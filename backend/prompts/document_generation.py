"""
Prompts for generating meeting documents.
"""


DOCUMENT_GENERATION_SYSTEM_PROMPT = """You are an expert at creating professional meeting documents. 
You produce clean, well-organized markdown that is easy to read and share.
Your documents are comprehensive yet concise, capturing all important information."""


def get_document_generation_prompt(title: str, summary: str, workflow_info: str, transcript_snippet: str) -> str:
    """
    Generate the user prompt for document generation.
    
    Args:
        title: The meeting title
        summary: The current meeting summary
        workflow_info: Information about workflows discussed
        transcript_snippet: Excerpt from the transcript
    
    Returns:
        The formatted user prompt
    """
    return f"""Based on the following meeting information, generate a professional, well-formatted markdown document that could be shared with the team or stakeholders.

Meeting Title: {title}

Current Summary:
{summary}
{workflow_info}
{transcript_snippet}

Requirements for the document:
1. Do NOT include a title - the title is already displayed separately
2. Start with an "Executive Summary" section (## Executive Summary) with 2-3 sentences
3. Organize key points into logical sections with H2 headings (## Section Name)
4. Use standard markdown dash bullets (- item) for ALL list items
5. Do NOT use nested/indented bullets - keep all bullets at the same level
6. If you need sub-information, include it in the same bullet or use a new section
7. Include a "Next Steps" or "Action Items" section at the end
8. Keep it professional and comprehensive
9. Use clear, direct language
10. For action items, include them as single bullets like: "- Action item description (Owner: Name)"

CRITICAL FORMATTING RULES:
- Do NOT include a title/H1 heading
- Use - for all bullets, never use • or * or indentation
- Every bullet starts at column 0 with "- "
- No nested lists
- Use exactly ONE blank line between sections (between heading and content, between paragraphs)
- Do NOT use multiple consecutive blank lines
- Keep the document compact and scannable

Return ONLY the markdown content, no code fences or explanations."""

