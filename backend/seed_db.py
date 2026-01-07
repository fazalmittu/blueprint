#!/usr/bin/env python3
"""
Database seeding script.
Clears existing database and populates it with fake meetings and current states.
"""
import os
import sys
import uuid

# Add backend to path so we can import modules
backend_path = os.path.join(os.path.dirname(__file__), '..', 'backend')
sys.path.insert(0, backend_path)

from database import DB_PATH, init_db, create_meeting, add_state_version, get_db
from models import Meeting, CurrentStateVersion
from models.meeting_schema import Status
from models.currentStateVersion_schema import Data as CurrentStateData
from models.workflow_schema import Model as Workflow


def clear_database():
    """Clear all data from the database if it exists."""
    if os.path.exists(DB_PATH):
        print(f"🗑️  Found existing database at {DB_PATH}")
        print("   Clearing all data...")
        
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute('DELETE FROM state_versions')
            cursor.execute('DELETE FROM meetings')
        
        print("   ✅ Database cleared!")
    else:
        print(f"📁 No existing database found. Creating new one at {DB_PATH}")
        init_db()
        print("   ✅ Database created!")


def create_fake_meetings():
    """Create fake meetings with realistic sample data."""
    
    fake_data = [
        {
            "org_id": "acme-corp",
            "summary": "Discussed Q1 roadmap priorities. Team agreed to focus on customer onboarding improvements and API v2 launch. Sarah will lead the onboarding workstream, Mike handles API development.",
            "workflows": [
                {
                    "title": "Customer Onboarding Process",
                    "mermaid": """flowchart TD
    A[New Customer Signs Up] --> B[Welcome Email Sent]
    B --> C[Account Setup Wizard]
    C --> D{Completed Setup?}
    D -->|Yes| E[Assign Success Manager]
    D -->|No| F[Send Reminder Email]
    F --> C
    E --> G[Schedule Kickoff Call]
    G --> H[30-Day Check-in]""",
                    "sources": ["chunk_0", "chunk_1", "chunk_2"]
                },
                {
                    "title": "API Release Process",
                    "mermaid": """flowchart TD
    A[Feature Complete] --> B[Internal Testing]
    B --> C[Security Review]
    C --> D[Beta Release]
    D --> E[Gather Feedback]
    E --> F{Issues Found?}
    F -->|Yes| G[Fix Issues]
    G --> B
    F -->|No| H[Production Release]
    H --> I[Update Documentation]""",
                    "sources": ["chunk_3", "chunk_4"]
                }
            ]
        },
        {
            "org_id": "startup-inc",
            "summary": "Sprint retrospective meeting. Team identified bottlenecks in code review process. Decision to implement pair programming for complex features and automate deployment pipeline.",
            "workflows": [
                {
                    "title": "Code Review Workflow",
                    "mermaid": """flowchart TD
    A[Developer Creates PR] --> B[Automated Tests Run]
    B --> C{Tests Pass?}
    C -->|No| D[Developer Fixes Issues]
    D --> B
    C -->|Yes| E[Request Code Review]
    E --> F[Reviewer Assigned]
    F --> G{Approved?}
    G -->|No| H[Address Feedback]
    H --> E
    G -->|Yes| I[Merge to Main]
    I --> J[Auto Deploy to Staging]""",
                    "sources": ["chunk_0", "chunk_1"]
                }
            ]
        },
        {
            "org_id": "enterprise-solutions",
            "summary": "Incident post-mortem for last week's outage. Root cause was database connection pool exhaustion. Action items: implement connection monitoring, add circuit breakers, and improve alerting thresholds.",
            "workflows": [
                {
                    "title": "Incident Response Process",
                    "mermaid": """flowchart TD
    A[Alert Triggered] --> B[On-Call Notified]
    B --> C[Initial Assessment]
    C --> D{Severity Level?}
    D -->|Critical| E[War Room Created]
    D -->|High| F[Senior Engineer Paged]
    D -->|Medium| G[Normal Handling]
    E --> H[Identify Root Cause]
    F --> H
    G --> H
    H --> I[Implement Fix]
    I --> J[Verify Resolution]
    J --> K[Post-Mortem Scheduled]""",
                    "sources": ["chunk_0", "chunk_2", "chunk_3"]
                },
                {
                    "title": "Database Monitoring Setup",
                    "mermaid": """flowchart TD
    A[Connection Pool Metric] --> B{Usage > 80%?}
    B -->|Yes| C[Warning Alert]
    B -->|No| D[Continue Monitoring]
    C --> E{Usage > 95%?}
    E -->|Yes| F[Critical Alert]
    E -->|No| G[Log Warning]
    F --> H[Auto-Scale Triggered]
    H --> I[Notify Team]""",
                    "sources": ["chunk_4", "chunk_5"]
                }
            ]
        },
        {
            "org_id": "acme-corp",
            "summary": "Product design review for mobile app redesign. Agreed on new navigation structure and updated color scheme. UX team will create prototypes by next Friday.",
            "workflows": [
                {
                    "title": "Design Review Process",
                    "mermaid": """flowchart TD
    A[Designer Creates Mockups] --> B[Internal Design Review]
    B --> C{Approved?}
    C -->|No| D[Iterate on Feedback]
    D --> B
    C -->|Yes| E[Stakeholder Presentation]
    E --> F{Changes Needed?}
    F -->|Yes| G[Document Changes]
    G --> D
    F -->|No| H[Create Prototype]
    H --> I[User Testing]
    I --> J[Final Approval]""",
                    "sources": ["chunk_0", "chunk_1", "chunk_2"]
                }
            ]
        },
        {
            "org_id": "startup-inc",
            "summary": "Empty meeting - no discussion topics were covered.",
            "workflows": []
        }
    ]
    
    meetings_created = []
    
    for i, data in enumerate(fake_data):
        meeting_id = str(uuid.uuid4())
        current_state_id = str(uuid.uuid4())
        
        # Create meeting - all seeded meetings are finalized
        status = Status.finalized
        meeting = Meeting(
            meetingId=meeting_id,
            status=status,
            orgId=data["org_id"]
        )
        create_meeting(meeting)
        
        # Create workflows from fake data
        workflows = []
        for wf_data in data["workflows"]:
            workflow = Workflow(
                id=str(uuid.uuid4()),
                title=wf_data["title"],
                mermaidDiagram=wf_data["mermaid"],
                sources=wf_data["sources"]
            )
            workflows.append(workflow)
        
        # Create initial state (version 0)
        initial_state = CurrentStateVersion(
            version=0,
            currentStateId=current_state_id,
            data=CurrentStateData(
                meetingSummary="",
                workflows=[]
            )
        )
        add_state_version(meeting_id, initial_state)
        
        # Create current state with summary and workflows (version 1)
        if data["summary"]:
            current_state = CurrentStateVersion(
                version=1,
                currentStateId=str(uuid.uuid4()),
                data=CurrentStateData(
                    meetingSummary=data["summary"],
                    workflows=workflows
                )
            )
            add_state_version(meeting_id, current_state)
        
        meetings_created.append({
            "meeting_id": meeting_id,
            "org_id": data["org_id"],
            "status": status.value,
            "workflows_count": len(workflows)
        })
        
        print(f"   ✅ Created meeting {i+1}: {meeting_id[:8]}... ({data['org_id']}, {len(workflows)} workflows)")
    
    return meetings_created


def main():
    print("\n" + "=" * 60)
    print("🌱 Database Seeding Script")
    print("=" * 60 + "\n")
    
    # Step 1: Clear existing database
    clear_database()
    print()
    
    # Step 2: Create fake meetings
    print("📝 Creating fake meetings and states...")
    meetings = create_fake_meetings()
    print()
    
    # Summary
    print("=" * 60)
    print("✨ Seeding Complete!")
    print("=" * 60)
    print(f"\n   Total meetings created: {len(meetings)}")
    print(f"   Database location: {DB_PATH}")
    print("\n   Meeting IDs:")
    for m in meetings:
        print(f"   - {m['meeting_id']} ({m['org_id']}, {m['status']}, {m['workflows_count']} workflows)")
    print()


if __name__ == "__main__":
    main()

