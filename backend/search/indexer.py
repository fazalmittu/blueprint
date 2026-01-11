"""
Indexing pipeline for the search system.

Handles indexing of:
- Meeting titles
- Transcript chunks
- Workflow summaries (LLM-generated)
- Meeting notes (when generated via sparkle button)
"""

import os
import json
import uuid
from typing import Optional
from openai import OpenAI
from dotenv import load_dotenv
from pathlib import Path

from .embeddings import EmbeddingService
from .vector_store import VectorStore, Document, DocType

# Load .env
load_dotenv(Path(__file__).resolve().parent.parent.parent / ".env")


class SearchIndexer:
    """
    Indexer for the semantic search system.
    
    Call index_meeting_complete() after processing a meeting.
    Call index_meeting_notes() when notes are generated via sparkle button.
    """
    
    def __init__(self):
        self._embedding_service = EmbeddingService()
        self._vector_store = VectorStore()
        self._client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    
    def index_meeting_complete(self, meeting_id: str) -> dict:
        """
        Index all components of a meeting after processing completes.
        
        This indexes:
        - Meeting title
        - Transcript chunks
        - Workflow summaries
        
        Args:
            meeting_id: The meeting to index
            
        Returns:
            Dict with counts of indexed items
        """
        # Import here to avoid circular imports
        import sys
        sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
        import database as db
        
        meeting = db.get_meeting(meeting_id)
        if not meeting:
            return {"error": "Meeting not found"}
        
        state = db.get_latest_state_version(meeting_id)
        if not state:
            return {"error": "No state found for meeting"}
        
        results = {
            "meeting_id": meeting_id,
            "title_indexed": False,
            "chunks_indexed": 0,
            "workflows_indexed": 0,
        }
        
        org_id = meeting.orgId
        
        # 1. Index meeting title
        if meeting.title:
            self._index_title(meeting_id, org_id, meeting.title)
            results["title_indexed"] = True
        
        # 2. Index transcript chunks
        if meeting.transcript:
            chunks = self._chunk_transcript(meeting.transcript)
            self._index_transcript_chunks(meeting_id, org_id, chunks)
            results["chunks_indexed"] = len(chunks)
        
        # 3. Index workflows
        if state.data.workflows:
            self._index_workflows(meeting_id, org_id, state.data.workflows)
            results["workflows_indexed"] = len(state.data.workflows)
        
        return results
    
    def index_meeting_notes(self, meeting_id: str, notes: str) -> bool:
        """
        Index meeting notes when generated via sparkle button.
        
        This replaces any existing meeting notes index for this meeting.
        
        Args:
            meeting_id: The meeting ID
            notes: The generated meeting notes (markdown)
            
        Returns:
            True if successful
        """
        import sys
        sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
        import database as db
        
        meeting = db.get_meeting(meeting_id)
        if not meeting:
            return False
        
        org_id = meeting.orgId
        
        # Delete existing meeting notes for this meeting
        self._vector_store.delete_by_meeting(meeting_id)
        
        # Re-index the meeting with new notes
        # First, re-index title and transcript (since delete_by_meeting removes all)
        state = db.get_latest_state_version(meeting_id)
        
        if meeting.title:
            self._index_title(meeting_id, org_id, meeting.title)
        
        if meeting.transcript:
            chunks = self._chunk_transcript(meeting.transcript)
            self._index_transcript_chunks(meeting_id, org_id, chunks)
        
        if state and state.data.workflows:
            self._index_workflows(meeting_id, org_id, state.data.workflows)
        
        # Now index the meeting notes
        if notes and notes.strip():
            doc = Document(
                id=f"notes-{meeting_id}",
                org_id=org_id,
                meeting_id=meeting_id,
                text=notes,
                source_id=None
            )
            
            embedding = self._embedding_service.embed(notes)
            self._vector_store.add_documents("meeting_notes", [doc], [embedding])
        
        return True
    
    def reindex_meeting(self, meeting_id: str) -> dict:
        """
        Delete existing index entries and reindex a meeting.
        
        Useful when meeting content has changed.
        
        Args:
            meeting_id: The meeting to reindex
            
        Returns:
            Results dict from index_meeting_complete
        """
        # Delete existing entries
        self._vector_store.delete_by_meeting(meeting_id)
        
        # Reindex
        return self.index_meeting_complete(meeting_id)
    
    def _index_title(self, meeting_id: str, org_id: str, title: str):
        """Index a meeting title."""
        doc = Document(
            id=f"title-{meeting_id}",
            org_id=org_id,
            meeting_id=meeting_id,
            text=title,
            source_id=None
        )
        
        embedding = self._embedding_service.embed(title)
        self._vector_store.add_documents("meeting_title", [doc], [embedding])
    
    def _index_transcript_chunks(
        self, 
        meeting_id: str, 
        org_id: str, 
        chunks: list[str]
    ):
        """Index transcript chunks."""
        if not chunks:
            return
        
        documents = []
        for i, chunk in enumerate(chunks):
            doc = Document(
                id=f"chunk-{meeting_id}-{i}",
                org_id=org_id,
                meeting_id=meeting_id,
                text=chunk,
                source_id=str(i)
            )
            documents.append(doc)
        
        # Batch embed for efficiency
        embeddings = self._embedding_service.embed_batch([d.text for d in documents])
        self._vector_store.add_documents("transcript_chunk", documents, embeddings)
    
    def _index_workflows(self, meeting_id: str, org_id: str, workflows: list):
        """
        Index workflows by generating summaries.
        
        For each workflow, we generate a 2-3 sentence summary describing
        what the workflow does, then index that summary.
        """
        if not workflows:
            return
        
        documents = []
        summaries = []
        
        for wf in workflows:
            # Convert workflow to a format the LLM can understand
            wf_dict = wf.model_dump(mode='json') if hasattr(wf, 'model_dump') else wf
            
            summary = self._generate_workflow_summary(wf_dict)
            
            doc = Document(
                id=f"workflow-{wf_dict['id']}",
                org_id=org_id,
                meeting_id=meeting_id,
                text=summary,
                source_id=wf_dict['id']
            )
            documents.append(doc)
            summaries.append(summary)
        
        # Batch embed
        embeddings = self._embedding_service.embed_batch(summaries)
        self._vector_store.add_documents("workflow_summary", documents, embeddings)
    
    def _generate_workflow_summary(self, workflow: dict) -> str:
        """
        Generate a 2-3 sentence summary of a workflow using LLM.
        
        Args:
            workflow: Dict with title, nodes, edges
            
        Returns:
            Summary string
        """
        title = workflow.get("title", "Untitled Workflow")
        nodes = workflow.get("nodes", [])
        edges = workflow.get("edges", [])
        
        # Build a text representation
        node_labels = [n.get("label", "") for n in nodes]
        
        prompt = f"""Summarize this workflow in 2-3 sentences. Focus on what process it describes and its key steps.

Workflow Title: {title}

Steps/Nodes:
{chr(10).join(f'- {label}' for label in node_labels if label)}

Number of decision points: {sum(1 for n in nodes if n.get('type') == 'decision')}
Number of steps: {len(nodes)}

Write a concise summary that would help someone understand what this workflow is about."""

        try:
            response = self._client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "system",
                        "content": "You write concise workflow summaries. Keep it to 2-3 sentences."
                    },
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3,
                max_tokens=200
            )
            
            return response.choices[0].message.content.strip()
            
        except Exception as e:
            # Fallback: just use title and node labels
            return f"{title}: {', '.join(node_labels[:5])}"
    
    def _chunk_transcript(self, transcript: str, sentences_per_chunk: int = 10) -> list[str]:
        """
        Break a transcript into chunks.
        
        Uses the same chunking logic as the main processing pipeline.
        
        Args:
            transcript: Full transcript text
            sentences_per_chunk: Number of sentences per chunk
            
        Returns:
            List of chunk strings
        """
        import re
        
        # Split by sentence-ending punctuation
        sentence_pattern = r'(?<=[.!?])\s+'
        sentences = re.split(sentence_pattern, transcript.strip())
        
        # Filter empty strings
        sentences = [s.strip() for s in sentences if s.strip()]
        
        chunks = []
        for i in range(0, len(sentences), sentences_per_chunk):
            chunk = ' '.join(sentences[i:i + sentences_per_chunk])
            chunks.append(chunk)
        
        return chunks


# Convenience function
def get_search_indexer() -> SearchIndexer:
    """Get a search indexer instance."""
    return SearchIndexer()
