"""
Prompts module for LLM interactions.
"""

from .chunk_processing import CHUNK_PROCESSING_SYSTEM_PROMPT, get_chunk_processing_user_prompt

__all__ = [
    'CHUNK_PROCESSING_SYSTEM_PROMPT',
    'get_chunk_processing_user_prompt',
]
