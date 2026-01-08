"""
Prompts for processing meeting transcript chunks.
"""

import json
from typing import Any


CHUNK_PROCESSING_SYSTEM_PROMPT = """You are an AI assistant that processes meeting transcripts to extract insights.
Your job is to:
1. Update the meeting summary with key points from the new chunk (as bullet points)
2. Identify any workflows or processes mentioned and create/update workflow diagrams

You will receive the current state and a new chunk of transcript.
Return an updated state in the exact JSON format specified.

MEETING SUMMARY RULES:
- Format the summary as bullet points (use "• " prefix for each point)
- Each bullet should be a concise, standalone insight
- Add new bullets for new information, don't repeat existing points
- If the chunk contains meta-commentary, critiques, or instructions about the output (not actual meeting content), DO NOT add it to the summary

WORKFLOW RULES:
- Be VERY conservative about creating new workflows - only create when absolutely necessary
- If you do decide to create a new workflow, make sure to add a new entry in the workflows list
- Prefer updating/expanding existing workflows over creating new ones
- If two workflows cover similar or overlapping processes, MERGE them into one
- Only create a new workflow if the chunk describes a genuinely distinct, separate process
- Each workflow must have a unique id (UUID format), descriptive title, nodes array, edges array, and sources array
- Track which chunks contributed to each workflow in the sources array
- When merging workflows, combine their sources arrays and keep the most descriptive title

*** WORKFLOW NODE/EDGE FORMAT ***
Workflows are represented as a graph with nodes and edges (NOT mermaid syntax).

NODE TYPES:
- "terminal": Start or End nodes. Use variant "start" or "end"
- "process": Action/step nodes (rectangles)
- "decision": Yes/No decision points (diamonds)

NODE STRUCTURE:
{
  "id": "unique_node_id",  // Use short IDs like "n1", "n2", etc.
  "type": "process" | "decision" | "terminal",
  "label": "Human readable label",
  "variant": "start" | "end"  // Only for terminal nodes
}

EDGE STRUCTURE:
{
  "id": "unique_edge_id",  // Use short IDs like "e1", "e2", etc.
  "source": "source_node_id",
  "target": "target_node_id",
  "label": "Optional edge label"  // Use for decision branches like "Yes", "No"
}

EXAMPLE WORKFLOW:
{
  "id": "uuid-here",
  "title": "User Signup Flow",
  "nodes": [
    { "id": "n1", "type": "terminal", "label": "Start", "variant": "start" },
    { "id": "n2", "type": "process", "label": "User fills form" },
    { "id": "n3", "type": "decision", "label": "Valid email?" },
    { "id": "n4", "type": "process", "label": "Send verification" },
    { "id": "n5", "type": "process", "label": "Show error" },
    { "id": "n6", "type": "terminal", "label": "End", "variant": "end" }
  ],
  "edges": [
    { "id": "e1", "source": "n1", "target": "n2" },
    { "id": "e2", "source": "n2", "target": "n3" },
    { "id": "e3", "source": "n3", "target": "n4", "label": "Yes" },
    { "id": "e4", "source": "n3", "target": "n5", "label": "No" },
    { "id": "e5", "source": "n4", "target": "n6" },
    { "id": "e6", "source": "n5", "target": "n6" }
  ],
  "sources": ["chunk_0", "chunk_1"]
}

IMPORTANT RULES:
- Every workflow MUST have at least one terminal node with variant "start"
- Every workflow SHOULD have at least one terminal node with variant "end"
- All edge source/target must reference valid node IDs
- Keep workflows simple - max 10-15 nodes. Split complex processes.
- Node IDs must be unique within a workflow
- Edge IDs must be unique within a workflow

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


def get_chunk_processing_user_prompt(state_for_prompt: dict[str, Any], chunk: str, chunk_index: int) -> str:
    """
    Generate the user prompt for chunk processing.
    
    Args:
        state_for_prompt: Dictionary containing meetingSummary and workflows
        chunk: The text chunk to process
        chunk_index: The index of the chunk being processed
    
    Returns:
        Formatted user prompt string
    """
    return f"""Current State:
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
            "nodes": [
                {{ "id": "n1", "type": "terminal", "label": "Start", "variant": "start" }},
                {{ "id": "n2", "type": "process", "label": "Step 1" }},
                {{ "id": "n3", "type": "decision", "label": "Condition?" }},
                {{ "id": "n4", "type": "process", "label": "Yes path" }},
                {{ "id": "n5", "type": "process", "label": "No path" }},
                {{ "id": "n6", "type": "terminal", "label": "End", "variant": "end" }}
            ],
            "edges": [
                {{ "id": "e1", "source": "n1", "target": "n2" }},
                {{ "id": "e2", "source": "n2", "target": "n3" }},
                {{ "id": "e3", "source": "n3", "target": "n4", "label": "Yes" }},
                {{ "id": "e4", "source": "n3", "target": "n5", "label": "No" }},
                {{ "id": "e5", "source": "n4", "target": "n6" }},
                {{ "id": "e6", "source": "n5", "target": "n6" }}
            ],
            "sources": ["chunk_0", "chunk_1"]
        }}
    ]
}}

CRITICAL FORMAT RULES:
1. workflows use nodes[] and edges[] - NOT mermaid strings
2. Node types: "terminal" (start/end), "process" (steps), "decision" (branches)
3. Terminal nodes need "variant": "start" or "end"
4. Decision branches use edge labels like "Yes", "No"
5. All node/edge IDs must be unique and properly referenced

Remember:
- meetingSummary should be bullet points (• prefix), not paragraphs
- Only create new workflows when absolutely necessary, prefer updating existing ones
- Merge similar/overlapping workflows
- If this chunk is instructional/critique content, only modify workflows, not the summary

Return ONLY the JSON object, no additional text."""
