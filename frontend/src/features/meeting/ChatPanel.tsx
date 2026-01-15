import { useState, useRef, useEffect, useCallback } from "react";
import { 
  sendChatMessage, 
  getMeetingChatSession,
  addMeetingChatMessage,
  clearMeetingChatSession,
  type ChatMessage, 
  type ChatResponse,
  type MeetingChatSession,
} from "@/api/client";
import type { Workflow } from "@/types";

interface WorkflowNode {
  id: string;
  type: "process" | "decision" | "terminal";
  label: string;
  variant?: "start" | "end";
}

interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  meetingId: string;
  meetingSummary: string;
  workflows: Workflow[];
  onWorkflowUpdated?: (workflowId: string, nodes: WorkflowNode[], edges: WorkflowEdge[]) => void;
  onSummaryUpdated?: (newSummary: string) => void;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  action?: ChatResponse["action"];
}

const WELCOME_MESSAGE: Message = {
  id: "welcome",
  role: "assistant",
  content: "Hi! I'm your meeting assistant. I can help you:\n\n• **Summarize** the meeting notes\n• **Edit workflows** - add, modify, or remove steps\n• **Answer questions** about the meeting\n\nHow can I help you?",
  timestamp: new Date(),
};

/**
 * Parse content that might be JSON-encoded with a message field.
 */
function parseMessageContent(content: string): string {
  if (!content) return content;
  
  // Check if content looks like JSON with a message field
  const trimmed = content.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed === 'object' && parsed.message && typeof parsed.message === 'string') {
        return parsed.message;
      }
    } catch {
      // Not valid JSON, return as-is
    }
  }
  return content;
}

/**
 * Convert a MeetingChatSession to Message array.
 */
function sessionToMessages(session: MeetingChatSession): Message[] {
  if (session.messages.length === 0) {
    return [{ ...WELCOME_MESSAGE, timestamp: new Date() }];
  }
  
  return session.messages.map((msg) => {
    // Extract action from sources if present
    const action = msg.sources?.[0]?.action as ChatResponse["action"] | undefined;
    return {
      id: msg.id,
      role: msg.role,
      content: parseMessageContent(msg.content),
      timestamp: new Date(msg.createdAt),
      action,
    };
  });
}

export function ChatPanel({
  isOpen,
  onClose,
  meetingId,
  meetingSummary,
  workflows,
  onWorkflowUpdated,
  onSummaryUpdated,
}: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([{ ...WELCOME_MESSAGE, timestamp: new Date() }]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load chat history from database when meetingId changes
  useEffect(() => {
    let cancelled = false;
    
    // Immediately reset to welcome message while loading
    setMessages([{ ...WELCOME_MESSAGE, timestamp: new Date() }]);
    setInput("");
    
    async function loadHistory() {
      setIsLoadingHistory(true);
      try {
        const session = await getMeetingChatSession(meetingId);
        if (!cancelled) {
          setMessages(sessionToMessages(session));
        }
      } catch (error) {
        console.error("Failed to load chat history:", error);
        if (!cancelled) {
          // Start with welcome message on error
          setMessages([{ ...WELCOME_MESSAGE, timestamp: new Date() }]);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingHistory(false);
        }
      }
    }
    
    loadHistory();
    
    return () => {
      cancelled = true;
    };
  }, [meetingId]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSend = useCallback(async () => {
    const trimmedInput = input.trim();
    if (!trimmedInput || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmedInput,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    // Save user message to database (fire and forget)
    addMeetingChatMessage(meetingId, "user", trimmedInput).catch((err) => {
      console.error("Failed to save user message:", err);
    });

    try {
      // Build conversation history for context
      const history: ChatMessage[] = messages
        .filter((m) => m.id !== "welcome")
        .map((m) => ({
          role: m.role,
          content: m.content,
        }));

      const response = await sendChatMessage(meetingId, trimmedInput, history);

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: response.message,
        timestamp: new Date(),
        action: response.action,
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // Save assistant message to database (fire and forget)
      addMeetingChatMessage(meetingId, "assistant", response.message, response.action).catch((err) => {
        console.error("Failed to save assistant message:", err);
      });

      // Handle actions from the LLM
      if (response.action) {
        if (response.action.type === "update_workflow" && response.action.workflowId) {
          // Convert API nodes/edges to our interface types
          const nodes: WorkflowNode[] = (response.action.nodes || []).map(n => ({
            id: n.id,
            type: n.type,
            label: n.label,
            variant: n.variant,
          }));
          const edges: WorkflowEdge[] = (response.action.edges || []).map(e => ({
            id: e.id,
            source: e.source,
            target: e.target,
            label: e.label,
          }));
          onWorkflowUpdated?.(response.action.workflowId, nodes, edges);
        } else if (response.action.type === "update_summary" && response.action.newSummary) {
          onSummaryUpdated?.(response.action.newSummary);
        }
      }
    } catch (error) {
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: "assistant",
        content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : "Unknown error"}. Please try again.`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, messages, meetingId, onWorkflowUpdated, onSummaryUpdated]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        width: 380,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "var(--bg-elevated)",
        borderLeft: "1px solid var(--border-subtle)",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "var(--space-md)",
          borderBottom: "1px solid var(--border-subtle)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--accent)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
          </svg>
          <span style={{ fontWeight: 600, fontSize: "0.9375rem" }}>Meeting Assistant</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-xs)" }}>
          {messages.length > 1 && (
            <button
              onClick={async () => {
                // Clear from database
                try {
                  await clearMeetingChatSession(meetingId);
                } catch (err) {
                  console.error("Failed to clear chat history:", err);
                }
                setMessages([{ ...WELCOME_MESSAGE, timestamp: new Date() }]);
              }}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "var(--space-xs)",
                borderRadius: "var(--radius-sm)",
                color: "var(--text-muted)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "var(--transition-fast)",
              }}
              title="Clear chat history"
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "var(--text-primary)";
                e.currentTarget.style.background = "var(--bg-tertiary)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "var(--text-muted)";
                e.currentTarget.style.background = "none";
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </button>
          )}
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "var(--space-xs)",
              borderRadius: "var(--radius-sm)",
              color: "var(--text-muted)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            title="Close chat"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "var(--space-md)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-md)",
        }}
      >
        {isLoadingHistory && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "var(--space-lg)",
              color: "var(--text-muted)",
            }}
          >
            <div
              style={{
                width: 20,
                height: 20,
                border: "2px solid var(--border-subtle)",
                borderTopColor: "var(--accent)",
                borderRadius: "50%",
                animation: "spin 1s linear infinite",
                marginRight: "var(--space-sm)",
              }}
            />
            <span style={{ fontSize: "0.8125rem" }}>Loading chat history...</span>
          </div>
        )}
        {!isLoadingHistory && messages.map((message) => (
          <div
            key={message.id}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: message.role === "user" ? "flex-end" : "flex-start",
            }}
          >
            <div
              style={{
                maxWidth: "85%",
                padding: "var(--space-sm) var(--space-md)",
                borderRadius: "var(--radius-md)",
                background: message.role === "user" ? "var(--accent)" : "var(--bg-tertiary)",
                color: message.role === "user" ? "white" : "var(--text-primary)",
                fontSize: "0.875rem",
                lineHeight: 1.5,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              <MessageContent content={message.content} />
            </div>
            {message.action && (
              <div
                style={{
                  marginTop: "var(--space-xs)",
                  fontSize: "0.75rem",
                  color: "var(--success)",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                {message.action.type === "update_workflow" && "Workflow updated"}
                {message.action.type === "update_summary" && "Summary updated"}
              </div>
            )}
            <span
              style={{
                fontSize: "0.6875rem",
                color: "var(--text-muted)",
                marginTop: "var(--space-xs)",
              }}
            >
              {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        ))}
        {!isLoadingHistory && isLoading && (
          <div style={{ display: "flex", alignItems: "flex-start" }}>
            <div
              style={{
                padding: "var(--space-sm) var(--space-md)",
                borderRadius: "var(--radius-md)",
                background: "var(--bg-tertiary)",
                display: "flex",
                gap: "4px",
              }}
            >
              <span className="typing-dot" style={{ animationDelay: "0ms" }} />
              <span className="typing-dot" style={{ animationDelay: "150ms" }} />
              <span className="typing-dot" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div
        style={{
          padding: "var(--space-md)",
          borderTop: "1px solid var(--border-subtle)",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: "var(--space-sm)",
            alignItems: "flex-end",
          }}
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about the meeting..."
            disabled={isLoading}
            rows={1}
            style={{
              flex: 1,
              resize: "none",
              padding: "var(--space-sm) var(--space-md)",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border-default)",
              background: "var(--bg-primary)",
              color: "var(--text-primary)",
              fontSize: "0.875rem",
              lineHeight: 1.5,
              fontFamily: "inherit",
              outline: "none",
              minHeight: "40px",
              maxHeight: "120px",
            }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = "auto";
              target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
            }}
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            style={{
              padding: "var(--space-sm)",
              borderRadius: "var(--radius-md)",
              border: "none",
              background: input.trim() ? "var(--accent)" : "var(--bg-tertiary)",
              color: input.trim() ? "white" : "var(--text-muted)",
              cursor: input.trim() && !isLoading ? "pointer" : "default",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 40,
              height: 40,
              flexShrink: 0,
              transition: "var(--transition-fast)",
            }}
            title="Send message"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
        <div
          style={{
            marginTop: "var(--space-xs)",
            fontSize: "0.6875rem",
            color: "var(--text-muted)",
            textAlign: "center",
          }}
        >
          Press Enter to send, Shift+Enter for new line
        </div>
      </div>

      <style>{`
        .typing-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--text-muted);
          animation: typing 1s ease-in-out infinite;
        }
        
        @keyframes typing {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-4px); }
        }
        
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

/**
 * Renders message content with basic markdown support.
 */
function MessageContent({ content }: { content: string }) {
  // Simple markdown rendering for bold text
  const parts = content.split(/(\*\*[^*]+\*\*)/g);
  
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <strong key={i} style={{ fontWeight: 600 }}>
              {part.slice(2, -2)}
            </strong>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}
