import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getCurrentOrg, getMeetingsByOrg, type MeetingsResponse } from "@/api/client";

type Meeting = MeetingsResponse["meetings"][number];

export function Home() {
  const navigate = useNavigate();
  const [orgId, setOrgId] = useState<string | null>(null);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const orgRes = await getCurrentOrg();
        setOrgId(orgRes.orgId);

        const meetingsRes = await getMeetingsByOrg(orgRes.orgId);
        setMeetings(meetingsRes.meetings);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="home-container">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="home-container">
        <div className="error">{error}</div>
      </div>
    );
  }

  return (
    <div className="home-container">
      <header className="home-header">
        <h1>{orgId}</h1>
        <button className="new-meeting-btn" onClick={() => {}}>
          New Meeting
        </button>
      </header>

      <section className="meetings-section">
        <h2>Meetings</h2>
        {meetings.length === 0 ? (
          <p className="no-meetings">No meetings yet</p>
        ) : (
          <ul className="meetings-list">
            {meetings.map((meeting) => (
              <li
                key={meeting.meetingId}
                className="meeting-card"
                onClick={() => navigate(`/meeting/${meeting.meetingId}`)}
              >
                <div className="meeting-id">{meeting.meetingId.slice(0, 8)}...</div>
                <span className={`status-badge ${meeting.status}`}>
                  {meeting.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <style>{`
        .home-container {
          max-width: 800px;
          margin: 0 auto;
          padding: var(--space-xl);
        }

        .home-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: var(--space-xl);
          padding-bottom: var(--space-md);
          border-bottom: 1px solid var(--border-subtle);
        }

        .home-header h1 {
          margin: 0;
          font-size: 1.5rem;
          font-weight: 600;
          color: var(--text-primary);
        }

        .new-meeting-btn {
          padding: var(--space-sm) var(--space-md);
          background: var(--accent);
          color: white;
          border: none;
          border-radius: var(--radius-md);
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          transition: opacity var(--transition-fast);
        }

        .new-meeting-btn:hover {
          opacity: 0.9;
        }

        .meetings-section h2 {
          margin: 0 0 var(--space-md) 0;
          font-size: 0.75rem;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--text-muted);
        }

        .no-meetings {
          color: var(--text-muted);
          font-size: 0.875rem;
        }

        .meetings-list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: var(--space-sm);
        }

        .meeting-card {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: var(--space-md);
          background: var(--bg-elevated);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-md);
          cursor: pointer;
          transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
        }

        .meeting-card:hover {
          border-color: var(--border-default);
          box-shadow: var(--shadow-card);
        }

        .meeting-id {
          font-family: var(--font-mono);
          font-size: 0.875rem;
          color: var(--text-primary);
        }

        .status-badge {
          font-size: 0.6875rem;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          padding: 2px 8px;
          border-radius: 9999px;
        }

        .status-badge.active {
          background: #dcfce7;
          color: #166534;
        }

        .status-badge.finalized {
          background: #e0e7ff;
          color: #3730a3;
        }

        .loading, .error {
          text-align: center;
          padding: var(--space-xl);
          color: var(--text-muted);
        }

        .error {
          color: #dc2626;
        }
      `}</style>
    </div>
  );
}

