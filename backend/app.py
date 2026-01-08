import os
import re
import json
import uuid
import threading
from flask import Flask, request, jsonify
from flask_cors import CORS
from openai import OpenAI
from pydantic import ValidationError
from models import (
    Workflow,
    CurrentState,
    CurrentStateVersion,
    Meeting,
    ProcessRequest,
    ProcessResponse,
    SocketEvent,
)
from models.meeting_schema import Status
from models.currentStateVersion_schema import Data as CurrentStateData
from models.workflow_schema import Node, Edge, Type as NodeType, Variant as NodeVariant
from prompts.chunk_processing import CHUNK_PROCESSING_SYSTEM_PROMPT, get_chunk_processing_user_prompt
from dotenv import load_dotenv
from pathlib import Path
import database as db

# Load .env from project root
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

# Initialize OpenAI client
client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))

# Store for SSE connections (meeting_id -> list of queues)
sse_connections: dict[str, list] = {}


def create_app():
    """Application factory."""
    app = Flask(__name__)
    
    # Enable CORS for frontend
    app_url = os.getenv('APP_URL', 'http://localhost:5173')
    CORS(app, origins=[app_url])

    # Register routes
    register_routes(app)

    return app


def register_routes(app):
    """Register all API routes."""

    # ==================== ORG ENDPOINTS ====================

    @app.route('/org', methods=['GET'])
    def get_current_org():
        """
        Get the current user's organization.
        For now, returns the first org found in the database.
        
        Returns:
            orgId (str): The organization ID
        """
        orgs = db.get_all_orgs()
        if not orgs:
            return jsonify({'error': 'No organizations found'}), 404
        
        # For now, just return the first org
        return jsonify({'orgId': orgs[0]}), 200

    @app.route('/orgs', methods=['GET'])
    def get_all_orgs():
        """
        Get all organizations.
        
        Returns:
            orgs (list): List of organization IDs
        """
        orgs = db.get_all_orgs()
        return jsonify({'orgs': orgs}), 200

    # ==================== MEETING ENDPOINTS ====================

    @app.route('/meetings', methods=['GET'])
    def get_meetings_by_org():
        """
        Get all meetings for an organization.
        
        Query Parameters:
            orgId (str): The organization ID
        
        Returns:
            meetings (list): List of meetings for the org
        """
        org_id = request.args.get('orgId')
        
        if not org_id:
            return jsonify({'error': 'orgId is required'}), 400
        
        meetings = db.get_meetings_by_org(org_id)
        return jsonify({
            'meetings': [m.model_dump(mode='json') for m in meetings]
        }), 200

    @app.route('/meeting', methods=['POST'])
    def create_meeting():
        """
        Create a new meeting with an optional transcript.
        
        Request Body:
            orgId (str): The organization ID
            transcript (str, optional): The full transcript to process
        
        Returns:
            meetingId (uuid): The unique identifier for the meeting
            currentStateId (uuid): The unique identifier for the initial state
            totalChunks (int): Number of chunks if transcript provided
        """
        meeting_id = str(uuid.uuid4())
        current_state_id = str(uuid.uuid4())
        data = request.get_json() or {}
        org_id = data.get('orgId', 'default')
        transcript = data.get('transcript')

        # Chunk the transcript if provided
        chunks = []
        total_chunks = 0
        if transcript:
            chunks = chunk_transcript(transcript)
            total_chunks = len(chunks)

        # Create meeting using Pydantic model
        status = Status.active
        meeting = Meeting(
            meetingId=meeting_id,
            status=status,
            orgId=org_id,
            transcript=transcript,
            totalChunks=total_chunks if total_chunks > 0 else None
        )
        db.create_meeting(meeting)

        # Create initial current state version using Pydantic model
        initial_state_data = get_initial_state()
        state_version = CurrentStateVersion(
            version=0,
            currentStateId=current_state_id,
            data=initial_state_data
        )
        db.add_state_version(meeting_id, state_version)

        response_data = {
            'meetingId': meeting_id,
            'currentStateId': current_state_id,
        }
        
        if total_chunks > 0:
            response_data['totalChunks'] = total_chunks
            
            # Start background processing automatically
            def process_in_background():
                process_transcript_chunks(meeting_id, chunks)
            
            thread = threading.Thread(target=process_in_background, daemon=True)
            thread.start()

        return jsonify(response_data), 201

    @app.route('/meeting', methods=['GET'])
    def get_meeting():
        """
        Get the current state version for a meeting.
        
        Query Parameters:
            meetingId (uuid): The meeting ID to fetch state for
            version (int, optional): Specific version to fetch (defaults to latest)
        
        Returns:
            The meeting info and requested state version
        """
        meeting_id = request.args.get('meetingId')
        version = request.args.get('version', type=int)

        if not meeting_id:
            return jsonify({'error': 'meetingId is required'}), 400

        # Find the meeting
        meeting = db.get_meeting(meeting_id)
        if not meeting:
            return jsonify({'error': 'Meeting not found'}), 404

        # Get requested state version
        if version is not None:
            state = db.get_state_version(meeting_id, version)
            if not state:
                return jsonify({'error': f'Version {version} not found'}), 404
        else:
            state = db.get_latest_state_version(meeting_id)
            if not state:
                return jsonify({'error': 'No state found for meeting'}), 404

        return jsonify({
            'meeting': meeting.model_dump(mode='json'),
            'currentState': state.model_dump(mode='json')
        }), 200

    @app.route('/meeting/<meeting_id>/versions', methods=['GET'])
    def get_meeting_versions(meeting_id: str):
        """
        Get all state versions for a meeting (for sidebar navigation).
        
        Returns:
            versions (list): List of version metadata (version number, chunkIndex, chunkText preview)
        """
        meeting = db.get_meeting(meeting_id)
        if not meeting:
            return jsonify({'error': 'Meeting not found'}), 404
        
        versions = db.get_all_state_versions(meeting_id)
        
        # Return lightweight version info for sidebar
        version_info = []
        for v in versions:
            info = {
                'version': v.version,
                'currentStateId': v.currentStateId,
            }
            if v.data.chunkIndex is not None:
                info['chunkIndex'] = v.data.chunkIndex
            if v.data.chunkText:
                # Truncate chunk text for preview
                info['chunkText'] = v.data.chunkText[:100] + ('...' if len(v.data.chunkText) > 100 else '')
            version_info.append(info)
        
        return jsonify({
            'meeting': meeting.model_dump(mode='json'),
            'versions': version_info,
            'totalVersions': len(versions)
        }), 200

    @app.route('/meeting/<meeting_id>/process', methods=['POST'])
    def process_meeting_transcript(meeting_id: str):
        """
        Process the meeting's transcript chunk by chunk.
        This runs synchronously for simplicity but returns updates via SSE.
        
        Returns immediately with status, processing happens in background.
        """
        meeting = db.get_meeting(meeting_id)
        if not meeting:
            return jsonify({'error': 'Meeting not found'}), 404
        
        if not meeting.transcript:
            return jsonify({'error': 'Meeting has no transcript'}), 400
        
        if meeting.status == Status.finalized:
            return jsonify({'error': 'Meeting has been finalized'}), 400
        
        # Chunk the transcript
        chunks = chunk_transcript(meeting.transcript)
        
        # Start background processing
        def process_in_background():
            process_transcript_chunks(meeting_id, chunks)
        
        thread = threading.Thread(target=process_in_background, daemon=True)
        thread.start()
        
        return jsonify({
            'status': 'processing',
            'totalChunks': len(chunks),
            'message': 'Processing started. Connect to SSE endpoint for updates.'
        }), 202

    @app.route('/meeting/<meeting_id>/stream')
    def stream_meeting_updates(meeting_id: str):
        """
        Server-Sent Events endpoint for real-time updates during processing.
        """
        from queue import Queue
        
        def generate():
            from queue import Empty
            # Create a queue for this connection
            q = Queue()
            
            # Register this connection
            if meeting_id not in sse_connections:
                sse_connections[meeting_id] = []
            sse_connections[meeting_id].append(q)
            
            try:
                # Send initial connection message
                yield f"data: {json.dumps({'type': 'connected', 'meetingId': meeting_id})}\n\n"
                
                # Keep connection alive and send updates
                while True:
                    try:
                        # Wait for updates (with timeout for keepalive)
                        message = q.get(timeout=30)
                        if message is None:
                            break
                        yield f"data: {json.dumps(message)}\n\n"
                    except Empty:
                        # Send keepalive on timeout
                        yield f"data: {json.dumps({'type': 'keepalive'})}\n\n"
            except GeneratorExit:
                # Client disconnected - exit gracefully
                pass
            finally:
                # Cleanup
                if meeting_id in sse_connections:
                    try:
                        sse_connections[meeting_id].remove(q)
                        if not sse_connections[meeting_id]:
                            del sse_connections[meeting_id]
                    except (ValueError, KeyError):
                        pass
        
        return app.response_class(
            generate(),
            mimetype='text/event-stream',
            headers={
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'X-Accel-Buffering': 'no'
            }
        )

    # ==================== WORKFLOW ENDPOINTS ====================

    @app.route('/meeting/<meeting_id>/workflow', methods=['POST'])
    def create_workflow(meeting_id: str):
        """
        Create a new workflow for a finalized meeting.
        
        Request Body:
            title (str): The workflow title
            nodes (list): Array of node objects with id, type, label, variant
            edges (list): Array of edge objects with id, source, target, label
        
        Returns:
            The created workflow
        """
        meeting = db.get_meeting(meeting_id)
        if not meeting:
            return jsonify({'error': 'Meeting not found'}), 404
        
        if meeting.status != Status.finalized:
            return jsonify({'error': 'Workflows can only be created for finalized meetings'}), 400
        
        data = request.get_json()
        if not data:
            return jsonify({'error': 'Request body is required'}), 400
        
        title = data.get('title', '').strip()
        nodes_data = data.get('nodes', [])
        edges_data = data.get('edges', [])
        
        if not title:
            return jsonify({'error': 'title is required'}), 400
        
        if not nodes_data:
            return jsonify({'error': 'nodes array is required'}), 400
        
        # Parse nodes
        nodes = []
        for node_data in nodes_data:
            node = Node(
                id=node_data.get('id', f'n{len(nodes)}'),
                type=NodeType(node_data.get('type', 'process')),
                label=node_data.get('label', 'Untitled'),
                variant=NodeVariant(node_data['variant']) if node_data.get('variant') else None
            )
            nodes.append(node)
        
        # Parse edges
        edges = []
        for edge_data in edges_data:
            edge = Edge(
                id=edge_data.get('id', f'e{len(edges)}'),
                source=edge_data.get('source', ''),
                target=edge_data.get('target', ''),
                label=edge_data.get('label')
            )
            edges.append(edge)
        
        # Get current workflows
        latest_state = db.get_latest_state_version(meeting_id)
        if not latest_state:
            return jsonify({'error': 'No state found for meeting'}), 404
        
        # Create new workflow
        new_workflow = Workflow(
            id=str(uuid.uuid4()),
            title=title,
            nodes=nodes,
            edges=edges,
            sources=['user_created']
        )
        
        # Add to workflows list
        workflows = list(latest_state.data.workflows) if latest_state.data.workflows else []
        workflows.append(new_workflow)
        
        # Update in database
        updated_state = db.update_latest_state_workflows(meeting_id, workflows)
        if not updated_state:
            return jsonify({'error': 'Failed to update workflows'}), 500
        
        return jsonify({
            'workflow': new_workflow.model_dump(mode='json')
        }), 201

    @app.route('/meeting/<meeting_id>/workflow/<workflow_id>', methods=['PATCH'])
    def update_workflow(meeting_id: str, workflow_id: str):
        """
        Update a workflow for a finalized meeting.
        
        Request Body:
            title (str, optional): New title
            nodes (list, optional): New nodes array
            edges (list, optional): New edges array
        
        Returns:
            The updated workflow
        """
        meeting = db.get_meeting(meeting_id)
        if not meeting:
            return jsonify({'error': 'Meeting not found'}), 404
        
        if meeting.status != Status.finalized:
            return jsonify({'error': 'Workflows can only be edited for finalized meetings'}), 400
        
        data = request.get_json()
        if not data:
            return jsonify({'error': 'Request body is required'}), 400
        
        # Get current workflows
        latest_state = db.get_latest_state_version(meeting_id)
        if not latest_state:
            return jsonify({'error': 'No state found for meeting'}), 404
        
        # Find the workflow to update
        workflows = list(latest_state.data.workflows) if latest_state.data.workflows else []
        workflow_index = next((i for i, w in enumerate(workflows) if w.id == workflow_id), None)
        
        if workflow_index is None:
            return jsonify({'error': 'Workflow not found'}), 404
        
        workflow = workflows[workflow_index]
        
        # Update fields if provided
        if 'title' in data:
            new_title = data['title'].strip()
            if not new_title:
                return jsonify({'error': 'title cannot be empty'}), 400
            workflow.title = new_title
        
        if 'nodes' in data:
            nodes_data = data['nodes']
            if not nodes_data:
                return jsonify({'error': 'nodes cannot be empty'}), 400
            
            # Parse nodes
            nodes = []
            for node_data in nodes_data:
                node = Node(
                    id=node_data.get('id', f'n{len(nodes)}'),
                    type=NodeType(node_data.get('type', 'process')),
                    label=node_data.get('label', 'Untitled'),
                    variant=NodeVariant(node_data['variant']) if node_data.get('variant') else None
                )
                nodes.append(node)
            workflow.nodes = nodes
        
        if 'edges' in data:
            edges_data = data['edges']
            # Edges can be empty (no connections)
            edges = []
            for edge_data in edges_data:
                edge = Edge(
                    id=edge_data.get('id', f'e{len(edges)}'),
                    source=edge_data.get('source', ''),
                    target=edge_data.get('target', ''),
                    label=edge_data.get('label')
                )
                edges.append(edge)
            workflow.edges = edges
        
        # Update in database
        workflows[workflow_index] = workflow
        updated_state = db.update_latest_state_workflows(meeting_id, workflows)
        if not updated_state:
            return jsonify({'error': 'Failed to update workflow'}), 500
        
        return jsonify({
            'workflow': workflow.model_dump(mode='json')
        }), 200

    @app.route('/meeting/<meeting_id>/workflow/<workflow_id>', methods=['DELETE'])
    def delete_workflow(meeting_id: str, workflow_id: str):
        """
        Delete a workflow from a finalized meeting.
        
        Returns:
            Success status
        """
        meeting = db.get_meeting(meeting_id)
        if not meeting:
            return jsonify({'error': 'Meeting not found'}), 404
        
        if meeting.status != Status.finalized:
            return jsonify({'error': 'Workflows can only be deleted from finalized meetings'}), 400
        
        # Get current workflows
        latest_state = db.get_latest_state_version(meeting_id)
        if not latest_state:
            return jsonify({'error': 'No state found for meeting'}), 404
        
        # Find and remove the workflow
        workflows = list(latest_state.data.workflows) if latest_state.data.workflows else []
        original_count = len(workflows)
        workflows = [w for w in workflows if w.id != workflow_id]
        
        if len(workflows) == original_count:
            return jsonify({'error': 'Workflow not found'}), 404
        
        # Update in database
        updated_state = db.update_latest_state_workflows(meeting_id, workflows)
        if not updated_state:
            return jsonify({'error': 'Failed to delete workflow'}), 500
        
        return jsonify({
            'success': True,
            'deletedWorkflowId': workflow_id
        }), 200

    # ==================== MEETING SUMMARY ENDPOINT ====================

    @app.route('/meeting/<meeting_id>/summary', methods=['PATCH'])
    def update_meeting_summary(meeting_id: str):
        """
        Update the meeting summary for a finalized meeting.
        
        Request Body:
            meetingSummary (str): The new meeting summary text
        
        Returns:
            Success status and updated summary
        """
        meeting = db.get_meeting(meeting_id)
        if not meeting:
            return jsonify({'error': 'Meeting not found'}), 404
        
        if meeting.status != Status.finalized:
            return jsonify({'error': 'Summary can only be updated for finalized meetings'}), 400
        
        data = request.get_json()
        if not data or 'meetingSummary' not in data:
            return jsonify({'error': 'meetingSummary is required'}), 400
        
        new_summary = data['meetingSummary']
        if not isinstance(new_summary, str):
            return jsonify({'error': 'meetingSummary must be a string'}), 400
        
        # Update in database
        updated_state = db.update_latest_state_summary(meeting_id, new_summary)
        if not updated_state:
            return jsonify({'error': 'Failed to update summary'}), 500
        
        return jsonify({
            'success': True,
            'meetingSummary': new_summary
        }), 200

    # ==================== CHAT ENDPOINT ====================

    @app.route('/meeting/<meeting_id>/chat', methods=['POST'])
    def chat_with_meeting(meeting_id: str):
        """
        Chat with an LLM that has context about the meeting.
        
        Request Body:
            message (str): The user's message
            history (list, optional): Previous conversation history
        
        Returns:
            message (str): The assistant's response
            action (object, optional): Any action to perform (update workflow, summary)
        """
        meeting = db.get_meeting(meeting_id)
        if not meeting:
            return jsonify({'error': 'Meeting not found'}), 404
        
        data = request.get_json()
        if not data or 'message' not in data:
            return jsonify({'error': 'message is required'}), 400
        
        user_message = data['message']
        history = data.get('history', [])
        
        # Get current meeting state
        latest_state = db.get_latest_state_version(meeting_id)
        if not latest_state:
            return jsonify({'error': 'No state found for meeting'}), 404
        
        # Process the chat message with LLM
        response = process_chat_message(
            user_message=user_message,
            history=history,
            meeting_summary=latest_state.data.meetingSummary,
            workflows=latest_state.data.workflows,
            meeting_id=meeting_id
        )
        
        # If there's an action, apply it
        if response.get('action'):
            action = response['action']
            if action['type'] == 'update_workflow' and action.get('workflowId'):
                # Find and update the workflow
                workflows = list(latest_state.data.workflows) if latest_state.data.workflows else []
                for i, w in enumerate(workflows):
                    if w.id == action['workflowId']:
                        # Parse nodes
                        nodes = []
                        for node_data in action.get('nodes', []):
                            node = Node(
                                id=node_data.get('id', f'n{len(nodes)}'),
                                type=NodeType(node_data.get('type', 'process')),
                                label=node_data.get('label', 'Untitled'),
                                variant=NodeVariant(node_data['variant']) if node_data.get('variant') else None
                            )
                            nodes.append(node)
                        
                        # Parse edges
                        edges = []
                        for edge_data in action.get('edges', []):
                            edge = Edge(
                                id=edge_data.get('id', f'e{len(edges)}'),
                                source=edge_data.get('source', ''),
                                target=edge_data.get('target', ''),
                                label=edge_data.get('label')
                            )
                            edges.append(edge)
                        
                        workflows[i].nodes = nodes
                        workflows[i].edges = edges
                        break
                
                db.update_latest_state_workflows(meeting_id, workflows)
            
            elif action['type'] == 'update_summary' and action.get('newSummary'):
                db.update_latest_state_summary(meeting_id, action['newSummary'])
        
        return jsonify(response), 200

    # ==================== PROCESS ENDPOINT ====================

    @app.route('/process', methods=['POST'])
    def process_chunk():
        """
        Process a chunk of data for a meeting.
        
        Gets the latest current state from store, performs LLM processing,
        and stores a new version of the state.
        
        Request Body:
            chunk (str): The text chunk to process
            meetingId (uuid): The meeting ID
        
        Returns:
            The new current state after processing
        """
        data = request.get_json()

        if not data:
            return jsonify({'error': 'Request body is required'}), 400

        # Validate request using Pydantic model
        try:
            process_request = ProcessRequest(**data)
        except ValidationError as e:
            return jsonify({'error': str(e)}), 400

        chunk = process_request.chunk
        meeting_id = process_request.meetingId

        # Find the meeting
        meeting = db.get_meeting(meeting_id)
        if not meeting:
            return jsonify({'error': 'Meeting not found'}), 404

        if meeting.status == Status.finalized:
            return jsonify({'error': 'Meeting has been finalized'}), 400

        # Get latest current state
        latest_state = db.get_latest_state_version(meeting_id)
        if not latest_state:
            return jsonify({'error': 'No state found for meeting'}), 404

        current_state_data = latest_state.data

        # Process with LLM
        new_state_data = process_with_llm(current_state_data, chunk, latest_state.version)

        # Create new state version using Pydantic model
        new_current_state_id = str(uuid.uuid4())
        new_state_version = CurrentStateVersion(
            version=latest_state.version + 1,
            currentStateId=new_current_state_id,
            data=new_state_data
        )
        db.add_state_version(meeting_id, new_state_version)

        return jsonify({
            'currentState': new_state_version.model_dump(mode='json'),
            'previousVersion': latest_state.version,
            'newVersion': new_state_version.version
        }), 200


def broadcast_to_meeting(meeting_id: str, message: dict):
    """Broadcast a message to all SSE connections for a meeting."""
    if meeting_id in sse_connections:
        for q in sse_connections[meeting_id]:
            q.put(message)


def process_transcript_chunks(meeting_id: str, chunks: list[str]):
    """
    Process all chunks for a meeting sequentially.
    Broadcasts updates via SSE after each chunk.
    """
    total_chunks = len(chunks)
    
    # Notify processing started
    broadcast_to_meeting(meeting_id, {
        'type': 'processing_started',
        'totalChunks': total_chunks
    })
    
    for i, chunk in enumerate(chunks):
        # Get latest state
        latest_state = db.get_latest_state_version(meeting_id)
        if not latest_state:
            break
        
        # Process with LLM
        new_state_data = process_with_llm(latest_state.data, chunk, latest_state.version, i, chunk)
        
        # Create new version
        new_current_state_id = str(uuid.uuid4())
        new_state_version = CurrentStateVersion(
            version=latest_state.version + 1,
            currentStateId=new_current_state_id,
            data=new_state_data
        )
        db.add_state_version(meeting_id, new_state_version)
        
        # Broadcast update
        broadcast_to_meeting(meeting_id, {
            'type': 'chunk_processed',
            'chunkIndex': i,
            'totalChunks': total_chunks,
            'version': new_state_version.version,
            'currentState': new_state_version.model_dump(mode='json')
        })
    
    # Get the final state to generate title
    final_state = db.get_latest_state_version(meeting_id)
    meeting = db.get_meeting(meeting_id)
    
    # Generate meeting title using LLM
    meeting_summary = final_state.data.meetingSummary if final_state else ""
    transcript = meeting.transcript if meeting else ""
    title = generate_meeting_title(meeting_summary, transcript)
    
    # Update meeting with title
    db.update_meeting_title(meeting_id, title)
    
    # Update meeting status to finalized
    db.update_meeting_status(meeting_id, Status.finalized)
    
    # Notify processing complete with the generated title
    broadcast_to_meeting(meeting_id, {
        'type': 'processing_complete',
        'totalChunks': total_chunks,
        'title': title
    })
    
    # Close SSE connections for this meeting
    if meeting_id in sse_connections:
        for q in sse_connections[meeting_id]:
            q.put(None)


# ==================== HELPER FUNCTIONS ====================

def get_initial_state() -> CurrentStateData:
    """
    Returns the initial currentState data structure.
    
    Returns:
        CurrentStateData: Initial state data with empty meetingSummary and workflows
    """
    return CurrentStateData(
        meetingSummary="",
        workflows=[]
    )


def chunk_transcript(transcript: str) -> list[str]:
    """
    Breaks a transcript string into chunks of 10 sentences.
    
    Args:
        transcript: The full transcript string to chunk
    
    Returns:
        List of chunks, each containing 10 sentences (or fewer for the last chunk)
    """
    # Split by sentence-ending punctuation while keeping the punctuation
    # This regex splits on . ! or ? followed by whitespace or end of string
    sentence_pattern = r'(?<=[.!?])\s+'
    sentences = re.split(sentence_pattern, transcript.strip())
    
    # Filter out empty strings
    sentences = [s.strip() for s in sentences if s.strip()]
    
    chunks = []
    
    # Take 10 sentences per chunk
    for i in range(0, len(sentences), 10):
        chunk = ' '.join(sentences[i:i+10])
        chunks.append(chunk)
    
    return chunks


def pass_chunk(chunk: str, current_state_data: CurrentStateData, chunk_index: int = 0) -> CurrentStateData:
    """
    Passes a chunk and the currentState data as context to GPT.
    The model returns an updated version of the currentState data.
    
    Args:
        chunk: The text chunk to process
        current_state_data: The current state data containing meetingSummary and workflows
        chunk_index: The index of this chunk (for source tracking)
    
    Returns:
        CurrentStateData: Updated currentState data
    """
    # Prepare current state for prompt (exclude chunk metadata)
    state_for_prompt = {
        'meetingSummary': current_state_data.meetingSummary,
        'workflows': [w.model_dump(mode='json') for w in current_state_data.workflows] if current_state_data.workflows else []
    }

    user_prompt = get_chunk_processing_user_prompt(state_for_prompt, chunk, chunk_index)

    try:
        response = client.chat.completions.create(
            model=os.getenv('OPENAI_MODEL', 'gpt-5.2'),
            messages=[
                {"role": "system", "content": CHUNK_PROCESSING_SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.3,
            response_format={"type": "json_object"}
        )
        
        raw_content = response.choices[0].message.content
        
        # Try to parse JSON, fixing common LLM issues if needed
        import re
        try:
            result = json.loads(raw_content)
        except json.JSONDecodeError as e:
            # Fix invalid unicode escapes (e.g., \uXXXX where XXXX isn't valid hex)
            # Remove any \u that isn't followed by exactly 4 hex digits
            fixed_content = re.sub(r'\\u(?![0-9a-fA-F]{4})[0-9a-fA-F]{0,3}', '', raw_content)
            result = json.loads(fixed_content)
        
        # Parse workflows into Workflow models with nodes/edges
        workflows = []
        for wf_data in result.get('workflows', []):
            # Parse nodes
            nodes = []
            for node_data in wf_data.get('nodes', []):
                node = Node(
                    id=node_data.get('id', f'n{len(nodes)}'),
                    type=NodeType(node_data.get('type', 'process')),
                    label=node_data.get('label', 'Untitled'),
                    variant=NodeVariant(node_data['variant']) if node_data.get('variant') else None
                )
                nodes.append(node)
            
            # Parse edges
            edges = []
            for edge_data in wf_data.get('edges', []):
                edge = Edge(
                    id=edge_data.get('id', f'e{len(edges)}'),
                    source=edge_data.get('source', ''),
                    target=edge_data.get('target', ''),
                    label=edge_data.get('label')
                )
                edges.append(edge)
            
            workflow = Workflow(
                id=wf_data.get('id', str(uuid.uuid4())),
                title=wf_data.get('title', 'Untitled Workflow'),
                nodes=nodes,
                edges=edges,
                sources=wf_data.get('sources', [])
            )
            workflows.append(workflow)
        
        new_summary = result.get('meetingSummary', '')
        
        # Sanity check: don't accept a response that clears existing content
        # If we had content before and now it's empty, preserve the old state
        had_content = bool(current_state_data.meetingSummary) or bool(current_state_data.workflows)
        new_is_empty = not new_summary and not workflows
        
        if had_content and new_is_empty:
            print(f"Warning: LLM returned empty state, preserving previous state")
            return current_state_data.model_copy()
        
        # Also check for significant data loss (had workflows, now none)
        if current_state_data.workflows and not workflows:
            print(f"Warning: LLM cleared all workflows, preserving previous workflows")
            workflows = [w.model_copy() for w in current_state_data.workflows]
        
        # If summary was cleared but we had one, preserve it
        if current_state_data.meetingSummary and not new_summary:
            print(f"Warning: LLM cleared summary, preserving previous summary")
            new_summary = current_state_data.meetingSummary
        
        return CurrentStateData(
            meetingSummary=new_summary,
            workflows=workflows
        )
        
    except Exception as e:
        # On error, return current state unchanged
        print(f"Error in pass_chunk: {e}")
        return current_state_data.model_copy()


def process_with_llm(current_state_data: CurrentStateData, chunk: str, version: int = 0, chunk_index: int = None, chunk_text: str = None) -> CurrentStateData:
    """
    Process a chunk using LLM and update the state.
    
    Args:
        current_state_data: The current state data
        chunk: The new text chunk to process
        version: The current version number (for chunk index calculation)
        chunk_index: Optional explicit chunk index
        chunk_text: Optional chunk text to store in the version
    
    Returns:
        Updated CurrentStateData after processing
    """
    # Initialize state if empty
    if current_state_data is None:
        current_state_data = get_initial_state()
    
    # Calculate chunk index based on version if not provided
    if chunk_index is None:
        chunk_index = version
    
    # Process the chunk with GPT
    updated_state = pass_chunk(chunk, current_state_data, chunk_index)
    
    # Add chunk metadata to the state
    updated_state.chunkIndex = chunk_index
    updated_state.chunkText = chunk_text if chunk_text else chunk
    
    return updated_state


def process_chat_message(
    user_message: str,
    history: list,
    meeting_summary: str,
    workflows: list,
    meeting_id: str
) -> dict:
    """
    Process a chat message with the meeting context.
    
    Args:
        user_message: The user's message
        history: Previous conversation history
        meeting_summary: The current meeting summary
        workflows: List of workflows in the meeting
        meeting_id: The meeting ID for reference
    
    Returns:
        dict with 'message' (response) and optional 'action' (workflow/summary update)
    """
    # Build the context about the meeting
    workflows_context = []
    for wf in workflows:
        wf_dict = wf.model_dump(mode='json') if hasattr(wf, 'model_dump') else wf
        workflows_context.append({
            'id': wf_dict.get('id'),
            'title': wf_dict.get('title'),
            'nodes': wf_dict.get('nodes', []),
            'edges': wf_dict.get('edges', [])
        })
    
    system_prompt = f"""You are a helpful meeting assistant. You have access to the following meeting context:

## Meeting Summary
{meeting_summary if meeting_summary else "(No summary yet)"}

## Workflows
{json.dumps(workflows_context, indent=2) if workflows_context else "(No workflows yet)"}

You can help the user by:
1. **Summarizing** the meeting notes or specific parts
2. **Answering questions** about the meeting content
3. **Editing workflows** - adding, modifying, or removing steps

When the user asks you to edit a workflow, you should return a JSON action in your response.

IMPORTANT: Your response must be a valid JSON object with this structure:
{{
  "message": "Your response message to the user",
  "action": null OR {{
    "type": "update_workflow" | "update_summary",
    "workflowId": "id of workflow to update (for update_workflow)",
    "nodes": [...] (for update_workflow - full list of updated nodes),
    "edges": [...] (for update_workflow - full list of updated edges),
    "newSummary": "..." (for update_summary)
  }}
}}

Node structure: {{"id": "n1", "type": "process|decision|terminal", "label": "Step name", "variant": "start|end" (only for terminal type)}}
Edge structure: {{"id": "e1", "source": "n1", "target": "n2", "label": "optional label"}}

When editing workflows:
- Preserve existing node IDs when modifying (don't change IDs for unchanged nodes)
- Use descriptive labels
- Ensure edges connect valid nodes
- Terminal nodes with variant "start" should be at the beginning
- Terminal nodes with variant "end" should be at the end

Be conversational and helpful. If you're not performing an action, set action to null."""

    # Build messages for the API call
    messages = [{"role": "system", "content": system_prompt}]
    
    # Add conversation history
    for msg in history:
        messages.append({
            "role": msg.get("role", "user"),
            "content": msg.get("content", "")
        })
    
    # Add the current message
    messages.append({"role": "user", "content": user_message})
    
    try:
        response = client.chat.completions.create(
            model=os.getenv('OPENAI_MODEL', 'gpt-4o-mini'),
            messages=messages,
            temperature=0.7,
            response_format={"type": "json_object"}
        )
        
        raw_content = response.choices[0].message.content
        result = json.loads(raw_content)
        
        return {
            'message': result.get('message', 'I apologize, but I could not generate a response.'),
            'action': result.get('action')
        }
        
    except Exception as e:
        print(f"Error in process_chat_message: {e}")
        return {
            'message': f"I apologize, but I encountered an error processing your request. Please try again.",
            'action': None
        }


def generate_meeting_title(meeting_summary: str, transcript: str = None) -> str:
    """
    Generate a concise title for the meeting using the LLM.
    
    Args:
        meeting_summary: The processed meeting summary
        transcript: Optional original transcript for additional context
    
    Returns:
        A concise title for the meeting (max ~10 words)
    """
    # Use summary as primary source, fall back to transcript snippet
    context = meeting_summary if meeting_summary else (transcript[:2000] if transcript else "")
    
    if not context:
        return "Untitled Meeting"
    
    try:
        response = client.chat.completions.create(
            model=os.getenv('OPENAI_MODEL', 'gpt-4o-mini'),
            messages=[
                {
                    "role": "system",
                    "content": "You are a helpful assistant that generates concise, descriptive titles for meetings. Generate a title that captures the main topic or purpose of the meeting. The title should be 3-10 words, professional, and descriptive. Return ONLY the title, no quotes or extra formatting."
                },
                {
                    "role": "user",
                    "content": f"Generate a concise title for this meeting based on the following summary:\n\n{context}"
                }
            ],
            temperature=0.3,
            max_tokens=50
        )
        
        title = response.choices[0].message.content.strip()
        # Remove quotes if the model added them
        title = title.strip('"\'')
        return title if title else "Untitled Meeting"
        
    except Exception as e:
        print(f"Error generating meeting title: {e}")
        return "Untitled Meeting"


def process_full_transcript(transcript: str, verbose: bool = True) -> CurrentStateData:
    """
    Process a full transcript by chunking it and processing each chunk.
    
    Args:
        transcript: The full transcript string
        verbose: Whether to print progress updates
    
    Returns:
        Final CurrentStateData after processing all chunks
    """
    chunks = chunk_transcript(transcript)
    current_state_data = get_initial_state()
    
    if verbose:
        print(f"\n Transcript chunked into {len(chunks)} chunks\n")
        print("=" * 60)
    
    for i, chunk in enumerate(chunks):
        if verbose:
            print(f"\n Processing chunk {i + 1}/{len(chunks)}...")
            print(f"   Chunk: \"{chunk[:80]}{'...' if len(chunk) > 80 else ''}\"")
        
        current_state_data = pass_chunk(chunk, current_state_data, i)
        
        if verbose:
            print(f"   Processed chunk {i + 1}")
            print(f"   Summary length: {len(current_state_data.meetingSummary)} chars")
            print(f"   Workflows: {len(current_state_data.workflows)}")
    
    return current_state_data



# ==================== MAIN ====================

if __name__ == '__main__':
    app = create_app()
    host = os.getenv('HOST', '0.0.0.0')
    port = int(os.getenv('PORT', '5001'))
    app.run(host=host, port=port, debug=True, threaded=True)
