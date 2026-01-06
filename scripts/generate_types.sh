#!/bin/bash
# Generates types from JSON schemas for both backend (Pydantic) and frontend (TypeScript)
#
# Usage:
#   ./scripts/generate_types.sh
#
# Prerequisites:
#   Backend: pip install datamodel-code-generator
#   Frontend: npm install -D json-schema-to-typescript (in frontend/)
#
set -e

cd "$(dirname "$0")/.."

# ============================================
# Backend: Pydantic Models
# ============================================

echo "🔁 Generating backend Pydantic models..."

# Activate venv if it exists
if [ -f "backend/venv/bin/activate" ]; then
    source backend/venv/bin/activate
fi

# Clean and recreate models directory
rm -rf backend/models
mkdir -p backend/models

# Generate all schemas at once - this resolves $ref properly and reuses models
datamodel-codegen \
    --input schemas/ \
    --input-file-type jsonschema \
    --output backend/models/ \
    --reuse-model

# Create __init__.py with nice aliases
cat > backend/models/__init__.py << 'EOF'
# Auto-generated - do not edit manually
# Run ./scripts/generate_types.sh to regenerate

from .workflow_schema import Model as Workflow
from .currentState_schema import Model as CurrentState
from .currentStateVersion_schema import Model as CurrentStateVersion
from .meeting_schema import Model as Meeting
from .processRequest_schema import Model as ProcessRequest
from .processResponse_schema import Model as ProcessResponse
from .socketEvent_schema import Model as SocketEvent

__all__ = [
    "Workflow",
    "CurrentState",
    "CurrentStateVersion",
    "Meeting",
    "ProcessRequest",
    "ProcessResponse",
    "SocketEvent",
]
EOF

echo "✅ Backend models generated"

# ============================================
# Frontend: TypeScript Types
# ============================================

echo "🔁 Generating frontend TypeScript types..."

# Clean and recreate types directory
rm -rf frontend/src/types/generated
mkdir -p frontend/src/types/generated

# Generate TypeScript types from each schema
cd frontend

npx json2ts -i ../schemas/workflow.schema.json -o src/types/generated/workflow.ts --cwd ../schemas
npx json2ts -i ../schemas/currentState.schema.json -o src/types/generated/currentState.ts --cwd ../schemas
npx json2ts -i ../schemas/currentStateVersion.schema.json -o src/types/generated/currentStateVersion.ts --cwd ../schemas
npx json2ts -i ../schemas/meeting.schema.json -o src/types/generated/meeting.ts --cwd ../schemas
npx json2ts -i ../schemas/socketEvent.schema.json -o src/types/generated/socketEvent.ts --cwd ../schemas
npx json2ts -i ../schemas/processRequest.schema.json -o src/types/generated/processRequest.ts --cwd ../schemas
npx json2ts -i ../schemas/processResponse.schema.json -o src/types/generated/processResponse.ts --cwd ../schemas

cd ..

# Create index.ts that re-exports everything with clean names
cat > frontend/src/types/generated/index.ts << 'EOF'
/**
 * Auto-generated types from JSON schemas.
 * DO NOT EDIT - Run ./scripts/generate_types.sh to regenerate.
 */

export type { Workflow } from "./workflow";
export type { CurrentState } from "./currentState";
export type { CurrentStateVersion } from "./currentStateVersion";
export type { Meeting } from "./meeting";
export type { SocketEvent } from "./socketEvent";
export type { ProcessRequest } from "./processRequest";
export type { ProcessResponse } from "./processResponse";

// Re-export the state object from SocketEvent as CurrentState for convenience
// This is the actual shape of state data (meetingSummary + workflows)
import type { SocketEvent } from "./socketEvent";
export type CurrentStateData = SocketEvent["state"];
EOF

echo "✅ Frontend types generated"
echo ""
echo "📁 Generated files:"
echo "   backend/models/*.py"
echo "   frontend/src/types/generated/*.ts"
