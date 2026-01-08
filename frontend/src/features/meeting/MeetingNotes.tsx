import type { Workflow } from "@/types";

interface MeetingNotesProps {
  summary: string;
  workflows: Workflow[];
  isProcessing?: boolean;
  processingChunkIndex?: number | null;
  onWorkflowClick?: (workflowId: string) => void;
}

/**
 * Meeting notes view - displays the meeting summary and workflow list.
 * This is a read-only view meant for reviewing meeting content.
 */
export function MeetingNotes({
  summary,
  workflows,
  isProcessing = false,
  processingChunkIndex,
  onWorkflowClick,
}: MeetingNotesProps) {
  // Parse summary into bullet points
  const bulletPoints = summary
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  return (
    <div
      style={{
        padding: "var(--space-xl)",
        maxWidth: 800,
        margin: "0 auto",
      }}
    >
      {/* Processing indicator */}
      {isProcessing && (
        <div
          style={{
            marginBottom: "var(--space-lg)",
            padding: "var(--space-md)",
            background: "var(--accent-subtle)",
            borderRadius: "var(--radius-md)",
            display: "flex",
            alignItems: "center",
            gap: "var(--space-sm)",
          }}
        >
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "var(--accent)",
              animation: "pulse 1.5s ease-in-out infinite",
            }}
          />
          <span style={{ fontSize: "0.875rem", color: "var(--accent)" }}>
            Processing chunk {(processingChunkIndex ?? 0) + 1}...
          </span>
        </div>
      )}

      {/* Summary section */}
      <section style={{ marginBottom: "var(--space-2xl)" }}>
        <h2
          style={{
            margin: "0 0 var(--space-lg) 0",
            fontSize: "1.25rem",
            fontWeight: 600,
            color: "var(--text-primary)",
            display: "flex",
            alignItems: "center",
            gap: "var(--space-sm)",
          }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
          Meeting Summary
        </h2>

        {bulletPoints.length > 0 ? (
          <ul
            style={{
              margin: 0,
              padding: 0,
              listStyle: "none",
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-sm)",
            }}
          >
            {bulletPoints.map((point, index) => (
              <li
                key={index}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "var(--space-sm)",
                  padding: "var(--space-sm) var(--space-md)",
                  background: "var(--bg-elevated)",
                  borderRadius: "var(--radius-md)",
                  fontSize: "0.9375rem",
                  lineHeight: 1.6,
                  color: "var(--text-secondary)",
                }}
              >
                <span
                  style={{
                    color: "var(--accent)",
                    fontWeight: 600,
                    flexShrink: 0,
                  }}
                >
                  •
                </span>
                <span>{point.replace(/^[•\-*]\s*/, "")}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p
            style={{
              margin: 0,
              color: "var(--text-muted)",
              fontStyle: "italic",
            }}
          >
            No summary yet. The meeting is still being processed.
          </p>
        )}
      </section>

      {/* Workflows section */}
      <section>
        <h2
          style={{
            margin: "0 0 var(--space-lg) 0",
            fontSize: "1.25rem",
            fontWeight: 600,
            color: "var(--text-primary)",
            display: "flex",
            alignItems: "center",
            gap: "var(--space-sm)",
          }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
          Workflows
          <span
            style={{
              fontSize: "0.875rem",
              fontWeight: 400,
              color: "var(--text-muted)",
              marginLeft: "var(--space-xs)",
            }}
          >
            ({workflows.length})
          </span>
        </h2>

        {workflows.length > 0 ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-sm)",
            }}
          >
            {workflows.map((workflow) => (
              <button
                key={workflow.id}
                onClick={() => onWorkflowClick?.(workflow.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "var(--space-md) var(--space-lg)",
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--radius-md)",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all var(--transition-fast)",
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.borderColor = "var(--accent)";
                  e.currentTarget.style.background = "var(--accent-subtle)";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.borderColor = "var(--border-subtle)";
                  e.currentTarget.style.background = "var(--bg-elevated)";
                }}
              >
                <div>
                  <h3
                    style={{
                      margin: 0,
                      fontSize: "0.9375rem",
                      fontWeight: 500,
                      color: "var(--text-primary)",
                    }}
                  >
                    {workflow.title}
                  </h3>
                  <p
                    style={{
                      margin: "4px 0 0 0",
                      fontSize: "0.75rem",
                      color: "var(--text-muted)",
                    }}
                  >
                    {workflow.nodes.length} nodes · {workflow.edges.length} connections
                  </p>
                </div>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  style={{ color: "var(--text-muted)", flexShrink: 0 }}
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            ))}
          </div>
        ) : (
          <p
            style={{
              margin: 0,
              color: "var(--text-muted)",
              fontStyle: "italic",
            }}
          >
            No workflows identified yet.
          </p>
        )}
      </section>

      {/* Pulse animation keyframes */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}

