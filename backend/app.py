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
                    except:
                        # Send keepalive
                        yield f"data: {json.dumps({'type': 'keepalive'})}\n\n"
            finally:
                # Cleanup
                if meeting_id in sse_connections:
                    sse_connections[meeting_id].remove(q)
                    if not sse_connections[meeting_id]:
                        del sse_connections[meeting_id]
        
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
            mermaidDiagram (str): The mermaid diagram code
        
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
        mermaid_diagram = data.get('mermaidDiagram', '').strip()
        
        if not title:
            return jsonify({'error': 'title is required'}), 400
        
        if not mermaid_diagram:
            return jsonify({'error': 'mermaidDiagram is required'}), 400
        
        # Validate mermaid syntax
        is_valid, error_msg = validate_mermaid_syntax(mermaid_diagram)
        if not is_valid:
            return jsonify({'error': f'Invalid mermaid syntax: {error_msg}'}), 400
        
        # Get current workflows
        latest_state = db.get_latest_state_version(meeting_id)
        if not latest_state:
            return jsonify({'error': 'No state found for meeting'}), 404
        
        # Create new workflow
        new_workflow = Workflow(
            id=str(uuid.uuid4()),
            title=title,
            mermaidDiagram=mermaid_diagram,
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
            'workflow': new_workflow.model_dump()
        }), 201

    @app.route('/meeting/<meeting_id>/workflow/<workflow_id>', methods=['PATCH'])
    def update_workflow(meeting_id: str, workflow_id: str):
        """
        Update a workflow for a finalized meeting.
        
        Request Body:
            title (str, optional): New title
            mermaidDiagram (str, optional): New mermaid diagram code
        
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
        
        if 'mermaidDiagram' in data:
            new_diagram = data['mermaidDiagram'].strip()
            if not new_diagram:
                return jsonify({'error': 'mermaidDiagram cannot be empty'}), 400
            
            # Validate mermaid syntax
            is_valid, error_msg = validate_mermaid_syntax(new_diagram)
            if not is_valid:
                return jsonify({'error': f'Invalid mermaid syntax: {error_msg}'}), 400
            
            workflow.mermaidDiagram = new_diagram
        
        # Update in database
        workflows[workflow_index] = workflow
        updated_state = db.update_latest_state_workflows(meeting_id, workflows)
        if not updated_state:
            return jsonify({'error': 'Failed to update workflow'}), 500
        
        return jsonify({
            'workflow': workflow.model_dump()
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
    
    # Update meeting status to finalized
    db.update_meeting_status(meeting_id, Status.finalized)
    
    # Notify processing complete
    broadcast_to_meeting(meeting_id, {
        'type': 'processing_complete',
        'totalChunks': total_chunks
    })
    
    # Close SSE connections for this meeting
    if meeting_id in sse_connections:
        for q in sse_connections[meeting_id]:
            q.put(None)


# ==================== HELPER FUNCTIONS ====================

def validate_mermaid_syntax(diagram: str) -> tuple[bool, str | None]:
    """
    Validate basic mermaid flowchart syntax.
    
    Args:
        diagram: The mermaid diagram string
    
    Returns:
        Tuple of (is_valid, error_message)
        error_message is None if valid
    """
    if not diagram or not diagram.strip():
        return False, "Diagram cannot be empty"
    
    lines = diagram.strip().split('\n')
    first_line = lines[0].strip().lower()
    
    # Must start with a valid diagram type
    valid_starts = ['flowchart td', 'flowchart tb', 'flowchart lr', 'flowchart rl', 
                    'flowchart bt', 'graph td', 'graph tb', 'graph lr', 'graph rl']
    if not any(first_line.startswith(start) for start in valid_starts):
        return False, "Diagram must start with 'flowchart TD' or similar direction (TD, TB, LR, RL, BT)"
    
    # Check for common syntax errors
    for i, line in enumerate(lines[1:], start=2):
        line = line.strip()
        if not line:
            continue
        
        # Skip subgraph and end keywords
        if line.lower().startswith('subgraph') or line.lower() == 'end':
            continue
        
        # Skip comments
        if line.startswith('%%'):
            continue
        
        # Check for markdown code fence (common mistake)
        if line.startswith('```'):
            return False, f"Line {i}: Remove markdown code fences (```). Just use raw mermaid syntax"
        
        # Check for invalid arrow syntax
        if '->' in line and '-->' not in line and '-.>' not in line:
            if '->>' not in line and '-.->' not in line:
                return False, f"Line {i}: Use '-->' for arrows, not '->'"
        
        # Check for node definitions without IDs (common mistake)
        # e.g., "[Start]" instead of "A[Start]"
        if re.match(r'^\s*\[[^\]]+\]\s*-->', line):
            return False, f"Line {i}: Nodes need IDs before brackets. Use 'A[Label]' not '[Label]'"
        
        # Check for spaces in node IDs (before brackets)
        node_match = re.match(r'^\s*([a-zA-Z0-9_\s]+)\[', line)
        if node_match:
            node_id = node_match.group(1).strip()
            if ' ' in node_id:
                return False, f"Line {i}: Node ID '{node_id}' cannot contain spaces. Use underscores instead"
    
    return True, None


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
    Breaks a transcript string into chunks of 2-3 sentences.
    
    Args:
        transcript: The full transcript string to chunk
    
    Returns:
        List of chunks, each containing 2-3 sentences
    """
    # Split by sentence-ending punctuation while keeping the punctuation
    # This regex splits on . ! or ? followed by whitespace or end of string
    sentence_pattern = r'(?<=[.!?])\s+'
    sentences = re.split(sentence_pattern, transcript.strip())
    
    # Filter out empty strings
    sentences = [s.strip() for s in sentences if s.strip()]
    
    chunks = []
    i = 0
    
    while i < len(sentences):
        # Take 2-3 sentences per chunk
        # Prefer 3 sentences, but take 2 if that's what's left
        if i + 3 <= len(sentences):
            chunk = ' '.join(sentences[i:i+3])
            i += 3
        elif i + 2 <= len(sentences):
            chunk = ' '.join(sentences[i:i+2])
            i += 2
        else:
            # Only one sentence left
            chunk = sentences[i]
            i += 1
        
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
    system_prompt = """You are an AI assistant that processes meeting transcripts to extract insights.
    Your job is to:
    1. Update the meeting summary with key points from the new chunk (as bullet points)
    2. Identify any workflows or processes mentioned and create/update Mermaid diagrams for them

    You will receive the current state and a new chunk of transcript.
    Return an updated state in the exact JSON format specified.

    MEETING SUMMARY RULES:
    - Format the summary as bullet points (use "• " prefix for each point)
    - Each bullet should be a concise, standalone insight
    - Add new bullets for new information, don't repeat existing points
    - If the chunk contains meta-commentary, critiques, or instructions about the output (not actual meeting content), DO NOT add it to the summary

    WORKFLOW RULES:
    - Be VERY conservative about creating new workflows - only create when absolutely necessary
    - Prefer updating/expanding existing workflows over creating new ones
    - If two workflows cover similar or overlapping processes, MERGE them into one
    - Only create a new workflow if the chunk describes a genuinely distinct, separate process
    - Each workflow must have a unique id (UUID format), descriptive title, valid Mermaid diagram, and sources array
    - Track which chunks contributed to each workflow in the sources array
    - When merging workflows, combine their sources arrays and keep the most descriptive title

    *** CRITICAL MERMAID DIAGRAM SYNTAX RULES ***
    You MUST follow these rules EXACTLY or the diagram will fail to render:

    1. ALWAYS start with: flowchart TD
    2. Node IDs must be alphanumeric only (A-Z, a-z, 0-9, underscores). NO spaces, NO special characters in IDs.
       GOOD: A, Step1, user_input, validateData
       BAD: step 1, user-input, step.one
    
    3. Node labels go in brackets/parentheses AFTER the ID:
       GOOD: A[Start Process] --> B[Do Something]
       BAD: [Start Process] --> [Do Something]
    
    4. ESCAPE special characters in labels by wrapping the ENTIRE label in double quotes:
       GOOD: A["Process (with parens)"] --> B["Check: is valid?"]
       BAD: A[Process (with parens)] --> B[Check: is valid?]
    
    5. Characters that REQUIRE quoted labels: ( ) [ ] { } : ; | # & < > 
    
    6. Use simple arrow syntax:
       GOOD: A --> B, A --> |Yes| B, A -.-> B (dotted), A ==> B (thick)
       BAD: A->B, A-->>B, A --> --> B
    
    7. Edge labels go in pipes: A --> |label text| B
       GOOD: A --> |Yes| B --> |No| C
       BAD: A --> "Yes" B
    
    8. Each connection on its own line for readability:
       GOOD:
         flowchart TD
             A[Start] --> B[Process]
             B --> C[End]
       
    9. Subgraphs syntax:
       GOOD:
         subgraph Title
             A --> B
         end
       BAD:
         subgraph "Title"
         subgraph Title {

    10. NO markdown code fences (```mermaid) - just the raw diagram starting with "flowchart TD"

    11. Keep diagrams simple - max 10-15 nodes. Split complex processes.

    12. Valid node shapes:
        [Text] = rectangle
        (Text) = rounded rectangle  
        {Text} = diamond/decision
        [[Text]] = subroutine
        [(Text)] = cylinder
        ((Text)) = circle

    EXAMPLE VALID DIAGRAM:
    flowchart TD
        A[Start] --> B{Valid?}
        B --> |Yes| C[Process Data]
        B --> |No| D[Show Error]
        C --> E["Save to DB (async)"]
        D --> F[End]
        E --> F

    HANDLING INSTRUCTIONAL/CRITIQUE CONTENT:
    - If the chunk contains instructions, critiques, or feedback about the diagrams/workflows themselves (not meeting content):
      - DO NOT update the meeting summary
      - DO apply the feedback to modify/improve the workflows accordingly
      - This includes things like "make this more detailed", "combine these steps", etc.

    CRITICAL - NEVER DELETE CONTENT:
    - NEVER return an empty meetingSummary if there was content before
    - NEVER return an empty workflows array if there were workflows before
    - Always preserve and build upon existing content
    - If a chunk doesn't add new information, return the existing state unchanged
    - Short conversational chunks like "Great, thanks!" should NOT cause any content to be removed"""

    # Prepare current state for prompt (exclude chunk metadata)
    state_for_prompt = {
        'meetingSummary': current_state_data.meetingSummary,
        'workflows': [w.model_dump() for w in current_state_data.workflows] if current_state_data.workflows else []
    }

    user_prompt = f"""Current State:
    {json.dumps(state_for_prompt, indent=2)}

    New Chunk (index {chunk_index}):
    "{chunk}"

    Please analyze this chunk and return an updated state. The response must be valid JSON with this exact structure:
    {{
        "meetingSummary": "• First key point\\n• Second key point\\n• Third key point",
        "workflows": [
            {{
                "id": "uuid-string",
                "title": "Descriptive workflow title",
                "mermaidDiagram": "flowchart TD\\n    A[Start] --> B{{Decision}}\\n    B --> |Yes| C[Process]\\n    B --> |No| D[\\"Handle Error (retry)\\"]\\n    C --> E[End]\\n    D --> E",
                "sources": ["chunk_0", "chunk_1"]
            }}
        ]
    }}

    CRITICAL MERMAID RULES - FOLLOW EXACTLY:
    1. Start with "flowchart TD" (no code fences, no ```mermaid)
    2. Node IDs = alphanumeric only (A, Step1, userInput) - NO spaces/hyphens in IDs
    3. Labels in brackets: A[Label Here] NOT [Label Here]
    4. Special chars in labels? Use quotes: A["Has (parens) or: colons"]
    5. Edge labels in pipes: A --> |Yes| B
    6. One connection per line
    7. Decision nodes use curly braces: B{{Is Valid?}}

    Remember:
    - meetingSummary should be bullet points (• prefix), not paragraphs
    - Only create new workflows when absolutely necessary, prefer updating existing ones
    - Merge similar/overlapping workflows
    - If this chunk is instructional/critique content, only modify workflows, not the summary
    - VALIDATE your mermaid syntax before returning!

    Return ONLY the JSON object, no additional text."""

    try:
        response = client.chat.completions.create(
            model=os.getenv('OPENAI_MODEL', 'gpt-5.2'),
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.3,
            response_format={"type": "json_object"}
        )
        
        result = json.loads(response.choices[0].message.content)
        
        # Parse workflows into Workflow models, ensuring required fields
        workflows = []
        for wf_data in result.get('workflows', []):
            workflow = Workflow(
                id=wf_data.get('id', str(uuid.uuid4())),
                title=wf_data.get('title', 'Untitled Workflow'),
                mermaidDiagram=wf_data.get('mermaidDiagram', ''),
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
