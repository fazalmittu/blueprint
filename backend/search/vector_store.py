"""
Vector store using FAISS for similarity search.

Maintains separate indices for different document types:
- transcript_chunks: Chunked transcript text
- meeting_titles: Meeting titles
- workflow_summaries: LLM-generated workflow descriptions
- meeting_notes: Generated meeting notes (via sparkle button)

Metadata is stored in SQLite alongside the vectors.
"""

import os
import json
import sqlite3
import numpy as np
from dataclasses import dataclass, asdict
from typing import Optional, Literal
from pathlib import Path
from contextlib import contextmanager

try:
    import faiss
except ImportError:
    raise ImportError("faiss-cpu is required. Install with: pip install faiss-cpu")

from .embeddings import EMBEDDING_DIMENSIONS

# Document types
DocType = Literal["transcript_chunk", "meeting_title", "workflow_summary", "meeting_notes"]
DOC_TYPES: list[DocType] = ["transcript_chunk", "meeting_title", "workflow_summary", "meeting_notes"]

# Paths
DATA_DIR = Path(__file__).resolve().parent.parent / "data" / "faiss"
DB_PATH = DATA_DIR / "search_metadata.db"


@dataclass
class Document:
    """A document to be indexed."""
    id: str  # Unique document ID
    org_id: str
    meeting_id: str
    text: str
    source_id: Optional[str] = None  # workflow_id or chunk_index


@dataclass
class SearchHit:
    """A search result."""
    id: str
    org_id: str
    meeting_id: str
    text: str
    source_id: Optional[str]
    score: float  # Similarity score (higher is better)
    doc_type: DocType


class VectorStore:
    """
    FAISS-based vector store with separate indices per document type.
    
    Each document type has its own FAISS index for efficient filtering.
    Metadata is stored in SQLite for persistence and querying.
    """
    
    _instance: Optional["VectorStore"] = None
    
    def __new__(cls) -> "VectorStore":
        """Singleton pattern."""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        """Initialize the vector store."""
        if self._initialized:
            return
        
        # Ensure data directory exists
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        
        # Initialize SQLite for metadata
        self._init_db()
        
        # Load or create FAISS indices
        self._indices: dict[DocType, faiss.IndexFlatIP] = {}
        self._load_indices()
        
        self._initialized = True
    
    def _init_db(self):
        """Initialize the SQLite metadata database."""
        with self._get_db() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS search_documents (
                    id TEXT PRIMARY KEY,
                    doc_type TEXT NOT NULL,
                    org_id TEXT NOT NULL,
                    meeting_id TEXT NOT NULL,
                    source_id TEXT,
                    text TEXT NOT NULL,
                    faiss_idx INTEGER NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_doc_type ON search_documents(doc_type)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_org_id ON search_documents(org_id)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_meeting_id ON search_documents(meeting_id)')
    
    @contextmanager
    def _get_db(self):
        """Get a database connection."""
        conn = sqlite3.connect(str(DB_PATH))
        conn.row_factory = sqlite3.Row
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()
    
    def _load_indices(self):
        """Load existing indices from disk or create new ones."""
        for doc_type in DOC_TYPES:
            index_path = DATA_DIR / f"{doc_type}.index"
            
            if index_path.exists():
                self._indices[doc_type] = faiss.read_index(str(index_path))
            else:
                # Create new index using Inner Product (for cosine similarity with normalized vectors)
                self._indices[doc_type] = faiss.IndexFlatIP(EMBEDDING_DIMENSIONS)
    
    def _save_index(self, doc_type: DocType):
        """Save a specific index to disk."""
        index_path = DATA_DIR / f"{doc_type}.index"
        faiss.write_index(self._indices[doc_type], str(index_path))
    
    def _normalize(self, vectors: np.ndarray) -> np.ndarray:
        """L2 normalize vectors for cosine similarity."""
        norms = np.linalg.norm(vectors, axis=1, keepdims=True)
        norms = np.where(norms == 0, 1, norms)  # Avoid division by zero
        return vectors / norms
    
    def add_documents(
        self, 
        doc_type: DocType, 
        documents: list[Document], 
        embeddings: list[list[float]]
    ) -> list[str]:
        """
        Add documents with their embeddings to the index.
        
        Args:
            doc_type: The type of documents being added
            documents: List of Document objects
            embeddings: Corresponding embeddings (must match documents length)
            
        Returns:
            List of document IDs that were added
        """
        if len(documents) != len(embeddings):
            raise ValueError(f"Documents ({len(documents)}) and embeddings ({len(embeddings)}) must match")
        
        if not documents:
            return []
        
        # Filter out documents with empty embeddings
        valid_docs = []
        valid_embeddings = []
        for doc, emb in zip(documents, embeddings):
            if emb and len(emb) == EMBEDDING_DIMENSIONS:
                valid_docs.append(doc)
                valid_embeddings.append(emb)
        
        if not valid_docs:
            return []
        
        # Convert to numpy and normalize
        vectors = np.array(valid_embeddings, dtype=np.float32)
        vectors = self._normalize(vectors)
        
        # Get current index size (this will be the starting faiss_idx for new docs)
        index = self._indices[doc_type]
        start_idx = index.ntotal
        
        # Add to FAISS
        index.add(vectors)
        
        # Add metadata to SQLite
        added_ids = []
        with self._get_db() as conn:
            cursor = conn.cursor()
            for i, doc in enumerate(valid_docs):
                faiss_idx = start_idx + i
                cursor.execute('''
                    INSERT OR REPLACE INTO search_documents 
                    (id, doc_type, org_id, meeting_id, source_id, text, faiss_idx)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                ''', (doc.id, doc_type, doc.org_id, doc.meeting_id, doc.source_id, doc.text, faiss_idx))
                added_ids.append(doc.id)
        
        # Persist index
        self._save_index(doc_type)
        
        return added_ids
    
    def search(
        self,
        doc_type: DocType,
        query_embedding: list[float],
        k: int = 10,
        org_id: Optional[str] = None
    ) -> list[SearchHit]:
        """
        Search for similar documents.
        
        Args:
            doc_type: Type of documents to search
            query_embedding: Query vector
            k: Number of results to return
            org_id: Optional filter by organization
            
        Returns:
            List of SearchHit objects, sorted by score descending
        """
        index = self._indices[doc_type]
        
        if index.ntotal == 0:
            return []
        
        # Normalize query vector
        query = np.array([query_embedding], dtype=np.float32)
        query = self._normalize(query)
        
        # Search (get more results if filtering by org)
        search_k = min(k * 5 if org_id else k, index.ntotal)
        scores, indices = index.search(query, search_k)
        
        # Get metadata for results
        results = []
        faiss_indices = indices[0].tolist()
        score_values = scores[0].tolist()
        
        with self._get_db() as conn:
            cursor = conn.cursor()
            
            for faiss_idx, score in zip(faiss_indices, score_values):
                if faiss_idx < 0:  # FAISS returns -1 for missing
                    continue
                
                # Build query with optional org filter
                query_sql = 'SELECT * FROM search_documents WHERE doc_type = ? AND faiss_idx = ?'
                params = [doc_type, faiss_idx]
                
                if org_id:
                    query_sql += ' AND org_id = ?'
                    params.append(org_id)
                
                cursor.execute(query_sql, params)
                row = cursor.fetchone()
                
                if row:
                    results.append(SearchHit(
                        id=row['id'],
                        org_id=row['org_id'],
                        meeting_id=row['meeting_id'],
                        text=row['text'],
                        source_id=row['source_id'],
                        score=float(score),
                        doc_type=doc_type
                    ))
                
                if len(results) >= k:
                    break
        
        return results
    
    def delete_by_meeting(self, meeting_id: str) -> dict[DocType, int]:
        """
        Delete all documents for a meeting.
        
        Note: FAISS doesn't support true deletion, so we just remove from metadata.
        The vectors remain in the index but won't be returned in search results.
        Periodic rebuilding of indices is needed to reclaim space.
        
        Args:
            meeting_id: The meeting to delete documents for
            
        Returns:
            Dict of doc_type -> count deleted
        """
        deleted = {}
        
        with self._get_db() as conn:
            cursor = conn.cursor()
            
            for doc_type in DOC_TYPES:
                cursor.execute(
                    'DELETE FROM search_documents WHERE meeting_id = ? AND doc_type = ?',
                    (meeting_id, doc_type)
                )
                deleted[doc_type] = cursor.rowcount
        
        return deleted
    
    def get_stats(self) -> dict:
        """Get statistics about the vector store."""
        stats = {}
        
        with self._get_db() as conn:
            cursor = conn.cursor()
            
            for doc_type in DOC_TYPES:
                cursor.execute(
                    'SELECT COUNT(*) as count FROM search_documents WHERE doc_type = ?',
                    (doc_type,)
                )
                row = cursor.fetchone()
                stats[doc_type] = {
                    "document_count": row['count'] if row else 0,
                    "index_size": self._indices[doc_type].ntotal
                }
        
        return stats
    
    def rebuild_index(self, doc_type: DocType):
        """
        Rebuild a FAISS index from metadata.
        
        This is useful after deletions to reclaim space.
        Requires re-embedding all documents.
        """
        from .embeddings import EmbeddingService
        
        embedding_service = EmbeddingService()
        
        # Get all documents for this type
        with self._get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                'SELECT id, org_id, meeting_id, source_id, text FROM search_documents WHERE doc_type = ?',
                (doc_type,)
            )
            rows = cursor.fetchall()
        
        if not rows:
            # Create empty index
            self._indices[doc_type] = faiss.IndexFlatIP(EMBEDDING_DIMENSIONS)
            self._save_index(doc_type)
            return
        
        # Re-embed all documents
        texts = [row['text'] for row in rows]
        embeddings = embedding_service.embed_batch(texts)
        
        # Create new index
        new_index = faiss.IndexFlatIP(EMBEDDING_DIMENSIONS)
        
        vectors = np.array([e for e in embeddings if e], dtype=np.float32)
        if len(vectors) > 0:
            vectors = self._normalize(vectors)
            new_index.add(vectors)
        
        # Update faiss_idx in metadata
        with self._get_db() as conn:
            cursor = conn.cursor()
            idx = 0
            for row, emb in zip(rows, embeddings):
                if emb:
                    cursor.execute(
                        'UPDATE search_documents SET faiss_idx = ? WHERE id = ?',
                        (idx, row['id'])
                    )
                    idx += 1
        
        self._indices[doc_type] = new_index
        self._save_index(doc_type)


def get_vector_store() -> VectorStore:
    """Get the singleton vector store instance."""
    return VectorStore()
