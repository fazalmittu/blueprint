<p align="center">
  <img src="assets/logo.svg" alt="Blueprint Logo" width="80">
</p>

<h1 align="center">Blueprint</h1>

<p align="center">
  <strong>AI-powered meeting notes and workflow visualization</strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#setup">Setup</a> •
  <a href="#api-endpoints">API</a> •
  <a href="#canvas-controls">Controls</a>
</p>

---

A real-time AI meeting note-taker and workflow mapping canvas. The AI processes meeting transcripts to extract insights, generate summaries, and create visual workflow diagrams using Mermaid.

## Features

- **Meeting Management**: Create and view meetings with versioned state history
- **AI-Powered Extraction**: Automatically extracts workflows and summaries from meeting transcripts
- **Infinite Canvas**: Pan, zoom, and interact with meeting content on a visual canvas
- **Workflow Visualization**: Mermaid diagram rendering for extracted workflows
- **Interactive Blocks**: Draggable text blocks, shapes (rectangles, circles, diamonds), and notes
- **Drag-to-Delete**: Drag blocks to trash zone or press Backspace/Delete to remove

## Tech Stack

### Backend
- Python 3.13+
- Flask (REST API)
- SQLite (database)
- OpenAI GPT (transcript processing)
- Pydantic (data validation)

### Frontend
- React 18 + TypeScript
- Vite (build tool)
- Tailwind CSS (styling)
- Mermaid.js (diagram rendering)
- React Router (navigation)

## Project Structure

```
blueprint/
├── backend/
│   ├── app.py              # Flask application & API routes
│   ├── database.py         # SQLite database operations
│   ├── seed_db.py          # Database seeding script
│   ├── models/             # Pydantic models (auto-generated)
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── api/            # API client
│   │   ├── features/
│   │   │   ├── home/       # Home page (org & meetings list)
│   │   │   └── meeting/    # Meeting canvas & blocks
│   │   ├── hooks/          # Custom React hooks
│   │   ├── types/          # TypeScript types (auto-generated)
│   │   └── index.css       # Design tokens & global styles
│   └── .env.example
├── schemas/                # JSON Schemas (source of truth)
├── scripts/
│   └── generate_types.sh   # Generate types from schemas
└── blueprint.db            # SQLite database
```

## Setup

### Prerequisites
- Python 3.13+
- Node.js 18+
- OpenAI API key

### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY

# Seed the database with sample data
python seed_db.py

# Start the server
python app.py
```

The backend runs on `http://localhost:5001`.

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Configure environment
cp .env.example .env

# Start development server
npm run dev
```

The frontend runs on `http://localhost:5173`.

## Environment Variables

### Backend (`.env`)
| Variable | Description | Default |
|----------|-------------|---------|
| `OPENAI_API_KEY` | OpenAI API key for GPT processing | Required |
| `APP_URL` | Frontend URL (for CORS) | `http://localhost:5173` |
| `HOST` | Server host | `0.0.0.0` |
| `PORT` | Server port | `5001` |

### Frontend (`.env`)
| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_URL` | Backend API URL | `http://localhost:5001` |

## API Endpoints

### Organizations
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/org` | Get current user's organization |
| `GET` | `/orgs` | Get all organizations |

### Meetings
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/meetings?orgId=<id>` | Get all meetings for an org |
| `GET` | `/meeting?meetingId=<id>` | Get meeting with current state |
| `POST` | `/meeting` | Create a new meeting |

### Processing
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/process` | Process a transcript chunk |

## Type Generation

Types are auto-generated from JSON schemas in `/schemas`:

```bash
./scripts/generate_types.sh
```

This generates:
- Backend: Pydantic models in `backend/models/`
- Frontend: TypeScript types in `frontend/src/types/generated/`

## Canvas Controls

- **Pan**: Click and drag on empty canvas area
- **Zoom**: Scroll wheel (zoom toward cursor)
- **Reset View**: Click the zoom percentage indicator
- **Select Block**: Click on any block
- **Move Block**: Drag from the block's handle area
- **Delete Block**: Press `Backspace`/`Delete` or drag to trash icon (bottom-left)
- **Add Blocks**: Use the toolbar (top center)

## Database

SQLite database stored at project root (`blueprint.db`).

**Tables:**
- `meetings`: Meeting records with status and org
- `state_versions`: Versioned state snapshots for each meeting

**Seed Data:**
Run `python backend/seed_db.py` to populate with sample meetings and workflows.

## Development

### Linting
```bash
# Frontend
cd frontend && npm run lint

# Type checking
cd frontend && npx tsc --noEmit
```

### Building
```bash
cd frontend && npm run build
```

## License

MIT
