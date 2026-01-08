"""
Prompts for processing meeting transcript chunks.
"""

import json
from typing import Any


CHUNK_PROCESSING_SYSTEM_PROMPT = """You are an AI assistant that processes meeting transcripts to extract insights.
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
- If you do decide to create a new workflow, make sure add a new entry in the workflows list. This is VERY important for organization purposes.
- Prefer updating/expanding existing workflows over creating new ones, unless the transcript explicitly mentions to create anew workflow.
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
            "mermaidDiagram": "flowchart TD\\n    A[Start] --> B{{Decision}}\\n    B --> |Yes| C[Process]\\n    B --> |No| D[\\"Handle Error (retry)\\"]\\n    C --> E[End]\\n    D --> E",
            "sources": ["chunk_0", "chunk_1"]
        }}
    ]
}}

Remember:
- meetingSummary should be bullet points (• prefix), not paragraphs
- Only create new workflows when absolutely necessary, prefer updating existing ones
- Merge similar/overlapping workflows
- If this chunk is instructional/critique content, only modify workflows, not the summary

Return ONLY the JSON object, no additional text."""
