"""
FastAPI WebSocket server for real-time meeting updates.
Runs on port 8000 alongside the Flask API on port 5001.
"""

import asyncio
from contextlib import asynccontextmanager
from typing import Dict, List
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel


class ConnectionManager:
    """Manages WebSocket connections organized by meeting_id."""
    
    def __init__(self):
        # meeting_id -> list of active WebSocket connections
        self.active_connections: Dict[str, List[WebSocket]] = {}
    
    async def connect(self, websocket: WebSocket, meeting_id: str):
        """Accept a new WebSocket connection and add it to the meeting room."""
        await websocket.accept()
        if meeting_id not in self.active_connections:
            self.active_connections[meeting_id] = []
        self.active_connections[meeting_id].append(websocket)
        print(f"✅ Client connected to meeting {meeting_id}. Total: {len(self.active_connections[meeting_id])}")
    
    def disconnect(self, websocket: WebSocket, meeting_id: str):
        """Remove a WebSocket connection from the meeting room."""
        if meeting_id in self.active_connections:
            if websocket in self.active_connections[meeting_id]:
                self.active_connections[meeting_id].remove(websocket)
            if not self.active_connections[meeting_id]:
                del self.active_connections[meeting_id]
        print(f"❌ Client disconnected from meeting {meeting_id}")
    
    async def broadcast_to_meeting(self, meeting_id: str, message: dict):
        """Broadcast a message to all clients in a specific meeting."""
        if meeting_id not in self.active_connections:
            print(f"⚠️ No clients connected to meeting {meeting_id}")
            return
        
        connections = self.active_connections[meeting_id].copy()
        disconnected = []
        
        for websocket in connections:
            try:
                await websocket.send_json(message)
            except Exception as e:
                print(f"Error sending to client: {e}")
                disconnected.append(websocket)
        
        # Clean up disconnected clients
        for ws in disconnected:
            self.disconnect(ws, meeting_id)
        
        print(f"📡 Broadcast to {len(connections) - len(disconnected)} clients in meeting {meeting_id}")
    
    def get_connection_count(self, meeting_id: str) -> int:
        """Get number of active connections for a meeting."""
        return len(self.active_connections.get(meeting_id, []))


# Global connection manager
manager = ConnectionManager()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    print("🚀 WebSocket server starting...")
    yield
    print("👋 WebSocket server shutting down...")


app = FastAPI(
    title="Blueprint WebSocket Server",
    description="Real-time WebSocket server for meeting updates",
    lifespan=lifespan
)

# CORS middleware for cross-origin requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==================== WebSocket Endpoints ====================

@app.websocket("/ws/{meeting_id}")
async def websocket_endpoint(websocket: WebSocket, meeting_id: str):
    """
    WebSocket endpoint for real-time meeting updates.
    Clients connect to /ws/{meeting_id} to receive updates for that meeting.
    """
    await manager.connect(websocket, meeting_id)
    
    try:
        while True:
            # Keep connection alive and handle any client messages
            data = await websocket.receive_text()
            # Echo back or handle ping/pong
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        manager.disconnect(websocket, meeting_id)
    except Exception as e:
        print(f"WebSocket error: {e}")
        manager.disconnect(websocket, meeting_id)


# ==================== HTTP Endpoints for Flask Integration ====================

class BroadcastPayload(BaseModel):
    """Payload for broadcasting state updates."""
    type: str = "full_state"
    state: dict


@app.post("/broadcast/{meeting_id}")
async def broadcast_state(meeting_id: str, payload: BroadcastPayload):
    """
    HTTP endpoint for Flask to trigger WebSocket broadcasts.
    Flask calls this after processing a chunk to notify all connected clients.
    """
    message = {
        "type": payload.type,
        "state": payload.state
    }
    await manager.broadcast_to_meeting(meeting_id, message)
    
    return {
        "success": True,
        "meeting_id": meeting_id,
        "clients_notified": manager.get_connection_count(meeting_id)
    }


@app.get("/connections/{meeting_id}")
async def get_connections(meeting_id: str):
    """Get the number of active connections for a meeting."""
    return {
        "meeting_id": meeting_id,
        "connection_count": manager.get_connection_count(meeting_id)
    }


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "websocket-server"}


# ==================== Main ====================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

