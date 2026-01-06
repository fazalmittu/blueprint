import os
import re
import json
from flask import Flask, request, jsonify
from openai import OpenAI
from config import config, Config
from models import db, Meeting, CurrentState


# Initialize OpenAI client
client = OpenAI(api_key=Config.OPENAI_API_KEY)


def create_app(config_name=None):
    """Application factory."""
    if config_name is None:
        config_name = os.getenv('FLASK_ENV', 'development')

    app = Flask(__name__)
    app.config.from_object(config[config_name])

    # Initialize extensions
    db.init_app(app)

    # Create tables
    with app.app_context():
        db.create_all()

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
        # Create new meeting
        meeting = Meeting()
        db.session.add(meeting)
        db.session.flush()  # Get the meeting ID before creating state

        # Create initial current state
        current_state = CurrentState(
            meeting_id=meeting.id,
            version=1,
            state_data={}
        )
        db.session.add(current_state)
        db.session.commit()

        return jsonify({
            'meetingId': meeting.id,
            'currentStateId': current_state.id
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
        meeting = Meeting.query.get(meeting_id)
        if not meeting:
            return jsonify({'error': 'Meeting not found'}), 404

        # Get latest current state (ordered by version desc)
        latest_state = CurrentState.query.filter_by(
            meeting_id=meeting_id
        ).order_by(CurrentState.version.desc()).first()

        if not latest_state:
            return jsonify({'error': 'No state found for meeting'}), 404

        return jsonify({
            'meeting': meeting.to_dict(),
            'currentState': latest_state.to_dict()
        }), 200

    # ==================== PROCESS ENDPOINT ====================

    @app.route('/process', methods=['POST'])
    def process_chunk():
        """
        Process a chunk of data for a meeting.
        
        Gets the latest current state from DB, performs LLM processing,
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

        chunk = data.get('chunk')
        meeting_id = data.get('meetingId')

        if not chunk:
            return jsonify({'error': 'chunk is required'}), 400
        if not meeting_id:
            return jsonify({'error': 'meetingId is required'}), 400

        # Find the meeting
        meeting = Meeting.query.get(meeting_id)
        if not meeting:
            return jsonify({'error': 'Meeting not found'}), 404

        if meeting.status == 'finalized':
            return jsonify({'error': 'Meeting has been finalized'}), 400

        # Get latest current state
        latest_state = CurrentState.query.filter_by(
            meeting_id=meeting_id
        ).order_by(CurrentState.version.desc()).first()

        if not latest_state:
            return jsonify({'error': 'No state found for meeting'}), 404

        # ==================== LLM MAGIC PLACEHOLDER ====================
        # TODO: Replace this with actual LLM processing
        new_state_data = process_with_llm(latest_state.state_data, chunk)
        # ===============================================================

        # Create new state version
        new_state = CurrentState(
            meeting_id=meeting_id,
            version=latest_state.version + 1,
            state_data=new_state_data
        )
        db.session.add(new_state)
        db.session.commit()

        return jsonify({
            'currentState': new_state.to_dict(),
            'previousVersion': latest_state.version,
            'newVersion': new_state.version
        }), 200

    # ==================== FINALIZE ENDPOINT ====================

    @app.route('/finalize', methods=['POST'])
    def finalize_meeting():
        """
        Finalize a meeting and clean up workflows.
        
        Request Body:
            meetingId (uuid): The meeting ID to finalize
        
        Returns:
            Confirmation of finalization
        """
        data = request.get_json()

        if not data:
            return jsonify({'error': 'Request body is required'}), 400

        meeting_id = data.get('meetingId')

        if not meeting_id:
            return jsonify({'error': 'meetingId is required'}), 400

        # Find the meeting
        meeting = Meeting.query.get(meeting_id)
        if not meeting:
            return jsonify({'error': 'Meeting not found'}), 404

        if meeting.status == 'finalized':
            return jsonify({'error': 'Meeting is already finalized'}), 400

        # ==================== CLEANUP WORKFLOWS ====================
        # TODO: Add actual cleanup logic here
        cleanup_workflows(meeting_id)
        # ===========================================================

        # Update meeting status
        meeting.status = 'finalized'
        db.session.commit()

        # Get final state
        final_state = CurrentState.query.filter_by(
            meeting_id=meeting_id
        ).order_by(CurrentState.version.desc()).first()

        return jsonify({
            'message': 'Meeting finalized successfully',
            'meetingId': meeting.id,
            'finalState': final_state.to_dict() if final_state else None,
            'totalVersions': final_state.version if final_state else 0
        }), 200


# ==================== HELPER FUNCTIONS ====================

def get_initial_state() -> dict:
    """
    Returns the initial currentState structure.
    
    Returns:
        dict: Initial state with empty meetingSummary, workflows, and version 1
    """
    return {
        "meetingSummary": "",
        "workflows": [],
        "version": 1
    }


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


def pass_chunk(chunk: str, current_state: dict, chunk_index: int = 0) -> dict:
    """
    Passes a chunk and the currentState as context to GPT.
    The model returns an updated version of the currentState.
    
    Args:
        chunk: The text chunk to process
        current_state: The current state dictionary containing:
            - meetingSummary (str): Summary of the meeting so far
            - workflows (list): List of workflow dicts with mermaidDiagram and sources
            - version (int): Current version number
        chunk_index: The index of this chunk (for source tracking)
    
    Returns:
        dict: Updated currentState with incremented version
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
- Use valid Mermaid diagram syntax (flowchart TD format)
- Track which chunks contributed to each workflow in the sources array

Important:
- Keep the meeting summary concise but comprehensive
- Only create workflows for actual processes/procedures described
- Each workflow should have a descriptive mermaid diagram"""

    user_prompt = f"""Current State:
{json.dumps(current_state, indent=2)}

New Chunk (index {chunk_index}):
"{chunk}"

Please analyze this chunk and return an updated state. The response must be valid JSON with this exact structure:
{{
    "meetingSummary": "updated summary incorporating new information",
    "workflows": [
        {{
            "mermaidDiagram": "flowchart TD\\n    A[Start] --> B[Step]\\n    B --> C[End]",
            "sources": ["chunk_0", "chunk_1"]
        }}
    ],
    "version": {current_state.get('version', 0) + 1}
}}

Return ONLY the JSON object, no additional text."""

    try:
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.3,
            response_format={"type": "json_object"}
        )
        
        result = json.loads(response.choices[0].message.content)
        
        # Ensure the version is incremented
        result['version'] = current_state.get('version', 0) + 1
        
        return result
        
    except Exception as e:
        # On error, return current state with incremented version
        print(f"Error in pass_chunk: {e}")
        new_state = current_state.copy()
        new_state['version'] = current_state.get('version', 0) + 1
        return new_state


def process_with_llm(current_state_data: dict, chunk: str) -> dict:
    """
    Process a chunk using LLM and update the state.
    
    Args:
        current_state_data: The current state data dictionary
        chunk: The new text chunk to process
    
    Returns:
        Updated state data dictionary
    """
    # Initialize state if empty
    if not current_state_data or 'meetingSummary' not in current_state_data:
        current_state_data = get_initial_state()
    
    # Calculate chunk index based on version
    chunk_index = current_state_data.get('version', 1) - 1
    
    # Process the chunk with GPT
    updated_state = pass_chunk(chunk, current_state_data, chunk_index)
    
    return updated_state


def process_full_transcript(transcript: str) -> dict:
    """
    Process a full transcript by chunking it and processing each chunk.
    
    Args:
        transcript: The full transcript string
    
    Returns:
        Final state after processing all chunks
    """
    chunks = chunk_transcript(transcript)
    current_state = get_initial_state()
    
    for i, chunk in enumerate(chunks):
        current_state = pass_chunk(chunk, current_state, i)
    
    return current_state


def cleanup_workflows(meeting_id: str) -> None:
    """
    Placeholder function for workflow cleanup.
    
    TODO: Implement actual cleanup logic here.
    
    Args:
        meeting_id: The meeting ID to clean up workflows for
    """
    # Placeholder implementation
    # In production, this would:
    # - Clean up any background tasks
    # - Release any held resources
    # - Archive meeting data if needed
    # - Send notifications
    pass


# ==================== MAIN ====================

if __name__ == '__main__':
    app = create_app()
    app.run(host='0.0.0.0', port=5000, debug=True)

