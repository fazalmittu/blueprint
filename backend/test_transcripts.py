SINGLE_WORKFLOW_TRANSCRIPT = """
Alex:
Alright, let's focus today on the new user onboarding experience. We've had feedback that people sign up but drop off before they actually create their first project.

Marco:
Yeah, from the usability testing last week, people weren't sure what to do after email verification. They land on the dashboard, but it's empty.

Priya:
Currently after signup, they verify their email, log in, and we just show them the default dashboard with a "Create Project" button in the top right. It's not very prominent.

Jamie:
From the backend side, the flow is pretty linear right now. User signs up → we create the user record → we wait for email verification → once verified, they can authenticate and access the app.

Alex:
Right, but we want to insert a guided onboarding step. Something like: once they log in for the first time, they're prompted to create their first project with some context.

Marco:
Exactly. I'm imagining a modal or a full-page onboarding screen that explains what a project is, then walks them through naming it and choosing a template.

Priya:
That's doable. We'd need a way to detect "first login" on the frontend so we know whether to show the onboarding screen or the normal dashboard.

Jamie:
We already store a last_login_at field. If it's null, that's the first login. After onboarding is completed, we can mark an onboarding_completed flag.

Alex:
Perfect. So the flow would be: sign up, verify email, log in, onboarding screen, project creation, then dashboard.

Priya:
And if they abandon onboarding halfway through?

Jamie:
We can save partial state, but simpler might be to just redirect them back to onboarding until they complete it.

Marco:
From a UX standpoint, that's fine as long as it's not too long. Maybe three steps max.

Alex:
Let's keep it minimal for v1. Name project, choose template, done.

Priya:
I'll need clear states: unauthenticated, authenticated but onboarding not complete, and fully onboarded.

Jamie:
Backend can enforce that too. If onboarding isn't complete, certain APIs like "list projects" can return an empty state or a specific response.

Alex:
Great. I think that's clear enough for implementation.
"""

MULTIPLE_WORKFLOWS_TRANSCRIPT = """
Sarah:
Thanks everyone. Today I want to walk through how we handle production incidents and how support escalates issues to engineering, because right now it's inconsistent.

Ben:
From support's perspective, when a customer reports an issue, we first try to reproduce it. If it's a known issue, we link them to the status page or existing ticket.

Tom:
But if it's not known, that's where things get messy. Sometimes we get a Slack ping, sometimes a Jira ticket, sometimes nothing.

Lina:
And on the SRE side, we often find out about incidents from alerts before support even reaches out, which creates duplication.

Sarah:
Exactly. I think we need to clearly separate two flows: customer-reported issues and system-detected incidents. Make sure there are two different workflow diagrams. 

Ben:
For customer-reported issues, the support agent should classify severity first. Low severity stays within support. High severity gets escalated.

Tom:
Escalation should be standardized. For high severity, support creates a Jira ticket with a specific template and pings the on-call engineer.

Lina:
Meanwhile, for system-detected incidents, monitoring alerts trigger PagerDuty, which wakes up the on-call SRE. That flow shouldn't depend on support at all.

Sarah:
Right, but once an incident is confirmed, support still needs to be informed so they can respond to customers consistently.

Ben:
We usually get that info ad hoc. It would help if there was a single incident channel created automatically.

Lina:
PagerDuty can do that. When an incident is triggered, it can auto-create a Slack channel and post initial diagnostics.

Tom:
Then engineering investigates, mitigates, and posts updates. Support can relay those updates externally.

Sarah:
After resolution, we also need a postmortem process.

Lina:
Yes. Once the incident is resolved, we create a postmortem doc, assign an owner, and track action items.

Ben:
Support also needs a summary they can send to affected customers once everything is closed.

Tom:
So in summary, we're talking about: one flow for customer escalation, one for automated incident response, and a shared post-incident follow-up process.

Sarah:
Exactly. Let's document all of this clearly so new hires don't have to learn it by osmosis.
"""


NO_WORKFLOWS_TRANSCRIPT = """
Maya:
Let's use this retro to talk about how this sprint felt. No action items yet, just reflections.

Chris:
For me, the sprint felt a bit rushed. Not because of the workload, but because requirements changed halfway through.

Elena:
I agree. From a design standpoint, I was still iterating on concepts while engineering had already started implementation.

Rob:
QA felt the pressure at the end. We didn't have enough time to properly test edge cases before release.

Maya:
That's good feedback. Do you feel this is a communication issue or a planning issue?

Chris:
Probably both. I think we locked scope too early without enough validation.

Elena:
Yeah, I'd prefer more collaborative design reviews earlier, even if things are still rough.

Rob:
And maybe looping QA in sooner so we can flag risky areas before they become last-minute surprises.

Maya:
That makes sense. On the positive side, what went well?

Chris:
Collaboration within engineering was solid. Pair programming helped a lot.

Elena:
I appreciated how receptive everyone was to design feedback, even late in the sprint.

Rob:
Same here. Bugs were addressed quickly once reported.

Maya:
Great. We'll take these reflections and think about improvements for next sprint, but for now I just wanted to surface how people felt.
"""

