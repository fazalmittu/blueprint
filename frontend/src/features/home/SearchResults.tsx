import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { SearchSource } from "@/api/client";

interface SearchResultsProps {
  query: string;
  answer: string;
  sources: SearchSource[];
  strategyUsed: string;
  debugInfo?: Record<string, unknown>;
  onClose: () => void;
}

/**
 * Render text with basic markdown support (bold, italic, lists).
 */
function MarkdownText({ text }: { text: string }) {
  // Split into lines for list handling
  const lines = text.split('\n');
  
  const renderLine = (line: string, key: number) => {
    // Handle list items
    const listMatch = line.match(/^(\s*)[-*]\s+(.+)$/);
    if (listMatch) {
      const [, indent, content] = listMatch;
      const level = Math.floor(indent.length / 2);
      return (
        <div key={key} style={{ paddingLeft: level * 16, display: 'flex', gap: 8, marginTop: 4 }}>
          <span style={{ color: 'var(--text-muted)' }}>•</span>
          <span>{renderInline(content)}</span>
        </div>
      );
    }
    
    // Handle numbered lists
    const numMatch = line.match(/^(\d+)\.\s+(.+)$/);
    if (numMatch) {
      const [, num, content] = numMatch;
      return (
        <div key={key} style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <span style={{ color: 'var(--text-muted)', minWidth: 20 }}>{num}.</span>
          <span>{renderInline(content)}</span>
        </div>
      );
    }
    
    // Empty lines become spacing
    if (!line.trim()) {
      return <div key={key} style={{ height: 8 }} />;
    }
    
    // Regular paragraph
    return <div key={key} style={{ marginTop: key > 0 ? 4 : 0 }}>{renderInline(line)}</div>;
  };
  
  const renderInline = (text: string) => {
    // Handle **bold** and *italic*
    const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
    
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('*') && part.endsWith('*') && !part.startsWith('**')) {
        return <em key={i}>{part.slice(1, -1)}</em>;
      }
      return <span key={i}>{part}</span>;
    });
  };
  
  return <>{lines.map((line, i) => renderLine(line, i))}</>;
}

/**
 * Search results display with answer and sources.
 * Shows the AI-generated answer and links to source meetings.
 */
export function SearchResults({
  query,
  answer,
  sources,
  strategyUsed,
  debugInfo,
  onClose,
}: SearchResultsProps) {
  const navigate = useNavigate();
  const [showDebug, setShowDebug] = useState(false);

  const handleMeetingClick = (meetingId: string) => {
    navigate(`/meeting/${meetingId}`);
  };

  // Get doc type display name
  const getDocTypeLabel = (docType: string) => {
    const labels: Record<string, string> = {
      meeting_title: "Title Match",
      transcript_chunk: "Transcript",
      workflow_summary: "Workflow",
      meeting_notes: "Notes",
    };
    return labels[docType] || docType;
  };

  // Get doc type color
  const getDocTypeColor = (docType: string) => {
    const colors: Record<string, string> = {
      meeting_title: "#6366f1",
      transcript_chunk: "#10b981",
      workflow_summary: "#f59e0b",
      meeting_notes: "#ec4899",
    };
    return colors[docType] || "#6b7280";
  };

  return (
    <div
      style={{
        background: "var(--bg-elevated)",
        border: "1px solid var(--border-subtle)",
        borderRadius: 16,
        padding: 24,
        marginTop: 16,
        boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
        maxHeight: "calc(100vh - 280px)",
        overflowY: "auto",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 20,
        }}
      >
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: "0.75rem",
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginBottom: 8,
            }}
          >
            Answer
          </div>
          <div
            style={{
              fontSize: "0.875rem",
              color: "var(--text-secondary)",
              fontStyle: "italic",
            }}
          >
            "{query}"
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 4,
            borderRadius: 4,
            color: "var(--text-muted)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          title="Close results"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Answer */}
      <div
        style={{
          padding: 20,
          background: "linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, rgba(139, 92, 246, 0.05) 100%)",
          borderRadius: 12,
          marginBottom: 24,
          border: "1px solid rgba(99, 102, 241, 0.1)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 12,
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: "var(--accent)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2"
            >
              <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
            </svg>
          </div>
          <div
            style={{
              fontSize: "0.9375rem",
              lineHeight: 1.7,
              color: "var(--text-secondary)",
              maxHeight: 400,
              overflowY: "auto",
            }}
          >
            <MarkdownText text={answer} />
          </div>
        </div>
      </div>

      {/* Sources */}
      {sources.length > 0 && (
        <div>
          <div
            style={{
              fontSize: "0.75rem",
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginBottom: 12,
            }}
          >
            Sources ({sources.length})
          </div>
          
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {sources.map((source, idx) => (
              <div
                key={idx}
                onClick={() => handleMeetingClick(source.meeting_id)}
                style={{
                  padding: 12,
                  background: "var(--bg-tertiary)",
                  borderRadius: 8,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  border: "1px solid transparent",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--bg-secondary)";
                  e.currentTarget.style.borderColor = "var(--border-default)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "var(--bg-tertiary)";
                  e.currentTarget.style.borderColor = "transparent";
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 6,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span
                      style={{
                        fontSize: "0.875rem",
                        fontWeight: 500,
                        color: "var(--text-primary)",
                      }}
                    >
                      {source.meeting_title}
                    </span>
                    <span
                      style={{
                        fontSize: "0.6875rem",
                        fontWeight: 500,
                        padding: "2px 6px",
                        borderRadius: 4,
                        background: `${getDocTypeColor(source.doc_type)}15`,
                        color: getDocTypeColor(source.doc_type),
                      }}
                    >
                      {getDocTypeLabel(source.doc_type)}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: "0.75rem",
                      color: "var(--text-muted)",
                    }}
                  >
                    {(source.score * 100).toFixed(0)}% match
                  </span>
                </div>
                {source.text_snippet && (
                  <div
                    style={{
                      fontSize: "0.8125rem",
                      color: "var(--text-secondary)",
                      lineHeight: 1.5,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                    }}
                  >
                    {source.text_snippet}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Debug info toggle */}
      <div
        style={{
          marginTop: 20,
          paddingTop: 16,
          borderTop: "1px solid var(--border-subtle)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span
          style={{
            fontSize: "0.75rem",
            color: "var(--text-muted)",
          }}
        >
          Strategy: {strategyUsed}
        </span>
        <button
          onClick={() => setShowDebug(!showDebug)}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: "0.75rem",
            color: "var(--text-muted)",
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            style={{
              transform: showDebug ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.15s ease",
            }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
          Debug info
        </button>
      </div>

      {/* Debug details */}
      {showDebug && debugInfo && (
        <pre
          style={{
            marginTop: 12,
            padding: 12,
            background: "var(--bg-tertiary)",
            borderRadius: 8,
            fontSize: "0.75rem",
            color: "var(--text-secondary)",
            overflow: "auto",
            maxHeight: 200,
          }}
        >
          {JSON.stringify(debugInfo, null, 2)}
        </pre>
      )}
    </div>
  );
}
