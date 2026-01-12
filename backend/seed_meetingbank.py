#!/usr/bin/env python3
"""
Complete database seeding script - replaces seed_db.py.

This script:
1. Loads N real meetings from MeetingBank (HuggingFace) - defaults to 30 longest transcripts
2. Generates workflows from transcripts using LLM
3. Generates meeting notes/summaries
4. Creates chunks from transcripts
5. Saves everything to blueprint.db (in data/ directory)
6. Builds FAISS search indices (in data/faiss/)
7. Generates ground truth test cases for evaluation (optional)

All meetings belong to the same organization (eval-org) for consistent testing.

The database and FAISS indices are committed to git, so cloning the repo
gives you a fully functional database ready to use.
"""
import os
import sys
import uuid
import time
import random
from pathlib import Path
from typing import List, Dict, Any
from datetime import datetime, timedelta

# Add backend to path
backend_path = Path(__file__).parent
sys.path.insert(0, str(backend_path))

from dotenv import load_dotenv
from openai import OpenAI

from database import (
    DB_PATH, init_db, create_meeting, add_state_version, 
    get_db, update_meeting_status, get_meeting
)
from models import Meeting, CurrentStateVersion
from models.meeting_schema import Status
from models.currentStateVersion_schema import Data as CurrentStateData
from models.workflow_schema import (
    Model as Workflow, Node, Edge, 
    Type as NodeType, Variant as NodeVariant
)

# Load environment
load_dotenv(backend_path.parent / ".env")

# All meetings belong to the same eval org
EVAL_ORG_ID = "eval-org"


def load_meetingbank_meetings(n: int = 50, seed: int = 42) -> List[Dict[str, Any]]:
    """Load n meetings from MeetingBank test set."""
    print(f"\n📚 Loading {n} meetings from MeetingBank...")
    
    try:
        from datasets import load_dataset
    except ImportError:
        print("❌ Error: 'datasets' library not installed")
        print("   Run: pip install datasets")
        sys.exit(1)
    
    # Load test set (cleaner, better for evals)
    dataset = load_dataset("huuuyeah/meetingbank", split="test")
    
    # Sort by transcript length (descending) and take top n
    print(f"   Sorting by transcript length...")
    meetings_with_length = [(i, dataset[i], len(dataset[i]['transcript'])) for i in range(len(dataset))]
    meetings_with_length.sort(key=lambda x: x[2], reverse=True)
    
    # Take top n longest transcripts
    selected = meetings_with_length[:n]
    meetings = [m[1] for m in selected]
    
    print(f"   Selected {n} meetings with longest transcripts")
    print(f"   Transcript lengths: {[m[2] for m in selected[:5]]}... (showing first 5)")
    
    print(f"   ✅ Loaded {len(meetings)} meetings")
    
    # Parse city from meeting UIDs
    for meeting in meetings:
        # UIDs are like "SeattleCityCouncil_06132016_Res 31669"
        uid = meeting['uid']
        city = None
        
        # Extract city from UID
        if 'Seattle' in uid:
            city = 'seattle'
        elif 'Boston' in uid:
            city = 'boston'
        elif 'Denver' in uid:
            city = 'denver'
        elif 'Alameda' in uid:
            city = 'alameda'
        elif 'LongBeach' in uid or 'Long Beach' in uid:
            city = 'long_beach'
        elif 'KingCounty' in uid or 'King County' in uid:
            city = 'king_county'
        else:
            # Default to first word before underscore/space
            city = uid.split('_')[0].split(' ')[0].lower()
        
        meeting['city'] = city
        meeting['org_id'] = EVAL_ORG_ID  # All meetings in same org for eval
    
    # Show distribution
    city_counts = {}
    for m in meetings:
        city_counts[m['city']] = city_counts.get(m['city'], 0) + 1
    
    print("\n   Distribution by city:")
    for city, count in sorted(city_counts.items()):
        print(f"   - {city}: {count} meetings")
    
    return meetings


def chunk_transcript(transcript: str, chunk_size: int = 2000) -> List[str]:
    """Chunk transcript into smaller pieces."""
    # Simple chunking by sentences (split on periods + space)
    sentences = transcript.replace('\n', ' ').split('. ')
    
    chunks = []
    current_chunk = ""
    
    for sentence in sentences:
        if len(current_chunk) + len(sentence) < chunk_size:
            current_chunk += sentence + ". "
        else:
            if current_chunk:
                chunks.append(current_chunk.strip())
            current_chunk = sentence + ". "
    
    if current_chunk:
        chunks.append(current_chunk.strip())
    
    return chunks


def generate_workflows_from_transcript(
    transcript: str, 
    title: str,
    client: OpenAI
) -> List[Dict[str, Any]]:
    """
    Generate workflows from transcript using LLM.
    Returns list of workflow dicts with nodes/edges.
    """
    print(f"      Generating workflows...")
    
    # Truncate transcript if too long (GPT context limits)
    max_chars = 50000
    transcript_truncated = transcript[:max_chars]
    if len(transcript) > max_chars:
        transcript_truncated += "\n... [transcript truncated]"
    
    prompt = f"""Analyze this meeting transcript and extract 1-3 workflows or processes that were discussed.

Meeting Title: {title}

Transcript:
{transcript_truncated}

For each workflow/process, provide:
1. A descriptive title
2. Nodes representing steps (each with: id, type, label, optional variant)
3. Edges connecting the nodes (each with: id, source, target, optional label)

Node types: "process", "decision", "terminal"
Terminal variants: "start", "end"

Return a JSON array of workflows:
[
  {{
    "title": "Workflow Title",
    "nodes": [
      {{"id": "n1", "type": "terminal", "label": "Start", "variant": "start"}},
      {{"id": "n2", "type": "process", "label": "Step description"}},
      {{"id": "n3", "type": "decision", "label": "Decision point?"}},
      {{"id": "n4", "type": "terminal", "label": "End", "variant": "end"}}
    ],
    "edges": [
      {{"id": "e1", "source": "n1", "target": "n2"}},
      {{"id": "e2", "source": "n2", "target": "n3"}},
      {{"id": "e3", "source": "n3", "target": "n4", "label": "Yes"}}
    ]
  }}
]

Focus on clear, actionable workflows. Limit to 3 workflows max."""

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are an expert at analyzing meeting transcripts and extracting structured workflows."},
                {"role": "user", "content": prompt}
            ],
            response_format={"type": "json_object"},
            temperature=0.3,
        )
        
        import json
        result = json.loads(response.choices[0].message.content)
        
        # Handle both array and object responses
        workflows = result if isinstance(result, list) else result.get('workflows', [])
        
        print(f"         ✅ Generated {len(workflows)} workflows")
        return workflows
        
    except Exception as e:
        print(f"         ⚠️  Workflow generation failed: {e}")
        return []


def generate_meeting_summary(
    transcript: str, 
    title: str,
    client: OpenAI
) -> str:
    """Generate comprehensive meeting notes from transcript."""
    print(f"      Generating meeting notes...")
    
    # Truncate if needed
    max_chars = 50000
    transcript_truncated = transcript[:max_chars]
    if len(transcript) > max_chars:
        transcript_truncated += "\n... [transcript truncated]"
    
    prompt = f"""Create comprehensive meeting notes from this transcript.

Meeting Title: {title}

Transcript:
{transcript_truncated}

Generate structured meeting notes with:
- Key discussion points
- Decisions made
- Action items
- Important topics covered

Format as markdown with clear sections and bullet points."""

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are an expert at creating clear, structured meeting notes."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
        )
        
        summary = response.choices[0].message.content
        print(f"         ✅ Generated summary ({len(summary)} chars)")
        return summary
        
    except Exception as e:
        print(f"         ⚠️  Summary generation failed: {e}")
        return ""


def generate_title_from_transcript(transcript: str, original_id: str, client: OpenAI) -> str:
    """Generate a descriptive title from transcript."""
    # Use first 2000 chars
    preview = transcript[:2000]
    
    prompt = f"""Generate a concise, descriptive title for this meeting transcript (max 10 words).

Transcript preview:
{preview}

Return only the title, no quotes or extra text."""

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are an expert at creating concise, descriptive titles."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            max_tokens=50,
        )
        
        title = response.choices[0].message.content.strip().strip('"')
        return title
        
    except Exception as e:
        print(f"         ⚠️  Title generation failed: {e}")
        # Fallback to ID-based title
        return f"Meeting {original_id}"


def create_workflow_objects(workflow_data_list: List[Dict]) -> List[Workflow]:
    """Convert workflow dicts to Workflow objects."""
    workflows = []
    
    for wf_data in workflow_data_list:
        try:
            nodes = []
            for node_data in wf_data.get("nodes", []):
                node = Node(
                    id=node_data["id"],
                    type=NodeType(node_data["type"]),
                    label=node_data["label"],
                    variant=NodeVariant(node_data["variant"]) if node_data.get("variant") else None
                )
                nodes.append(node)
            
            edges = []
            for edge_data in wf_data.get("edges", []):
                edge = Edge(
                    id=edge_data["id"],
                    source=edge_data["source"],
                    target=edge_data["target"],
                    label=edge_data.get("label")
                )
                edges.append(edge)
            
            workflow = Workflow(
                id=str(uuid.uuid4()),
                title=wf_data.get("title", "Workflow"),
                nodes=nodes,
                edges=edges,
                sources=[]  # Will be filled during chunking
            )
            workflows.append(workflow)
        except Exception as e:
            print(f"         ⚠️  Failed to create workflow: {e}")
            continue
    
    return workflows


def clear_search_index():
    """Clear the search index."""
    from pathlib import Path
    import shutil
    
    faiss_dir = Path(__file__).parent / "data" / "faiss"
    if faiss_dir.exists():
        print("🗑️  Clearing search index...")
        shutil.rmtree(faiss_dir)
        faiss_dir.mkdir(parents=True, exist_ok=True)
        print("   ✅ Search index cleared")


def index_all_meetings(meetings: List[Dict]):
    """Index all meetings for search."""
    from search.indexer import SearchIndexer
    
    index_start = time.time()
    print("\n📇 Step 4/4: Indexing meetings for search...")
    print("   " + "-" * 60)
    
    indexer = SearchIndexer()
    
    for i, m in enumerate(meetings, 1):
        meeting_start = time.time()
        meeting_id = m['meeting_id']
        title = m['title']
        progress_pct = int((i / len(meetings)) * 100)
        
        print(f"   [{i}/{len(meetings)}] ({progress_pct}%) Indexing: {title[:55]}...", end="", flush=True)
        
        try:
            result = indexer.index_meeting_complete(meeting_id)
            chunks = result.get('chunks_indexed', 0)
            workflows = result.get('workflows_indexed', 0)
            title_indexed = "✓" if result.get('title_indexed') else "✗"
            
            index_time = time.time() - meeting_start
            print(f" ✅ ({format_time(index_time)})")
            print(f"      {title_indexed} Title | {chunks} chunks | {workflows} workflows")
        except Exception as e:
            print(f" ❌ Error: {e}")
    
    index_total = time.time() - index_start
    print(f"\n   ✅ Indexing complete in {format_time(index_total)}!")
    
    # Show stats
    from search.service import get_search_service
    service = get_search_service()
    stats = service.get_index_stats()
    
    print("\n   📊 Index Statistics:")
    total_docs = 0
    for doc_type, info in stats.items():
        count = info.get("document_count", 0)
        total_docs += count
        print(f"      {doc_type}: {count} documents")
    print(f"      ─────────────────")
    print(f"      Total: {total_docs} documents")


def format_time(seconds: float) -> str:
    """Format seconds into human-readable time."""
    if seconds < 60:
        return f"{seconds:.1f}s"
    elif seconds < 3600:
        mins = int(seconds // 60)
        secs = int(seconds % 60)
        return f"{mins}m {secs}s"
    else:
        hours = int(seconds // 3600)
        mins = int((seconds % 3600) // 60)
        return f"{hours}h {mins}m"


def seed_meetingbank_meetings(n: int = 50, seed: int = 42):
    """Main seeding function - complete replacement for seed_db.py."""
    start_time = time.time()
    
    print("\n" + "=" * 70)
    print("🌱 MeetingBank Seeding Script (Complete Database Seeding)")
    print("=" * 70)
    print(f"⏰ Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"📊 Target: {n} meetings")
    print("=" * 70)
    
    # Initialize OpenAI
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        print("❌ Error: OPENAI_API_KEY not found in environment")
        sys.exit(1)
    
    client = OpenAI(api_key=api_key)
    
    # Load meetings
    print("\n📚 Step 1/4: Loading meetings from MeetingBank...")
    load_start = time.time()
    meetings = load_meetingbank_meetings(n, seed)
    load_time = time.time() - load_start
    print(f"   ✅ Loaded {len(meetings)} meetings in {format_time(load_time)}")
    
    # Clear existing database
    print("\n🗑️  Step 2/4: Clearing existing database and indices...")
    clear_start = time.time()
    if os.path.exists(DB_PATH):
        with get_db() as conn:
            conn.execute('DELETE FROM state_versions')
            conn.execute('DELETE FROM meetings')
        print("   ✅ Database cleared")
    else:
        init_db()
        print("   ✅ Database created")
    
    clear_search_index()
    clear_time = time.time() - clear_start
    print(f"   ✅ Cleanup complete in {format_time(clear_time)}")
    
    # Process each meeting
    print(f"\n📝 Step 3/4: Processing {len(meetings)} meetings...")
    print("   This will take ~1-2 minutes per meeting due to LLM API calls")
    print("   " + "-" * 60)
    
    created_meetings = []
    meeting_times = []
    
    for i, mb_meeting in enumerate(meetings, 1):
        meeting_start = time.time()
        progress_pct = int((i / len(meetings)) * 100)
        
        print(f"\n[{i}/{len(meetings)}] ({progress_pct}%) Processing: {mb_meeting['uid'][:50]}...")
        
        meeting_id = str(uuid.uuid4())
        transcript = mb_meeting['transcript']
        org_id = EVAL_ORG_ID  # All meetings in same org
        
        # Generate title
        print(f"   ⏳ Generating title...", end="", flush=True)
        title_start = time.time()
        title = generate_title_from_transcript(transcript, mb_meeting['uid'], client)
        title_time = time.time() - title_start
        print(f" ✅ ({format_time(title_time)})")
        print(f"      📌 {title}")
        
        # Chunk transcript
        print(f"   ⏳ Chunking transcript...", end="", flush=True)
        chunk_start = time.time()
        chunks = chunk_transcript(transcript)
        chunk_time = time.time() - chunk_start
        print(f" ✅ ({format_time(chunk_time)}) - {len(chunks)} chunks")
        
        # Create meeting
        meeting = Meeting(
            meetingId=meeting_id,
            status=Status.finalized,
            orgId=org_id,
            title=title,
            transcript=transcript,
            totalChunks=len(chunks)
        )
        create_meeting(meeting)
        
        # Generate workflows
        print(f"   ⏳ Generating workflows...", end="", flush=True)
        workflow_start = time.time()
        workflow_data = generate_workflows_from_transcript(transcript, title, client)
        workflows = create_workflow_objects(workflow_data)
        workflow_time = time.time() - workflow_start
        print(f" ✅ ({format_time(workflow_time)}) - {len(workflows)} workflows")
        
        # Generate summary
        print(f"   ⏳ Generating summary...", end="", flush=True)
        summary_start = time.time()
        summary = generate_meeting_summary(transcript, title, client)
        summary_time = time.time() - summary_start
        print(f" ✅ ({format_time(summary_time)}) - {len(summary)} chars")
        
        # Create initial state (version 0)
        initial_state = CurrentStateVersion(
            version=0,
            currentStateId=str(uuid.uuid4()),
            data=CurrentStateData(
                meetingSummary="",
                workflows=[],
                chunkText=""
            )
        )
        add_state_version(meeting_id, initial_state)
        
        # Create a version for each chunk so frontend can display them
        # For seeded meetings, all chunks are finalized at once, so each version
        # gets the full summary/workflows, but with the correct chunkIndex for matching
        for chunk_idx, chunk_text in enumerate(chunks):
            chunk_state = CurrentStateVersion(
                version=chunk_idx + 1,  # Version 1 = chunk 0, version 2 = chunk 1, etc.
                currentStateId=str(uuid.uuid4()),
                data=CurrentStateData(
                    meetingSummary=summary,  # Full summary for all chunks (they're all finalized)
                    workflows=workflows,      # Full workflows for all chunks
                    chunkText=chunk_text,     # This chunk's text
                    chunkIndex=chunk_idx      # Set chunkIndex so frontend can match chunks to versions
                )
            )
            add_state_version(meeting_id, chunk_state)
        
        created_meetings.append({
            "meeting_id": meeting_id,
            "org_id": org_id,
            "title": title,
            "city": mb_meeting['city'],
            "original_uid": mb_meeting['uid'],
            "workflows_count": len(workflows),
            "chunks_count": len(chunks),
            "summary_length": len(summary)
        })
        
        meeting_time = time.time() - meeting_start
        meeting_times.append(meeting_time)
        avg_time = sum(meeting_times) / len(meeting_times)
        remaining = avg_time * (len(meetings) - i)
        
        print(f"   ✅ Meeting complete in {format_time(meeting_time)}")
        print(f"      📊 Stats: {len(workflows)} workflows, {len(chunks)} chunks, {len(summary)} chars")
        if i < len(meetings):
            print(f"      ⏱️  Avg: {format_time(avg_time)}/meeting | Est. remaining: {format_time(remaining)}")
        
        # Small delay to avoid rate limits
        if i < len(meetings):
            time.sleep(0.5)
    
    total_time = time.time() - start_time
    print(f"\n   ✅ Processed {len(meetings)} meetings in {format_time(total_time)}")
    print(f"   📊 Average: {format_time(sum(meeting_times) / len(meeting_times))} per meeting")
    
    return created_meetings


def main():
    import argparse
    
    script_start = time.time()
    
    parser = argparse.ArgumentParser(
        description="Seed database with MeetingBank data (replaces seed_db.py)"
    )
    parser.add_argument("--n", type=int, default=30, help="Number of meetings to load (default: 30)")
    parser.add_argument("--seed", type=int, default=42, help="Random seed for reproducibility")
    parser.add_argument("--skip-indexing", action="store_true", help="Skip search indexing step")
    parser.add_argument("--skip-questions", action="store_true", help="Skip ground truth question generation")
    args = parser.parse_args()
    
    # Seed meetings
    created_meetings = seed_meetingbank_meetings(args.n, args.seed)
    
    # Index meetings for search
    if not args.skip_indexing:
        index_all_meetings(created_meetings)
    
    # Generate ground truth (optional, for eval)
    if not args.skip_questions:
        test_cases = generate_ground_truth_questions(created_meetings, args.seed)
        save_ground_truth(test_cases, "eval/eval_data/ground_truth.json", len(created_meetings))
    
    # Summary
    total_time = time.time() - script_start
    end_time = datetime.now()
    
    print("\n" + "=" * 70)
    print("✨ Seeding Complete!")
    print("=" * 70)
    print(f"\n⏰ Total time: {format_time(total_time)}")
    print(f"📅 Started: {datetime.fromtimestamp(script_start).strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"📅 Finished: {end_time.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"\n📊 Summary:")
    print(f"   Total meetings created: {len(created_meetings)}")
    print(f"   Organization: {EVAL_ORG_ID}")
    print(f"   Database location: {DB_PATH}")
    
    print("\n   Meetings by city:")
    city_counts = {}
    for m in created_meetings:
        city_counts[m['city']] = city_counts.get(m['city'], 0) + 1
    for city, count in sorted(city_counts.items()):
        print(f"   - {city}: {count} meetings")
    
    if not args.skip_indexing:
        print("\n   ✅ Search indices built and ready")
    
    if not args.skip_questions:
        print(f"\n   ✅ Ground truth saved to: eval/eval_data/ground_truth.json")
    
    print("\n   🚀 Database and indices are ready for use!")
    print("   Start the server: python app.py")
    print()


def generate_ground_truth_questions(meetings: List[Dict], seed: int = 42) -> List[Dict]:
    """
    Generate ground truth test cases from meetings.
    Mix of single-meeting and multi-meeting questions.
    """
    questions_start = time.time()
    print("\n🎯 Generating ground truth test cases...")
    print("   " + "-" * 60)
    
    api_key = os.getenv("OPENAI_API_KEY")
    client = OpenAI(api_key=api_key)
    
    random.seed(seed)
    test_cases = []
    
    # Get meetings from DB with full content
    print("   📥 Loading meetings from database...")
    db_meetings = []
    for m in meetings[:40]:  # Limit to 40 to avoid token limits
        try:
            meeting_obj = get_meeting(m['meeting_id'])
            if meeting_obj:
                db_meetings.append({
                    **m,
                    'meeting_obj': meeting_obj
                })
        except:
            continue
    print(f"   ✅ Loaded {len(db_meetings)} meetings")
    
    # Generate single-meeting questions (30 cases)
    print(f"\n   📝 Generating single-meeting questions (target: 30)...")
    single_meeting_sample = random.sample(db_meetings, min(30, len(db_meetings)))
    
    for i, m in enumerate(single_meeting_sample, 1):
        q_start = time.time()
        meeting_obj = m['meeting_obj']
        transcript_preview = meeting_obj.transcript[:1500] if meeting_obj.transcript else ""
        
        prompt = f"""Generate a specific question that can be answered using this meeting.

Meeting Title: {meeting_obj.title}
Transcript Preview: {transcript_preview}

Generate ONE specific question that someone might ask about this meeting.
Make it natural and specific to the content.
Return only the question, no extra text."""

        try:
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You generate specific, answerable questions about meetings."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                max_tokens=100,
            )
            
            query = response.choices[0].message.content.strip().strip('"')
            
            test_cases.append({
                "id": f"tc_single_{i:03d}",
                "query": query,
                "org_id": m['org_id'],
                "relevant_docs": [
                    {
                        "doc_id": f"meeting_title:{m['meeting_id']}:",
                        "relevance": 2
                    }
                ],
                "tags": ["single-meeting", m['city']]
            })
            
            q_time = time.time() - q_start
            if i % 5 == 0 or i == len(single_meeting_sample):
                print(f"      [{i}/{len(single_meeting_sample)}] Generated ({format_time(q_time)} each)")
            time.sleep(0.3)
                
        except Exception as e:
            print(f"      ⚠️  Failed to generate question for {m['title']}: {e}")
            continue
    
    # Generate multi-meeting questions (10 cases)
    print(f"\n   📝 Generating multi-meeting questions (target: 10)...")
    
    # Group by city for multi-meeting questions
    by_city = {}
    for m in db_meetings:
        city = m['city']
        if city not in by_city:
            by_city[city] = []
        by_city[city].append(m)
    
    multi_count = 0
    for city, city_meetings in by_city.items():
        if len(city_meetings) < 2:
            continue
        
        if multi_count >= 10:
            break
        
        # Sample 2-3 meetings from same city
        sample_size = min(3, len(city_meetings))
        sample_meetings = random.sample(city_meetings, sample_size)
        
        # Build context from multiple meetings
        context = ""
        for sm in sample_meetings:
            meeting_obj = sm['meeting_obj']
            context += f"\nMeeting: {meeting_obj.title}\n"
            context += meeting_obj.transcript[:800] + "...\n"
        
        q_start = time.time()
        prompt = f"""Generate a question that requires information from MULTIPLE meetings to answer.

Context from {len(sample_meetings)} meetings in {city}:
{context}

Generate ONE question that would require looking across these meetings.
Examples: "What were the recurring themes?", "How did the approach change over time?"
Return only the question."""

        try:
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You generate questions that span multiple meetings."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                max_tokens=100,
            )
            
            query = response.choices[0].message.content.strip().strip('"')
            
            test_cases.append({
                "id": f"tc_multi_{multi_count+1:03d}",
                "query": query,
                "org_id": sample_meetings[0]['org_id'],
                "relevant_docs": [
                    {
                        "doc_id": f"meeting_title:{sm['meeting_id']}:",
                        "relevance": 2
                    }
                    for sm in sample_meetings
                ],
                "tags": ["multi-meeting", city]
            })
            
            multi_count += 1
            q_time = time.time() - q_start
            print(f"      [{multi_count}/10] Generated ({format_time(q_time)})")
            time.sleep(0.3)
            
        except Exception as e:
            print(f"      ⚠️  Failed to generate multi-meeting question: {e}")
            continue
    
    questions_time = time.time() - questions_start
    print(f"\n   ✅ Generated {len(test_cases)} total test cases in {format_time(questions_time)}")
    print(f"      Single-meeting: {sum(1 for tc in test_cases if 'single-meeting' in tc['tags'])}")
    print(f"      Multi-meeting: {sum(1 for tc in test_cases if 'multi-meeting' in tc['tags'])}")
    
    return test_cases


def save_ground_truth(test_cases: List[Dict], output_path: str, n_meetings: int):
    """Save ground truth test cases to JSON."""
    import json
    from datetime import datetime
    
    dataset = {
        "name": f"meetingbank-{n_meetings}",
        "description": f"Test dataset from {n_meetings} MeetingBank meetings with generated questions",
        "version": "1.0",
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "test_cases": test_cases
    }
    
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(output_path, 'w') as f:
        json.dump(dataset, f, indent=2)
    
    print(f"\n💾 Saved ground truth to: {output_path}")




if __name__ == "__main__":
    main()
