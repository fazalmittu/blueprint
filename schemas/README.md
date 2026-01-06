# Shared Schema Types

This folder contains JSON Schema definitions that serve as the **single source of truth** for types shared between the Python backend and TypeScript frontend.

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

## Generate Backend Pydantic Models

### 1. Install the code generator

```bash
pip install datamodel-code-generator
```

### 2. Create models folder

```bash
mkdir -p backend/models
```

### 3. Generate models

```bash
# Core models
datamodel-codegen \
  --input schemas/workflow.schema.json \
  --input-file-type jsonschema \
  --output backend/models/workflow.py

datamodel-codegen \
  --input schemas/currentState.schema.json \
  --input-file-type jsonschema \
  --output backend/models/current_state.py

datamodel-codegen \
  --input schemas/currentStateVersion.schema.json \
  --input-file-type jsonschema \
  --output backend/models/current_state_version.py

datamodel-codegen \
  --input schemas/meeting.schema.json \
  --input-file-type jsonschema \
  --output backend/models/meeting.py

# API models
datamodel-codegen \
  --input schemas/processRequest.schema.json \
  --input-file-type jsonschema \
  --output backend/models/process_request.py

datamodel-codegen \
  --input schemas/processResponse.schema.json \
  --input-file-type jsonschema \
  --output backend/models/process_response.py

datamodel-codegen \
  --input schemas/socketEvent.schema.json \
  --input-file-type jsonschema \
  --output backend/models/socket_event.py
```

### 4. Usage in Python

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

---

## Generate Frontend TypeScript Types

### 1. Install the code generator

```bash
npm i -D json-schema-to-typescript
```

### 2. Create types folder

```bash
mkdir -p frontend/src/types
```

### 3. Generate types

```bash
npx json2ts -i schemas/workflow.schema.json -o frontend/src/types/workflow.ts
npx json2ts -i schemas/currentState.schema.json -o frontend/src/types/currentState.ts
npx json2ts -i schemas/currentStateVersion.schema.json -o frontend/src/types/currentStateVersion.ts
npx json2ts -i schemas/meeting.schema.json -o frontend/src/types/meeting.ts
npx json2ts -i schemas/processRequest.schema.json -o frontend/src/types/processRequest.ts
npx json2ts -i schemas/processResponse.schema.json -o frontend/src/types/processResponse.ts
npx json2ts -i schemas/socketEvent.schema.json -o frontend/src/types/socketEvent.ts
```

### 4. Usage in TypeScript

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

## Automation Scripts

Add these to your `package.json` / `Makefile` for convenience:

### package.json (frontend)

```json
{
  "scripts": {
    "generate:types": "json2ts -i ../schemas/*.schema.json -o src/types/"
  }
}
```

### Makefile (backend)

```makefile
generate-models:
	@for schema in schemas/*.schema.json; do \
		name=$$(basename $$schema .schema.json | sed 's/\([A-Z]\)/_\L\1/g' | sed 's/^_//'); \
		datamodel-codegen --input $$schema --input-file-type jsonschema --output backend/models/$$name.py; \
	done
```

---

## Workflow

1. **Edit schema** in `schemas/` folder
2. **Regenerate** both Python and TypeScript types
3. **Compiler breaks** on both sides if you forgot to update something

This ensures frontend and backend stay in sync at compile time rather than discovering mismatches at runtime.

