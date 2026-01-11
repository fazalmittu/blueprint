"""
Embedding service using OpenAI's text-embedding-3-small model.

Provides a singleton service for generating embeddings with:
- Single text embedding
- Batch embedding for efficiency
- Retry logic for API failures
"""

import os
import time
from typing import Optional
from openai import OpenAI
from dotenv import load_dotenv
from pathlib import Path

# Load .env from project root
load_dotenv(Path(__file__).resolve().parent.parent.parent / ".env")

# Constants
EMBEDDING_MODEL = "text-embedding-3-small"
EMBEDDING_DIMENSIONS = 1536
MAX_RETRIES = 3
RETRY_DELAY = 1.0  # seconds


class EmbeddingService:
    """
    Service for generating text embeddings using OpenAI.
    
    Uses text-embedding-3-small which produces 1536-dimensional vectors.
    Implements retry logic for robustness.
    """
    
    _instance: Optional["EmbeddingService"] = None
    
    def __new__(cls) -> "EmbeddingService":
        """Singleton pattern - only one instance of the service."""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        """Initialize the OpenAI client."""
        if self._initialized:
            return
        
        self._client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        self._initialized = True
    
    @property
    def dimensions(self) -> int:
        """Return the embedding dimension size."""
        return EMBEDDING_DIMENSIONS
    
    def embed(self, text: str) -> list[float]:
        """
        Generate embedding for a single text.
        
        Args:
            text: The text to embed
            
        Returns:
            1536-dimensional embedding vector
            
        Raises:
            Exception: If embedding fails after retries
        """
        if not text or not text.strip():
            raise ValueError("Cannot embed empty text")
        
        # Truncate very long text (model has token limit)
        # Approximate: 1 token ≈ 4 chars, limit is 8191 tokens
        max_chars = 8191 * 4
        if len(text) > max_chars:
            text = text[:max_chars]
        
        last_error = None
        for attempt in range(MAX_RETRIES):
            try:
                response = self._client.embeddings.create(
                    input=text,
                    model=EMBEDDING_MODEL
                )
                return response.data[0].embedding
            except Exception as e:
                last_error = e
                if attempt < MAX_RETRIES - 1:
                    time.sleep(RETRY_DELAY * (attempt + 1))
        
        raise Exception(f"Failed to generate embedding after {MAX_RETRIES} attempts: {last_error}")
    
    def embed_batch(self, texts: list[str]) -> list[list[float]]:
        """
        Generate embeddings for multiple texts efficiently.
        
        The OpenAI API supports batching up to 2048 texts at once.
        We batch in groups of 100 to be safe with rate limits.
        
        Args:
            texts: List of texts to embed
            
        Returns:
            List of 1536-dimensional embedding vectors
            
        Raises:
            Exception: If embedding fails after retries
        """
        if not texts:
            return []
        
        # Filter empty texts and track indices
        valid_texts = []
        valid_indices = []
        for i, text in enumerate(texts):
            if text and text.strip():
                # Truncate very long text
                max_chars = 8191 * 4
                if len(text) > max_chars:
                    text = text[:max_chars]
                valid_texts.append(text)
                valid_indices.append(i)
        
        if not valid_texts:
            return [[] for _ in texts]
        
        # Batch process
        batch_size = 100
        all_embeddings = {}
        
        for batch_start in range(0, len(valid_texts), batch_size):
            batch_end = min(batch_start + batch_size, len(valid_texts))
            batch_texts = valid_texts[batch_start:batch_end]
            batch_indices = valid_indices[batch_start:batch_end]
            
            last_error = None
            for attempt in range(MAX_RETRIES):
                try:
                    response = self._client.embeddings.create(
                        input=batch_texts,
                        model=EMBEDDING_MODEL
                    )
                    
                    # Map embeddings back to original indices
                    for j, embedding_data in enumerate(response.data):
                        original_idx = batch_indices[j]
                        all_embeddings[original_idx] = embedding_data.embedding
                    
                    break
                except Exception as e:
                    last_error = e
                    if attempt < MAX_RETRIES - 1:
                        time.sleep(RETRY_DELAY * (attempt + 1))
            else:
                raise Exception(f"Failed to generate batch embeddings after {MAX_RETRIES} attempts: {last_error}")
        
        # Reconstruct full list with empty embeddings for invalid texts
        result = []
        for i in range(len(texts)):
            if i in all_embeddings:
                result.append(all_embeddings[i])
            else:
                result.append([])
        
        return result


# Convenience function for simple usage
def get_embedding_service() -> EmbeddingService:
    """Get the singleton embedding service instance."""
    return EmbeddingService()
