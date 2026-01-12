#!/usr/bin/env python3
"""
Seed script for loading MeetingBank data and generating test cases.

This script:
1. Loads 50 real meetings from MeetingBank (HuggingFace)
2. Generates workflows from transcripts using LLM
3. Generates meeting notes/summaries
4. Creates chunks from transcripts
5. Indexes everything for search
6. Generates ground truth test cases (single + multi-meeting questions)
"""
import os
import sys
import uuid
import time
import random
from pathlib import Path
from typing import List, Dict, Any

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

# Org mapping for cities
CITY_ORG_MAP = {
    "alameda": "alameda-city",
    "boston": "boston-city",
    "denver": "denver-city",
    "long_beach": "longbeach-city",
    "king_county": "kingcounty-gov",
    "seattle": "seattle-city",
}


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
    
    # Set seed for reproducibility
    random.seed(seed)
    
    # Sample n meetings
    indices = random.sample(range(len(dataset)), min(n, len(dataset)))
    meetings = [dataset[i] for i in indices]
    
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
        meeting['org_id'] = CITY_ORG_MAP.get(city, f"{city}-city")
    
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


def seed_meetingbank_meetings(n: int = 50, seed: int = 42):
    """Main seeding function."""
    print("\n" + "=" * 70)
    print("🌱 MeetingBank Seeding Script")
    print("=" * 70)
    
    # Initialize OpenAI
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        print("❌ Error: OPENAI_API_KEY not found in environment")
        sys.exit(1)
    
    client = OpenAI(api_key=api_key)
    
    # Load meetings
    meetings = load_meetingbank_meetings(n, seed)
    
    # Clear existing database
    print("\n🗑️  Clearing existing database...")
    if os.path.exists(DB_PATH):
        with get_db() as conn:
            conn.execute('DELETE FROM state_versions')
            conn.execute('DELETE FROM meetings')
        print("   ✅ Database cleared")
    else:
        init_db()
        print("   ✅ Database created")
    
    # Process each meeting
    created_meetings = []
    
    for i, mb_meeting in enumerate(meetings, 1):
        print(f"\n📝 Processing meeting {i}/{len(meetings)}: {mb_meeting['uid']}")
        
        meeting_id = str(uuid.uuid4())
        transcript = mb_meeting['transcript']
        org_id = mb_meeting['org_id']
        
        # Generate title
        print(f"   Generating title...")
        title = generate_title_from_transcript(transcript, mb_meeting['uid'], client)
        print(f"      ✅ Title: {title}")
        
        # Chunk transcript
        print(f"   Chunking transcript...")
        chunks = chunk_transcript(transcript)
        print(f"      ✅ Created {len(chunks)} chunks")
        
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
        workflow_data = generate_workflows_from_transcript(transcript, title, client)
        workflows = create_workflow_objects(workflow_data)
        
        # Generate summary
        summary = generate_meeting_summary(transcript, title, client)
        
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
        
        # Create final state with content (version 1)
        final_state = CurrentStateVersion(
            version=1,
            currentStateId=str(uuid.uuid4()),
            data=CurrentStateData(
                meetingSummary=summary,
                workflows=workflows,
                chunkText=chunks[0] if chunks else ""
            )
        )
        add_state_version(meeting_id, final_state)
        
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
        
        print(f"   ✅ Meeting created: {meeting_id}")
        print(f"      Workflows: {len(workflows)}, Chunks: {len(chunks)}, Summary: {len(summary)} chars")
        
        # Small delay to avoid rate limits
        if i < len(meetings):
            time.sleep(0.5)
    
    return created_meetings


def generate_ground_truth_questions(meetings: List[Dict], seed: int = 42) -> List[Dict]:
    """
    Generate ground truth test cases from meetings.
    Mix of single-meeting and multi-meeting questions.
    """
    print("\n🎯 Generating ground truth test cases...")
    
    api_key = os.getenv("OPENAI_API_KEY")
    client = OpenAI(api_key=api_key)
    
    random.seed(seed)
    test_cases = []
    
    # Get meetings from DB with full content
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
    
    # Generate single-meeting questions (30 cases)
    print("   Generating single-meeting questions...")
    single_meeting_sample = random.sample(db_meetings, min(30, len(db_meetings)))
    
    for i, m in enumerate(single_meeting_sample, 1):
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
            
            if i % 5 == 0:
                print(f"      Generated {i}/30 single-meeting questions")
                time.sleep(0.3)
                
        except Exception as e:
            print(f"      ⚠️  Failed to generate question for {m['title']}: {e}")
            continue
    
    # Generate multi-meeting questions (10 cases)
    print("   Generating multi-meeting questions...")
    
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
            print(f"      Generated {multi_count}/10 multi-meeting questions")
            time.sleep(0.3)
            
        except Exception as e:
            print(f"      ⚠️  Failed to generate multi-meeting question: {e}")
            continue
    
    print(f"   ✅ Generated {len(test_cases)} total test cases")
    print(f"      Single-meeting: {sum(1 for tc in test_cases if 'single-meeting' in tc['tags'])}")
    print(f"      Multi-meeting: {sum(1 for tc in test_cases if 'multi-meeting' in tc['tags'])}")
    
    return test_cases


def save_ground_truth(test_cases: List[Dict], output_path: str):
    """Save ground truth test cases to JSON."""
    import json
    from datetime import datetime
    
    dataset = {
        "name": "meetingbank-50",
        "description": "Test dataset from 50 MeetingBank meetings with generated questions",
        "version": "1.0",
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "test_cases": test_cases
    }
    
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(output_path, 'w') as f:
        json.dump(dataset, f, indent=2)
    
    print(f"\n💾 Saved ground truth to: {output_path}")


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description="Seed MeetingBank data and generate test cases")
    parser.add_argument("--n", type=int, default=50, help="Number of meetings to load")
    parser.add_argument("--seed", type=int, default=42, help="Random seed for reproducibility")
    parser.add_argument("--skip-questions", action="store_true", help="Skip question generation")
    args = parser.parse_args()
    
    # Seed meetings
    created_meetings = seed_meetingbank_meetings(args.n, args.seed)
    
    # Generate ground truth
    if not args.skip_questions:
        test_cases = generate_ground_truth_questions(created_meetings, args.seed)
        save_ground_truth(test_cases, "eval/eval_data/meetingbank_ground_truth.json")
    
    # Summary
    print("\n" + "=" * 70)
    print("✨ Seeding Complete!")
    print("=" * 70)
    print(f"\n   Total meetings created: {len(created_meetings)}")
    print(f"   Database location: {DB_PATH}")
    
    print("\n   Meetings by city:")
    city_counts = {}
    for m in created_meetings:
        city_counts[m['city']] = city_counts.get(m['city'], 0) + 1
    for city, count in sorted(city_counts.items()):
        print(f"   - {city}: {count} meetings")
    
    if not args.skip_questions:
        print(f"\n   Ground truth saved to: eval/eval_data/meetingbank_ground_truth.json")
    
    print("\n   Next steps:")
    print("   1. Index the meetings: python -m search.indexer --all")
    print("   2. Run eval: python -m eval.run --dataset eval/eval_data/meetingbank_ground_truth.json")
    print()


if __name__ == "__main__":
    main()
