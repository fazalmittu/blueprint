import os
import re
import json
import uuid
from flask import Flask, request, jsonify
from openai import OpenAI
from pydantic import ValidationError
import httpx
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
import database as db

load_dotenv()

# WebSocket server URL for broadcasting updates
WEBSOCKET_SERVER_URL = os.getenv('WEBSOCKET_SERVER_URL', 'http://localhost:8000')

# Initialize OpenAI client
client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))


def create_app():
    """Application factory."""
    app = Flask(__name__)

    # Register routes
    register_routes(app)

    return app


def register_routes(app):
    """Register all API routes."""

    # ==================== MEETING ENDPOINTS ====================

    @app.route('/meeting', methods=['POST'])
    def create_meeting():
        """
        Create a new meeting with an initial current state.
        
        Returns:
            meetingId (uuid): The unique identifier for the meeting
            currentStateId (uuid): The unique identifier for the initial state
        """
        meeting_id = str(uuid.uuid4())
        current_state_id = str(uuid.uuid4())
        org_id = request.get_json().get('orgId', 'default') if request.get_json() else 'default'

        # Create meeting using Pydantic model
        meeting = Meeting(
            meetingId=meeting_id,
            status=Status.active,
            orgId=org_id
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

        return jsonify({
            'meetingId': meeting_id,
            'currentStateId': current_state_id
        }), 201

    @app.route('/meeting', methods=['GET'])
    def get_meeting():
        """
        Get the latest current state version for a meeting.
        
        Query Parameters:
            meetingId (uuid): The meeting ID to fetch state for
        
        Returns:
            The latest current state version
        """
        meeting_id = request.args.get('meetingId')

        if not meeting_id:
            return jsonify({'error': 'meetingId is required'}), 400

        # Find the meeting
        meeting = db.get_meeting(meeting_id)
        if not meeting:
            return jsonify({'error': 'Meeting not found'}), 404

        # Get latest current state
        latest_state = db.get_latest_state_version(meeting_id)
        if not latest_state:
            return jsonify({'error': 'No state found for meeting'}), 404

        return jsonify({
            'meeting': meeting.model_dump(mode='json'),
            'currentState': latest_state.model_dump(mode='json')
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

        # Broadcast the state update to all connected WebSocket clients
        broadcast_state_update(meeting_id, new_state_data)

        return jsonify({
            'currentState': new_state_version.model_dump(mode='json'),
            'previousVersion': latest_state.version,
            'newVersion': new_state_version.version
        }), 200


# ==================== WEBSOCKET BROADCAST ====================

def broadcast_state_update(meeting_id: str, state_data: CurrentStateData) -> bool:
    """
    Notify the WebSocket server to broadcast a state update to all connected clients.
    
    Args:
        meeting_id: The meeting ID to broadcast to
        state_data: The current state data to broadcast
    
    Returns:
        True if broadcast was successful, False otherwise
    """
    try:
        response = httpx.post(
            f"{WEBSOCKET_SERVER_URL}/broadcast/{meeting_id}",
            json={
                "type": "full_state",
                "state": state_data.model_dump(mode='json')
            },
            timeout=5.0
        )
        if response.status_code == 200:
            result = response.json()
            print(f"📡 Broadcast to {result.get('clients_notified', 0)} clients")
            return True
        else:
            print(f"⚠️ Broadcast failed: {response.status_code}")
            return False
    except httpx.ConnectError:
        print("⚠️ WebSocket server not available - skipping broadcast")
        return False
    except Exception as e:
        print(f"⚠️ Broadcast error: {e}")
        return False


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
    1. Update the meeting summary with key points from the new chunk
    2. Identify any workflows or processes mentioned and create/update Mermaid diagrams for them

    You will receive the current state and a new chunk of transcript.
    Return an updated state in the exact JSON format specified.

    For workflows:
    - Create a new workflow if a distinct process/workflow is described
    - Update existing workflows if the chunk adds to them
    - Each workflow must have a unique id (UUID format), descriptive title, valid Mermaid diagram, and sources array
    - Use valid Mermaid diagram syntax (flowchart TD format)
    - Track which chunks contributed to each workflow in the sources array

    Important:
    - Keep the meeting summary concise but comprehensive
    - Only create workflows for actual processes/procedures described
    - Each workflow should have a descriptive title and mermaid diagram"""

    user_prompt = f"""Current State:
    {json.dumps(current_state_data.model_dump(), indent=2)}

    New Chunk (index {chunk_index}):
    "{chunk}"

    Please analyze this chunk and return an updated state. The response must be valid JSON with this exact structure:
    {{
        "meetingSummary": "updated summary incorporating new information",
        "workflows": [
            {{
                "id": "uuid-string",
                "title": "Descriptive workflow title",
                "mermaidDiagram": "flowchart TD\\n    A[Start] --> B[Step]\\n    B --> C[End]",
                "sources": ["chunk_0", "chunk_1"]
            }}
        ]
    }}

    Return ONLY the JSON object, no additional text."""

    try:
        response = client.chat.completions.create(
            model="gpt-5.2",
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
        
        return CurrentStateData(
            meetingSummary=result.get('meetingSummary', ''),
            workflows=workflows
        )
        
    except Exception as e:
        # On error, return current state unchanged
        print(f"Error in pass_chunk: {e}")
        return current_state_data.model_copy()


def process_with_llm(current_state_data: CurrentStateData, chunk: str, version: int = 0) -> CurrentStateData:
    """
    Process a chunk using LLM and update the state.
    
    Args:
        current_state_data: The current state data
        chunk: The new text chunk to process
        version: The current version number (for chunk index calculation)
    
    Returns:
        Updated CurrentStateData after processing
    """
    # Initialize state if empty
    if current_state_data is None:
        current_state_data = get_initial_state()
    
    # Calculate chunk index based on version
    chunk_index = version
    
    # Process the chunk with GPT
    updated_state = pass_chunk(chunk, current_state_data, chunk_index)
    
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
        print(f"\n📝 Transcript chunked into {len(chunks)} chunks\n")
        print("=" * 60)
    
    for i, chunk in enumerate(chunks):
        if verbose:
            print(f"\n🔄 Processing chunk {i + 1}/{len(chunks)}...")
            print(f"   Chunk: \"{chunk[:80]}{'...' if len(chunk) > 80 else ''}\"")
        
        current_state_data = pass_chunk(chunk, current_state_data, i)
        
        if verbose:
            print(f"   ✅ Processed chunk {i + 1}")
            print(f"   📄 Summary length: {len(current_state_data.meetingSummary)} chars")
            print(f"   🔀 Workflows: {len(current_state_data.workflows)}")
    
    return current_state_data



# ==================== MAIN ====================

if __name__ == '__main__':
    app = create_app()
    app.run(host='0.0.0.0', port=5001, debug=True)
