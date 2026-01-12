<p align="center">
  <img src="assets/logo.png" alt="Blueprint Logo" width="80">
</p>

<h1 align="center">Blueprint</h1>

<p align="center">
  <strong>Turn meeting transcripts into actionable workflow diagrams</strong>
</p>

---

## The Problem

Meetings are where processes get defined, but that knowledge dies in transcripts nobody reads. Teams walk out with scattered notes, vague action items, and no shared understanding of the workflows they just discussed.

**Blueprint solves this.**

Upload a meeting transcript and Blueprint's AI extracts the actual workflows—onboarding steps, approval chains, deployment procedures—and renders them as interactive Mermaid diagrams. As it processes the transcript chunk by chunk, you watch the workflows materialize in real-time on an infinite canvas.

## How It Works

1. **Upload a transcript** → Blueprint chunks it into digestible pieces
2. **AI processes each chunk** → GPT-4o extracts workflows and key points as bullet summaries
3. **Real-time visualization** → Watch diagrams build live via Server-Sent Events
4. **Version history** → Scrub through processing stages to see how understanding evolved

The result: a visual map of every process mentioned in your meeting, with source attribution back to the transcript.

## Tech Stack

| Layer | Technology |
|-------|------------|
| **AI** | OpenAI GPT-4o for transcript analysis and workflow extraction |
| **Backend** | Python, Flask, SQLite, Pydantic |
| **Frontend** | React 18, TypeScript, Vite |
| **Diagrams** | Mermaid.js for flowchart rendering |
| **Real-time** | Server-Sent Events (SSE) for live processing updates |

## Quick Start

### Prerequisites
- Python 3.13+
- Node.js 18+
- OpenAI API key

### Setup

```bash
# Clone and enter
git clone <repo> && cd blueprint

# Backend
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cd ..

# Add your OpenAI key to root .env
echo "OPENAI_API_KEY=your-key-here" > .env
echo "APP_URL=http://localhost:5173" >> .env
echo "HOST=0.0.0.0" >> .env
echo "PORT=5001" >> .env

# Database and indices are already committed to git!
# If you need to regenerate: cd backend && python seed_meetingbank.py

# Frontend
cd frontend && npm install && cd ..
```

### Run

```bash
# Terminal 1: Backend
cd backend && source venv/bin/activate && python -m app

# Terminal 2: Frontend
cd frontend && npm run dev
```

Open `http://localhost:5173`, create a meeting, paste a transcript, and watch the workflows appear.

## Project Structure

```
blueprint/
├── backend/
│   ├── app.py          # Flask API + LLM processing logic
│   ├── database.py     # SQLite operations
│   ├── models/         # Pydantic models (auto-generated from schemas)
│   ├── seed_meetingbank.py  # Database seeder (replaces seed_db.py)
│   ├── data/           # Database and FAISS indices (committed to git)
│   │   ├── blueprint.db
│   │   └── faiss/      # Search indices
├── frontend/
│   └── src/
│       ├── features/meeting/  # Canvas, blocks, real-time updates
│       └── api/client.ts      # Backend API client
├── schemas/            # JSON Schemas (source of truth for types)
└── .env                # Environment variables (create this)
```

## Type Generation

Types are generated from JSON schemas to keep backend and frontend in sync:

```bash
./scripts/generate_types.sh
```

## License

MIT
