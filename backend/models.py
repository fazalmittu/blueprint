import uuid
from datetime import datetime
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


def generate_uuid():
    return str(uuid.uuid4())


class Meeting(db.Model):
    """Meeting model to track meeting sessions."""
    __tablename__ = 'meetings'

    id = db.Column(db.String(36), primary_key=True, default=generate_uuid)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    status = db.Column(db.String(20), default='active')  # active, finalized

    # Relationship to current states
    current_states = db.relationship('CurrentState', backref='meeting', lazy='dynamic', order_by='CurrentState.version.desc()')

    def to_dict(self):
        return {
            'id': self.id,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat(),
            'status': self.status
        }


class CurrentState(db.Model):
    """CurrentState model to track versioned states for each meeting."""
    __tablename__ = 'current_states'

    id = db.Column(db.String(36), primary_key=True, default=generate_uuid)
    meeting_id = db.Column(db.String(36), db.ForeignKey('meetings.id'), nullable=False)
    version = db.Column(db.Integer, nullable=False, default=1)
    state_data = db.Column(db.JSON, default=dict)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Unique constraint on meeting_id + version
    __table_args__ = (
        db.UniqueConstraint('meeting_id', 'version', name='unique_meeting_version'),
    )

    def to_dict(self):
        return {
            'id': self.id,
            'meeting_id': self.meeting_id,
            'version': self.version,
            'state_data': self.state_data,
            'created_at': self.created_at.isoformat()
        }

