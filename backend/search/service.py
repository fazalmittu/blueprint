"""
Search service - orchestrates search across strategies.

Provides a unified interface for executing searches with different strategies.
Handles strategy registration, selection, and result formatting.
"""

from typing import Optional, Any
from dataclasses import dataclass

from .strategies.base import SearchStrategy, SearchResult
from .strategies.title_first import TitleFirstStrategy
from .vector_store import VectorStore


class SearchService:
    """
    Main search service that orchestrates search strategies.
    
    Usage:
        service = SearchService()
        result = service.search("How do we handle renewals?", org_id="acme")
        
        # Or specify a strategy
        result = service.search(..., strategy_name="title_first")
    """
    
    def __init__(self):
        self._strategies: dict[str, SearchStrategy] = {}
        self._default_strategy: str = "title_first"
        self._vector_store = VectorStore()
        
        # Register built-in strategies
        self._register_default_strategies()
    
    def _register_default_strategies(self):
        """Register the default search strategies."""
        self.register_strategy(TitleFirstStrategy())
    
    def register_strategy(self, strategy: SearchStrategy):
        """
        Register a search strategy.
        
        Args:
            strategy: The strategy instance to register
        """
        self._strategies[strategy.name] = strategy
    
    def set_default_strategy(self, strategy_name: str):
        """
        Set the default strategy to use when none is specified.
        
        Args:
            strategy_name: Name of a registered strategy
            
        Raises:
            ValueError: If strategy is not registered
        """
        if strategy_name not in self._strategies:
            raise ValueError(f"Strategy '{strategy_name}' not registered")
        self._default_strategy = strategy_name
    
    def get_available_strategies(self) -> list[dict[str, Any]]:
        """
        Get information about all registered strategies.
        
        Returns:
            List of strategy configs
        """
        return [s.get_config() for s in self._strategies.values()]
    
    def search(
        self,
        query: str,
        org_id: str,
        strategy_name: Optional[str] = None,
        top_k: int = 5,
        **kwargs
    ) -> SearchResult:
        """
        Execute a search query.
        
        Args:
            query: The user's question
            org_id: Organization to search within
            strategy_name: Strategy to use (defaults to default_strategy)
            top_k: Maximum number of sources to consider
            **kwargs: Strategy-specific options
            
        Returns:
            SearchResult with answer and sources
        """
        strategy_name = strategy_name or self._default_strategy
        
        if strategy_name not in self._strategies:
            return SearchResult(
                answer=f"Unknown search strategy: {strategy_name}",
                sources=[],
                strategy_used=strategy_name,
                success=False,
                error=f"Strategy '{strategy_name}' not registered"
            )
        
        strategy = self._strategies[strategy_name]
        return strategy.search(query, org_id, top_k, **kwargs)
    
    def get_index_stats(self) -> dict:
        """Get statistics about the search indices."""
        return self._vector_store.get_stats()
    
    def health_check(self) -> dict:
        """
        Check the health of the search system.
        
        Returns:
            Dict with status and details
        """
        try:
            stats = self._vector_store.get_stats()
            total_docs = sum(s["document_count"] for s in stats.values())
            
            return {
                "status": "healthy",
                "total_documents": total_docs,
                "strategies_available": list(self._strategies.keys()),
                "default_strategy": self._default_strategy,
                "index_stats": stats
            }
        except Exception as e:
            return {
                "status": "unhealthy",
                "error": str(e)
            }


# Singleton instance
_search_service: Optional[SearchService] = None


def get_search_service() -> SearchService:
    """Get the singleton search service instance."""
    global _search_service
    if _search_service is None:
        _search_service = SearchService()
    return _search_service
