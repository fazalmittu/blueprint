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


# Database file path (in project root, outside backend folder)
DB_PATH = os.path.join(os.path.dirname(__file__), '..', 'blueprint.db')


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
        
        # Create index for faster lookups
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_state_versions_meeting_id 
            ON state_versions(meeting_id)
        ''')
        
        # Migration: add transcript and total_chunks columns if they don't exist
        _migrate_add_transcript_columns(cursor)


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


# Initialize the database on module import
init_db()
