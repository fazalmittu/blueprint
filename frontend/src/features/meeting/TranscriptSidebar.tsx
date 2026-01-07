import { useEffect, useRef } from "react";
import type { VersionInfo } from "@/api/client";

interface TranscriptSidebarProps {
  versions: VersionInfo[];
  currentVersion: number;
  processingChunkIndex: number | null;
  totalChunks: number;
  isProcessing: boolean;
  onVersionClick: (version: number) => void;
}

/**
 * Sidebar showing transcript chunks and processing progress.
 * Allows navigation between different state versions.
 */
export function TranscriptSidebar({
  versions,
  currentVersion,
  processingChunkIndex,
  totalChunks,
  isProcessing,
  onVersionClick,
}: TranscriptSidebarProps) {
  const activeRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to active chunk when processing
  useEffect(() => {
    if (activeRef.current && isProcessing) {
      activeRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [processingChunkIndex, isProcessing]);

  // Generate chunks list - versions start at 0 (initial state), then 1 for chunk 0, etc.
  // So version N corresponds to chunk N-1
  const chunks = Array.from({ length: totalChunks }, (_, i) => {
    // Find the version that processed this chunk
    const version = versions.find(v => v.chunkIndex === i);
    return {
      index: i,
      version: version?.version,
      text: version?.chunkText || `Chunk ${i + 1}`,
      isProcessed: version !== undefined,
    };
  });

  return (
    <div className="transcript-sidebar">
      <div className="sidebar-header">
        <h3>Transcript</h3>
        {isProcessing && (
          <div className="processing-indicator">
            <div className="spinner" />
            <span>Processing...</span>
          </div>
        )}
        {!isProcessing && totalChunks > 0 && (
          <span className="chunk-count">{versions.length - 1}/{totalChunks} chunks</span>
        )}
      </div>

      <div className="chunks-list">
        {chunks.length === 0 && !isProcessing && (
          <div className="empty-state">
            No transcript available
          </div>
        )}

        {chunks.map((chunk) => {
          const isActive = chunk.version === currentVersion;
          const isCurrentlyProcessing = isProcessing && chunk.index === processingChunkIndex;
          const isPending = !chunk.isProcessed && !isCurrentlyProcessing;

          return (
            <div
              key={chunk.index}
              ref={isCurrentlyProcessing ? activeRef : undefined}
              className={`chunk-item ${isActive ? "active" : ""} ${isCurrentlyProcessing ? "processing" : ""} ${isPending ? "pending" : ""} ${chunk.isProcessed ? "processed" : ""}`}
              onClick={() => chunk.version !== undefined && onVersionClick(chunk.version)}
              style={{ cursor: chunk.isProcessed ? "pointer" : "default" }}
            >
              <div className="chunk-header">
                <span className="chunk-number">Chunk {chunk.index + 1}</span>
                {isCurrentlyProcessing && (
                  <span className="status-badge processing">Processing</span>
                )}
                {isPending && (
                  <span className="status-badge pending">Pending</span>
                )}
                {chunk.isProcessed && !isCurrentlyProcessing && (
                  <span className="status-badge done">Done</span>
                )}
              </div>
              <div className="chunk-text">
                {chunk.text}
              </div>
            </div>
          );
        })}

        {isProcessing && processingChunkIndex !== null && processingChunkIndex >= chunks.length && (
          <div className="chunk-item processing">
            <div className="chunk-header">
              <span className="chunk-number">Chunk {processingChunkIndex + 1}</span>
              <span className="status-badge processing">Processing</span>
            </div>
            <div className="chunk-text">Processing...</div>
          </div>
        )}
      </div>

      <style>{`
        .transcript-sidebar {
          position: fixed;
          top: var(--header-height);
          left: 0;
          bottom: 0;
          width: 280px;
          background: var(--bg-elevated);
          border-right: 1px solid var(--border-subtle);
          display: flex;
          flex-direction: column;
          z-index: 50;
        }

        .sidebar-header {
          padding: var(--space-md);
          border-bottom: 1px solid var(--border-subtle);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .sidebar-header h3 {
          margin: 0;
          font-size: 0.75rem;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--text-muted);
        }

        .processing-indicator {
          display: flex;
          align-items: center;
          gap: var(--space-xs);
          font-size: 0.6875rem;
          color: var(--accent);
        }

        .spinner {
          width: 12px;
          height: 12px;
          border: 2px solid var(--border-subtle);
          border-top-color: var(--accent);
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .chunk-count {
          font-size: 0.6875rem;
          color: var(--text-muted);
          font-family: var(--font-mono);
        }

        .chunks-list {
          flex: 1;
          overflow-y: auto;
          padding: var(--space-sm);
        }

        .empty-state {
          padding: var(--space-xl);
          text-align: center;
          color: var(--text-muted);
          font-size: 0.875rem;
        }

        .chunk-item {
          padding: var(--space-sm) var(--space-md);
          border-radius: var(--radius-md);
          margin-bottom: var(--space-xs);
          transition: background var(--transition-fast);
        }

        .chunk-item.processed:hover {
          background: var(--bg-secondary);
        }

        .chunk-item.active {
          background: var(--accent-subtle, rgba(59, 130, 246, 0.1));
          border: 1px solid var(--accent);
        }

        .chunk-item.processing {
          background: rgba(245, 158, 11, 0.1);
          border: 1px solid #f59e0b;
        }

        .chunk-item.pending {
          opacity: 0.5;
        }

        .chunk-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: var(--space-xs);
        }

        .chunk-number {
          font-size: 0.6875rem;
          font-weight: 500;
          color: var(--text-secondary);
        }

        .status-badge {
          font-size: 0.5625rem;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          padding: 2px 6px;
          border-radius: 9999px;
        }

        .status-badge.processing {
          background: rgba(245, 158, 11, 0.2);
          color: #d97706;
        }

        .status-badge.pending {
          background: var(--bg-tertiary);
          color: var(--text-muted);
        }

        .status-badge.done {
          background: #dcfce7;
          color: #166534;
        }

        .chunk-text {
          font-size: 0.75rem;
          color: var(--text-muted);
          line-height: 1.5;
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
          word-break: break-word;
        }

        .chunk-item.active .chunk-text,
        .chunk-item.processed .chunk-text {
          color: var(--text-secondary);
        }
      `}</style>
    </div>
  );
}

