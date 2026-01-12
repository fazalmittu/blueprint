#!/usr/bin/env python3
"""
⚠️ DEPRECATED: This script is kept for reference but is no longer the primary seeding method.

For evaluation purposes, use the MeetingBank-based seed data instead:
    python seed_meetingbank.py

This creates a comprehensive test dataset for evaluating the search system.

---

Original description:
Database seeding script with full indexing support.
Clears existing database and populates it with rich test data including:
- Meeting transcripts
- Meeting summaries
- Workflows with detailed nodes/edges
- Full search indexing
"""
import os
import sys
import uuid
import time

# Add backend to path so we can import modules
backend_path = os.path.dirname(__file__)
sys.path.insert(0, backend_path)

from database import DB_PATH, init_db, create_meeting, add_state_version, get_db, update_meeting_status
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


def clear_search_index():
    """Clear the search index."""
    from pathlib import Path
    import shutil
    
    faiss_dir = Path(__file__).parent / "data" / "faiss"
    if faiss_dir.exists():
        print("🗑️  Clearing search index...")
        shutil.rmtree(faiss_dir)
        faiss_dir.mkdir(parents=True, exist_ok=True)
        print("   ✅ Search index cleared!")


# ==================== RICH TEST DATA ====================

FAKE_MEETINGS = [
    # ==================== ACME CORP MEETINGS ====================
    {
        "org_id": "acme-corp",
        "title": "Q1 Product Roadmap Planning",
        "transcript": """
Sarah: Good morning everyone! Let's dive into our Q1 roadmap planning. We have a lot to cover today.

Mike: Thanks Sarah. I've been looking at our customer feedback from last quarter and I think we really need to prioritize the onboarding experience.

Sarah: That's a great point. What specifically are customers struggling with?

Mike: The main issues are around the initial account setup. About 40% of users drop off during the setup wizard before completing it. They find it too long and confusing.

Tom: I can confirm that from the support tickets. We get at least 20 tickets a day about the setup process. The most common complaints are about connecting their payment method and understanding the pricing tiers.

Sarah: Okay, so we need to simplify the setup wizard. Mike, can you lead that initiative?

Mike: Absolutely. I'm thinking we break it into three shorter steps instead of one long form. First just basic info, then billing, then optional customization.

Lisa: That sounds good. We should also add progress indicators so users know how far along they are.

Sarah: Love it. What about the API v2 launch? Where are we on that?

Tom: We're about 70% done with the core functionality. The main blockers are the new authentication system and the rate limiting implementation.

Mike: When do you think we can get to beta?

Tom: If we stay focused, end of February for internal beta, then public beta by mid-March.

Sarah: That works with our timeline. We promised enterprise customers the new webhooks feature by end of Q1.

Lisa: Speaking of enterprise, I've been working on the new dashboard designs. I have mockups ready for review.

Sarah: Perfect. Can you schedule a design review for next week?

Lisa: Will do. I'll send out a calendar invite this afternoon.

Tom: One more thing - we should discuss the mobile app. Are we still planning to launch the iOS version this quarter?

Sarah: That's a stretch goal. Let's focus on the core platform first and see where we are by end of February.

Mike: Agreed. We don't want to spread ourselves too thin.

Sarah: Alright team, great discussion. To summarize: Mike leads onboarding improvements, Tom continues API v2 development with February beta target, Lisa schedules design review. Let's reconvene next week.
        """,
        "summary": """• Q1 roadmap planning session held with product and engineering teams
• Customer onboarding identified as top priority - 40% drop-off rate during setup
• Plan to simplify setup wizard into 3 shorter steps: basic info, billing, customization
• API v2 development at 70% completion, targeting February internal beta
• Public beta planned for mid-March with new webhooks for enterprise customers
• New dashboard designs ready for review - Lisa scheduling design review next week
• iOS mobile app launch is stretch goal, focusing on core platform first
• Mike leading onboarding workstream, Tom on API v2, Lisa on design""",
        "workflows": [
            {
                "title": "Customer Onboarding Flow",
                "nodes": [
                    {"id": "n1", "type": "terminal", "label": "New Customer Signs Up", "variant": "start"},
                    {"id": "n2", "type": "process", "label": "Welcome Email Sent"},
                    {"id": "n3", "type": "process", "label": "Basic Info Collection"},
                    {"id": "n4", "type": "process", "label": "Billing Setup"},
                    {"id": "n5", "type": "process", "label": "Optional Customization"},
                    {"id": "n6", "type": "decision", "label": "Setup Complete?"},
                    {"id": "n7", "type": "process", "label": "Assign Success Manager"},
                    {"id": "n8", "type": "process", "label": "Send Reminder"},
                    {"id": "n9", "type": "terminal", "label": "Onboarding Complete", "variant": "end"},
                ],
                "edges": [
                    {"id": "e1", "source": "n1", "target": "n2"},
                    {"id": "e2", "source": "n2", "target": "n3"},
                    {"id": "e3", "source": "n3", "target": "n4"},
                    {"id": "e4", "source": "n4", "target": "n5"},
                    {"id": "e5", "source": "n5", "target": "n6"},
                    {"id": "e6", "source": "n6", "target": "n7", "label": "Yes"},
                    {"id": "e7", "source": "n6", "target": "n8", "label": "No"},
                    {"id": "e8", "source": "n8", "target": "n3"},
                    {"id": "e9", "source": "n7", "target": "n9"},
                ],
                "sources": ["chunk_0", "chunk_1"]
            },
            {
                "title": "API v2 Release Process",
                "nodes": [
                    {"id": "n1", "type": "terminal", "label": "Feature Development Complete", "variant": "start"},
                    {"id": "n2", "type": "process", "label": "Internal Testing"},
                    {"id": "n3", "type": "process", "label": "Security Review"},
                    {"id": "n4", "type": "process", "label": "Internal Beta Release"},
                    {"id": "n5", "type": "process", "label": "Public Beta"},
                    {"id": "n6", "type": "decision", "label": "Issues Found?"},
                    {"id": "n7", "type": "process", "label": "Fix Critical Issues"},
                    {"id": "n8", "type": "process", "label": "Production Release"},
                    {"id": "n9", "type": "terminal", "label": "Documentation Updated", "variant": "end"},
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
                "sources": ["chunk_2", "chunk_3"]
            }
        ]
    },
    {
        "org_id": "acme-corp",
        "title": "Enterprise Customer Success Review",
        "transcript": """
Jennifer: Welcome everyone to our monthly enterprise customer success review. Let's start with our top accounts.

David: Sure. Our biggest account, GlobalTech Industries, renewed their contract last week for another 2 years. They're expanding from 500 to 1200 seats.

Jennifer: That's fantastic news! What drove the expansion?

David: They loved the new reporting features we shipped last month. Their VP of Operations said it saved them 10 hours per week in manual reporting.

Marcus: Speaking of GlobalTech, they did request some custom integrations with their SAP system. Is that something we can accommodate?

David: I've already talked to engineering. Tom said they can build a custom connector, but it would be a 6-week project.

Jennifer: Let's discuss pricing for that. Custom integrations should be billed separately.

David: Agreed. I'm thinking $50k for the initial build plus $5k per month for maintenance and support.

Jennifer: That sounds reasonable. What about our other enterprise accounts?

Marcus: SecureBank has been having some issues with our SSO integration. They're using Okta and experiencing intermittent login failures.

Jennifer: That's concerning. Have we escalated to engineering?

Marcus: Yes, Tom's team is investigating. It seems to be related to our recent security update. They expect a fix by end of week.

Jennifer: Good. What's the customer sentiment? Are they frustrated?

Marcus: Their IT team is understanding since we've been responsive. But we should probably offer them a service credit as a goodwill gesture.

Jennifer: I agree. Let's offer them 10% credit on their next invoice. David, can you handle that conversation?

David: Absolutely. I'll reach out to their account manager today.

Jennifer: Great. Now let's talk about our pipeline. Any new enterprise prospects we're working on?

Marcus: Yes! I had a great call with MegaRetail Corp yesterday. They're looking for a vendor to replace their legacy system. It would be a 2000-seat deal worth about $800k annually.

Jennifer: That's huge! What's the timeline?

Marcus: They want to make a decision by end of Q1. I'm scheduling a demo for next week.

Jennifer: Perfect. Let's make sure we bring our A-game to that demo. Anything they specifically care about?

Marcus: Data security and compliance are their top priorities. They're in retail, so PCI compliance is critical.

Jennifer: Good to know. Let's prepare a custom security overview for them.

David: I can help with that. I have a template from the GlobalTech deal we can adapt.

Jennifer: Excellent teamwork. Alright, let's wrap up. Action items: David handles GlobalTech SAP integration pricing and SecureBank credit, Marcus prepares MegaRetail demo. Anything else?

Marcus: Just a reminder that our quarterly business review with FinanceFirst is next Tuesday.

Jennifer: Right, I have that on my calendar. Thanks everyone!
        """,
        "summary": """• Monthly enterprise customer success review conducted
• GlobalTech Industries renewed for 2 years, expanding from 500 to 1200 seats
• GlobalTech requested custom SAP integration - 6-week project quoted at $50k + $5k/month
• SecureBank experiencing SSO/Okta integration issues - fix expected end of week
• Offering SecureBank 10% service credit as goodwill gesture
• New prospect MegaRetail Corp - potential 2000-seat deal worth $800k annually
• MegaRetail demo scheduled for next week, focusing on PCI compliance and security
• FinanceFirst quarterly business review scheduled for next Tuesday
• David handling GlobalTech pricing and SecureBank credit, Marcus preparing MegaRetail demo""",
        "workflows": [
            {
                "title": "Enterprise Deal Renewal Process",
                "nodes": [
                    {"id": "n1", "type": "terminal", "label": "Renewal Date Approaching", "variant": "start"},
                    {"id": "n2", "type": "process", "label": "Account Review"},
                    {"id": "n3", "type": "process", "label": "Usage Analysis"},
                    {"id": "n4", "type": "process", "label": "Prepare Renewal Proposal"},
                    {"id": "n5", "type": "decision", "label": "Expansion Opportunity?"},
                    {"id": "n6", "type": "process", "label": "Upsell Discussion"},
                    {"id": "n7", "type": "process", "label": "Standard Renewal"},
                    {"id": "n8", "type": "process", "label": "Contract Negotiation"},
                    {"id": "n9", "type": "process", "label": "Legal Review"},
                    {"id": "n10", "type": "terminal", "label": "Contract Signed", "variant": "end"},
                ],
                "edges": [
                    {"id": "e1", "source": "n1", "target": "n2"},
                    {"id": "e2", "source": "n2", "target": "n3"},
                    {"id": "e3", "source": "n3", "target": "n4"},
                    {"id": "e4", "source": "n4", "target": "n5"},
                    {"id": "e5", "source": "n5", "target": "n6", "label": "Yes"},
                    {"id": "e6", "source": "n5", "target": "n7", "label": "No"},
                    {"id": "e7", "source": "n6", "target": "n8"},
                    {"id": "e8", "source": "n7", "target": "n8"},
                    {"id": "e9", "source": "n8", "target": "n9"},
                    {"id": "e10", "source": "n9", "target": "n10"},
                ],
                "sources": ["chunk_0", "chunk_1"]
            },
            {
                "title": "Custom Integration Request Handling",
                "nodes": [
                    {"id": "n1", "type": "terminal", "label": "Customer Requests Integration", "variant": "start"},
                    {"id": "n2", "type": "process", "label": "Technical Assessment"},
                    {"id": "n3", "type": "decision", "label": "Feasible?"},
                    {"id": "n4", "type": "process", "label": "Scope Definition"},
                    {"id": "n5", "type": "process", "label": "Pricing Proposal"},
                    {"id": "n6", "type": "process", "label": "Decline with Alternatives"},
                    {"id": "n7", "type": "decision", "label": "Customer Approves?"},
                    {"id": "n8", "type": "process", "label": "Development Sprint"},
                    {"id": "n9", "type": "process", "label": "Testing & Deployment"},
                    {"id": "n10", "type": "terminal", "label": "Integration Live", "variant": "end"},
                ],
                "edges": [
                    {"id": "e1", "source": "n1", "target": "n2"},
                    {"id": "e2", "source": "n2", "target": "n3"},
                    {"id": "e3", "source": "n3", "target": "n4", "label": "Yes"},
                    {"id": "e4", "source": "n3", "target": "n6", "label": "No"},
                    {"id": "e5", "source": "n4", "target": "n5"},
                    {"id": "e6", "source": "n5", "target": "n7"},
                    {"id": "e7", "source": "n7", "target": "n8", "label": "Yes"},
                    {"id": "e8", "source": "n7", "target": "n6", "label": "No"},
                    {"id": "e9", "source": "n8", "target": "n9"},
                    {"id": "e10", "source": "n9", "target": "n10"},
                ],
                "sources": ["chunk_2"]
            }
        ]
    },
    {
        "org_id": "acme-corp",
        "title": "Engineering Sprint Planning",
        "transcript": """
Tom: Alright team, let's plan our next two-week sprint. We have a full backlog to work through.

Anna: Before we start, can we address the tech debt issue? Our test coverage has dropped to 65% and it's causing bugs to slip through.

Tom: Good point. Let's allocate 20% of our capacity to tech debt this sprint. That means roughly 4 story points per developer.

Ben: Sounds fair. What are the priority items from product?

Tom: Sarah flagged three things: the payment retry logic fix, the new user dashboard, and the bulk import feature.

Anna: The payment retry logic is critical. We had two customers complain about failed charges not being retried properly.

Ben: I can take that one. I wrote the original payment integration, so I'm familiar with the codebase.

Tom: Perfect. Anna, can you handle the user dashboard?

Anna: Sure. Do we have designs for it yet?

Tom: Lisa sent over the Figma files yesterday. I'll share the link in Slack.

Anna: Great. I estimate it's about 8 story points.

Tom: That leaves the bulk import feature. This is for enterprise customers who want to upload thousands of records at once.

Ben: That's a bigger project. We'll need to handle file parsing, validation, progress tracking, and error reporting.

Tom: I agree. Let's scope it out. What are the main components?

Anna: I'd break it into: file upload with drag-and-drop, CSV parsing and validation, background job processing, real-time progress updates, and error report generation.

Ben: Don't forget rate limiting. We don't want a single import to overload our database.

Tom: Good call. Let's add that to the spec. This sounds like a 2-sprint project minimum.

Anna: We could deliver an MVP in one sprint - just the basic upload and processing without real-time updates.

Tom: Let's do that. MVP this sprint, polish next sprint.

Ben: What about the infrastructure work for the new caching layer?

Tom: That's been deprioritized. Product wants us focused on customer-facing features for Q1.

Anna: Makes sense. We can revisit caching in Q2.

Tom: Okay, let's finalize. Ben takes payment retry (5 points), Anna takes dashboard (8 points), and we split the bulk import MVP between the three of us. I'll handle the backend job processing.

Ben: What about the bug fixes in the backlog?

Tom: Let's timebox 2 hours each Friday for bug fixes. We'll tackle the highest priority ones.

Anna: Works for me. Should we also schedule the code review rotation?

Tom: Yes, let's keep the same rotation as last sprint. Ben reviews Anna's code, Anna reviews mine, I review Ben's.

Ben: Perfect. Are we doing daily standups at 9am again?

Tom: Yes, but let's keep them to 10 minutes max. Last sprint they were running 20 minutes.

Anna: Agreed. We can use Slack for async updates on blockers.

Tom: Great. Sprint starts tomorrow. Let's crush it!
        """,
        "summary": """• Engineering sprint planning for two-week cycle
• 20% capacity allocated to tech debt - test coverage dropped to 65%
• Priority items: payment retry logic fix, new user dashboard, bulk import feature
• Ben taking payment retry fix (5 points) - critical issue with failed charges
• Anna handling user dashboard (8 points) - Figma designs available
• Bulk import MVP planned for this sprint, full feature in 2 sprints total
• Bulk import components: file upload, CSV parsing, background jobs, progress tracking, error reporting
• Rate limiting to be added to bulk import spec
• Infrastructure caching work deprioritized until Q2
• Friday bug fix timebox established - 2 hours each Friday
• Code review rotation maintained: Ben→Anna, Anna→Tom, Tom→Ben
• Daily standups at 9am, capped at 10 minutes with Slack for async blockers""",
        "workflows": [
            {
                "title": "Bulk Import Processing Flow",
                "nodes": [
                    {"id": "n1", "type": "terminal", "label": "User Uploads CSV", "variant": "start"},
                    {"id": "n2", "type": "process", "label": "File Validation"},
                    {"id": "n3", "type": "decision", "label": "Valid Format?"},
                    {"id": "n4", "type": "process", "label": "Show Error Message"},
                    {"id": "n5", "type": "process", "label": "Parse CSV Rows"},
                    {"id": "n6", "type": "process", "label": "Create Background Job"},
                    {"id": "n7", "type": "process", "label": "Process Records"},
                    {"id": "n8", "type": "decision", "label": "All Rows Valid?"},
                    {"id": "n9", "type": "process", "label": "Generate Error Report"},
                    {"id": "n10", "type": "process", "label": "Update Progress"},
                    {"id": "n11", "type": "terminal", "label": "Import Complete", "variant": "end"},
                ],
                "edges": [
                    {"id": "e1", "source": "n1", "target": "n2"},
                    {"id": "e2", "source": "n2", "target": "n3"},
                    {"id": "e3", "source": "n3", "target": "n4", "label": "No"},
                    {"id": "e4", "source": "n3", "target": "n5", "label": "Yes"},
                    {"id": "e5", "source": "n5", "target": "n6"},
                    {"id": "e6", "source": "n6", "target": "n7"},
                    {"id": "e7", "source": "n7", "target": "n8"},
                    {"id": "e8", "source": "n8", "target": "n9", "label": "No"},
                    {"id": "e9", "source": "n8", "target": "n10", "label": "Yes"},
                    {"id": "e10", "source": "n9", "target": "n10"},
                    {"id": "e11", "source": "n10", "target": "n11"},
                ],
                "sources": ["chunk_2", "chunk_3"]
            },
            {
                "title": "Sprint Code Review Process",
                "nodes": [
                    {"id": "n1", "type": "terminal", "label": "Developer Creates PR", "variant": "start"},
                    {"id": "n2", "type": "process", "label": "Automated Tests Run"},
                    {"id": "n3", "type": "decision", "label": "Tests Pass?"},
                    {"id": "n4", "type": "process", "label": "Fix Failing Tests"},
                    {"id": "n5", "type": "process", "label": "Assign Reviewer"},
                    {"id": "n6", "type": "process", "label": "Code Review"},
                    {"id": "n7", "type": "decision", "label": "Approved?"},
                    {"id": "n8", "type": "process", "label": "Address Feedback"},
                    {"id": "n9", "type": "process", "label": "Merge to Main"},
                    {"id": "n10", "type": "terminal", "label": "Deploy to Staging", "variant": "end"},
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
                    {"id": "e9", "source": "n8", "target": "n6"},
                    {"id": "e10", "source": "n7", "target": "n9", "label": "Yes"},
                    {"id": "e11", "source": "n9", "target": "n10"},
                ],
                "sources": ["chunk_4"]
            }
        ]
    },
    
    # ==================== STARTUP INC MEETINGS ====================
    {
        "org_id": "startup-inc",
        "title": "Series A Fundraising Strategy",
        "transcript": """
Alex: Thanks for joining this strategy session. We need to finalize our Series A approach.

Rachel: Let's start with the numbers. What's our current runway and how much are we looking to raise?

Alex: We have 8 months of runway left. I'm thinking we should raise $10-15 million at a $50 million pre-money valuation.

Chris: Is that valuation realistic? Our ARR is at $2M right now.

Alex: It's aggressive but defensible. We're growing 20% month-over-month and our net revenue retention is 140%.

Rachel: Those are strong metrics. What's our investor target list looking like?

Alex: I've identified 30 potential leads. Top tier includes Sequoia, a]16z, and Benchmark. Second tier is Accel, Greylock, and Index.

Chris: Have we had any warm intros yet?

Alex: Yes, our seed investor at First Round has offered to intro us to Sequoia and Benchmark. That's a good starting point.

Rachel: We should also consider strategic investors. Any interest from potential acquirers or partners?

Alex: Good thinking. Salesforce Ventures reached out last month. They're interested in companies in our space.

Chris: That could be a double-edged sword though. Strategic investment might limit our options later.

Alex: True. Let's keep them as a backup option if the traditional VC route doesn't work.

Rachel: What about our pitch deck? Is it ready?

Alex: The first version is done. I'd like everyone to review it and give feedback by Friday.

Chris: What's the key story we're telling?

Alex: We're positioning ourselves as the platform that solves workflow automation for mid-market companies. The big players like Zapier target SMBs, the enterprise solutions are too expensive. We're the Goldilocks solution.

Rachel: I love that positioning. Do we have case studies to back it up?

Alex: Yes, three strong ones. TechStart reduced their manual work by 60%, GrowthCo saved $200K annually, and ScaleUp cut their onboarding time in half.

Chris: We should also prepare for due diligence. What documents do they typically ask for?

Alex: Financial model, cap table, customer contracts, team bios, and technical architecture overview.

Rachel: I can own the financial model. Chris, can you work on the technical architecture doc?

Chris: On it. I'll have a draft by next week.

Alex: Perfect. Let's also prep for the hard questions. What are our weaknesses?

Rachel: Our sales cycle is still long - 45 days average. And we only have one enterprise customer.

Chris: Tech debt is another one. We've been moving fast and accumulated some shortcuts.

Alex: Good to know. Let's prepare honest answers for those. Investors appreciate transparency.

Rachel: What's our timeline for raising?

Alex: I want to close by end of Q2. That means starting serious conversations in February, term sheets by April, and closing by June.

Chris: That's tight but doable if we stay focused.

Alex: Exactly. Alright, action items: Rachel on financial model, Chris on tech docs, I'll finalize the deck and start scheduling meetings. Let's make this happen!
        """,
        "summary": """• Series A fundraising strategy session for startup-inc
• Target raise: $10-15 million at $50 million pre-money valuation
• Current metrics: $2M ARR, 20% MoM growth, 140% net revenue retention, 8 months runway
• Investor targets: Tier 1 (Sequoia, a16z, Benchmark), Tier 2 (Accel, Greylock, Index)
• First Round seed investor offering warm intros to Sequoia and Benchmark
• Salesforce Ventures expressed interest - keeping as backup strategic option
• Positioning: Goldilocks workflow automation platform for mid-market (between SMB and enterprise)
• Case studies: TechStart (60% manual work reduction), GrowthCo ($200K savings), ScaleUp (50% faster onboarding)
• Due diligence prep: financial model, cap table, customer contracts, team bios, technical architecture
• Known weaknesses: 45-day sales cycle, single enterprise customer, tech debt
• Timeline: February conversations, April term sheets, June close
• Rachel owns financial model, Chris owns tech architecture docs, Alex finalizing deck""",
        "workflows": [
            {
                "title": "Series A Fundraising Process",
                "nodes": [
                    {"id": "n1", "type": "terminal", "label": "Prepare Materials", "variant": "start"},
                    {"id": "n2", "type": "process", "label": "Finalize Pitch Deck"},
                    {"id": "n3", "type": "process", "label": "Build Investor List"},
                    {"id": "n4", "type": "process", "label": "Warm Intros"},
                    {"id": "n5", "type": "process", "label": "Initial Meetings"},
                    {"id": "n6", "type": "decision", "label": "Interest?"},
                    {"id": "n7", "type": "process", "label": "Partner Meetings"},
                    {"id": "n8", "type": "process", "label": "Due Diligence"},
                    {"id": "n9", "type": "process", "label": "Term Sheet Negotiation"},
                    {"id": "n10", "type": "process", "label": "Legal Review"},
                    {"id": "n11", "type": "terminal", "label": "Close Round", "variant": "end"},
                ],
                "edges": [
                    {"id": "e1", "source": "n1", "target": "n2"},
                    {"id": "e2", "source": "n2", "target": "n3"},
                    {"id": "e3", "source": "n3", "target": "n4"},
                    {"id": "e4", "source": "n4", "target": "n5"},
                    {"id": "e5", "source": "n5", "target": "n6"},
                    {"id": "e6", "source": "n6", "target": "n4", "label": "No"},
                    {"id": "e7", "source": "n6", "target": "n7", "label": "Yes"},
                    {"id": "e8", "source": "n7", "target": "n8"},
                    {"id": "e9", "source": "n8", "target": "n9"},
                    {"id": "e10", "source": "n9", "target": "n10"},
                    {"id": "e11", "source": "n10", "target": "n11"},
                ],
                "sources": ["chunk_0", "chunk_1", "chunk_2", "chunk_3"]
            }
        ]
    },
    {
        "org_id": "startup-inc",
        "title": "Product Market Fit Analysis",
        "transcript": """
Jordan: Let's dive into our product market fit analysis. I've been reviewing our metrics and customer feedback.

Emma: What's the overall picture looking like?

Jordan: Mixed signals honestly. Our NPS is 45, which is good but not great. Power users love us, but casual users churn quickly.

Emma: What's the churn rate for casual versus power users?

Jordan: Power users - those who use us daily - have 5% monthly churn. Casual users who log in weekly or less have 25% monthly churn.

Derek: That's a huge difference. What features separate power users from casual ones?

Jordan: The main differentiator is whether they set up automations. Users with at least one automation active have 3x higher retention.

Emma: So our core value prop is automation, but we're not getting enough users to that aha moment.

Jordan: Exactly. Only 30% of new signups create their first automation within the first week.

Derek: What's blocking them?

Jordan: Our user research shows three things: the automation builder is confusing, users don't know where to start, and the templates aren't relevant to their use cases.

Emma: We need to fix the first-time user experience then. What if we had a guided setup?

Jordan: I've been thinking about that. A wizard that asks about their role and use case, then recommends specific templates.

Derek: Like Notion's templates based on team type?

Jordan: Yes, exactly. We could have templates for marketing teams, sales teams, operations, etc.

Emma: I love it. What about the automation builder itself?

Jordan: That's a bigger project. But short term, we could add more tooltips and a video walkthrough.

Derek: What about offering a setup call for new users?

Jordan: We tested that last month. It increased activation by 40% but doesn't scale - we can't do calls for everyone.

Emma: Could we automate parts of it? Like a Loom video that walks through their specific use case?

Jordan: Interesting idea. Let me think about how that could work.

Derek: What about our pricing? Is that a barrier?

Jordan: Actually no. Users who churned cited complexity, not cost. Our $29/month price point seems reasonable.

Emma: That's good. So it's purely a product problem, not a pricing problem.

Jordan: Right. If we can get more users to their first successful automation, retention should improve across the board.

Derek: What's the goal then?

Jordan: I'd like to see 50% of new signups create an automation in week one, up from 30% today.

Emma: That's ambitious. But achievable if we nail the onboarding.

Jordan: Agreed. Let's prioritize: first the personalized template recommendations, then the guided wizard, then the builder improvements.

Derek: Makes sense to sequence it that way. Quick wins first.

Jordan: Exactly. Alright, I'll put together a detailed spec and we can review next week.
        """,
        "summary": """• Product market fit analysis for startup-inc
• NPS score is 45 - good but not great, mixed signals on PMF
• Power users (daily) have 5% monthly churn, casual users (weekly or less) have 25% churn
• Key differentiator: users with automations have 3x higher retention
• Only 30% of new signups create first automation in week one - activation problem
• Blockers: confusing automation builder, unclear starting point, irrelevant templates
• Proposed solution: guided wizard asking about role/use case with personalized template recommendations
• Template categories needed: marketing teams, sales teams, operations teams
• Short-term fixes: more tooltips, video walkthrough for automation builder
• Setup calls tested - 40% activation increase but doesn't scale
• Pricing ($29/month) not a barrier - users cite complexity as churn reason
• Goal: increase week-one automation creation from 30% to 50%
• Priority order: personalized templates → guided wizard → builder improvements""",
        "workflows": [
            {
                "title": "New User Activation Flow",
                "nodes": [
                    {"id": "n1", "type": "terminal", "label": "User Signs Up", "variant": "start"},
                    {"id": "n2", "type": "process", "label": "Role Selection"},
                    {"id": "n3", "type": "process", "label": "Use Case Quiz"},
                    {"id": "n4", "type": "process", "label": "Recommend Templates"},
                    {"id": "n5", "type": "decision", "label": "Template Selected?"},
                    {"id": "n6", "type": "process", "label": "One-Click Setup"},
                    {"id": "n7", "type": "process", "label": "Show Blank Canvas"},
                    {"id": "n8", "type": "process", "label": "Guided Tutorial"},
                    {"id": "n9", "type": "process", "label": "First Automation Created"},
                    {"id": "n10", "type": "terminal", "label": "User Activated", "variant": "end"},
                ],
                "edges": [
                    {"id": "e1", "source": "n1", "target": "n2"},
                    {"id": "e2", "source": "n2", "target": "n3"},
                    {"id": "e3", "source": "n3", "target": "n4"},
                    {"id": "e4", "source": "n4", "target": "n5"},
                    {"id": "e5", "source": "n5", "target": "n6", "label": "Yes"},
                    {"id": "e6", "source": "n5", "target": "n7", "label": "No"},
                    {"id": "e7", "source": "n6", "target": "n9"},
                    {"id": "e8", "source": "n7", "target": "n8"},
                    {"id": "e9", "source": "n8", "target": "n9"},
                    {"id": "e10", "source": "n9", "target": "n10"},
                ],
                "sources": ["chunk_1", "chunk_2", "chunk_3"]
            }
        ]
    },
    {
        "org_id": "startup-inc",
        "title": "Hiring Strategy Discussion",
        "transcript": """
Priya: We need to scale the team. Let's discuss our hiring priorities for the next quarter.

Sam: What positions are we looking at?

Priya: Engineering is the biggest need. We need at least two senior backend engineers and one frontend specialist.

Max: We also desperately need a DevOps person. I'm spending half my time on infrastructure instead of features.

Priya: Good point. Let's add DevOps to the list. What about non-engineering roles?

Sam: Marketing. We have no dedicated marketing person. Alex has been doing it all himself, but he's stretched thin with fundraising.

Priya: True. Should we hire a head of marketing or start with a more junior growth role?

Sam: I'd say head of marketing. We need someone who can build the function, not just execute tactics.

Max: What about customer success? Our support queue is always backed up.

Priya: Let's plan for one customer success manager this quarter, with a second in Q2.

Sam: That's a lot of hires. Can we afford it with our current runway?

Priya: If we close the Series A, yes. We should start the hiring process now so we're ready to pull the trigger once funding is secured.

Max: What's our approach to finding candidates?

Priya: For engineering, I want to prioritize referrals. Our team knows talented people.

Sam: We could also post on specialized job boards. I've had luck with Key Values and Hacker News Who's Hiring.

Priya: Good ideas. For the marketing role, I think we need a recruiter. That's a harder search.

Max: What about our interview process? It's pretty ad-hoc right now.

Priya: You're right. We should standardize it. Let's do a phone screen, technical challenge, then on-site with team interviews.

Sam: For non-technical roles, maybe a take-home project instead of technical challenge?

Priya: Makes sense. Max, can you design a standardized engineering interview rubric?

Max: Sure. I'll model it after what we saw at Google.

Priya: Great. Sam, can you research marketing recruiters and get some quotes?

Sam: Will do. Any budget constraints?

Priya: Let's say 20-25% of first year salary as the recruiter fee. That's standard.

Max: What about compensation benchmarks? We need to be competitive.

Priya: I'll pull data from Levels.fyi and Option Impact. We should be at 75th percentile for our stage.

Sam: Equity too. What's our pool looking like?

Priya: We have 15% reserved for the option pool. Plenty of room for key hires.

Priya: Alright, let's wrap up. Max on interview process, Sam on recruiter research, I'll handle comp benchmarks. Let's reconvene in a week.
        """,
        "summary": """• Hiring strategy discussion for startup-inc scaling
• Engineering needs: 2 senior backend engineers, 1 frontend specialist, 1 DevOps
• Non-engineering needs: Head of Marketing, 1 Customer Success Manager (Q2: second CSM)
• Hiring contingent on Series A close - starting process now to be ready
• Candidate sourcing: referrals for engineering, Key Values and HN for postings, recruiter for marketing
• Interview process standardization needed: phone screen → technical challenge → on-site
• Non-technical roles: take-home project instead of technical challenge
• Max designing standardized engineering interview rubric (modeled after Google)
• Recruiter budget: 20-25% of first year salary
• Compensation targeting 75th percentile for stage (using Levels.fyi, Option Impact)
• Option pool: 15% reserved, plenty of room for key hires
• Sam researching marketing recruiters, Max on interview process, Priya on comp benchmarks""",
        "workflows": [
            {
                "title": "Engineering Hiring Process",
                "nodes": [
                    {"id": "n1", "type": "terminal", "label": "Role Opened", "variant": "start"},
                    {"id": "n2", "type": "process", "label": "Post Job Description"},
                    {"id": "n3", "type": "process", "label": "Source Candidates"},
                    {"id": "n4", "type": "process", "label": "Resume Screen"},
                    {"id": "n5", "type": "process", "label": "Phone Screen"},
                    {"id": "n6", "type": "decision", "label": "Advance?"},
                    {"id": "n7", "type": "process", "label": "Technical Challenge"},
                    {"id": "n8", "type": "decision", "label": "Pass?"},
                    {"id": "n9", "type": "process", "label": "On-site Interviews"},
                    {"id": "n10", "type": "decision", "label": "Hire?"},
                    {"id": "n11", "type": "process", "label": "Reference Check"},
                    {"id": "n12", "type": "process", "label": "Extend Offer"},
                    {"id": "n13", "type": "terminal", "label": "Candidate Joins", "variant": "end"},
                ],
                "edges": [
                    {"id": "e1", "source": "n1", "target": "n2"},
                    {"id": "e2", "source": "n2", "target": "n3"},
                    {"id": "e3", "source": "n3", "target": "n4"},
                    {"id": "e4", "source": "n4", "target": "n5"},
                    {"id": "e5", "source": "n5", "target": "n6"},
                    {"id": "e6", "source": "n6", "target": "n3", "label": "No"},
                    {"id": "e7", "source": "n6", "target": "n7", "label": "Yes"},
                    {"id": "e8", "source": "n7", "target": "n8"},
                    {"id": "e9", "source": "n8", "target": "n3", "label": "No"},
                    {"id": "e10", "source": "n8", "target": "n9", "label": "Yes"},
                    {"id": "e11", "source": "n9", "target": "n10"},
                    {"id": "e12", "source": "n10", "target": "n3", "label": "No"},
                    {"id": "e13", "source": "n10", "target": "n11", "label": "Yes"},
                    {"id": "e14", "source": "n11", "target": "n12"},
                    {"id": "e15", "source": "n12", "target": "n13"},
                ],
                "sources": ["chunk_1", "chunk_2", "chunk_3"]
            }
        ]
    },

    # ==================== ENTERPRISE SOLUTIONS MEETINGS ====================
    {
        "org_id": "enterprise-solutions",
        "title": "Production Outage Post-Mortem",
        "transcript": """
Kevin: Thanks everyone for joining this post-mortem. We had a significant outage last Wednesday that affected 40% of our customers for 2 hours.

Nina: Can you walk us through the timeline?

Kevin: At 2:15 PM, our monitoring detected elevated error rates. By 2:20, customers started reporting issues. The on-call engineer was paged at 2:22.

Carlos: What was the initial diagnosis?

Kevin: The on-call thought it was a database issue because queries were timing out. But it turned out to be something else entirely.

Nina: What was the actual root cause?

Kevin: A memory leak in our new caching service. We deployed version 2.3 of the cache that morning. It had a bug that caused memory to grow unbounded under high load.

Carlos: Why wasn't this caught in testing?

Kevin: Our load tests don't simulate the exact traffic patterns we see in production. The leak only manifested after 4+ hours of sustained traffic.

Nina: That's a process gap we need to address.

Kevin: Agreed. We've added an action item to improve our load testing scenarios.

Carlos: Walk me through the resolution.

Kevin: At 3:15, we identified the caching service as the culprit. By 3:30, we rolled back to version 2.2. Services recovered by 4:20.

Nina: That's over an hour from identification to resolution. Can we speed that up?

Kevin: Rollback was slow because we had to coordinate with three teams. We need a faster rollback mechanism.

Carlos: What about the customer impact?

Kevin: 40% of customers experienced errors. We estimate $150K in lost transactions and potential SLA credits.

Nina: Have we communicated with affected customers?

Kevin: Yes, we sent an email yesterday with an apology and explanation. Enterprise customers got personal calls from their account managers.

Carlos: What are the follow-up actions?

Kevin: I've identified six action items. First, improve load testing to simulate 8-hour sustained traffic. Second, add memory monitoring alerts for all services. Third, create a one-click rollback mechanism.

Nina: What else?

Kevin: Fourth, implement canary deployments so we catch issues before full rollout. Fifth, update our runbooks with caching service troubleshooting. Sixth, conduct a training session on the new monitoring tools.

Carlos: Who owns each action item?

Kevin: I'll own the load testing improvements. Nina, can you take the monitoring alerts?

Nina: Yes, I'll have that done by end of week.

Kevin: Carlos, can you work on the rollback mechanism with the platform team?

Carlos: Absolutely. I've already started discussing it with them.

Kevin: Great. The canary deployment work is bigger - that's a Q1 project for the whole team.

Nina: We should also consider whether our on-call rotation is adequate. The initial responder spent 30 minutes going down the wrong path.

Kevin: Good point. Let's add that to the training session - better initial triage procedures.

Carlos: Any other learnings?

Kevin: We need better communication during incidents. There was confusion about who was leading the response.

Nina: Incident commander role?

Kevin: Exactly. We should formalize that.

Kevin: Alright, I'll document all of this in Confluence and schedule follow-up reviews. Thanks everyone.
        """,
        "summary": """• Production outage post-mortem: 40% of customers affected for 2 hours on Wednesday
• Timeline: 2:15 PM elevated errors detected, 2:22 on-call paged, 4:20 PM services recovered
• Root cause: memory leak in caching service v2.3 deployed that morning
• Leak only manifested after 4+ hours of sustained traffic - not caught in testing
• Resolution took over 1 hour due to coordination across three teams
• Customer impact: $150K in lost transactions, potential SLA credits
• Communication sent: email apology to all, personal calls to enterprise accounts
• Action items: (1) improve load testing for 8-hour sustained traffic, (2) memory monitoring alerts, (3) one-click rollback mechanism, (4) canary deployments (Q1 project), (5) update runbooks for caching troubleshooting, (6) training on monitoring tools
• Owners: Kevin - load testing, Nina - monitoring alerts by EOW, Carlos - rollback mechanism
• Additional items: better initial triage training, incident commander role formalization""",
        "workflows": [
            {
                "title": "Incident Response Process",
                "nodes": [
                    {"id": "n1", "type": "terminal", "label": "Alert Triggered", "variant": "start"},
                    {"id": "n2", "type": "process", "label": "On-Call Notified"},
                    {"id": "n3", "type": "process", "label": "Initial Triage"},
                    {"id": "n4", "type": "decision", "label": "Severity?"},
                    {"id": "n5", "type": "process", "label": "Create War Room"},
                    {"id": "n6", "type": "process", "label": "Page Additional Engineers"},
                    {"id": "n7", "type": "process", "label": "Standard Handling"},
                    {"id": "n8", "type": "process", "label": "Identify Root Cause"},
                    {"id": "n9", "type": "decision", "label": "Rollback Needed?"},
                    {"id": "n10", "type": "process", "label": "Execute Rollback"},
                    {"id": "n11", "type": "process", "label": "Apply Fix"},
                    {"id": "n12", "type": "process", "label": "Verify Resolution"},
                    {"id": "n13", "type": "process", "label": "Customer Communication"},
                    {"id": "n14", "type": "terminal", "label": "Schedule Post-Mortem", "variant": "end"},
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
                    {"id": "e11", "source": "n9", "target": "n10", "label": "Yes"},
                    {"id": "e12", "source": "n9", "target": "n11", "label": "No"},
                    {"id": "e13", "source": "n10", "target": "n12"},
                    {"id": "e14", "source": "n11", "target": "n12"},
                    {"id": "e15", "source": "n12", "target": "n13"},
                    {"id": "e16", "source": "n13", "target": "n14"},
                ],
                "sources": ["chunk_0", "chunk_1", "chunk_2"]
            },
            {
                "title": "Deployment Rollback Process",
                "nodes": [
                    {"id": "n1", "type": "terminal", "label": "Rollback Decision Made", "variant": "start"},
                    {"id": "n2", "type": "process", "label": "Identify Previous Version"},
                    {"id": "n3", "type": "process", "label": "Notify Stakeholders"},
                    {"id": "n4", "type": "process", "label": "Stop Current Deployment"},
                    {"id": "n5", "type": "process", "label": "Deploy Previous Version"},
                    {"id": "n6", "type": "process", "label": "Run Health Checks"},
                    {"id": "n7", "type": "decision", "label": "Healthy?"},
                    {"id": "n8", "type": "process", "label": "Investigate Further"},
                    {"id": "n9", "type": "process", "label": "Confirm Recovery"},
                    {"id": "n10", "type": "terminal", "label": "Rollback Complete", "variant": "end"},
                ],
                "edges": [
                    {"id": "e1", "source": "n1", "target": "n2"},
                    {"id": "e2", "source": "n2", "target": "n3"},
                    {"id": "e3", "source": "n3", "target": "n4"},
                    {"id": "e4", "source": "n4", "target": "n5"},
                    {"id": "e5", "source": "n5", "target": "n6"},
                    {"id": "e6", "source": "n6", "target": "n7"},
                    {"id": "e7", "source": "n7", "target": "n8", "label": "No"},
                    {"id": "e8", "source": "n7", "target": "n9", "label": "Yes"},
                    {"id": "e9", "source": "n8", "target": "n5"},
                    {"id": "e10", "source": "n9", "target": "n10"},
                ],
                "sources": ["chunk_3"]
            }
        ]
    },
    {
        "org_id": "enterprise-solutions",
        "title": "Security Compliance Review",
        "transcript": """
Amanda: Let's start our quarterly security compliance review. We have SOC 2 Type II audit coming up in March.

Ryan: What's our current status on the control gaps from last audit?

Amanda: We've closed 8 of the 12 findings. The remaining four are in progress.

Luis: What are the outstanding ones?

Amanda: First, access review automation - we're still doing quarterly reviews manually. Second, encryption at rest for the analytics database. Third, penetration testing documentation. Fourth, vendor security assessment process.

Ryan: The access review automation is almost done. I've been working on integrating with Okta. Should be ready next week.

Amanda: Great. Luis, where are we on the database encryption?

Luis: The migration is 70% complete. We're encrypting tables in batches to avoid downtime. Full completion by end of February.

Amanda: Good progress. What about the penetration test docs?

Ryan: We did the pentest last month. I need to finish documenting the remediation for two medium-severity findings.

Amanda: What were those findings?

Ryan: One was a cross-site scripting vulnerability in the admin panel. Already fixed. The other was weak session timeout settings. Also fixed, just need to document.

Luis: Do we have evidence of the fixes?

Ryan: Yes, I have before and after screenshots. Just need to write them up formally.

Amanda: Make that a priority. The auditors will want to see it.

Luis: What about the vendor assessment process?

Amanda: That's the big one. We need a formal process for evaluating third-party security before we onboard them.

Ryan: I've drafted a questionnaire based on the SIG Lite framework.

Amanda: Perfect. Let's review that today. We also need to define risk tiers - not every vendor needs the same level of scrutiny.

Luis: Agree. A SaaS tool for internal use is different from a data processor.

Amanda: Exactly. Let's define three tiers: critical (handles customer data), important (internal tools with access to systems), and standard (isolated tools with no data access).

Ryan: Makes sense. Different questionnaire depth for each tier?

Amanda: Yes, and different approval workflows. Critical vendors need security team sign-off.

Luis: What about ongoing monitoring? We can't just assess once and forget.

Amanda: Good point. Annual reassessment for critical vendors, bi-annual for important.

Ryan: We should also monitor for security incidents at our vendors. There are services that track breaches.

Amanda: Add that to the roadmap. For now, let's focus on getting the initial assessment process documented.

Luis: What else for the SOC 2 audit?

Amanda: We need to update our information security policy. It's two years old and references some deprecated processes.

Ryan: I can take that on. I'll schedule a review with the team leads.

Amanda: Thanks. Also, we need to test our disaster recovery procedure. When was the last DR test?

Luis: Six months ago. We should do another one before the audit.

Amanda: Schedule it for February. Let's make sure we can actually recover from our backups.

Luis: Will do. Anything else?

Amanda: Just the employee security training. Make sure everyone's completed it. The deadline is February 15th.

Ryan: I'll send a reminder to the managers.

Amanda: Perfect. Let's reconvene in two weeks to check progress. Thanks everyone.
        """,
        "summary": """• Quarterly security compliance review for SOC 2 Type II audit in March
• 8 of 12 control gaps from last audit closed, 4 remaining in progress
• Outstanding items: (1) access review automation with Okta - ready next week, (2) database encryption at rest - 70% complete, Feb completion, (3) pentest documentation for 2 medium findings (XSS and session timeout), (4) vendor security assessment process
• Vendor assessment: using SIG Lite framework questionnaire, defining 3 risk tiers
• Tier definitions: Critical (customer data), Important (internal tools with system access), Standard (isolated tools)
• Different scrutiny levels per tier, critical vendors need security team sign-off
• Ongoing vendor monitoring: annual for critical, bi-annual for important
• Information security policy needs update - 2 years old with deprecated processes
• Disaster recovery test needed before audit - scheduled for February
• Employee security training deadline: February 15th
• Ryan updating security policy and pentest docs, Luis on DR test""",
        "workflows": [
            {
                "title": "Vendor Security Assessment Process",
                "nodes": [
                    {"id": "n1", "type": "terminal", "label": "New Vendor Request", "variant": "start"},
                    {"id": "n2", "type": "process", "label": "Determine Risk Tier"},
                    {"id": "n3", "type": "decision", "label": "Tier Level?"},
                    {"id": "n4", "type": "process", "label": "Full Security Questionnaire"},
                    {"id": "n5", "type": "process", "label": "Standard Questionnaire"},
                    {"id": "n6", "type": "process", "label": "Basic Checklist"},
                    {"id": "n7", "type": "process", "label": "Security Team Review"},
                    {"id": "n8", "type": "process", "label": "Manager Review"},
                    {"id": "n9", "type": "decision", "label": "Approved?"},
                    {"id": "n10", "type": "process", "label": "Document Concerns"},
                    {"id": "n11", "type": "process", "label": "Contract Signing"},
                    {"id": "n12", "type": "process", "label": "Schedule Reassessment"},
                    {"id": "n13", "type": "terminal", "label": "Vendor Onboarded", "variant": "end"},
                ],
                "edges": [
                    {"id": "e1", "source": "n1", "target": "n2"},
                    {"id": "e2", "source": "n2", "target": "n3"},
                    {"id": "e3", "source": "n3", "target": "n4", "label": "Critical"},
                    {"id": "e4", "source": "n3", "target": "n5", "label": "Important"},
                    {"id": "e5", "source": "n3", "target": "n6", "label": "Standard"},
                    {"id": "e6", "source": "n4", "target": "n7"},
                    {"id": "e7", "source": "n5", "target": "n8"},
                    {"id": "e8", "source": "n6", "target": "n8"},
                    {"id": "e9", "source": "n7", "target": "n9"},
                    {"id": "e10", "source": "n8", "target": "n9"},
                    {"id": "e11", "source": "n9", "target": "n10", "label": "No"},
                    {"id": "e12", "source": "n9", "target": "n11", "label": "Yes"},
                    {"id": "e13", "source": "n11", "target": "n12"},
                    {"id": "e14", "source": "n12", "target": "n13"},
                ],
                "sources": ["chunk_2", "chunk_3"]
            },
            {
                "title": "SOC 2 Audit Preparation",
                "nodes": [
                    {"id": "n1", "type": "terminal", "label": "Audit Scheduled", "variant": "start"},
                    {"id": "n2", "type": "process", "label": "Gap Assessment"},
                    {"id": "n3", "type": "process", "label": "Remediation Planning"},
                    {"id": "n4", "type": "process", "label": "Evidence Collection"},
                    {"id": "n5", "type": "process", "label": "Policy Updates"},
                    {"id": "n6", "type": "process", "label": "Control Testing"},
                    {"id": "n7", "type": "decision", "label": "Controls Effective?"},
                    {"id": "n8", "type": "process", "label": "Additional Remediation"},
                    {"id": "n9", "type": "process", "label": "Final Documentation"},
                    {"id": "n10", "type": "terminal", "label": "Ready for Audit", "variant": "end"},
                ],
                "edges": [
                    {"id": "e1", "source": "n1", "target": "n2"},
                    {"id": "e2", "source": "n2", "target": "n3"},
                    {"id": "e3", "source": "n3", "target": "n4"},
                    {"id": "e4", "source": "n4", "target": "n5"},
                    {"id": "e5", "source": "n5", "target": "n6"},
                    {"id": "e6", "source": "n6", "target": "n7"},
                    {"id": "e7", "source": "n7", "target": "n8", "label": "No"},
                    {"id": "e8", "source": "n8", "target": "n6"},
                    {"id": "e9", "source": "n7", "target": "n9", "label": "Yes"},
                    {"id": "e10", "source": "n9", "target": "n10"},
                ],
                "sources": ["chunk_0", "chunk_1"]
            }
        ]
    },
    {
        "org_id": "enterprise-solutions",
        "title": "Customer Data Migration Planning",
        "transcript": """
Patricia: We have a major data migration coming up for BankCorp. Let's plan it carefully.

Victor: What's the scope of the migration?

Patricia: They're moving from our legacy platform to the new one. We're talking about 5 million customer records, 3 years of transaction history, and all their custom configurations.

Victor: That's substantial. What's the timeline?

Patricia: They want to be fully migrated by end of Q1. That gives us about 8 weeks.

Elena: Do we have a migration tool or are we building custom scripts?

Patricia: We have a base migration tool, but BankCorp has heavy customizations. We'll need to extend the tool.

Victor: What customizations specifically?

Patricia: Custom fields on customer profiles, a unique approval workflow, and integration with their internal fraud detection system.

Elena: The fraud detection integration is tricky. That's real-time data.

Patricia: Agreed. We might need to maintain a sync during the transition period.

Victor: What about downtime? Can they tolerate any?

Patricia: Maximum 4 hours for the final cutover. Everything else needs to happen with the systems running.

Elena: That means we need a staged approach. Migrate historical data first while systems are live, then do a quick cutover for recent data.

Patricia: Exactly. I'm thinking three phases. Phase one: historical data migration, running in background. Phase two: validation and reconciliation. Phase three: final cutover during maintenance window.

Victor: For phase one, how far back does historical data go?

Patricia: Three years. But the bulk of the data is from the last 6 months. Older data is mostly archived records.

Elena: We should prioritize recent data then. Users are more likely to access it.

Patricia: Good thinking. We can tier the migration - last 6 months first, then older data.

Victor: What about testing? We can't migrate 5 million records without thorough testing.

Patricia: We'll set up a staging environment that mirrors production. I want to run at least three full test migrations before the real thing.

Elena: Do we have the infrastructure for that?

Patricia: I've requested additional cloud resources. Should be provisioned by end of week.

Victor: What's the rollback plan if something goes wrong during cutover?

Patricia: If we haven't passed the point of no return, we can revert to the legacy system. But that window is short - about 30 minutes into the cutover.

Elena: And after that?

Patricia: After that, we'd have to forward-migrate any new data back to legacy. Much messier. Let's make sure we don't need to do that.

Victor: We should have the whole engineering team on standby during cutover.

Patricia: Absolutely. I'm scheduling it for a Sunday night to minimize customer impact.

Elena: What about customer communication?

Patricia: BankCorp is handling that on their end. They'll notify their customers about the maintenance window.

Victor: Any other dependencies we should be aware of?

Patricia: Their IT team needs to update their firewall rules for the new platform. I've sent them the documentation.

Elena: And testing credentials for their fraud system?

Patricia: On my list to follow up. Good catch.

Patricia: Alright, let's document this plan and share with the team. Weekly check-ins starting next Monday.
        """,
        "summary": """• Customer data migration planning for BankCorp - legacy to new platform
• Scope: 5 million customer records, 3 years transaction history, custom configurations
• Timeline: 8 weeks, full migration by end of Q1
• Customizations requiring tool extension: custom profile fields, unique approval workflow, fraud detection integration
• Fraud detection integration requires real-time sync during transition
• Maximum 4-hour downtime for final cutover - rest must happen live
• Three-phase approach: (1) historical data migration in background, (2) validation/reconciliation, (3) final cutover during maintenance window
• Data tiering: last 6 months migrated first, then older archived data
• Testing: staging environment mirroring production, 3 full test migrations before go-live
• Rollback window: 30 minutes into cutover before point of no return
• Cutover scheduled for Sunday night, full engineering team on standby
• BankCorp handling customer communication for maintenance window
• Dependencies: firewall rules update, fraud system testing credentials needed""",
        "workflows": [
            {
                "title": "Data Migration Process",
                "nodes": [
                    {"id": "n1", "type": "terminal", "label": "Migration Initiated", "variant": "start"},
                    {"id": "n2", "type": "process", "label": "Extract Historical Data"},
                    {"id": "n3", "type": "process", "label": "Transform Data Format"},
                    {"id": "n4", "type": "process", "label": "Load to Staging"},
                    {"id": "n5", "type": "process", "label": "Validation Checks"},
                    {"id": "n6", "type": "decision", "label": "Data Valid?"},
                    {"id": "n7", "type": "process", "label": "Fix Data Issues"},
                    {"id": "n8", "type": "process", "label": "Reconciliation Report"},
                    {"id": "n9", "type": "decision", "label": "Approved?"},
                    {"id": "n10", "type": "process", "label": "Schedule Cutover"},
                    {"id": "n11", "type": "process", "label": "Final Delta Sync"},
                    {"id": "n12", "type": "process", "label": "Switch DNS"},
                    {"id": "n13", "type": "terminal", "label": "Migration Complete", "variant": "end"},
                ],
                "edges": [
                    {"id": "e1", "source": "n1", "target": "n2"},
                    {"id": "e2", "source": "n2", "target": "n3"},
                    {"id": "e3", "source": "n3", "target": "n4"},
                    {"id": "e4", "source": "n4", "target": "n5"},
                    {"id": "e5", "source": "n5", "target": "n6"},
                    {"id": "e6", "source": "n6", "target": "n7", "label": "No"},
                    {"id": "e7", "source": "n7", "target": "n3"},
                    {"id": "e8", "source": "n6", "target": "n8", "label": "Yes"},
                    {"id": "e9", "source": "n8", "target": "n9"},
                    {"id": "e10", "source": "n9", "target": "n7", "label": "No"},
                    {"id": "e11", "source": "n9", "target": "n10", "label": "Yes"},
                    {"id": "e12", "source": "n10", "target": "n11"},
                    {"id": "e13", "source": "n11", "target": "n12"},
                    {"id": "e14", "source": "n12", "target": "n13"},
                ],
                "sources": ["chunk_0", "chunk_1", "chunk_2", "chunk_3"]
            }
        ]
    },
]


def create_workflows(workflow_data_list: list) -> list:
    """Create Workflow objects from data."""
    workflows = []
    for wf_data in workflow_data_list:
        nodes = []
        for node_data in wf_data["nodes"]:
            node = Node(
                id=node_data["id"],
                type=NodeType(node_data["type"]),
                label=node_data["label"],
                variant=NodeVariant(node_data["variant"]) if node_data.get("variant") else None
            )
            nodes.append(node)
        
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
    
    return workflows


def create_fake_meetings():
    """Create fake meetings with realistic sample data."""
    meetings_created = []
    
    for i, data in enumerate(FAKE_MEETINGS):
        meeting_id = str(uuid.uuid4())
        current_state_id = str(uuid.uuid4())
        
        # Create meeting - all seeded meetings are finalized
        meeting = Meeting(
            meetingId=meeting_id,
            status=Status.finalized,
            orgId=data["org_id"],
            title=data.get("title"),
            transcript=data.get("transcript", "").strip(),
            totalChunks=len(data.get("transcript", "").split('.')) // 10 or 1
        )
        create_meeting(meeting)
        
        # Create workflows
        workflows = create_workflows(data.get("workflows", []))
        
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
        if data.get("summary"):
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
            "status": "finalized",
            "workflows_count": len(workflows),
            "has_transcript": bool(data.get("transcript"))
        })
        
        print(f"   ✅ Created meeting {i+1}: {data.get('title', 'Untitled')}")
        print(f"      Org: {data['org_id']}, Workflows: {len(workflows)}, Has transcript: {bool(data.get('transcript'))}")
    
    return meetings_created


def index_all_meetings(meetings: list):
    """Index all meetings for search."""
    from search.indexer import SearchIndexer
    
    print("\n📇 Indexing meetings for search...")
    indexer = SearchIndexer()
    
    for meeting in meetings:
        meeting_id = meeting["meeting_id"]
        title = meeting["title"]
        
        print(f"   Indexing: {title}...")
        
        try:
            result = indexer.index_meeting_complete(meeting_id)
            print(f"      ✅ Title: {result.get('title_indexed', False)}, "
                  f"Chunks: {result.get('chunks_indexed', 0)}, "
                  f"Workflows: {result.get('workflows_indexed', 0)}")
        except Exception as e:
            print(f"      ❌ Error: {e}")
    
    print("   ✅ Indexing complete!")


def generate_meeting_notes_for_all(meetings: list):
    """Generate meeting notes using the API function for all meetings."""
    from app import generate_meeting_document
    import database as db
    from search.indexer import SearchIndexer
    
    print("\n📝 Generating meeting notes for all meetings...")
    indexer = SearchIndexer()
    
    for meeting in meetings:
        meeting_id = meeting["meeting_id"]
        title = meeting["title"]
        
        print(f"   Generating notes for: {title}...")
        
        try:
            meeting_obj = db.get_meeting(meeting_id)
            state = db.get_latest_state_version(meeting_id)
            
            if not meeting_obj or not state:
                print(f"      ⚠️ Skipping - meeting or state not found")
                continue
            
            # Generate the document
            document = generate_meeting_document(
                title=meeting_obj.title or "Meeting Notes",
                summary=state.data.meetingSummary,
                workflows=state.data.workflows,
                transcript=meeting_obj.transcript
            )
            
            # Save it
            db.update_latest_state_summary(meeting_id, document)
            
            # Index the notes
            indexer.index_meeting_notes(meeting_id, document)
            
            print(f"      ✅ Generated and indexed ({len(document)} chars)")
            
        except Exception as e:
            print(f"      ❌ Error: {e}")
        
        # Small delay to avoid rate limiting
        time.sleep(0.5)
    
    print("   ✅ Note generation complete!")


def print_search_stats():
    """Print search index statistics."""
    from search.service import get_search_service
    
    print("\n📊 Search Index Statistics:")
    service = get_search_service()
    stats = service.get_index_stats()
    
    total = 0
    for doc_type, info in stats.items():
        count = info.get("document_count", 0)
        total += count
        print(f"   {doc_type}: {count} documents")
    
    print(f"   ─────────────────")
    print(f"   Total: {total} documents")


def main():
    print("\n" + "=" * 70)
    print("🌱 Database Seeding Script with Full Search Indexing")
    print("=" * 70 + "\n")
    
    # Step 1: Clear existing database
    clear_database()
    print()
    
    # Step 2: Clear search index
    clear_search_index()
    print()
    
    # Step 3: Create fake meetings
    print("📝 Creating meetings with transcripts and workflows...")
    meetings = create_fake_meetings()
    print()
    
    # Step 4: Index all meetings
    index_all_meetings(meetings)
    
    # Step 5: Generate meeting notes (uses LLM)
    print("\n⚠️  Skipping meeting notes generation (requires API calls)")
    print("   To generate notes, run: python seed_db.py --with-notes")
    
    if len(sys.argv) > 1 and sys.argv[1] == "--with-notes":
        generate_meeting_notes_for_all(meetings)
    
    # Step 6: Print stats
    print_search_stats()
    
    # Summary
    print("\n" + "=" * 70)
    print("✨ Seeding Complete!")
    print("=" * 70)
    print(f"\n   Total meetings created: {len(meetings)}")
    print(f"   Database location: {DB_PATH}")
    
    print("\n   Meetings by org:")
    orgs = {}
    for m in meetings:
        orgs[m['org_id']] = orgs.get(m['org_id'], 0) + 1
    for org, count in orgs.items():
        print(f"   - {org}: {count} meetings")
    
    print("\n   To test search, start the server and POST to /org/<org_id>/search")
    print()


if __name__ == "__main__":
    main()
