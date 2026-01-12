"""
Agentic RAG Search Strategy

This strategy uses an LLM agent with access to tools to intelligently
search and retrieve information from meetings. The agent can:
1. Search for relevant meetings by title, notes, and workflow summaries
2. Search for specific transcript chunks
3. Search for relevant workflows
4. Retrieve full transcripts when needed (used sparingly)

The agent can gather context from multiple meetings and make multiple
tool calls to synthesize a comprehensive answer.

Best for: Complex queries that may require information from multiple sources
or need intelligent reasoning about what to search for.
"""

import os
import json
from typing import Any, Optional
from dataclasses import dataclass
from openai import OpenAI
from dotenv import load_dotenv
from pathlib import Path

from .base import SearchStrategy, SearchResult, SourceReference
from ..embeddings import EmbeddingService
from ..vector_store import VectorStore, SearchHit

# Load .env
load_dotenv(Path(__file__).resolve().parent.parent.parent.parent / ".env")


# Tool definitions for the agent
AGENT_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "search_meetings",
            "description": (
                "Search for relevant meetings based on a query. This searches across "
                "meeting titles, meeting notes summaries, and workflow summaries to find "
                "meetings that might contain relevant information. Returns a list of matching "
                "meetings with their IDs, titles, and relevance snippets."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "The search query to find relevant meetings"
                    },
                    "max_results": {
                        "type": "integer",
                        "description": "Maximum number of meetings to return (default 5)",
                        "default": 5
                    }
                },
                "required": ["query"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "search_transcript_chunks",
            "description": (
                "Search for specific transcript chunks that match a query. Useful for finding "
                "exact discussions, quotes, or detailed information about a topic. Returns "
                "chunks of transcript text with their meeting context."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "The search query to find relevant transcript sections"
                    },
                    "max_results": {
                        "type": "integer",
                        "description": "Maximum number of chunks to return (default 10)",
                        "default": 10
                    },
                    "meeting_id": {
                        "type": "string",
                        "description": "Optional: limit search to a specific meeting ID"
                    }
                },
                "required": ["query"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "search_workflows",
            "description": (
                "Search for workflows relevant to a query. Workflows describe processes, "
                "procedures, and decision flows discussed in meetings. Returns workflow "
                "summaries with their meeting context."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "The search query to find relevant workflows"
                    },
                    "max_results": {
                        "type": "integer",
                        "description": "Maximum number of workflows to return (default 5)",
                        "default": 5
                    }
                },
                "required": ["query"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_full_transcript",
            "description": (
                "Retrieve the full transcript for a specific meeting. Use this ONLY when "
                "you cannot answer the question using chunks or summaries, or when you need "
                "the complete context of a discussion. This is an expensive operation."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "meeting_id": {
                        "type": "string",
                        "description": "The ID of the meeting to get the transcript for"
                    }
                },
                "required": ["meeting_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_meeting_notes",
            "description": (
                "Retrieve the meeting notes/summary for a specific meeting. Meeting notes "
                "provide a structured summary of what was discussed."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "meeting_id": {
                        "type": "string",
                        "description": "The ID of the meeting to get notes for"
                    }
                },
                "required": ["meeting_id"]
            }
        }
    }
]


@dataclass
class GatheredContext:
    """Context gathered by the agent during search."""
    meetings_searched: list[str]
    transcript_chunks: list[dict]
    workflows: list[dict]
    meeting_notes: list[dict]
    full_transcripts: list[dict]
    tool_calls_made: list[dict]


class AgenticRAGStrategy(SearchStrategy):
    """
    Strategy that uses an LLM agent with tools to intelligently search
    and gather information from multiple sources.
    
    Configuration:
        agent_model: Model for the agent (default: gpt-4o-mini)
        answer_model: Model for generating final answer (default: gpt-4o-mini)
        max_iterations: Maximum tool call iterations (default: 5)
    """
    
    def __init__(
        self,
        agent_model: str = "gpt-4o-mini",
        answer_model: str = "gpt-4o-mini",
        max_iterations: int = 5,
    ):
        self._agent_model = agent_model
        self._answer_model = answer_model
        self._max_iterations = max_iterations
        
        self._client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        self._embedding_service = EmbeddingService()
        self._vector_store = VectorStore()
    
    @property
    def name(self) -> str:
        return "agentic_rag"
    
    @property
    def description(self) -> str:
        return (
            "Uses an LLM agent with tools to intelligently search meetings, "
            "transcripts, workflows, and notes. Can gather context from multiple "
            "sources and make multiple searches to answer complex queries."
        )
    
    def get_config(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "description": self.description,
            "agent_model": self._agent_model,
            "answer_model": self._answer_model,
            "max_iterations": self._max_iterations,
        }
    
    def search(
        self,
        query: str,
        org_id: str,
        top_k: int = 5,
        **kwargs
    ) -> SearchResult:
        """Execute the agentic RAG search strategy."""
        debug_info = {
            "iterations": 0,
            "tool_calls": [],
        }
        
        try:
            # Initialize context gatherer
            context = GatheredContext(
                meetings_searched=[],
                transcript_chunks=[],
                workflows=[],
                meeting_notes=[],
                full_transcripts=[],
                tool_calls_made=[],
            )
            
            # Run the agent loop
            agent_result = self._run_agent_loop(query, org_id, context, debug_info)
            
            if not agent_result["success"]:
                return SearchResult(
                    answer=agent_result.get("error", "Agent failed to find relevant information."),
                    sources=[],
                    strategy_used=self.name,
                    success=False,
                    error=agent_result.get("error"),
                    debug_info=debug_info
                )
            
            # Generate final answer from gathered context
            answer = self._generate_answer(query, context)
            
            # Build source references
            sources = self._build_sources(context)
            
            debug_info["context_summary"] = {
                "meetings_searched": len(context.meetings_searched),
                "transcript_chunks": len(context.transcript_chunks),
                "workflows": len(context.workflows),
                "meeting_notes": len(context.meeting_notes),
                "full_transcripts": len(context.full_transcripts),
            }
            
            return SearchResult(
                answer=answer,
                sources=sources,
                strategy_used=self.name,
                success=True,
                debug_info=debug_info
            )
            
        except Exception as e:
            return SearchResult(
                answer=f"An error occurred during agentic search: {str(e)}",
                sources=[],
                strategy_used=self.name,
                success=False,
                error=str(e),
                debug_info=debug_info
            )
    
    def _run_agent_loop(
        self, 
        query: str, 
        org_id: str, 
        context: GatheredContext,
        debug_info: dict
    ) -> dict:
        """
        Run the agent loop to gather context.
        
        The agent decides which tools to call and gathers information
        until it has enough context or reaches max iterations.
        """
        system_prompt = """You are a research agent that helps answer questions about company meetings.
You have access to tools to search meetings, transcripts, workflows, and notes.

Your goal is to gather enough context to answer the user's question comprehensively.

Strategy:
1. Start by searching for relevant meetings based on the query
2. If you find relevant meetings, search for transcript chunks or get meeting notes for more detail
3. Search for workflows if the question is about processes or procedures
4. Only use get_full_transcript if you truly need the complete context
5. You can search across multiple meetings if the question might span several discussions

Once you have gathered sufficient context, respond with a message starting with "READY:" 
followed by a brief summary of what you found. This signals you have enough information.

If you cannot find relevant information after searching, respond with "NO_RESULTS:" 
followed by an explanation."""

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Question: {query}"}
        ]
        
        for iteration in range(self._max_iterations):
            debug_info["iterations"] = iteration + 1
            
            response = self._client.chat.completions.create(
                model=self._agent_model,
                messages=messages,
                tools=AGENT_TOOLS,
                tool_choice="auto",
                temperature=0.1,
            )
            
            message = response.choices[0].message
            messages.append(message)
            
            # Check if agent is done
            if message.content:
                if message.content.startswith("READY:"):
                    debug_info["agent_summary"] = message.content[6:].strip()
                    return {"success": True}
                elif message.content.startswith("NO_RESULTS:"):
                    return {"success": False, "error": message.content[11:].strip()}
            
            # Process tool calls
            if message.tool_calls:
                for tool_call in message.tool_calls:
                    tool_name = tool_call.function.name
                    tool_args = json.loads(tool_call.function.arguments)
                    
                    # Execute the tool
                    tool_result = self._execute_tool(tool_name, tool_args, org_id, context)
                    
                    debug_info["tool_calls"].append({
                        "tool": tool_name,
                        "args": tool_args,
                        "result_count": tool_result.get("count", 0)
                    })
                    
                    context.tool_calls_made.append({
                        "tool": tool_name,
                        "args": tool_args
                    })
                    
                    # Add tool result to messages
                    messages.append({
                        "role": "tool",
                        "tool_call_id": tool_call.id,
                        "content": json.dumps(tool_result)
                    })
            else:
                # No tool calls and no termination signal - agent might be stuck
                if not message.content:
                    return {"success": False, "error": "Agent did not produce output"}
        
        # Max iterations reached
        if context.transcript_chunks or context.workflows or context.meeting_notes:
            return {"success": True}  # We have some context, proceed with answer
        
        return {"success": False, "error": "Max iterations reached without gathering context"}
    
    def _execute_tool(
        self, 
        tool_name: str, 
        args: dict, 
        org_id: str, 
        context: GatheredContext
    ) -> dict:
        """Execute a tool and update the context."""
        
        if tool_name == "search_meetings":
            return self._tool_search_meetings(
                args.get("query", ""),
                org_id,
                args.get("max_results", 5),
                context
            )
        
        elif tool_name == "search_transcript_chunks":
            return self._tool_search_chunks(
                args.get("query", ""),
                org_id,
                args.get("max_results", 10),
                args.get("meeting_id"),
                context
            )
        
        elif tool_name == "search_workflows":
            return self._tool_search_workflows(
                args.get("query", ""),
                org_id,
                args.get("max_results", 5),
                context
            )
        
        elif tool_name == "get_full_transcript":
            return self._tool_get_transcript(
                args.get("meeting_id", ""),
                context
            )
        
        elif tool_name == "get_meeting_notes":
            return self._tool_get_meeting_notes(
                args.get("meeting_id", ""),
                context
            )
        
        return {"error": f"Unknown tool: {tool_name}"}
    
    def _tool_search_meetings(
        self, 
        query: str, 
        org_id: str, 
        max_results: int,
        context: GatheredContext
    ) -> dict:
        """Search for meetings by title, notes, and workflow summaries."""
        # Validate query is not empty
        if not query or not query.strip():
            return {
                "count": 0,
                "meetings": [],
                "error": "Query cannot be empty"
            }
        
        query_embedding = self._embedding_service.embed(query)
        
        results = []
        meeting_ids_seen = set()
        
        # Search meeting titles
        title_hits = self._vector_store.search(
            doc_type="meeting_title",
            query_embedding=query_embedding,
            k=max_results,
            org_id=org_id
        )
        
        for hit in title_hits:
            if hit.meeting_id not in meeting_ids_seen:
                meeting_ids_seen.add(hit.meeting_id)
                results.append({
                    "meeting_id": hit.meeting_id,
                    "title": hit.text,
                    "match_type": "title",
                    "score": hit.score
                })
        
        # Search meeting notes
        notes_hits = self._vector_store.search(
            doc_type="meeting_notes",
            query_embedding=query_embedding,
            k=max_results,
            org_id=org_id
        )
        
        for hit in notes_hits:
            if hit.meeting_id not in meeting_ids_seen:
                meeting_ids_seen.add(hit.meeting_id)
                # Get the meeting title
                title = self._get_meeting_title(hit.meeting_id)
                results.append({
                    "meeting_id": hit.meeting_id,
                    "title": title,
                    "match_type": "notes",
                    "notes_snippet": hit.text[:300] + "..." if len(hit.text) > 300 else hit.text,
                    "score": hit.score
                })
            else:
                # Add notes snippet to existing result
                for r in results:
                    if r["meeting_id"] == hit.meeting_id:
                        r["notes_snippet"] = hit.text[:300] + "..." if len(hit.text) > 300 else hit.text
                        break
        
        # Search workflow summaries
        workflow_hits = self._vector_store.search(
            doc_type="workflow_summary",
            query_embedding=query_embedding,
            k=max_results,
            org_id=org_id
        )
        
        for hit in workflow_hits:
            if hit.meeting_id not in meeting_ids_seen:
                meeting_ids_seen.add(hit.meeting_id)
                title = self._get_meeting_title(hit.meeting_id)
                results.append({
                    "meeting_id": hit.meeting_id,
                    "title": title,
                    "match_type": "workflow",
                    "workflow_summary": hit.text,
                    "score": hit.score
                })
        
        # Sort by score and limit
        results.sort(key=lambda x: x["score"], reverse=True)
        results = results[:max_results]
        
        # Update context
        for r in results:
            if r["meeting_id"] not in context.meetings_searched:
                context.meetings_searched.append(r["meeting_id"])
        
        return {
            "count": len(results),
            "meetings": results
        }
    
    def _tool_search_chunks(
        self,
        query: str,
        org_id: str,
        max_results: int,
        meeting_id: Optional[str],
        context: GatheredContext
    ) -> dict:
        """Search for transcript chunks."""
        # Validate query is not empty
        if not query or not query.strip():
            return {
                "count": 0,
                "chunks": [],
                "error": "Query cannot be empty"
            }
        
        query_embedding = self._embedding_service.embed(query)
        
        hits = self._vector_store.search(
            doc_type="transcript_chunk",
            query_embedding=query_embedding,
            k=max_results,
            org_id=org_id
        )
        
        results = []
        for hit in hits:
            # Filter by meeting_id if specified
            if meeting_id and hit.meeting_id != meeting_id:
                continue
            
            title = self._get_meeting_title(hit.meeting_id)
            chunk_data = {
                "meeting_id": hit.meeting_id,
                "meeting_title": title,
                "chunk_index": hit.source_id,
                "text": hit.text,
                "score": hit.score
            }
            results.append(chunk_data)
            context.transcript_chunks.append(chunk_data)
        
        return {
            "count": len(results),
            "chunks": results
        }
    
    def _tool_search_workflows(
        self,
        query: str,
        org_id: str,
        max_results: int,
        context: GatheredContext
    ) -> dict:
        """Search for workflows."""
        # Validate query is not empty
        if not query or not query.strip():
            return {
                "count": 0,
                "workflows": [],
                "error": "Query cannot be empty"
            }
        
        query_embedding = self._embedding_service.embed(query)
        
        hits = self._vector_store.search(
            doc_type="workflow_summary",
            query_embedding=query_embedding,
            k=max_results,
            org_id=org_id
        )
        
        results = []
        for hit in hits:
            title = self._get_meeting_title(hit.meeting_id)
            
            # Get the full workflow data
            workflow_data = self._get_workflow_details(hit.meeting_id, hit.source_id)
            
            wf_result = {
                "meeting_id": hit.meeting_id,
                "meeting_title": title,
                "workflow_id": hit.source_id,
                "summary": hit.text,
                "score": hit.score
            }
            
            if workflow_data:
                wf_result["workflow_title"] = workflow_data.get("title")
                wf_result["nodes"] = workflow_data.get("nodes", [])
                wf_result["edges"] = workflow_data.get("edges", [])
            
            results.append(wf_result)
            context.workflows.append(wf_result)
        
        return {
            "count": len(results),
            "workflows": results
        }
    
    def _tool_get_transcript(
        self,
        meeting_id: str,
        context: GatheredContext
    ) -> dict:
        """Get full transcript for a meeting."""
        # Import database module
        import sys
        sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))
        import database as db
        
        meeting = db.get_meeting(meeting_id)
        if not meeting:
            return {"error": f"Meeting {meeting_id} not found"}
        
        transcript_data = {
            "meeting_id": meeting_id,
            "title": meeting.title or "Untitled Meeting",
            "transcript": meeting.transcript or "(No transcript available)"
        }
        
        context.full_transcripts.append(transcript_data)
        
        # Return truncated for the agent message (full context saved)
        transcript_preview = meeting.transcript[:5000] + "..." if meeting.transcript and len(meeting.transcript) > 5000 else meeting.transcript
        
        return {
            "meeting_id": meeting_id,
            "title": meeting.title,
            "transcript_length": len(meeting.transcript) if meeting.transcript else 0,
            "transcript_preview": transcript_preview
        }
    
    def _tool_get_meeting_notes(
        self,
        meeting_id: str,
        context: GatheredContext
    ) -> dict:
        """Get meeting notes for a meeting."""
        import sys
        sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))
        import database as db
        
        meeting = db.get_meeting(meeting_id)
        if not meeting:
            return {"error": f"Meeting {meeting_id} not found"}
        
        state = db.get_latest_state_version(meeting_id)
        if not state:
            return {"error": f"No notes found for meeting {meeting_id}"}
        
        notes_data = {
            "meeting_id": meeting_id,
            "title": meeting.title or "Untitled Meeting",
            "notes": state.data.meetingSummary or "(No notes available)"
        }
        
        context.meeting_notes.append(notes_data)
        
        return {
            "meeting_id": meeting_id,
            "title": meeting.title,
            "notes": state.data.meetingSummary or "(No notes available)"
        }
    
    def _get_meeting_title(self, meeting_id: str) -> str:
        """Get the title of a meeting."""
        import sys
        sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))
        import database as db
        
        meeting = db.get_meeting(meeting_id)
        return meeting.title if meeting and meeting.title else "Untitled Meeting"
    
    def _get_workflow_details(self, meeting_id: str, workflow_id: str) -> Optional[dict]:
        """Get full workflow details."""
        import sys
        sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))
        import database as db
        
        state = db.get_latest_state_version(meeting_id)
        if not state or not state.data.workflows:
            return None
        
        for wf in state.data.workflows:
            if wf.id == workflow_id:
                return wf.model_dump(mode='json')
        
        return None
    
    def _build_sources(self, context: GatheredContext) -> list[SourceReference]:
        """Build source references from gathered context."""
        sources = []
        meeting_ids_seen = set()
        
        # Add sources from transcript chunks
        for chunk in context.transcript_chunks:
            if chunk["meeting_id"] not in meeting_ids_seen:
                meeting_ids_seen.add(chunk["meeting_id"])
            sources.append(SourceReference(
                meeting_id=chunk["meeting_id"],
                meeting_title=chunk["meeting_title"],
                doc_type="transcript_chunk",
                text_snippet=chunk["text"][:200] + "..." if len(chunk["text"]) > 200 else chunk["text"],
                score=chunk["score"],
                source_id=chunk["chunk_index"]
            ))
        
        # Add sources from workflows
        for wf in context.workflows:
            sources.append(SourceReference(
                meeting_id=wf["meeting_id"],
                meeting_title=wf["meeting_title"],
                doc_type="workflow_summary",
                text_snippet=wf["summary"][:200] + "..." if len(wf["summary"]) > 200 else wf["summary"],
                score=wf["score"],
                source_id=wf["workflow_id"]
            ))
        
        # Add sources from meeting notes
        for notes in context.meeting_notes:
            sources.append(SourceReference(
                meeting_id=notes["meeting_id"],
                meeting_title=notes["title"],
                doc_type="meeting_notes",
                text_snippet=notes["notes"][:200] + "..." if len(notes["notes"]) > 200 else notes["notes"],
                score=1.0,
                source_id=None
            ))
        
        # Dedupe and sort by score
        seen = set()
        unique_sources = []
        for s in sources:
            key = (s.meeting_id, s.doc_type, s.source_id)
            if key not in seen:
                seen.add(key)
                unique_sources.append(s)
        
        unique_sources.sort(key=lambda x: x.score, reverse=True)
        return unique_sources[:10]  # Limit to top 10 sources
    
    def _generate_answer(self, query: str, context: GatheredContext) -> str:
        """Generate a comprehensive answer from gathered context."""
        
        # Build context sections
        context_parts = []
        
        # Meeting notes
        if context.meeting_notes:
            context_parts.append("## Meeting Notes\n")
            for notes in context.meeting_notes:
                context_parts.append(f"### {notes['title']}\n{notes['notes']}\n")
        
        # Transcript chunks
        if context.transcript_chunks:
            context_parts.append("\n## Relevant Transcript Excerpts\n")
            for chunk in context.transcript_chunks[:10]:  # Limit chunks
                context_parts.append(f"**From: {chunk['meeting_title']}**\n{chunk['text']}\n\n")
        
        # Workflows
        if context.workflows:
            context_parts.append("\n## Relevant Workflows\n")
            for wf in context.workflows:
                wf_title = wf.get("workflow_title", "Untitled Workflow")
                context_parts.append(f"**{wf_title}** (from {wf['meeting_title']})\n")
                context_parts.append(f"Summary: {wf['summary']}\n")
                if wf.get("nodes"):
                    steps = [n.get("label", "") for n in wf["nodes"] if n.get("label")]
                    context_parts.append(f"Steps: {' → '.join(steps[:7])}\n")
                context_parts.append("\n")
        
        # Full transcripts (truncated)
        if context.full_transcripts:
            context_parts.append("\n## Full Transcript Context\n")
            for t in context.full_transcripts:
                transcript_text = t["transcript"][:15000] if t["transcript"] else "(No transcript)"
                context_parts.append(f"**{t['title']}**\n{transcript_text}\n\n")
        
        full_context = "\n".join(context_parts)
        
        if not full_context.strip():
            return "I couldn't find any relevant information in the meetings to answer your question."
        
        prompt = f"""You are a helpful assistant answering questions about company meetings.

Based on the following information gathered from meeting searches:

{full_context}

---

User's Question: {query}

Please provide a comprehensive and accurate answer based on the information above.
- Be specific and reference details from the meetings when relevant
- If information comes from multiple meetings, synthesize it into a coherent answer
- If the information doesn't fully answer the question, acknowledge what's missing
- Cite which meetings the information came from when possible"""

        try:
            response = self._client.chat.completions.create(
                model=self._answer_model,
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "You answer questions about company meetings based on gathered context. "
                            "Be accurate, cite specific details, and synthesize information from "
                            "multiple sources when available."
                        )
                    },
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3,
                max_tokens=2000
            )
            
            return response.choices[0].message.content.strip()
            
        except Exception as e:
            return f"I found relevant information but encountered an error generating the answer: {e}"
