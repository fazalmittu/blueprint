"""
Base classes and protocols for search strategies.

All search strategies must implement the SearchStrategy protocol.
This allows easy swapping and testing of different approaches.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Optional, Any


@dataclass
class SourceReference:
    """Reference to a source document that contributed to an answer."""
    meeting_id: str
    meeting_title: str
    doc_type: str  # transcript_chunk, meeting_title, workflow_summary, meeting_notes
    text_snippet: str
    score: float
    source_id: Optional[str] = None  # workflow_id or chunk_index


@dataclass
class SearchResult:
    """Result from a search strategy."""
    answer: str
    sources: list[SourceReference]
    strategy_used: str
    success: bool = True
    error: Optional[str] = None
    debug_info: dict[str, Any] = field(default_factory=dict)


class SearchStrategy(ABC):
    """
    Abstract base class for search strategies.
    
    Implement this interface to create new search strategies.
    Each strategy can take different approaches to:
    - Which indices to search
    - How to rank results
    - How to build context for the LLM
    - What model to use for generation
    """
    
    @property
    @abstractmethod
    def name(self) -> str:
        """Unique name for this strategy."""
        pass
    
    @property
    def description(self) -> str:
        """Human-readable description of the strategy."""
        return "No description provided"
    
    @abstractmethod
    def search(
        self,
        query: str,
        org_id: str,
        top_k: int = 5,
        **kwargs
    ) -> SearchResult:
        """
        Execute a search query.
        
        Args:
            query: The user's question
            org_id: Organization to search within
            top_k: Maximum number of source documents to consider
            **kwargs: Strategy-specific options
            
        Returns:
            SearchResult with answer and source references
        """
        pass
    
    def get_config(self) -> dict[str, Any]:
        """
        Get the current configuration of this strategy.
        
        Useful for debugging and comparing strategies.
        """
        return {"name": self.name, "description": self.description}
