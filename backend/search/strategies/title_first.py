"""
Title-First Search Strategy

This strategy:
1. Embeds the user's query
2. Searches meeting titles by cosine similarity
3. Uses an LLM to select the most relevant meeting
4. Loads the full transcript + meeting notes
5. Generates a comprehensive answer

Best for: Queries that can be matched to a specific meeting topic.
"""

import os
import json
from typing import Any
from openai import OpenAI
from dotenv import load_dotenv
from pathlib import Path

from .base import SearchStrategy, SearchResult, SourceReference
from ..embeddings import EmbeddingService
from ..vector_store import VectorStore

# Load .env
load_dotenv(Path(__file__).resolve().parent.parent.parent.parent / ".env")


class TitleFirstStrategy(SearchStrategy):
    """
    Strategy that first matches on meeting titles, then loads full context.
    
    Configuration:
        top_k_titles: Number of title matches to consider (default: 10)
        selection_model: Model for selecting best meeting (default: gpt-4o-mini)
        answer_model: Model for generating answer (default: gpt-4o-mini)
    """
    
    def __init__(
        self,
        top_k_titles: int = 10,
        selection_model: str = "gpt-4o-mini",
        answer_model: str = "gpt-4o-mini",
    ):
        self._top_k_titles = top_k_titles
        self._selection_model = selection_model
        self._answer_model = answer_model
        
        self._client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        self._embedding_service = EmbeddingService()
        self._vector_store = VectorStore()
    
    @property
    def name(self) -> str:
        return "title_first"
    
    @property
    def description(self) -> str:
        return (
            "Matches query to meeting titles, selects best meeting via LLM, "
            "then generates answer from full transcript and notes."
        )
    
    def get_config(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "description": self.description,
            "top_k_titles": self._top_k_titles,
            "selection_model": self._selection_model,
            "answer_model": self._answer_model,
        }
    
    def search(
        self,
        query: str,
        org_id: str,
        top_k: int = 5,
        history: list = None,
        **kwargs
    ) -> SearchResult:
        """Execute the title-first search strategy."""
        history = history or []
        debug_info = {}
        
        try:
            # Step 1: Embed the query
            query_embedding = self._embedding_service.embed(query)
            debug_info["query_embedded"] = True
            
            # Step 2: Search meeting titles
            title_hits = self._vector_store.search(
                doc_type="meeting_title",
                query_embedding=query_embedding,
                k=self._top_k_titles,
                org_id=org_id
            )
            
            debug_info["titles_found"] = len(title_hits)
            
            if not title_hits:
                return SearchResult(
                    answer="I couldn't find any meetings in this organization to search.",
                    sources=[],
                    strategy_used=self.name,
                    success=False,
                    error="No meetings indexed",
                    debug_info=debug_info
                )
            
            # Step 3: LLM selects the best meeting
            selected_idx, selection_reasoning = self._select_meeting(query, title_hits)
            debug_info["selected_meeting_idx"] = selected_idx
            debug_info["selection_reasoning"] = selection_reasoning
            
            if selected_idx < 0 or selected_idx >= len(title_hits):
                return SearchResult(
                    answer="I couldn't find a meeting that seems relevant to your question.",
                    sources=[],
                    strategy_used=self.name,
                    success=False,
                    error="No relevant meeting found",
                    debug_info=debug_info
                )
            
            selected_hit = title_hits[selected_idx]
            debug_info["selected_meeting_id"] = selected_hit.meeting_id
            debug_info["selected_meeting_title"] = selected_hit.text
            
            # Step 4: Load full context
            context = self._load_meeting_context(selected_hit.meeting_id)
            debug_info["context_loaded"] = bool(context)
            
            if not context:
                return SearchResult(
                    answer="I found a relevant meeting but couldn't load its content.",
                    sources=[SourceReference(
                        meeting_id=selected_hit.meeting_id,
                        meeting_title=selected_hit.text,
                        doc_type="meeting_title",
                        text_snippet=selected_hit.text,
                        score=selected_hit.score
                    )],
                    strategy_used=self.name,
                    success=False,
                    error="Failed to load meeting context",
                    debug_info=debug_info
                )
            
            # Step 5: Generate answer
            answer = self._generate_answer(query, context, history)
            debug_info["answer_generated"] = True
            
            # Build source reference
            sources = [SourceReference(
                meeting_id=selected_hit.meeting_id,
                meeting_title=context.get("title", selected_hit.text),
                doc_type="meeting_title",
                text_snippet=selected_hit.text,
                score=selected_hit.score
            )]
            
            return SearchResult(
                answer=answer,
                sources=sources,
                strategy_used=self.name,
                success=True,
                debug_info=debug_info
            )
            
        except Exception as e:
            return SearchResult(
                answer=f"An error occurred while searching: {str(e)}",
                sources=[],
                strategy_used=self.name,
                success=False,
                error=str(e),
                debug_info=debug_info
            )
    
    def _select_meeting(self, query: str, title_hits: list) -> tuple[int, str]:
        """
        Use LLM to select the most relevant meeting from title matches.
        
        Returns:
            Tuple of (selected_index, reasoning)
            Index is -1 if no meeting is relevant
        """
        # Build the selection prompt
        titles_list = "\n".join([
            f"{i+1}. \"{hit.text}\" (similarity: {hit.score:.2f})"
            for i, hit in enumerate(title_hits)
        ])
        
        prompt = f"""You are helping select the most relevant meeting to answer a user's question.

User's question: "{query}"

Available meetings (with relevance scores):
{titles_list}

Which meeting is most likely to contain information that answers this question?

Respond in JSON format:
{{
    "selected": <number 1-{len(title_hits)} or 0 if none are relevant>,
    "reasoning": "<brief explanation of why this meeting was selected>"
}}

Only select 0 if you're confident none of the meetings could possibly be relevant."""

        try:
            response = self._client.chat.completions.create(
                model=self._selection_model,
                messages=[
                    {"role": "system", "content": "You select the most relevant meeting to answer questions. Respond only in JSON."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.1,
                response_format={"type": "json_object"}
            )
            
            result = json.loads(response.choices[0].message.content)
            selected = result.get("selected", 0)
            reasoning = result.get("reasoning", "")
            
            # Convert 1-indexed to 0-indexed
            return (selected - 1, reasoning)
            
        except Exception as e:
            # Fallback: just use the highest scoring match
            return (0, f"Fallback to highest score due to error: {e}")
    
    def _load_meeting_context(self, meeting_id: str) -> dict | None:
        """
        Load full transcript and meeting notes for a meeting.
        
        Returns:
            Dict with title, transcript, meeting_notes, or None if not found
        """
        # Import here to avoid circular imports
        import sys
        sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))
        import database as db
        
        meeting = db.get_meeting(meeting_id)
        if not meeting:
            return None
        
        state = db.get_latest_state_version(meeting_id)
        
        return {
            "title": meeting.title or "Untitled Meeting",
            "transcript": meeting.transcript or "",
            "meeting_notes": state.data.meetingSummary if state else "",
            "meeting_id": meeting_id
        }
    
    def _generate_answer(self, query: str, context: dict, history: list = None) -> str:
        """Generate a comprehensive answer using the full meeting context and conversation history."""
        history = history or []
        
        # Build context prompt
        context_prompt = f"""Meeting: {context['title']}

Meeting Notes:
{context['meeting_notes'] if context['meeting_notes'] else "(No structured notes available)"}

Full Transcript:
{context['transcript'][:50000] if context['transcript'] else "(No transcript available)"}"""

        system_prompt = f"""You answer questions about meetings based on transcripts and notes. Be accurate and cite specific details.

Here is the meeting context you have access to:

{context_prompt}

If the information isn't in the meeting, say so clearly.
Be specific and reference details from the meeting when relevant.
If the user references something from a previous message, use the conversation history to understand the context."""

        try:
            # Build messages array with conversation history
            messages = [{"role": "system", "content": system_prompt}]
            
            # Add conversation history
            for msg in history:
                messages.append({
                    "role": msg.get("role", "user"),
                    "content": msg.get("content", "")
                })
            
            # Add current query
            messages.append({"role": "user", "content": query})
            
            response = self._client.chat.completions.create(
                model=self._answer_model,
                messages=messages,
                temperature=0.3,
                max_tokens=2000
            )
            
            return response.choices[0].message.content.strip()
            
        except Exception as e:
            return f"I found the relevant meeting but encountered an error generating the answer: {e}"
