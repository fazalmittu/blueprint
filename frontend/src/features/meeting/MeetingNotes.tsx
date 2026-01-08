import { RichTextEditor } from "./notes-editor";

interface MeetingNotesProps {
  summary: string;
  isProcessing?: boolean;
  processingChunkIndex?: number | null;
  onSummaryChange?: (newSummary: string) => Promise<void>;
  isEditable?: boolean;
}

/**
 * Meeting notes view - a rich text editor for the meeting summary.
 * Full markdown support with Notion-like editing experience.
 */
export function MeetingNotes({
  summary,
  isProcessing = false,
  processingChunkIndex,
  onSummaryChange,
  isEditable = false,
}: MeetingNotesProps) {
  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "var(--bg-primary)",
      }}
    >
      {/* Processing indicator */}
      {isProcessing && (
        <div
          style={{
            padding: "12px 24px",
            background: "linear-gradient(90deg, var(--accent-subtle) 0%, transparent 100%)",
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            gap: "var(--space-sm)",
            flexShrink: 0,
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
          <span style={{ fontSize: "0.875rem", color: "var(--accent)", fontWeight: 500 }}>
            Processing transcript... Chunk {(processingChunkIndex ?? 0) + 1}
          </span>
        </div>
      )}

      {/* Rich text editor */}
      <div style={{ flex: 1, overflow: "auto" }}>
        <RichTextEditor
          content={summary}
          onSave={onSummaryChange}
          placeholder="Start writing your meeting notes... (Type '/' for commands)"
          editable={isEditable && !isProcessing}
          autoFocus={false}
        />
      </div>

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
