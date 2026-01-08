import { useParams, useNavigate } from "react-router-dom";
import { useState, useCallback, useEffect, useRef } from "react";
import { 
  getMeeting, 
  getMeetingVersions, 
  subscribeMeetingUpdates,
  updateWorkflow,
  deleteWorkflow,
  type MeetingResponse, 
  type VersionInfo,
  type SSEMessage,
} from "@/api/client";
import type { Node, Edge } from "@xyflow/react";
import { SplitPanel } from "./SplitPanel";
import { MeetingNotes } from "./MeetingNotes";
import { CanvasView } from "./CanvasView";
import { TranscriptSidebar } from "./TranscriptSidebar";

/**
 * Loading state component.
 */
function LoadingState() {
  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg-primary)",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            width: 40,
            height: 40,
            border: "3px solid var(--border-subtle)",
            borderTopColor: "var(--accent)",
            borderRadius: "50%",
            animation: "spin 1s linear infinite",
            margin: "0 auto var(--space-md)",
          }}
        />
        <p style={{ color: "var(--text-muted)", margin: 0 }}>Loading meeting...</p>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  );
}

/**
 * Error state component.
 */
function ErrorState({ message, onBack }: { message: string; onBack: () => void }) {
  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg-primary)",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <h2 style={{ color: "var(--error)", marginBottom: "var(--space-md)" }}>Error</h2>
        <p style={{ color: "var(--text-secondary)", marginBottom: "var(--space-lg)" }}>{message}</p>
        <button
          onClick={onBack}
          style={{
            padding: "var(--space-sm) var(--space-lg)",
            background: "var(--accent)",
            color: "white",
            border: "none",
            borderRadius: "var(--radius-md)",
            cursor: "pointer",
          }}
        >
          Go Back
        </button>
      </div>
    </div>
  );
}

/**
 * Main meeting content with tab system.
 */
function MeetingContent({ 
  data, 
  versions,
  isProcessing,
  processingChunkIndex,
  onVersionChange,
  onWorkflowDeleted,
  onWorkflowUpdated,
}: { 
  data: MeetingResponse;
  versions: VersionInfo[];
  isProcessing: boolean;
  processingChunkIndex: number | null;
  onVersionChange: (version: number) => void;
  onWorkflowDeleted?: (workflowId: string) => void;
  onWorkflowUpdated?: (workflowId: string, nodes: { id: string; type: "process" | "decision" | "terminal"; label: string; variant?: "start" | "end" }[], edges: { id: string; source: string; target: string; label?: string }[]) => void;
}) {
  const navigate = useNavigate();
  const state = data.currentState.data;
  const meeting = data.meeting;
  const hasSidebar = meeting.totalChunks !== undefined && meeting.totalChunks > 0;

  // Check if meeting is editable (finalized and not processing)
  const isEditable = meeting.status === "finalized" && !isProcessing;

  // Handle workflow update from canvas
  const handleWorkflowUpdate = useCallback(
    async (workflowId: string, nodes: Node[], edges: Edge[]) => {
      try {
        const workflowNodes = nodes.map((node) => ({
          id: node.id,
          type: (node.type || "process") as "process" | "decision" | "terminal",
          label: (node.data as { label: string }).label || "Untitled",
          variant: (node.data as { variant?: "start" | "end" }).variant,
        }));

        const workflowEdges = edges.map((edge) => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          label: edge.label as string | undefined,
        }));

        await updateWorkflow(meeting.meetingId, workflowId, {
          nodes: workflowNodes,
          edges: workflowEdges,
        });

        onWorkflowUpdated?.(workflowId, workflowNodes, workflowEdges);
      } catch (error) {
        console.error("Failed to update workflow:", error);
        alert(error instanceof Error ? error.message : "Failed to update workflow");
      }
    },
    [meeting.meetingId, onWorkflowUpdated]
  );

  // Handle workflow delete from canvas
  const handleWorkflowDelete = useCallback(
    async (workflowId: string) => {
      try {
        await deleteWorkflow(meeting.meetingId, workflowId);
        onWorkflowDeleted?.(workflowId);
      } catch (error) {
        console.error("Failed to delete workflow:", error);
        alert(error instanceof Error ? error.message : "Failed to delete workflow");
      }
    },
    [meeting.meetingId, onWorkflowDeleted]
  );

  // Handle workflow click from notes view - switch to canvas tab
  const handleWorkflowClick = useCallback((workflowId: string) => {
    // For now, just log - in future could scroll to workflow
    console.log("Navigate to workflow:", workflowId);
  }, []);

  // Tab definitions
  const tabs = [
    {
      id: "notes",
      label: "Meeting Notes",
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
      ),
      content: (
        <MeetingNotes
          summary={state.meetingSummary}
          workflows={state.workflows}
          isProcessing={isProcessing}
          processingChunkIndex={processingChunkIndex}
          onWorkflowClick={handleWorkflowClick}
        />
      ),
    },
    {
      id: "canvas",
      label: "Canvas",
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <line x1="3" y1="9" x2="21" y2="9" />
          <line x1="9" y1="21" x2="9" y2="9" />
        </svg>
      ),
      content: (
        <CanvasView
          workflows={state.workflows}
          isEditable={isEditable}
          onWorkflowUpdate={handleWorkflowUpdate}
          onWorkflowDelete={handleWorkflowDelete}
        />
      ),
    },
  ];

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Header bar */}
      <div
        style={{
          height: "var(--header-height)",
          background: "var(--bg-elevated)",
          borderBottom: "1px solid var(--border-subtle)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 var(--space-md)",
          flexShrink: 0,
        }}
      >
        <button
          onClick={() => navigate("/")}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "var(--space-sm)",
            color: "var(--text-secondary)",
            fontSize: "0.875rem",
          }}
        >
          ← Back
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-md)" }}>
          {isProcessing && (
            <span style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-xs)",
              fontSize: "0.75rem",
              color: "#d97706",
            }}>
              <div style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: "#f59e0b",
                animation: "pulse 1.5s ease-in-out infinite",
              }} />
              Processing chunk {(processingChunkIndex ?? 0) + 1}/{meeting.totalChunks}
            </span>
          )}
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "0.75rem",
              color: "var(--text-muted)",
            }}
          >
            {meeting.meetingId.slice(0, 8)}...
          </span>
          <span
            style={{
              fontSize: "0.6875rem",
              fontWeight: 500,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              padding: "2px 8px",
              borderRadius: 9999,
              background: meeting.status === "finalized" 
                ? "#e0e7ff" 
                : isProcessing 
                  ? "rgba(245, 158, 11, 0.2)" 
                  : "#dcfce7",
              color: meeting.status === "finalized" 
                ? "#3730a3" 
                : isProcessing
                  ? "#d97706"
                  : "#166534",
            }}
          >
            {isProcessing ? "processing" : meeting.status}
          </span>
        </div>
      </div>

      {/* Main content area */}
      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        {/* Transcript sidebar */}
        {hasSidebar && (
          <div style={{ width: 280, flexShrink: 0, borderRight: "1px solid var(--border-subtle)" }}>
            <TranscriptSidebar
              versions={versions}
              currentVersion={data.currentState.version}
              processingChunkIndex={processingChunkIndex}
              totalChunks={meeting.totalChunks || 0}
              isProcessing={isProcessing}
              onVersionClick={onVersionChange}
            />
          </div>
        )}

        {/* Tab content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <SplitPanel tabs={tabs} defaultTabId="notes" />
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}

/**
 * Meeting page - smart container.
 */
export function Meeting() {
  const { meetingId } = useParams<{ meetingId: string }>();
  const navigate = useNavigate();
  
  const [data, setData] = useState<MeetingResponse | null>(null);
  const [versions, setVersions] = useState<VersionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingChunkIndex, setProcessingChunkIndex] = useState<number | null>(null);
  
  const eventSourceRef = useRef<EventSource | null>(null);
  
  // Cache for version data to avoid redundant fetches
  const versionCacheRef = useRef<Map<number, MeetingResponse>>(new Map());
  // AbortController to cancel pending requests
  const abortControllerRef = useRef<AbortController | null>(null);
  // Debounce timer
  const debounceTimerRef = useRef<number | null>(null);

  // Load initial data
  useEffect(() => {
    if (!meetingId) return;
    
    const loadData = async () => {
      try {
        const [meetingRes, versionsRes] = await Promise.all([
          getMeeting(meetingId),
          getMeetingVersions(meetingId),
        ]);
        setData(meetingRes);
        setVersions(versionsRes.versions);
        
        // Cache the initial version
        versionCacheRef.current.set(meetingRes.currentState.version, meetingRes);
        
        // Check if meeting is being processed
        if (meetingRes.meeting.status === "active") {
          subscribeToUpdates(meetingId);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load meeting");
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
    
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [meetingId]);

  const subscribeToUpdates = useCallback((id: string) => {
    setIsProcessing(true);
    
    eventSourceRef.current = subscribeMeetingUpdates(
      id,
      (message: SSEMessage) => {
        switch (message.type) {
          case "processing_started":
            setIsProcessing(true);
            break;
            
          case "chunk_processed":
            if (message.currentState) {
              // Update current state with the new data
              setData(prev => {
                if (!prev) return null;
                const updated = {
                  ...prev,
                  currentState: message.currentState!,
                };
                // Cache this version
                versionCacheRef.current.set(message.currentState!.version, updated);
                return updated;
              });
            }
            if (message.chunkIndex !== undefined) {
              setProcessingChunkIndex(message.chunkIndex);
            }
            if (message.version !== undefined) {
              setVersions(prev => {
                const exists = prev.some(v => v.version === message.version);
                if (!exists && message.currentState) {
                  return [...prev, {
                    version: message.version!,
                    currentStateId: message.currentState.currentStateId,
                    chunkIndex: message.chunkIndex,
                    chunkText: message.currentState.data.chunkText
                  }];
                }
                return prev;
              });
            }
            break;
            
          case "processing_complete":
            setIsProcessing(false);
            setProcessingChunkIndex(null);
            if (eventSourceRef.current) {
              eventSourceRef.current.close();
              eventSourceRef.current = null;
            }
            // Reload to get finalized status
            if (meetingId) {
              getMeeting(meetingId).then(res => setData(res)).catch(console.error);
            }
            break;
          
          case "keepalive":
            break;
        }
      },
      (error) => {
        console.error("SSE error:", error);
        setIsProcessing(false);
      }
    );
  }, [meetingId]);

  const handleVersionChange = useCallback((version: number) => {
    if (!meetingId) return;
    
    // Clear any pending debounce
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    // Check cache first
    const cached = versionCacheRef.current.get(version);
    if (cached) {
      setData(cached);
      return;
    }
    
    // Debounce the actual fetch (150ms)
    debounceTimerRef.current = window.setTimeout(async () => {
      // Cancel any pending request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();
      
      try {
        const res = await getMeeting(meetingId, version);
        // Cache the result
        versionCacheRef.current.set(version, res);
        setData(res);
      } catch (e) {
        // Ignore abort errors
        if (e instanceof Error && e.name === 'AbortError') return;
        console.error("Failed to load version:", e);
      }
    }, 150);
  }, [meetingId]);

  const handleWorkflowDeleted = useCallback((workflowId: string) => {
    setData((prev) =>
      prev
        ? {
            ...prev,
            currentState: {
              ...prev.currentState,
              data: {
                ...prev.currentState.data,
                workflows: prev.currentState.data.workflows.filter(
                  (w) => w.id !== workflowId
                ),
              },
            },
          }
        : null
    );
  }, []);

  const handleWorkflowUpdated = useCallback((
    workflowId: string, 
    nodes: { id: string; type: "process" | "decision" | "terminal"; label: string; variant?: "start" | "end" }[], 
    edges: { id: string; source: string; target: string; label?: string }[]
  ) => {
    setData((prev) =>
      prev
        ? {
            ...prev,
            currentState: {
              ...prev.currentState,
              data: {
                ...prev.currentState.data,
                workflows: prev.currentState.data.workflows.map((w) =>
                  w.id === workflowId
                    ? { ...w, nodes, edges }
                    : w
                ),
              },
            },
          }
        : null
    );
  }, []);

  if (!meetingId) {
    return <ErrorState message="Missing meeting ID" onBack={() => navigate("/")} />;
  }

  if (loading) {
    return <LoadingState />;
  }

  if (error || !data) {
    return <ErrorState message={error || "Failed to load"} onBack={() => navigate("/")} />;
  }

  return (
    <MeetingContent 
      data={data} 
      versions={versions}
      isProcessing={isProcessing}
      processingChunkIndex={processingChunkIndex}
      onVersionChange={handleVersionChange}
      onWorkflowDeleted={handleWorkflowDeleted}
      onWorkflowUpdated={handleWorkflowUpdated}
    />
  );
}
