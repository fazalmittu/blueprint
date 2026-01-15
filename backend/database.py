"""
SQLite database module for storing meetings and state versions.
"""
import sqlite3
import json
import os
from contextlib import contextmanager
from typing import Optional

from models import Meeting, CurrentStateVersion
from models.meeting_schema import Status
from models.currentStateVersion_schema import Data as CurrentStateData
from models.workflow_schema import Model as Workflow, Node, Edge, Type as NodeType, Variant as NodeVariant


# Database file path (in data directory, committed to git)
DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')
os.makedirs(DATA_DIR, exist_ok=True)
DB_PATH = os.path.join(DATA_DIR, 'blueprint.db')


def get_connection() -> sqlite3.Connection:
    """Get a database connection."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


@contextmanager
def get_db():
    """Context manager for database connections."""
    conn = get_connection()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db():
    """Initialize the database schema."""
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Create meetings table (with new columns)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS meetings (
                meeting_id TEXT PRIMARY KEY,
                status TEXT NOT NULL,
                org_id TEXT NOT NULL,
                title TEXT,
                transcript TEXT,
                total_chunks INTEGER
            )
        ''')
        
        # Create state_versions table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS state_versions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                meeting_id TEXT NOT NULL,
                version INTEGER NOT NULL,
                current_state_id TEXT NOT NULL,
                data_json TEXT NOT NULL,
                FOREIGN KEY (meeting_id) REFERENCES meetings(meeting_id),
                UNIQUE (meeting_id, version)
            )
        ''')
        
        # Create chat_sessions table for org-wide search chats and meeting-specific chats
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS chat_sessions (
                id TEXT PRIMARY KEY,
                org_id TEXT NOT NULL,
                meeting_id TEXT,
                title TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (meeting_id) REFERENCES meetings(meeting_id)
            )
        ''')
        
        # Create chat_messages table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS chat_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                sources_json TEXT,
                strategy_used TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
            )
        ''')
        
        # Create index for faster lookups
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_state_versions_meeting_id 
            ON state_versions(meeting_id)
        ''')
        
        # Create index for chat sessions by org
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_chat_sessions_org_id 
            ON chat_sessions(org_id)
        ''')
        
        # Create index for messages by session
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id 
            ON chat_messages(session_id)
        ''')
        
        # Migration: add transcript and total_chunks columns if they don't exist
        _migrate_add_transcript_columns(cursor)
        
        # Migration: add meeting_id column to chat_sessions if it doesn't exist
        _migrate_add_chat_session_meeting_id(cursor)
        
        # Create index for chat sessions by meeting (must be after migration adds the column)
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_chat_sessions_meeting_id 
            ON chat_sessions(meeting_id)
        ''')


def _migrate_add_transcript_columns(cursor):
    """Add transcript, total_chunks, and title columns if they don't exist."""
    # Check if columns exist
    cursor.execute("PRAGMA table_info(meetings)")
    columns = [col[1] for col in cursor.fetchall()]
    
    if 'transcript' not in columns:
        cursor.execute('ALTER TABLE meetings ADD COLUMN transcript TEXT')
    
    if 'total_chunks' not in columns:
        cursor.execute('ALTER TABLE meetings ADD COLUMN total_chunks INTEGER')
    
    if 'title' not in columns:
        cursor.execute('ALTER TABLE meetings ADD COLUMN title TEXT')


def _migrate_add_chat_session_meeting_id(cursor):
    """Add meeting_id column to chat_sessions if it doesn't exist."""
    cursor.execute("PRAGMA table_info(chat_sessions)")
    columns = [col[1] for col in cursor.fetchall()]
    
    if 'meeting_id' not in columns:
        cursor.execute('ALTER TABLE chat_sessions ADD COLUMN meeting_id TEXT')


# ==================== MEETING OPERATIONS ====================

def create_meeting(meeting: Meeting) -> None:
    """Store a new meeting in the database."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            '''INSERT INTO meetings (meeting_id, status, org_id, title, transcript, total_chunks) 
               VALUES (?, ?, ?, ?, ?, ?)''',
            (
                meeting.meetingId, 
                meeting.status.value, 
                meeting.orgId,
                meeting.title,
                meeting.transcript,
                meeting.totalChunks
            )
        )


def get_meeting(meeting_id: str) -> Optional[Meeting]:
    """Retrieve a meeting by ID."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            'SELECT meeting_id, status, org_id, title, transcript, total_chunks FROM meetings WHERE meeting_id = ?',
            (meeting_id,)
        )
        row = cursor.fetchone()
        
        if row is None:
            return None
        
        return Meeting(
            meetingId=row['meeting_id'],
            status=Status(row['status']),
            orgId=row['org_id'],
            title=row['title'],
            transcript=row['transcript'],
            totalChunks=row['total_chunks']
        )


def update_meeting_status(meeting_id: str, status: Status) -> bool:
    """Update a meeting's status."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            'UPDATE meetings SET status = ? WHERE meeting_id = ?',
            (status.value, meeting_id)
        )
        return cursor.rowcount > 0


def update_meeting_title(meeting_id: str, title: str) -> bool:
    """Update a meeting's title."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            'UPDATE meetings SET title = ? WHERE meeting_id = ?',
            (title, meeting_id)
        )
        return cursor.rowcount > 0


def update_meeting_transcript(meeting_id: str, transcript: str, total_chunks: int) -> bool:
    """Update a meeting's transcript and total chunks."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            'UPDATE meetings SET transcript = ?, total_chunks = ? WHERE meeting_id = ?',
            (transcript, total_chunks, meeting_id)
        )
        return cursor.rowcount > 0


def get_all_orgs() -> list[str]:
    """Get all unique org IDs from meetings."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT DISTINCT org_id FROM meetings ORDER BY org_id')
        rows = cursor.fetchall()
        return [row['org_id'] for row in rows]


def get_meetings_by_org(org_id: str) -> list[Meeting]:
    """Get all meetings for an organization."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            'SELECT meeting_id, status, org_id, title, transcript, total_chunks FROM meetings WHERE org_id = ? ORDER BY meeting_id',
            (org_id,)
        )
        rows = cursor.fetchall()
        
        meetings = []
        for row in rows:
            meeting = Meeting(
                meetingId=row['meeting_id'],
                status=Status(row['status']),
                orgId=row['org_id'],
                title=row['title'],
                transcript=row['transcript'],
                totalChunks=row['total_chunks']
            )
            meetings.append(meeting)
        
        return meetings


# ==================== STATE VERSION OPERATIONS ====================

def _serialize_state_data(data: CurrentStateData) -> str:
    """Serialize CurrentStateData to JSON string."""
    return json.dumps(data.model_dump(mode='json'))


def _deserialize_state_data(json_str: str) -> CurrentStateData:
    """Deserialize JSON string to CurrentStateData."""
    data_dict = json.loads(json_str)
    
    # Reconstruct workflows
    workflows = []
    for wf_data in data_dict.get('workflows', []):
        # Parse nodes
        nodes = []
        for node_data in wf_data.get('nodes', []):
            node = Node(
                id=node_data['id'],
                type=NodeType(node_data['type']),
                label=node_data['label'],
                variant=NodeVariant(node_data['variant']) if node_data.get('variant') else None
            )
            nodes.append(node)
        
        # Parse edges
        edges = []
        for edge_data in wf_data.get('edges', []):
            edge = Edge(
                id=edge_data['id'],
                source=edge_data['source'],
                target=edge_data['target'],
                label=edge_data.get('label')
            )
            edges.append(edge)
        
        workflow = Workflow(
            id=wf_data['id'],
            title=wf_data['title'],
            nodes=nodes,
            edges=edges,
            sources=wf_data['sources']
        )
        workflows.append(workflow)
    
    return CurrentStateData(
        meetingSummary=data_dict.get('meetingSummary', ''),
        workflows=workflows,
        chunkIndex=data_dict.get('chunkIndex'),
        chunkText=data_dict.get('chunkText')
    )


def add_state_version(meeting_id: str, state_version: CurrentStateVersion) -> None:
    """Add a new state version for a meeting."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            '''INSERT INTO state_versions 
               (meeting_id, version, current_state_id, data_json) 
               VALUES (?, ?, ?, ?)''',
            (
                meeting_id,
                state_version.version,
                state_version.currentStateId,
                _serialize_state_data(state_version.data)
            )
        )


def get_all_state_versions(meeting_id: str) -> list[CurrentStateVersion]:
    """Get all state versions for a meeting, ordered by version."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            '''SELECT version, current_state_id, data_json 
               FROM state_versions 
               WHERE meeting_id = ? 
               ORDER BY version ASC''',
            (meeting_id,)
        )
        rows = cursor.fetchall()
        
        versions = []
        for row in rows:
            state_version = CurrentStateVersion(
                version=row['version'],
                currentStateId=row['current_state_id'],
                data=_deserialize_state_data(row['data_json'])
            )
            versions.append(state_version)
        
        return versions


def get_latest_state_version(meeting_id: str) -> Optional[CurrentStateVersion]:
    """Get the latest state version for a meeting."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            '''SELECT version, current_state_id, data_json 
               FROM state_versions 
               WHERE meeting_id = ? 
               ORDER BY version DESC 
               LIMIT 1''',
            (meeting_id,)
        )
        row = cursor.fetchone()
        
        if row is None:
            return None
        
        return CurrentStateVersion(
            version=row['version'],
            currentStateId=row['current_state_id'],
            data=_deserialize_state_data(row['data_json'])
        )


def get_state_version(meeting_id: str, version: int) -> Optional[CurrentStateVersion]:
    """Get a specific state version for a meeting."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            '''SELECT version, current_state_id, data_json 
               FROM state_versions 
               WHERE meeting_id = ? AND version = ?''',
            (meeting_id, version)
        )
        row = cursor.fetchone()
        
        if row is None:
            return None
        
        return CurrentStateVersion(
            version=row['version'],
            currentStateId=row['current_state_id'],
            data=_deserialize_state_data(row['data_json'])
        )


def get_state_version_count(meeting_id: str) -> int:
    """Get the count of state versions for a meeting."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            'SELECT COUNT(*) FROM state_versions WHERE meeting_id = ?',
            (meeting_id,)
        )
        return cursor.fetchone()[0]


def update_latest_state_workflows(meeting_id: str, workflows: list[Workflow]) -> Optional[CurrentStateVersion]:
    """
    Update workflows in the latest state version for a meeting.
    
    Args:
        meeting_id: The meeting ID
        workflows: The new list of workflows
    
    Returns:
        The updated CurrentStateVersion, or None if no state exists
    """
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Get the latest version
        cursor.execute(
            '''SELECT version, current_state_id, data_json 
               FROM state_versions 
               WHERE meeting_id = ? 
               ORDER BY version DESC 
               LIMIT 1''',
            (meeting_id,)
        )
        row = cursor.fetchone()
        
        if row is None:
            return None
        
        # Deserialize current data
        current_data = _deserialize_state_data(row['data_json'])
        
        # Update workflows
        current_data.workflows = workflows
        
        # Serialize back
        new_data_json = _serialize_state_data(current_data)
        
        # Update in database
        cursor.execute(
            '''UPDATE state_versions 
               SET data_json = ? 
               WHERE meeting_id = ? AND version = ?''',
            (new_data_json, meeting_id, row['version'])
        )
        
        return CurrentStateVersion(
            version=row['version'],
            currentStateId=row['current_state_id'],
            data=current_data
        )


def update_latest_state_summary(meeting_id: str, meeting_summary: str) -> Optional[CurrentStateVersion]:
    """
    Update the meeting summary in the latest state version for a meeting.
    
    Args:
        meeting_id: The meeting ID
        meeting_summary: The new meeting summary text
    
    Returns:
        The updated CurrentStateVersion, or None if no state exists
    """
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Get the latest version
        cursor.execute(
            '''SELECT version, current_state_id, data_json 
               FROM state_versions 
               WHERE meeting_id = ? 
               ORDER BY version DESC 
               LIMIT 1''',
            (meeting_id,)
        )
        row = cursor.fetchone()
        
        if row is None:
            return None
        
        # Deserialize current data
        current_data = _deserialize_state_data(row['data_json'])
        
        # Update summary
        current_data.meetingSummary = meeting_summary
        
        # Serialize back
        new_data_json = _serialize_state_data(current_data)
        
        # Update in database
        cursor.execute(
            '''UPDATE state_versions 
               SET data_json = ? 
               WHERE meeting_id = ? AND version = ?''',
            (new_data_json, meeting_id, row['version'])
        )
        
        return CurrentStateVersion(
            version=row['version'],
            currentStateId=row['current_state_id'],
            data=current_data
        )


# ==================== CHAT SESSION OPERATIONS ====================

def create_chat_session(session_id: str, org_id: str, title: Optional[str] = None, meeting_id: Optional[str] = None) -> dict:
    """Create a new chat session (org-wide or meeting-specific)."""
    from datetime import datetime
    now = datetime.utcnow().isoformat()
    
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            '''INSERT INTO chat_sessions (id, org_id, meeting_id, title, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?)''',
            (session_id, org_id, meeting_id, title, now, now)
        )
    
    result = {
        'id': session_id,
        'orgId': org_id,
        'title': title,
        'createdAt': now,
        'updatedAt': now,
        'messages': []
    }
    if meeting_id:
        result['meetingId'] = meeting_id
    return result


def get_chat_session(session_id: str) -> Optional[dict]:
    """Get a chat session with all its messages."""
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Get session
        cursor.execute(
            'SELECT id, org_id, meeting_id, title, created_at, updated_at FROM chat_sessions WHERE id = ?',
            (session_id,)
        )
        row = cursor.fetchone()
        
        if row is None:
            return None
        
        # Get messages
        cursor.execute(
            '''SELECT id, role, content, sources_json, strategy_used, created_at 
               FROM chat_messages WHERE session_id = ? ORDER BY id ASC''',
            (session_id,)
        )
        message_rows = cursor.fetchall()
        
        messages = []
        for msg in message_rows:
            message = {
                'id': str(msg['id']),
                'role': msg['role'],
                'content': msg['content'],
                'createdAt': msg['created_at']
            }
            if msg['sources_json']:
                message['sources'] = json.loads(msg['sources_json'])
            if msg['strategy_used']:
                message['strategyUsed'] = msg['strategy_used']
            messages.append(message)
        
        result = {
            'id': row['id'],
            'orgId': row['org_id'],
            'title': row['title'],
            'createdAt': row['created_at'],
            'updatedAt': row['updated_at'],
            'messages': messages
        }
        if row['meeting_id']:
            result['meetingId'] = row['meeting_id']
        return result


def get_chat_session_by_meeting(meeting_id: str) -> Optional[dict]:
    """Get the chat session for a specific meeting (there should be at most one)."""
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Get session by meeting_id
        cursor.execute(
            'SELECT id, org_id, meeting_id, title, created_at, updated_at FROM chat_sessions WHERE meeting_id = ?',
            (meeting_id,)
        )
        row = cursor.fetchone()
        
        if row is None:
            return None
        
        # Get messages
        cursor.execute(
            '''SELECT id, role, content, sources_json, strategy_used, created_at 
               FROM chat_messages WHERE session_id = ? ORDER BY id ASC''',
            (row['id'],)
        )
        message_rows = cursor.fetchall()
        
        messages = []
        for msg in message_rows:
            message = {
                'id': str(msg['id']),
                'role': msg['role'],
                'content': msg['content'],
                'createdAt': msg['created_at']
            }
            if msg['sources_json']:
                message['sources'] = json.loads(msg['sources_json'])
            if msg['strategy_used']:
                message['strategyUsed'] = msg['strategy_used']
            messages.append(message)
        
        return {
            'id': row['id'],
            'orgId': row['org_id'],
            'meetingId': row['meeting_id'],
            'title': row['title'],
            'createdAt': row['created_at'],
            'updatedAt': row['updated_at'],
            'messages': messages
        }


def get_chat_sessions_by_org(org_id: str, limit: int = 50, include_meeting_chats: bool = False) -> list[dict]:
    """Get all chat sessions for an organization, most recent first.
    
    Args:
        org_id: The organization ID
        limit: Maximum number of sessions to return
        include_meeting_chats: If False (default), excludes meeting-specific chats
    """
    with get_db() as conn:
        cursor = conn.cursor()
        if include_meeting_chats:
            cursor.execute(
                '''SELECT id, org_id, meeting_id, title, created_at, updated_at 
                   FROM chat_sessions 
                   WHERE org_id = ? 
                   ORDER BY updated_at DESC
                   LIMIT ?''',
                (org_id, limit)
            )
        else:
            cursor.execute(
                '''SELECT id, org_id, meeting_id, title, created_at, updated_at 
                   FROM chat_sessions 
                   WHERE org_id = ? AND meeting_id IS NULL
                   ORDER BY updated_at DESC
                   LIMIT ?''',
                (org_id, limit)
            )
        rows = cursor.fetchall()
        
        sessions = []
        for row in rows:
            # Get first message preview
            cursor.execute(
                '''SELECT content FROM chat_messages 
                   WHERE session_id = ? AND role = 'user' 
                   ORDER BY id ASC LIMIT 1''',
                (row['id'],)
            )
            first_msg = cursor.fetchone()
            preview = first_msg['content'][:100] if first_msg else None
            
            # Get message count
            cursor.execute(
                'SELECT COUNT(*) FROM chat_messages WHERE session_id = ?',
                (row['id'],)
            )
            msg_count = cursor.fetchone()[0]
            
            session_data = {
                'id': row['id'],
                'orgId': row['org_id'],
                'title': row['title'],
                'preview': preview,
                'messageCount': msg_count,
                'createdAt': row['created_at'],
                'updatedAt': row['updated_at']
            }
            if row['meeting_id']:
                session_data['meetingId'] = row['meeting_id']
            sessions.append(session_data)
        
        return sessions


def add_chat_message(session_id: str, role: str, content: str, 
                     sources: Optional[list] = None, strategy_used: Optional[str] = None) -> dict:
    """Add a message to a chat session."""
    from datetime import datetime
    now = datetime.utcnow().isoformat()
    
    with get_db() as conn:
        cursor = conn.cursor()
        
        sources_json = json.dumps(sources) if sources else None
        
        cursor.execute(
            '''INSERT INTO chat_messages (session_id, role, content, sources_json, strategy_used, created_at)
               VALUES (?, ?, ?, ?, ?, ?)''',
            (session_id, role, content, sources_json, strategy_used, now)
        )
        message_id = cursor.lastrowid
        
        # Update session updated_at
        cursor.execute(
            'UPDATE chat_sessions SET updated_at = ? WHERE id = ?',
            (now, session_id)
        )
    
    message = {
        'id': str(message_id),
        'role': role,
        'content': content,
        'createdAt': now
    }
    if sources:
        message['sources'] = sources
    if strategy_used:
        message['strategyUsed'] = strategy_used
    
    return message


def update_chat_session_title(session_id: str, title: str) -> bool:
    """Update a chat session's title."""
    from datetime import datetime
    now = datetime.utcnow().isoformat()
    
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            'UPDATE chat_sessions SET title = ?, updated_at = ? WHERE id = ?',
            (title, now, session_id)
        )
        return cursor.rowcount > 0


def delete_chat_session(session_id: str) -> bool:
    """Delete a chat session and all its messages."""
    with get_db() as conn:
        cursor = conn.cursor()
        # Messages will be deleted by CASCADE
        cursor.execute('DELETE FROM chat_sessions WHERE id = ?', (session_id,))
        return cursor.rowcount > 0


# Initialize the database on module import
init_db()
