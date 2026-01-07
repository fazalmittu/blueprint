"""
Standalone script for testing chunk processing + LLM logic without the API.

Usage:
    python main.py                    # Run with sample transcript
    python main.py "your transcript"  # Run with custom transcript
"""

import os
import re
import json
import sys
from openai import OpenAI
from dotenv import load_dotenv
from pathlib import Path

# Load .env from project root
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

# Initialize OpenAI client
client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))


# ==================== CORE FUNCTIONS ====================

def get_initial_state() -> dict:
    """
    Returns the initial currentState structure.
    
    Returns:
        dict: Initial state with empty meetingSummary, workflows, and version 1
    """
    return {
        "meetingSummary": "",
        "workflows": [],
        "version": 0
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
            model="gpt-5.2",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.3,
            response_format={"type": "json_object"}
        )
        
        result = json.loads(response.choices[0].message.content)
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


def process_full_transcript(transcript: str, verbose: bool = True) -> dict:
    """
    Process a full transcript by chunking it and processing each chunk.
    
    Args:
        transcript: The full transcript string
        verbose: Whether to print progress updates
    
    Returns:
        Final state after processing all chunks
    """
    chunks = chunk_transcript(transcript)
    current_state = get_initial_state()
    
    if verbose:
        print(f"\n📝 Transcript chunked into {len(chunks)} chunks\n")
        print("=" * 60)
    
    for i, chunk in enumerate(chunks):
        if verbose:
            print(f"\n🔄 Processing chunk {i + 1}/{len(chunks)}...")
            print(f"   Chunk: \"{chunk[:80]}{'...' if len(chunk) > 80 else ''}\"")
        
        current_state = pass_chunk(chunk, current_state, i)
        
        if verbose:
            print(f"   ✅ Version updated to {current_state['version']}")
            print(f"   📄 Summary length: {len(current_state.get('meetingSummary', ''))} chars")
            print(f"   🔀 Workflows: {len(current_state.get('workflows', []))}")
    
    return current_state


# ==================== TEST HARNESS ====================

SAMPLE_TRANSCRIPT = """
Alex:
Alright, thanks everyone for joining. The goal of today's meeting is to align on the workflow for launching the new mobile feature by the end of the quarter. I want us to walk through the steps from final design all the way to public release and flag any dependencies or risks.

Rina:
From the design side, we're almost done. We'll finalize the UI designs by next Friday. Once that's done, we'll hand everything off to engineering along with the design specs and interaction guidelines.

Jamie:
Okay, so engineering can't fully start until those final designs are delivered. Once we receive them, we'll break implementation into two phases: backend support first, then frontend integration. Backend work should take about one week, and frontend another week.

Alex:
So engineering starts after design sign-off, backend first, frontend second. Got it. What happens after frontend is done?

Jamie:
After frontend integration, we'll move into internal QA. That usually takes three to four days. If QA finds blocking bugs, we loop back to engineering to fix them before moving forward.

Taylor:
Once QA signs off, operations needs at least two days to prepare the deployment. That includes setting up feature flags, updating monitoring dashboards, and confirming rollback procedures.

Sam:
Marketing depends on knowing the exact release date. Once operations confirms deployment readiness, we'll need about five days to prepare launch materials—blog post, email announcement, and social media assets.

Alex:
So marketing prep starts after deployment readiness is confirmed, but before the actual release, correct?

Sam:
Exactly. We don't need the feature live yet, just a locked release date.

Rina:
One more thing—if QA feedback requires design changes, those need to come back to us before engineering fixes anything. Otherwise, we risk patching the wrong UI behavior.

Jamie:
Right, so in that case the loop would be QA → Design → Engineering → QA again.

Alex:
That's important. Let's make sure that feedback loop is explicit.

Taylor:
On release day, ops will deploy the feature behind a feature flag. If monitoring looks good after 24 hours, we fully roll it out to all users.

Sam:
And marketing will coordinate the public announcement only after that 24-hour monitoring window passes successfully.

Alex:
Perfect. Let me summarize the flow to make sure we're aligned:

Design finalizes UI

Engineering implements backend

Engineering implements frontend

QA testing

If issues:

Design review (if needed)

Engineering fixes

QA retest

Ops prepares deployment

Marketing prepares launch content

Feature is deployed behind a flag

Monitoring period

Full rollout and public announcement

Does anyone see anything missing?

Jamie:
Looks complete from engineering.

Rina:
Same for design.

Sam:
All good from marketing.

Taylor:
No gaps from ops.

Alex:
Great. I'll document this workflow and share it after the meeting.
"""


def main():
    """Main entry point for testing."""
    # Get transcript from command line arg or use sample
    transcript = SAMPLE_TRANSCRIPT
    
    # Process the transcript
    final_state = process_full_transcript(transcript)
    
    # Print results
    print("\n" + "=" * 60)
    print("📊 FINAL RESULTS")
    print("=" * 60)
    
    print(f"\n📝 Meeting Summary:\n{final_state.get('meetingSummary', 'N/A')}")
    
    workflows = final_state.get('workflows', [])
    print(f"\n🔀 Workflows Found: {len(workflows)}")
    
    for i, workflow in enumerate(workflows):
        print(f"\n--- Workflow {i + 1} ---")
        print(f"Sources: {workflow.get('sources', [])}")
        print(f"Mermaid Diagram:\n{workflow.get('mermaidDiagram', 'N/A')}")
    
    print("\n" + "=" * 60)
    print("📦 Full State (JSON):")
    print("=" * 60)
    print(json.dumps(final_state, indent=2))
    
    return final_state


if __name__ == '__main__':
    main()

