"""
Search module for org-wide semantic search across meetings.

This module provides:
- Embedding service (OpenAI text-embedding-3-small)
- FAISS-based vector storage with metadata
- Pluggable search strategies
- Indexing pipeline for meetings, transcripts, workflows
"""

from .embeddings import EmbeddingService
from .vector_store import VectorStore, Document, SearchHit
from .indexer import SearchIndexer
from .service import SearchService
from .strategies import SearchStrategy, SearchResult, SourceReference

__all__ = [
    "EmbeddingService",
    "VectorStore",
    "Document",
    "SearchHit",
    "SearchIndexer",
    "SearchService",
    "SearchStrategy",
    "SearchResult",
    "SourceReference",
]
