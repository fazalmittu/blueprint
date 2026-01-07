<p align="center">
  <img src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8ZGVmcz4KICAgIDxsaW5lYXJHcmFkaWVudCBpZD0iYmciIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPgogICAgICA8c3RvcCBvZmZzZXQ9IjAlIiBzdG9wLWNvbG9yPSIjM2I4MmY2Ii8+CiAgICAgIDxzdG9wIG9mZnNldD0iMTAwJSIgc3RvcC1jb2xvcj0iIzFkNGVkOCIvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICA8L2RlZnM+CiAgCiAgPCEtLSBSb3VuZGVkIHNxdWFyZSBiYWNrZ3JvdW5kIC0tPgogIDxyZWN0IHdpZHRoPSI2NCIgaGVpZ2h0PSI2NCIgcng9IjE0IiBmaWxsPSJ1cmwoI2JnKSIvPgogIAogIDwhLS0gRmxvd2NoYXJ0IGljb24gaW4gd2hpdGUgLS0+CiAgPGcgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjZmZmIiBzdHJva2Utd2lkdGg9IjIuNSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj4KICAgIDwhLS0gVG9wIG5vZGUgLS0+CiAgICA8cmVjdCB4PSIyMiIgeT0iMTAiIHdpZHRoPSIyMCIgaGVpZ2h0PSIxMiIgcng9IjIiIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4yIi8+CiAgICA8IS0tIExpbmUgZG93biAtLT4KICAgIDxsaW5lIHgxPSIzMiIgeTE9IjIyIiB4Mj0iMzIiIHkyPSIyOCIvPgogICAgPCEtLSBNaWRkbGUgbm9kZSAobGFyZ2VyKSAtLT4KICAgIDxyZWN0IHg9IjE4IiB5PSIyOCIgd2lkdGg9IjI4IiBoZWlnaHQ9IjE0IiByeD0iMyIgZmlsbD0iI2ZmZiIgZmlsbC1vcGFjaXR5PSIwLjIiLz4KICAgIDwhLS0gQnJhbmNoIGxpbmVzIC0tPgogICAgPGxpbmUgeDE9IjI0IiB5MT0iNDIiIHgyPSIxOCIgeTI9IjQ4Ii8+CiAgICA8bGluZSB4MT0iNDAiIHkxPSI0MiIgeDI9IjQ2IiB5Mj0iNDgiLz4KICAgIDwhLS0gQm90dG9tIG5vZGVzIC0tPgogICAgPGNpcmNsZSBjeD0iMTQiIGN5PSI1MiIgcj0iNSIgZmlsbD0iI2ZmZiIgZmlsbC1vcGFjaXR5PSIwLjMiLz4KICAgIDxjaXJjbGUgY3g9IjUwIiBjeT0iNTIiIHI9IjUiIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4zIi8+CiAgPC9nPgo8L3N2Zz4K" alt="Blueprint Logo" width="80">
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
