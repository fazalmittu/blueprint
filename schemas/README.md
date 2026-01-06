# Shared Schema Types

This folder contains JSON Schema definitions that serve as the **single source of truth** for types shared between the Python backend and TypeScript frontend.

---

## Quick Start

```bash
# Install dependencies (one-time)
pip install datamodel-code-generator
npm i -D json-schema-to-typescript

# Generate all types
./scripts/generate_types.sh
```

That's it. Run the script whenever you modify a schema.

---

## Schema Overview

| Schema | Description |
|--------|-------------|
| `workflow.schema.json` | Individual workflow with mermaid diagram and sources |
| `currentState.schema.json` | Snapshot of meeting state (summary + workflows) |
| `currentStateVersion.schema.json` | Versioned wrapper for currentState |
| `meeting.schema.json` | Meeting metadata (id, status, org) |
| `processRequest.schema.json` | Request payload for processing chunks |
| `processResponse.schema.json` | Response containing updated currentState |
| `socketEvent.schema.json` | WebSocket event payload |

---

## Generated Output

After running the script:

```
backend/models/
├── current_state.py
├── current_state_version.py
├── meeting.py
├── process_request.py
├── process_response.py
├── socket_event.py
└── workflow.py

frontend/src/types/
├── currentState.ts
├── currentStateVersion.ts
├── meeting.ts
├── processRequest.ts
├── processResponse.ts
├── socketEvent.ts
└── workflow.ts
```

---

## Usage

### Python (Backend)

```python
from models.current_state import CurrentState
from models.workflow import Workflow
from models.socket_event import SocketEvent
from models.process_request import ProcessRequest
from models.process_response import ProcessResponse

# Example
state = CurrentState(
    meetingSummary="Discussion about auth flow",
    workflows=[
        Workflow(
            id="wf-1",
            title="User Authentication",
            mermaidDiagram="graph TD; A-->B;",
            sources=["chunk-1", "chunk-2"]
        )
    ]
)
```

### TypeScript (Frontend)

```typescript
import { CurrentState } from "../types/currentState";
import { Workflow } from "../types/workflow";
import { SocketEvent } from "../types/socketEvent";

// Example
const state: CurrentState = {
  meetingSummary: "Discussion about auth flow",
  workflows: [
    {
      id: "wf-1",
      title: "User Authentication",
      mermaidDiagram: "graph TD; A-->B;",
      sources: ["chunk-1", "chunk-2"]
    }
  ]
};
```

---

## Workflow

1. **Edit schema** in `schemas/` folder
2. **Run** `./scripts/generate_types.sh`
3. **Compiler breaks** on both sides if you forgot to update something

This ensures frontend and backend stay in sync at compile time rather than discovering mismatches at runtime.
