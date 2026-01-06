#!/bin/bash
set -e

cd "$(dirname "$0")/.."

echo "🔁 Generating backend Pydantic models..."
mkdir -p backend/models
datamodel-codegen --input schemas/currentState.schema.json --input-file-type jsonschema --output backend/models/current_state.py
datamodel-codegen --input schemas/workflow.schema.json --input-file-type jsonschema --output backend/models/workflow.py
datamodel-codegen --input schemas/currentStateVersion.schema.json --input-file-type jsonschema --output backend/models/current_state_version.py
datamodel-codegen --input schemas/meeting.schema.json --input-file-type jsonschema --output backend/models/meeting.py
datamodel-codegen --input schemas/socketEvent.schema.json --input-file-type jsonschema --output backend/models/socket_event.py
datamodel-codegen --input schemas/processRequest.schema.json --input-file-type jsonschema --output backend/models/process_request.py
datamodel-codegen --input schemas/processResponse.schema.json --input-file-type jsonschema --output backend/models/process_response.py

echo "🔁 Generating frontend TypeScript types..."
mkdir -p frontend/src/types
npx json2ts -i schemas/currentState.schema.json -o frontend/src/types/currentState.ts
npx json2ts -i schemas/workflow.schema.json -o frontend/src/types/workflow.ts
npx json2ts -i schemas/currentStateVersion.schema.json -o frontend/src/types/currentStateVersion.ts
npx json2ts -i schemas/meeting.schema.json -o frontend/src/types/meeting.ts
npx json2ts -i schemas/socketEvent.schema.json -o frontend/src/types/socketEvent.ts
npx json2ts -i schemas/processRequest.schema.json -o frontend/src/types/processRequest.ts
npx json2ts -i schemas/processResponse.schema.json -o frontend/src/types/processResponse.ts

echo "✅ Shared types updated"

