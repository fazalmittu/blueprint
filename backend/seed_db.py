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
from models.workflow_schema import Model as Workflow, Node, Edge, Type as NodeType, Variant as NodeVariant


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
            "title": "Q1 Roadmap Planning",
            "summary": "• Discussed Q1 roadmap priorities\n• Team agreed to focus on customer onboarding improvements\n• API v2 launch scheduled for end of quarter\n• Sarah will lead the onboarding workstream\n• Mike handles API development",
            "workflows": [
                {
                    "title": "Customer Onboarding Process",
                    "nodes": [
                        {"id": "n1", "type": "terminal", "label": "New Customer Signs Up", "variant": "start"},
                        {"id": "n2", "type": "process", "label": "Welcome Email Sent"},
                        {"id": "n3", "type": "process", "label": "Account Setup Wizard"},
                        {"id": "n4", "type": "decision", "label": "Completed Setup?"},
                        {"id": "n5", "type": "process", "label": "Assign Success Manager"},
                        {"id": "n6", "type": "process", "label": "Send Reminder Email"},
                        {"id": "n7", "type": "process", "label": "Schedule Kickoff Call"},
                        {"id": "n8", "type": "terminal", "label": "30-Day Check-in", "variant": "end"},
                    ],
                    "edges": [
                        {"id": "e1", "source": "n1", "target": "n2"},
                        {"id": "e2", "source": "n2", "target": "n3"},
                        {"id": "e3", "source": "n3", "target": "n4"},
                        {"id": "e4", "source": "n4", "target": "n5", "label": "Yes"},
                        {"id": "e5", "source": "n4", "target": "n6", "label": "No"},
                        {"id": "e6", "source": "n6", "target": "n3"},
                        {"id": "e7", "source": "n5", "target": "n7"},
                        {"id": "e8", "source": "n7", "target": "n8"},
                    ],
                    "sources": ["chunk_0", "chunk_1", "chunk_2"]
                },
                {
                    "title": "API Release Process",
                    "nodes": [
                        {"id": "n1", "type": "terminal", "label": "Feature Complete", "variant": "start"},
                        {"id": "n2", "type": "process", "label": "Internal Testing"},
                        {"id": "n3", "type": "process", "label": "Security Review"},
                        {"id": "n4", "type": "process", "label": "Beta Release"},
                        {"id": "n5", "type": "process", "label": "Gather Feedback"},
                        {"id": "n6", "type": "decision", "label": "Issues Found?"},
                        {"id": "n7", "type": "process", "label": "Fix Issues"},
                        {"id": "n8", "type": "process", "label": "Production Release"},
                        {"id": "n9", "type": "terminal", "label": "Update Documentation", "variant": "end"},
                    ],
                    "edges": [
                        {"id": "e1", "source": "n1", "target": "n2"},
                        {"id": "e2", "source": "n2", "target": "n3"},
                        {"id": "e3", "source": "n3", "target": "n4"},
                        {"id": "e4", "source": "n4", "target": "n5"},
                        {"id": "e5", "source": "n5", "target": "n6"},
                        {"id": "e6", "source": "n6", "target": "n7", "label": "Yes"},
                        {"id": "e7", "source": "n7", "target": "n2"},
                        {"id": "e8", "source": "n6", "target": "n8", "label": "No"},
                        {"id": "e9", "source": "n8", "target": "n9"},
                    ],
                    "sources": ["chunk_3", "chunk_4"]
                }
            ]
        },
        {
            "org_id": "startup-inc",
            "title": "Sprint Retrospective",
            "summary": "• Sprint retrospective meeting held\n• Team identified bottlenecks in code review process\n• Decision to implement pair programming for complex features\n• Will automate deployment pipeline",
            "workflows": [
                {
                    "title": "Code Review Workflow",
                    "nodes": [
                        {"id": "n1", "type": "terminal", "label": "Developer Creates PR", "variant": "start"},
                        {"id": "n2", "type": "process", "label": "Automated Tests Run"},
                        {"id": "n3", "type": "decision", "label": "Tests Pass?"},
                        {"id": "n4", "type": "process", "label": "Developer Fixes Issues"},
                        {"id": "n5", "type": "process", "label": "Request Code Review"},
                        {"id": "n6", "type": "process", "label": "Reviewer Assigned"},
                        {"id": "n7", "type": "decision", "label": "Approved?"},
                        {"id": "n8", "type": "process", "label": "Address Feedback"},
                        {"id": "n9", "type": "process", "label": "Merge to Main"},
                        {"id": "n10", "type": "terminal", "label": "Auto Deploy to Staging", "variant": "end"},
                    ],
                    "edges": [
                        {"id": "e1", "source": "n1", "target": "n2"},
                        {"id": "e2", "source": "n2", "target": "n3"},
                        {"id": "e3", "source": "n3", "target": "n4", "label": "No"},
                        {"id": "e4", "source": "n4", "target": "n2"},
                        {"id": "e5", "source": "n3", "target": "n5", "label": "Yes"},
                        {"id": "e6", "source": "n5", "target": "n6"},
                        {"id": "e7", "source": "n6", "target": "n7"},
                        {"id": "e8", "source": "n7", "target": "n8", "label": "No"},
                        {"id": "e9", "source": "n8", "target": "n5"},
                        {"id": "e10", "source": "n7", "target": "n9", "label": "Yes"},
                        {"id": "e11", "source": "n9", "target": "n10"},
                    ],
                    "sources": ["chunk_0", "chunk_1"]
                }
            ]
        },
        {
            "org_id": "enterprise-solutions",
            "title": "Outage Post-Mortem",
            "summary": "• Incident post-mortem for last week's outage\n• Root cause: database connection pool exhaustion\n• Action item: implement connection monitoring\n• Action item: add circuit breakers\n• Action item: improve alerting thresholds",
            "workflows": [
                {
                    "title": "Incident Response Process",
                    "nodes": [
                        {"id": "n1", "type": "terminal", "label": "Alert Triggered", "variant": "start"},
                        {"id": "n2", "type": "process", "label": "On-Call Notified"},
                        {"id": "n3", "type": "process", "label": "Initial Assessment"},
                        {"id": "n4", "type": "decision", "label": "Severity Level?"},
                        {"id": "n5", "type": "process", "label": "War Room Created"},
                        {"id": "n6", "type": "process", "label": "Senior Engineer Paged"},
                        {"id": "n7", "type": "process", "label": "Normal Handling"},
                        {"id": "n8", "type": "process", "label": "Identify Root Cause"},
                        {"id": "n9", "type": "process", "label": "Implement Fix"},
                        {"id": "n10", "type": "process", "label": "Verify Resolution"},
                        {"id": "n11", "type": "terminal", "label": "Post-Mortem Scheduled", "variant": "end"},
                    ],
                    "edges": [
                        {"id": "e1", "source": "n1", "target": "n2"},
                        {"id": "e2", "source": "n2", "target": "n3"},
                        {"id": "e3", "source": "n3", "target": "n4"},
                        {"id": "e4", "source": "n4", "target": "n5", "label": "Critical"},
                        {"id": "e5", "source": "n4", "target": "n6", "label": "High"},
                        {"id": "e6", "source": "n4", "target": "n7", "label": "Medium"},
                        {"id": "e7", "source": "n5", "target": "n8"},
                        {"id": "e8", "source": "n6", "target": "n8"},
                        {"id": "e9", "source": "n7", "target": "n8"},
                        {"id": "e10", "source": "n8", "target": "n9"},
                        {"id": "e11", "source": "n9", "target": "n10"},
                        {"id": "e12", "source": "n10", "target": "n11"},
                    ],
                    "sources": ["chunk_0", "chunk_2", "chunk_3"]
                },
                {
                    "title": "Database Monitoring Setup",
                    "nodes": [
                        {"id": "n1", "type": "terminal", "label": "Connection Pool Metric", "variant": "start"},
                        {"id": "n2", "type": "decision", "label": "Usage > 80%?"},
                        {"id": "n3", "type": "process", "label": "Warning Alert"},
                        {"id": "n4", "type": "process", "label": "Continue Monitoring"},
                        {"id": "n5", "type": "decision", "label": "Usage > 95%?"},
                        {"id": "n6", "type": "process", "label": "Critical Alert"},
                        {"id": "n7", "type": "process", "label": "Log Warning"},
                        {"id": "n8", "type": "process", "label": "Auto-Scale Triggered"},
                        {"id": "n9", "type": "terminal", "label": "Notify Team", "variant": "end"},
                    ],
                    "edges": [
                        {"id": "e1", "source": "n1", "target": "n2"},
                        {"id": "e2", "source": "n2", "target": "n3", "label": "Yes"},
                        {"id": "e3", "source": "n2", "target": "n4", "label": "No"},
                        {"id": "e4", "source": "n3", "target": "n5"},
                        {"id": "e5", "source": "n5", "target": "n6", "label": "Yes"},
                        {"id": "e6", "source": "n5", "target": "n7", "label": "No"},
                        {"id": "e7", "source": "n6", "target": "n8"},
                        {"id": "e8", "source": "n8", "target": "n9"},
                    ],
                    "sources": ["chunk_4", "chunk_5"]
                }
            ]
        },
        {
            "org_id": "acme-corp",
            "title": "Mobile App Design Review",
            "summary": "• Product design review for mobile app redesign\n• Agreed on new navigation structure\n• Updated color scheme approved\n• UX team will create prototypes by next Friday",
            "workflows": [
                {
                    "title": "Design Review Process",
                    "nodes": [
                        {"id": "n1", "type": "terminal", "label": "Designer Creates Mockups", "variant": "start"},
                        {"id": "n2", "type": "process", "label": "Internal Design Review"},
                        {"id": "n3", "type": "decision", "label": "Approved?"},
                        {"id": "n4", "type": "process", "label": "Iterate on Feedback"},
                        {"id": "n5", "type": "process", "label": "Stakeholder Presentation"},
                        {"id": "n6", "type": "decision", "label": "Changes Needed?"},
                        {"id": "n7", "type": "process", "label": "Document Changes"},
                        {"id": "n8", "type": "process", "label": "Create Prototype"},
                        {"id": "n9", "type": "process", "label": "User Testing"},
                        {"id": "n10", "type": "terminal", "label": "Final Approval", "variant": "end"},
                    ],
                    "edges": [
                        {"id": "e1", "source": "n1", "target": "n2"},
                        {"id": "e2", "source": "n2", "target": "n3"},
                        {"id": "e3", "source": "n3", "target": "n4", "label": "No"},
                        {"id": "e4", "source": "n4", "target": "n2"},
                        {"id": "e5", "source": "n3", "target": "n5", "label": "Yes"},
                        {"id": "e6", "source": "n5", "target": "n6"},
                        {"id": "e7", "source": "n6", "target": "n7", "label": "Yes"},
                        {"id": "e8", "source": "n7", "target": "n4"},
                        {"id": "e9", "source": "n6", "target": "n8", "label": "No"},
                        {"id": "e10", "source": "n8", "target": "n9"},
                        {"id": "e11", "source": "n9", "target": "n10"},
                    ],
                    "sources": ["chunk_0", "chunk_1", "chunk_2"]
                }
            ]
        },
        {
            "org_id": "startup-inc",
            "title": "Weekly Standup",
            "summary": "• Empty meeting - no discussion topics were covered.",
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
            orgId=data["org_id"],
            title=data.get("title")
        )
        create_meeting(meeting)
        
        # Create workflows from fake data
        workflows = []
        for wf_data in data["workflows"]:
            # Parse nodes
            nodes = []
            for node_data in wf_data["nodes"]:
                node = Node(
                    id=node_data["id"],
                    type=NodeType(node_data["type"]),
                    label=node_data["label"],
                    variant=NodeVariant(node_data["variant"]) if node_data.get("variant") else None
                )
                nodes.append(node)
            
            # Parse edges
            edges = []
            for edge_data in wf_data["edges"]:
                edge = Edge(
                    id=edge_data["id"],
                    source=edge_data["source"],
                    target=edge_data["target"],
                    label=edge_data.get("label")
                )
                edges.append(edge)
            
            workflow = Workflow(
                id=str(uuid.uuid4()),
                title=wf_data["title"],
                nodes=nodes,
                edges=edges,
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
            "title": data.get("title", "Untitled"),
            "status": status.value,
            "workflows_count": len(workflows)
        })
        
        print(f"   ✅ Created meeting {i+1}: {data.get('title', 'Untitled')} ({data['org_id']}, {len(workflows)} workflows)")
    
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
    print("\n   Meetings:")
    for m in meetings:
        print(f"   - {m['title']} ({m['org_id']}, {m['workflows_count']} workflows)")
    print()


if __name__ == "__main__":
    main()
