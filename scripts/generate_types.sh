#!/bin/bash
# Generates Pydantic models from JSON schemas
#
# Usage:
#   ./scripts/generate_types.sh
#
# Prerequisites:
#   pip install datamodel-code-generator
#
set -e

cd "$(dirname "$0")/.."

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

# Frontend generation (uncomment when frontend is set up)
# echo "🔁 Generating frontend TypeScript types..."
# mkdir -p frontend/src/types
# npx json2ts -i schemas/currentState.schema.json -o frontend/src/types/currentState.ts
# npx json2ts -i schemas/workflow.schema.json -o frontend/src/types/workflow.ts
# npx json2ts -i schemas/currentStateVersion.schema.json -o frontend/src/types/currentStateVersion.ts
# npx json2ts -i schemas/meeting.schema.json -o frontend/src/types/meeting.ts
# npx json2ts -i schemas/socketEvent.schema.json -o frontend/src/types/socketEvent.ts
# npx json2ts -i schemas/processRequest.schema.json -o frontend/src/types/processRequest.ts
# npx json2ts -i schemas/processResponse.schema.json -o frontend/src/types/processResponse.ts
# echo "✅ Frontend types generated"
