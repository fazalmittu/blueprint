import { useState, useCallback, useRef, useEffect } from "react";
import { RichTextEditor } from "./notes-editor";

interface MeetingNotesProps {
  title: string;
  summary: string;
  isProcessing?: boolean;
  processingChunkIndex?: number | null;
  onSummaryChange?: (newSummary: string) => Promise<void>;
  onTitleChange?: (newTitle: string) => Promise<void>;
  onGenerateDocument?: () => Promise<void>;
  isEditable?: boolean;
}

/**
 * Meeting notes view - a rich text editor for the meeting summary.
 * Full markdown support with Notion-like editing experience.
 */
export function MeetingNotes({
  title,
  summary,
  isProcessing = false,
  processingChunkIndex,
  onSummaryChange,
  onTitleChange,
  onGenerateDocument,
  isEditable = false,
}: MeetingNotesProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(title);
  const [isSavingTitle, setIsSavingTitle] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Sync edited title when prop changes
  useEffect(() => {
    if (!isEditingTitle) {
      setEditedTitle(title);
    }
  }, [title, isEditingTitle]);

  const handleTitleClick = useCallback(() => {
    if (isEditable && !isProcessing) {
      setIsEditingTitle(true);
      setTimeout(() => {
        titleInputRef.current?.focus();
        titleInputRef.current?.select();
      }, 10);
    }
  }, [isEditable, isProcessing]);

  const handleTitleSave = useCallback(async () => {
    if (!onTitleChange || editedTitle.trim() === title) {
      setIsEditingTitle(false);
      return;
    }

    setIsSavingTitle(true);
    try {
      await onTitleChange(editedTitle.trim());
      setIsEditingTitle(false);
    } catch (error) {
      console.error("Failed to save title:", error);
      setEditedTitle(title); // Revert on error
    } finally {
      setIsSavingTitle(false);
    }
  }, [editedTitle, title, onTitleChange]);

  const handleTitleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleTitleSave();
    } else if (e.key === "Escape") {
      setEditedTitle(title);
      setIsEditingTitle(false);
    }
  }, [handleTitleSave, title]);

  const handleGenerateDocument = useCallback(async () => {
    if (!onGenerateDocument) return;
    
    setIsGenerating(true);
    try {
      await onGenerateDocument();
    } catch (error) {
      console.error("Failed to generate document:", error);
    } finally {
      setIsGenerating(false);
    }
  }, [onGenerateDocument]);

  // Shared content width for perfect alignment
  const contentMaxWidth = 900;
  const contentPadding = 48; // 3rem = 48px

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "var(--bg-primary)",
        overflow: "auto",
      }}
    >
      {/* Centered content container */}
      <div
        style={{
          maxWidth: contentMaxWidth,
          width: "100%",
          margin: "0 auto",
          paddingLeft: contentPadding,
          paddingRight: contentPadding,
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          flex: 1,
          minHeight: 0,
        }}
      >
        {/* Header with title and generate button */}
        <div
          style={{
            paddingTop: 24,
            paddingBottom: 16,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          {/* Editable title */}
          {isEditingTitle ? (
            <input
              ref={titleInputRef}
              type="text"
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              onBlur={handleTitleSave}
              onKeyDown={handleTitleKeyDown}
              disabled={isSavingTitle}
              style={{
                flex: 1,
                fontSize: "1.75rem",
                fontWeight: 700,
                color: "var(--text-primary)",
                background: "var(--bg-secondary)",
                border: "none",
                borderRadius: 4,
                outline: "none",
                padding: "4px 8px",
                margin: "-4px -8px",
                fontFamily: "inherit",
                letterSpacing: "-0.02em",
              }}
            />
          ) : (
            <h1
              onClick={handleTitleClick}
              style={{
                flex: 1,
                margin: 0,
                fontSize: "1.75rem",
                fontWeight: 700,
                color: "var(--text-primary)",
                cursor: isEditable && !isProcessing ? "text" : "default",
                padding: "2px 0",
                letterSpacing: "-0.02em",
              }}
              title={isEditable ? "Click to edit title" : undefined}
            >
              {title || "Untitled Meeting"}
            </h1>
          )}

          {/* Sparkle/AI generate button */}
          {isEditable && !isProcessing && onGenerateDocument && (
            <button
              onClick={handleGenerateDocument}
              disabled={isGenerating}
              style={{
                padding: 6,
                background: "transparent",
                border: "none",
                borderRadius: 6,
                color: isGenerating ? "var(--accent)" : "var(--text-muted)",
                cursor: isGenerating ? "default" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "color 0.15s ease",
              }}
              onMouseOver={(e) => {
                if (!isGenerating) {
                  e.currentTarget.style.color = "var(--accent)";
                }
              }}
              onMouseOut={(e) => {
                if (!isGenerating) {
                  e.currentTarget.style.color = "var(--text-muted)";
                }
              }}
              title="Generate formatted document with AI"
            >
              <svg 
                width="20" 
                height="20" 
                viewBox="0 0 24 24" 
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  animation: isGenerating ? "spin 1s linear infinite" : "none",
                }}
              >
                {/* Clean sparkles icon */}
                <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" />
                <path d="M19 13l.75 2.25L22 16l-2.25.75L19 19l-.75-2.25L16 16l2.25-.75L19 13z" />
                <path d="M5 17l.5 1.5L7 19l-1.5.5L5 21l-.5-1.5L3 19l1.5-.5L5 17z" />
              </svg>
            </button>
          )}
        </div>

        {/* Divider */}
        <div
          style={{
            height: 1,
            background: "var(--border-subtle)",
            flexShrink: 0,
          }}
        />

        {/* Processing indicator */}
        {isProcessing && (
          <div
            style={{
              padding: "12px 0",
              background: "linear-gradient(90deg, var(--accent-subtle) 0%, transparent 100%)",
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

        {/* Content area - either skeleton or editor */}
        {isGenerating ? (
          <div style={{ paddingTop: 16, paddingBottom: 32, flex: 1 }}>
            <SkeletonLoader />
          </div>
        ) : (
          <div style={{ paddingTop: 16, paddingBottom: 32, flex: 1, minHeight: 0 }}>
            <RichTextEditor
              content={summary}
              onSave={onSummaryChange}
              placeholder="Start writing your meeting notes... (Type '/' for commands)"
              editable={isEditable && !isProcessing}
              autoFocus={false}
              noPadding
            />
          </div>
        )}
      </div>

      {/* Keyframe animations */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>
    </div>
  );
}

/**
 * Skeleton loader component that mimics document structure
 */
function SkeletonLoader() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Executive Summary skeleton */}
      <div>
        <div style={{ ...skeletonLine, width: "40%", height: 28, marginBottom: 16 }} />
        <div style={{ ...skeletonLine, width: "100%", height: 16, marginBottom: 8 }} />
        <div style={{ ...skeletonLine, width: "95%", height: 16, marginBottom: 8 }} />
        <div style={{ ...skeletonLine, width: "60%", height: 16 }} />
      </div>

      {/* Section 1 skeleton */}
      <div>
        <div style={{ ...skeletonLine, width: "50%", height: 24, marginBottom: 16 }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ ...skeletonLine, width: 8, height: 8, borderRadius: "50%" }} />
            <div style={{ ...skeletonLine, width: "85%", height: 14 }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ ...skeletonLine, width: 8, height: 8, borderRadius: "50%" }} />
            <div style={{ ...skeletonLine, width: "70%", height: 14 }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ ...skeletonLine, width: 8, height: 8, borderRadius: "50%" }} />
            <div style={{ ...skeletonLine, width: "90%", height: 14 }} />
          </div>
        </div>
      </div>

      {/* Section 2 skeleton */}
      <div>
        <div style={{ ...skeletonLine, width: "35%", height: 24, marginBottom: 16 }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ ...skeletonLine, width: 8, height: 8, borderRadius: "50%" }} />
            <div style={{ ...skeletonLine, width: "75%", height: 14 }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ ...skeletonLine, width: 8, height: 8, borderRadius: "50%" }} />
            <div style={{ ...skeletonLine, width: "80%", height: 14 }} />
          </div>
        </div>
      </div>

      {/* Section 3 skeleton */}
      <div>
        <div style={{ ...skeletonLine, width: "30%", height: 24, marginBottom: 16 }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ ...skeletonLine, width: 8, height: 8, borderRadius: "50%" }} />
            <div style={{ ...skeletonLine, width: "65%", height: 14 }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ ...skeletonLine, width: 8, height: 8, borderRadius: "50%" }} />
            <div style={{ ...skeletonLine, width: "88%", height: 14 }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ ...skeletonLine, width: 8, height: 8, borderRadius: "50%" }} />
            <div style={{ ...skeletonLine, width: "72%", height: 14 }} />
          </div>
        </div>
      </div>
    </div>
  );
}

const skeletonLine: React.CSSProperties = {
  background: "linear-gradient(90deg, var(--bg-tertiary) 25%, var(--border-subtle) 50%, var(--bg-tertiary) 75%)",
  backgroundSize: "200% 100%",
  animation: "shimmer 1.5s ease-in-out infinite",
  borderRadius: 4,
};
