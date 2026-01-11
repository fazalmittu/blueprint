"""
Search strategies for the semantic search system.

Strategies implement different approaches to answering questions
based on the indexed meeting data.
"""

from .base import SearchStrategy, SearchResult, SourceReference
from .title_first import TitleFirstStrategy

__all__ = [
    "SearchStrategy",
    "SearchResult", 
    "SourceReference",
    "TitleFirstStrategy",
]
