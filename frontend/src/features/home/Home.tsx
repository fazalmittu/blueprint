import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { 
  getCurrentOrg, 
  getMeetingsByOrg, 
  createMeeting, 
  type MeetingsResponse,
  type SearchResponse,
} from "@/api/client";
import { UploadTranscriptModal } from "./UploadTranscriptModal";
import { SearchBar } from "./SearchBar";
import { OrgChatView } from "./OrgChatView";

type Meeting = MeetingsResponse["meetings"][number];

const SEARCH_STORAGE_KEY = "blueprint_search_state";

interface PersistedSearchState {
  query: string;
  result: SearchResponse;
}

function saveSearchState(query: string, result: SearchResponse) {
  try {
    sessionStorage.setItem(SEARCH_STORAGE_KEY, JSON.stringify({ query, result }));
  } catch {
    // Ignore storage errors
  }
}

function loadSearchState(): PersistedSearchState | null {
  try {
    const stored = sessionStorage.getItem(SEARCH_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored) as PersistedSearchState;
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}

function clearSearchState() {
  try {
    sessionStorage.removeItem(SEARCH_STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}

export function Home() {
  const navigate = useNavigate();
  const [orgId, setOrgId] = useState<string | null>(null);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  
  // Search state - initialize from sessionStorage if available
  const [searchQuery, setSearchQuery] = useState(() => {
    const saved = loadSearchState();
    return saved?.query ?? "";
  });
  const [searchResult, setSearchResult] = useState<SearchResponse | null>(() => {
    const saved = loadSearchState();
    return saved?.result ?? null;
  });
  const [searchError, setSearchError] = useState<string | null>(null);
  const [showChatView, setShowChatView] = useState(() => {
    // Show chat view if we have persisted search state
    const saved = loadSearchState();
    return saved?.query && saved?.result?.success ? true : false;
  });

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

  const handleCreateMeeting = useCallback(async (transcript: string) => {
    if (!orgId) return;
    
    // Create meeting with transcript
    const result = await createMeeting(orgId, transcript);
    
    // Navigate to the meeting page - it will start processing
    navigate(`/meeting/${result.meetingId}`);
  }, [orgId, navigate]);

  const handleSearch = useCallback((query: string) => {
    if (!orgId) return;
    
    // Immediately show the chat view with the query - the chat view will handle the search
    setSearchQuery(query);
    setSearchResult(null); // Clear any previous result
    setSearchError(null);
    setShowChatView(true);
  }, [orgId]);

  const handleCloseSearch = useCallback(() => {
    setSearchResult(null);
    setSearchQuery("");
    setSearchError(null);
    setShowChatView(false);
    clearSearchState();
  }, []);

  if (loading) {
    return (
      <div className="home-container">
        <div className="loading">
          <div className="loading-spinner" />
          <span>Loading your workspace...</span>
        </div>
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
    <div className="home-wrapper">
    <div className="home-container">
      {/* Hero section with search */}
      <div className="hero-section">
        <div className="hero-content">
          <h1 className="hero-title">
            <span className="hero-icon">📋</span>
            {orgId}
          </h1>
          <p className="hero-subtitle">
            Search across all your meetings, workflows, and notes
          </p>
        </div>
        
        <div className="search-section">
          <SearchBar 
            onSearch={handleSearch} 
            isLoading={false}
            placeholder="Ask anything about your meetings..."
            initialQuery={searchQuery}
          />
          
          {searchError && (
            <div className="search-error">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {searchError}
            </div>
          )}
        </div>
      </div>

      {/* Meetings section */}
      <section className="meetings-section">
        <div className="section-header">
          <h2>Meetings</h2>
          <button className="new-meeting-btn" onClick={() => setShowUploadModal(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Meeting
          </button>
        </div>
        
        {meetings.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📝</div>
            <h3>No meetings yet</h3>
            <p>Upload a transcript to create your first meeting</p>
            <button 
              className="empty-cta" 
              onClick={() => setShowUploadModal(true)}
            >
              Upload Transcript
            </button>
          </div>
        ) : (
          <ul className="meetings-list">
            {meetings.map((meeting) => (
              <li
                key={meeting.meetingId}
                className="meeting-card"
                onClick={() => navigate(`/meeting/${meeting.meetingId}`)}
              >
                <div className="meeting-info">
                  <div className="meeting-title">
                    {meeting.title || `Meeting ${meeting.meetingId.slice(0, 8)}...`}
                  </div>
                  <div className="meeting-meta">
                    {meeting.totalChunks && (
                      <span className="meeting-chunks">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                        </svg>
                        {meeting.totalChunks} chunks
                      </span>
                    )}
                  </div>
                </div>
                <span className={`status-badge ${meeting.status}`}>
                  {meeting.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <UploadTranscriptModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onSubmit={handleCreateMeeting}
      />

      {showChatView && orgId && (
        <OrgChatView
          orgId={orgId}
          initialQuery={searchQuery}
          initialResult={searchResult}
          onClose={handleCloseSearch}
        />
      )}

      <style>{`
        .home-container {
          max-width: min(56rem, 92vw);
          margin: 0 auto;
          padding: var(--space-xl) var(--space-lg);
          padding-bottom: 100px;
        }

        .hero-section {
          margin-bottom: var(--space-2xl);
        }

        .hero-content {
          text-align: center;
          margin-bottom: var(--space-xl);
        }

        .hero-title {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: var(--space-sm);
          margin: 0 0 var(--space-sm) 0;
          font-size: 1.75rem;
          font-weight: 700;
          color: var(--text-primary);
          letter-spacing: -0.02em;
        }

        .hero-icon {
          font-size: 1.5rem;
        }

        .hero-subtitle {
          margin: 0;
          font-size: 1rem;
          color: var(--text-secondary);
        }

        .search-section {
          max-width: 640px;
          margin: 0 auto;
        }

        .search-error {
          display: flex;
          align-items: center;
          gap: var(--space-sm);
          margin-top: var(--space-md);
          padding: var(--space-sm) var(--space-md);
          background: rgba(239, 68, 68, 0.1);
          border-radius: var(--radius-md);
          color: #dc2626;
          font-size: 0.875rem;
        }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: var(--space-md);
          padding-bottom: var(--space-md);
          border-bottom: 1px solid var(--border-subtle);
        }

        .section-header h2 {
          margin: 0;
          font-size: 0.8125rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--text-muted);
        }

        .new-meeting-btn {
          display: flex;
          align-items: center;
          gap: var(--space-xs);
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

        .empty-state {
          text-align: center;
          padding: var(--space-2xl) var(--space-xl);
          background: var(--bg-elevated);
          border: 2px dashed var(--border-subtle);
          border-radius: var(--radius-lg);
        }

        .empty-icon {
          font-size: 3rem;
          margin-bottom: var(--space-md);
        }

        .empty-state h3 {
          margin: 0 0 var(--space-sm) 0;
          font-size: 1.125rem;
          font-weight: 600;
          color: var(--text-primary);
        }

        .empty-state p {
          margin: 0 0 var(--space-lg) 0;
          color: var(--text-secondary);
        }

        .empty-cta {
          padding: var(--space-sm) var(--space-lg);
          background: var(--accent);
          color: white;
          border: none;
          border-radius: var(--radius-md);
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          transition: opacity var(--transition-fast);
        }

        .empty-cta:hover {
          opacity: 0.9;
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
          padding: var(--space-md) var(--space-lg);
          background: var(--bg-elevated);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-md);
          cursor: pointer;
          transition: all var(--transition-fast);
        }

        .meeting-card:hover {
          border-color: var(--border-default);
          box-shadow: var(--shadow-card);
          transform: translateY(-1px);
        }

        .meeting-info {
          display: flex;
          flex-direction: column;
          gap: var(--space-xs);
          flex: 1;
          min-width: 0;
        }

        .meeting-title {
          font-size: 0.9375rem;
          font-weight: 500;
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .meeting-meta {
          display: flex;
          align-items: center;
          gap: var(--space-md);
        }

        .meeting-chunks {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 0.75rem;
          color: var(--text-muted);
        }

        .status-badge {
          font-size: 0.6875rem;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          padding: var(--space-xs) var(--space-sm);
          border-radius: 9999px;
          flex-shrink: 0;
        }

        .status-badge.active {
          background: rgba(16, 185, 129, 0.1);
          color: #059669;
        }

        .status-badge.finalized {
          background: rgba(99, 102, 241, 0.1);
          color: #4f46e5;
        }

        .loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: var(--space-md);
          padding: var(--space-2xl);
          color: var(--text-muted);
        }

        .loading-spinner {
          width: 32px;
          height: 32px;
          border: 3px solid var(--border-subtle);
          border-top-color: var(--accent);
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .error {
          text-align: center;
          padding: var(--space-xl);
          color: #dc2626;
        }
        
        .home-wrapper {
          width: 100%;
          height: 100%;
          overflow-y: auto;
        }
      `}</style>
    </div>
    </div>
  );
}
