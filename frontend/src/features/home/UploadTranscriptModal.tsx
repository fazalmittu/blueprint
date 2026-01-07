import { useState, useRef, useCallback } from "react";

interface UploadTranscriptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (transcript: string) => Promise<void>;
}

/**
 * Modal for uploading or pasting a meeting transcript.
 */
export function UploadTranscriptModal({ isOpen, onClose, onSubmit }: UploadTranscriptModalProps) {
  const [transcript, setTranscript] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      readFile(file);
    }
  }, []);

  const readFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setTranscript(text);
      setError(null);
    };
    reader.onerror = () => {
      setError("Failed to read file");
    };
    reader.readAsText(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      if (file.type === "text/plain" || file.name.endsWith(".txt") || file.name.endsWith(".md")) {
        readFile(file);
      } else {
        setError("Please upload a text file (.txt or .md)");
      }
    }
  }, [readFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!transcript.trim()) {
      setError("Please enter or upload a transcript");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onSubmit(transcript);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create meeting");
      setIsSubmitting(false);
    }
  }, [transcript, onSubmit]);

  const handleClose = useCallback(() => {
    if (!isSubmitting) {
      setTranscript("");
      setError(null);
      onClose();
    }
  }, [isSubmitting, onClose]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>New Meeting</h2>
          <button className="close-btn" onClick={handleClose} disabled={isSubmitting}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="modal-body">
          <p className="instructions">
            Paste your meeting transcript below or upload a text file.
          </p>

          {/* Drop zone / File upload */}
          <div
            className={`drop-zone ${dragOver ? "drag-over" : ""}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.md,text/plain"
              onChange={handleFileChange}
              style={{ display: "none" }}
            />
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <span>Drop a file here or click to browse</span>
          </div>

          <div className="divider">
            <span>or paste directly</span>
          </div>

          {/* Textarea for pasting */}
          <textarea
            className="transcript-input"
            placeholder="Paste your transcript here..."
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            disabled={isSubmitting}
          />

          {/* Character count */}
          <div className="char-count">
            {transcript.length.toLocaleString()} characters
          </div>

          {error && <div className="error-message">{error}</div>}
        </div>

        <div className="modal-footer">
          <button className="cancel-btn" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </button>
          <button 
            className="submit-btn" 
            onClick={handleSubmit} 
            disabled={isSubmitting || !transcript.trim()}
          >
            {isSubmitting ? "Creating..." : "Create Meeting"}
          </button>
        </div>
      </div>

      <style>{`
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: var(--space-lg);
        }

        .modal-content {
          background: var(--bg-elevated);
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-lg);
          width: 100%;
          max-width: 600px;
          max-height: 80vh;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: var(--space-lg);
          border-bottom: 1px solid var(--border-subtle);
        }

        .modal-header h2 {
          margin: 0;
          font-size: 1.125rem;
          font-weight: 600;
          color: var(--text-primary);
        }

        .close-btn {
          background: none;
          border: none;
          cursor: pointer;
          color: var(--text-muted);
          padding: var(--space-xs);
          border-radius: var(--radius-sm);
          transition: color var(--transition-fast);
        }

        .close-btn:hover:not(:disabled) {
          color: var(--text-primary);
        }

        .close-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .modal-body {
          padding: var(--space-lg);
          overflow-y: auto;
          flex: 1;
        }

        .instructions {
          margin: 0 0 var(--space-md) 0;
          color: var(--text-secondary);
          font-size: 0.875rem;
        }

        .drop-zone {
          border: 2px dashed var(--border-default);
          border-radius: var(--radius-md);
          padding: var(--space-xl);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--space-sm);
          cursor: pointer;
          transition: border-color var(--transition-fast), background var(--transition-fast);
          color: var(--text-muted);
        }

        .drop-zone:hover {
          border-color: var(--accent);
          background: var(--bg-secondary);
        }

        .drop-zone.drag-over {
          border-color: var(--accent);
          background: var(--accent-subtle, rgba(59, 130, 246, 0.1));
        }

        .drop-zone span {
          font-size: 0.875rem;
        }

        .divider {
          display: flex;
          align-items: center;
          gap: var(--space-md);
          margin: var(--space-lg) 0;
          color: var(--text-muted);
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .divider::before,
        .divider::after {
          content: "";
          flex: 1;
          height: 1px;
          background: var(--border-subtle);
        }

        .transcript-input {
          width: 100%;
          min-height: 200px;
          padding: var(--space-md);
          border: 1px solid var(--border-default);
          border-radius: var(--radius-md);
          font-family: var(--font-mono);
          font-size: 0.8125rem;
          line-height: 1.6;
          resize: vertical;
          background: var(--bg-primary);
          color: var(--text-primary);
        }

        .transcript-input:focus {
          outline: none;
          border-color: var(--accent);
        }

        .transcript-input:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .transcript-input::placeholder {
          color: var(--text-faint);
        }

        .char-count {
          margin-top: var(--space-sm);
          font-size: 0.75rem;
          color: var(--text-muted);
          text-align: right;
        }

        .error-message {
          margin-top: var(--space-md);
          padding: var(--space-sm) var(--space-md);
          background: #fee2e2;
          color: #dc2626;
          border-radius: var(--radius-sm);
          font-size: 0.875rem;
        }

        .modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: var(--space-sm);
          padding: var(--space-lg);
          border-top: 1px solid var(--border-subtle);
        }

        .cancel-btn {
          padding: var(--space-sm) var(--space-md);
          background: var(--bg-secondary);
          border: 1px solid var(--border-default);
          border-radius: var(--radius-md);
          font-size: 0.875rem;
          cursor: pointer;
          color: var(--text-secondary);
          transition: background var(--transition-fast);
        }

        .cancel-btn:hover:not(:disabled) {
          background: var(--bg-tertiary);
        }

        .cancel-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .submit-btn {
          padding: var(--space-sm) var(--space-lg);
          background: var(--accent);
          border: none;
          border-radius: var(--radius-md);
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          color: white;
          transition: opacity var(--transition-fast);
        }

        .submit-btn:hover:not(:disabled) {
          opacity: 0.9;
        }

        .submit-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}

