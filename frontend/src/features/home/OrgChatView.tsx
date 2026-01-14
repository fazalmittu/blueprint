import { useState, useRef, useEffect, useCallback } from "react";
import { searchOrg, getMeeting, type SearchResponse, type SearchSource, type MeetingResponse, type Workflow } from "@/api/client";

interface OrgChatViewProps {
  orgId: string;
  initialQuery: string;
  initialResult?: SearchResponse | null;
  onClose: () => void;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  sources?: SearchSource[];
  strategyUsed?: string;
  isLoading?: boolean;
}

/**
 * Render text with markdown support (headers, bold, italic, lists, code, links).
 */
function MarkdownText({ text }: { text: string }) {
  // First, handle code blocks
  const segments = text.split(/(```[\s\S]*?```)/g);
  
  return (
    <>
      {segments.map((segment, segIdx) => {
        // Code block
        if (segment.startsWith('```') && segment.endsWith('```')) {
          const codeContent = segment.slice(3, -3);
          // Remove optional language identifier on first line
          const lines = codeContent.split('\n');
          const firstLine = lines[0]?.trim();
          const isLangIdentifier = firstLine && /^[a-z]+$/i.test(firstLine);
          const code = isLangIdentifier ? lines.slice(1).join('\n') : codeContent;
          
          return (
            <pre
              key={segIdx}
              style={{
                background: 'var(--bg-tertiary)',
                padding: '12px 16px',
                borderRadius: 8,
                fontSize: '0.8125rem',
                fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, monospace',
                overflow: 'auto',
                margin: '12px 0',
                border: '1px solid var(--border-subtle)',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              <code>{code.trim()}</code>
            </pre>
          );
        }
        
        // Regular text - process line by line
        const lines = segment.split('\n');
        return (
          <span key={segIdx}>
            {lines.map((line, lineIdx) => renderLine(line, `${segIdx}-${lineIdx}`, lineIdx))}
          </span>
        );
      })}
    </>
  );
  
  function renderLine(line: string, key: string, lineIndex: number) {
    // Handle headers
    const h3Match = line.match(/^###\s+(.+)$/);
    if (h3Match) {
      return (
        <div key={key} style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-primary)', marginTop: lineIndex > 0 ? 16 : 0, marginBottom: 8 }}>
          {renderInline(h3Match[1])}
        </div>
      );
    }
    
    const h2Match = line.match(/^##\s+(.+)$/);
    if (h2Match) {
      return (
        <div key={key} style={{ fontWeight: 600, fontSize: '1.0625rem', color: 'var(--text-primary)', marginTop: lineIndex > 0 ? 20 : 0, marginBottom: 8 }}>
          {renderInline(h2Match[1])}
        </div>
      );
    }
    
    const h1Match = line.match(/^#\s+(.+)$/);
    if (h1Match) {
      return (
        <div key={key} style={{ fontWeight: 700, fontSize: '1.125rem', color: 'var(--text-primary)', marginTop: lineIndex > 0 ? 24 : 0, marginBottom: 12 }}>
          {renderInline(h1Match[1])}
        </div>
      );
    }
    
    // Handle list items
    const listMatch = line.match(/^(\s*)[-*]\s+(.+)$/);
    if (listMatch) {
      const [, indent, content] = listMatch;
      const level = Math.floor(indent.length / 2);
      return (
        <div key={key} style={{ paddingLeft: level * 20, display: 'flex', gap: 10, marginTop: 6 }}>
          <span style={{ color: 'var(--accent)', fontWeight: 600 }}>•</span>
          <span style={{ flex: 1 }}>{renderInline(content)}</span>
        </div>
      );
    }
    
    // Handle numbered lists
    const numMatch = line.match(/^(\s*)(\d+)\.\s+(.+)$/);
    if (numMatch) {
      const [, indent, num, content] = numMatch;
      const level = Math.floor(indent.length / 2);
      return (
        <div key={key} style={{ paddingLeft: level * 20, display: 'flex', gap: 10, marginTop: 8 }}>
          <span style={{ color: 'var(--accent)', fontWeight: 600, minWidth: 20 }}>{num}.</span>
          <span style={{ flex: 1 }}>{renderInline(content)}</span>
        </div>
      );
    }
    
    // Empty lines become spacing
    if (!line.trim()) {
      return <div key={key} style={{ height: 12 }} />;
    }
    
    // Regular paragraph
    return <div key={key} style={{ marginTop: lineIndex > 0 ? 6 : 0 }}>{renderInline(line)}</div>;
  }
  
  function renderInline(text: string): React.ReactNode {
    // Match: **bold**, *italic*, `code`, [text](url)
    const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
    const parts = text.split(pattern);
    
    return parts.map((part, i) => {
      // Bold
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{part.slice(2, -2)}</strong>;
      }
      // Italic
      if (part.startsWith('*') && part.endsWith('*') && !part.startsWith('**')) {
        return <em key={i} style={{ fontStyle: 'italic' }}>{part.slice(1, -1)}</em>;
      }
      // Inline code
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code
            key={i}
            style={{
              background: 'var(--bg-tertiary)',
              padding: '2px 6px',
              borderRadius: 4,
              fontSize: '0.85em',
              fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, monospace',
              color: 'var(--accent)',
            }}
          >
            {part.slice(1, -1)}
          </code>
        );
      }
      // Links
      const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch) {
        return (
          <a
            key={i}
            href={linkMatch[2]}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--accent)', textDecoration: 'underline' }}
          >
            {linkMatch[1]}
          </a>
        );
      }
      return <span key={i}>{part}</span>;
    });
  }
}

/**
 * Get doc type display name
 */
const getDocTypeLabel = (docType: string) => {
  const labels: Record<string, string> = {
    meeting_title: "Title Match",
    transcript_chunk: "Transcript",
    workflow_summary: "Workflow",
    meeting_notes: "Notes",
  };
  return labels[docType] || docType;
};

/**
 * Get doc type color
 */
const getDocTypeColor = (docType: string) => {
  const colors: Record<string, string> = {
    meeting_title: "#6366f1",
    transcript_chunk: "#10b981",
    workflow_summary: "#f59e0b",
    meeting_notes: "#ec4899",
  };
  return colors[docType] || "#6b7280";
};

/**
 * Full-screen org-wide chat view for search.
 */
export function OrgChatView({ orgId, initialQuery, initialResult, onClose }: OrgChatViewProps) {
  const [messages, setMessages] = useState<Message[]>(() => {
    const initial: Message[] = [];
    
    // Add initial query as user message if provided
    if (initialQuery) {
      initial.push({
        id: `user-initial`,
        role: "user",
        content: initialQuery,
        timestamp: new Date(),
      });
      
      // Add initial result as assistant message if provided
      if (initialResult?.success) {
        initial.push({
          id: `assistant-initial`,
          role: "assistant",
          content: initialResult.answer,
          timestamp: new Date(),
          sources: initialResult.sources,
          strategyUsed: initialResult.strategy_used,
        });
      }
    }
    
    return initial;
  });
  
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(() => {
    // Start loading if we have a query but no result
    return Boolean(initialQuery && !initialResult);
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [expandedSources, setExpandedSources] = useState<Set<string>>(new Set());
  const hasFetchedInitial = useRef(false);
  
  // State for source panel
  const [selectedSource, setSelectedSource] = useState<SearchSource | null>(null);
  const [meetingData, setMeetingData] = useState<MeetingResponse | null>(null);
  const [isMeetingLoading, setIsMeetingLoading] = useState(false);
  const [panelView, setPanelView] = useState<"source" | "meeting">("source");
  const [isPanelExpanded, setIsPanelExpanded] = useState(false);

  // Fetch initial query result on mount if not provided
  useEffect(() => {
    if (initialQuery && !initialResult && !hasFetchedInitial.current) {
      hasFetchedInitial.current = true;
      
      (async () => {
        try {
          const result = await searchOrg(orgId, initialQuery);
          
          const assistantMessage: Message = {
            id: `assistant-initial`,
            role: "assistant",
            content: result.success ? result.answer : (result.error || "Sorry, I couldn't find an answer to that question."),
            timestamp: new Date(),
            sources: result.success ? result.sources : [],
            strategyUsed: result.strategy_used,
          };

          setMessages((prev) => [...prev, assistantMessage]);
        } catch (error) {
          const errorMessage: Message = {
            id: `error-initial`,
            role: "assistant",
            content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : "Unknown error"}. Please try again.`,
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, errorMessage]);
        } finally {
          setIsLoading(false);
        }
      })();
    }
  }, [initialQuery, initialResult, orgId]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Focus input on mount
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // Close source panel first if open, otherwise close the whole view
        if (selectedSource) {
          setSelectedSource(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, selectedSource]);

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

    try {
      // Build conversation history for context
      const history = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));
      
      const result = await searchOrg(orgId, trimmedInput, { history });
      
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: result.success ? result.answer : (result.error || "Sorry, I couldn't find an answer to that question."),
        timestamp: new Date(),
        sources: result.success ? result.sources : [],
        strategyUsed: result.strategy_used,
      };

      setMessages((prev) => [...prev, assistantMessage]);
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
  }, [input, isLoading, orgId, messages]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSourceClick = (source: SearchSource) => {
    setSelectedSource(source);
    setPanelView("source");
    setMeetingData(null);
  };

  const handleViewFullMeeting = async (meetingId: string) => {
    setIsMeetingLoading(true);
    setPanelView("meeting");
    
    try {
      const data = await getMeeting(meetingId);
      setMeetingData(data);
    } catch (error) {
      console.error("Failed to load meeting:", error);
    } finally {
      setIsMeetingLoading(false);
    }
  };

  const handleBackToSource = () => {
    setPanelView("source");
    setMeetingData(null);
  };

  const handleCloseSourcePanel = () => {
    setSelectedSource(null);
    setMeetingData(null);
    setPanelView("source");
  };

  const toggleSourcesExpanded = (messageId: string) => {
    setExpandedSources((prev) => {
      const next = new Set(prev);
      if (next.has(messageId)) {
        next.delete(messageId);
      } else {
        next.add(messageId);
      }
      return next;
    });
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--bg-primary)",
        display: "flex",
        flexDirection: "column",
        zIndex: 1000,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "var(--space-md) var(--space-lg)",
          borderBottom: "1px solid var(--border-subtle)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "var(--bg-elevated)",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-md)" }}>
          <button
            onClick={onClose}
            style={{
              background: "var(--bg-tertiary)",
              border: "1px solid var(--border-subtle)",
              cursor: "pointer",
              padding: "var(--space-sm) var(--space-md)",
              borderRadius: "var(--radius-md)",
              color: "var(--text-secondary)",
              display: "flex",
              alignItems: "center",
              gap: "var(--space-xs)",
              fontSize: "0.875rem",
              fontWeight: 500,
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--bg-secondary)";
              e.currentTarget.style.borderColor = "var(--border-default)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "var(--bg-tertiary)";
              e.currentTarget.style.borderColor = "var(--border-subtle)";
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--accent)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
            </svg>
            <span style={{ fontWeight: 600, fontSize: "1rem", color: "var(--text-primary)" }}>
              Search Assistant
            </span>
          </div>
        </div>
        <div
          style={{
            fontSize: "0.75rem",
            color: "var(--text-muted)",
            display: "flex",
            alignItems: "center",
            gap: "var(--space-xs)",
          }}
        >
          <kbd
            style={{
              padding: "2px 6px",
              background: "var(--bg-tertiary)",
              borderRadius: 4,
              border: "1px solid var(--border-subtle)",
              fontFamily: "inherit",
              fontSize: "0.6875rem",
            }}
          >
            Esc
          </kbd>
          <span>to close</span>
        </div>
      </div>

      {/* Main Content Area with optional Source Panel */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Chat Area */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            transition: "all 0.3s ease",
          }}
        >
          {/* Messages Area */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                maxWidth: 800,
                width: "100%",
                margin: "0 auto",
                padding: "var(--space-xl)",
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-lg)",
              }}
            >
          {messages.length === 0 && (
            <div
              style={{
                textAlign: "center",
                padding: "var(--space-2xl)",
                color: "var(--text-muted)",
              }}
            >
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                style={{ margin: "0 auto var(--space-md)" }}
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <h3 style={{ margin: "0 0 var(--space-sm) 0", fontSize: "1.125rem", color: "var(--text-secondary)" }}>
                Ask anything about your meetings
              </h3>
              <p style={{ margin: 0, fontSize: "0.875rem" }}>
                I can search across all your meeting transcripts, notes, and workflows.
              </p>
            </div>
          )}
          
          {messages.map((message) => (
            <div
              key={message.id}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: message.role === "user" ? "flex-end" : "flex-start",
              }}
            >
              {/* Message bubble */}
              <div
                style={{
                  maxWidth: message.role === "user" ? "70%" : "100%",
                  width: message.role === "assistant" ? "100%" : undefined,
                }}
              >
                {message.role === "user" ? (
                  <div
                    style={{
                      padding: "var(--space-md) var(--space-lg)",
                      borderRadius: "var(--radius-lg)",
                      background: "var(--accent)",
                      color: "white",
                      fontSize: "0.9375rem",
                      lineHeight: 1.6,
                    }}
                  >
                    {message.content}
                  </div>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "var(--space-md)",
                    }}
                  >
                    {/* AI Avatar + Answer */}
                    <div
                      style={{
                        display: "flex",
                        gap: "var(--space-md)",
                        alignItems: "flex-start",
                      }}
                    >
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: "var(--radius-md)",
                          background: "linear-gradient(135deg, var(--accent) 0%, #8b5cf6 100%)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                          <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
                        </svg>
                      </div>
                      <div
                        style={{
                          flex: 1,
                          padding: "var(--space-md) var(--space-lg)",
                          borderRadius: "var(--radius-lg)",
                          background: "var(--bg-elevated)",
                          border: "1px solid var(--border-subtle)",
                          fontSize: "0.9375rem",
                          lineHeight: 1.7,
                          color: "var(--text-secondary)",
                        }}
                      >
                        <MarkdownText text={message.content} />
                      </div>
                    </div>

                    {/* Sources */}
                    {message.sources && message.sources.length > 0 && (
                      <div style={{ marginLeft: 52 }}>
                        <button
                          onClick={() => toggleSourcesExpanded(message.id)}
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            padding: "var(--space-xs) 0",
                            display: "flex",
                            alignItems: "center",
                            gap: "var(--space-xs)",
                            color: "var(--text-muted)",
                            fontSize: "0.8125rem",
                            fontWeight: 500,
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
                              transform: expandedSources.has(message.id) ? "rotate(180deg)" : "rotate(0deg)",
                              transition: "transform 0.15s ease",
                            }}
                          >
                            <polyline points="6 9 12 15 18 9" />
                          </svg>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                          </svg>
                          {message.sources.length} source{message.sources.length !== 1 ? "s" : ""}
                        </button>

                        {expandedSources.has(message.id) && (
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: "var(--space-sm)",
                              marginTop: "var(--space-sm)",
                            }}
                          >
                            {message.sources.map((source, idx) => (
                              <div
                                key={idx}
                                onClick={() => handleSourceClick(source)}
                                style={{
                                  padding: "var(--space-sm) var(--space-md)",
                                  background: "var(--bg-tertiary)",
                                  borderRadius: "var(--radius-md)",
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
                                    marginBottom: source.text_snippet ? 4 : 0,
                                  }}
                                >
                                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <span
                                      style={{
                                        fontSize: "0.8125rem",
                                        fontWeight: 500,
                                        color: "var(--text-primary)",
                                      }}
                                    >
                                      {source.meeting_title}
                                    </span>
                                    <span
                                      style={{
                                        fontSize: "0.625rem",
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
                                      fontSize: "0.6875rem",
                                      color: "var(--text-muted)",
                                    }}
                                  >
                                    {(source.score * 100).toFixed(0)}% match
                                  </span>
                                </div>
                                {source.text_snippet && (
                                  <div
                                    style={{
                                      fontSize: "0.75rem",
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
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              {/* Timestamp */}
              <span
                style={{
                  fontSize: "0.6875rem",
                  color: "var(--text-muted)",
                  marginTop: "var(--space-xs)",
                  marginLeft: message.role === "assistant" ? 52 : 0,
                }}
              >
                {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          ))}

          {/* Loading indicator */}
          {isLoading && (
            <div
              style={{
                display: "flex",
                gap: "var(--space-md)",
                alignItems: "flex-start",
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "var(--radius-md)",
                  background: "linear-gradient(135deg, var(--accent) 0%, #8b5cf6 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                  <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
                </svg>
              </div>
              <div
                style={{
                  padding: "var(--space-md) var(--space-lg)",
                  borderRadius: "var(--radius-lg)",
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border-subtle)",
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
        </div>

        {/* Input Area */}
        <div
          style={{
            borderTop: "1px solid var(--border-subtle)",
            background: "var(--bg-elevated)",
            flexShrink: 0,
          }}
        >
        <div
          style={{
            maxWidth: 800,
            width: "100%",
            margin: "0 auto",
            padding: "var(--space-lg)",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: "var(--space-sm)",
              alignItems: "flex-end",
              background: "var(--bg-primary)",
              border: "1px solid var(--border-default)",
              borderRadius: "var(--radius-lg)",
              padding: "var(--space-sm)",
            }}
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a follow-up question..."
              disabled={isLoading}
              rows={1}
              style={{
                flex: 1,
                resize: "none",
                padding: "var(--space-sm) var(--space-md)",
                borderRadius: "var(--radius-md)",
                border: "none",
                background: "transparent",
                color: "var(--text-primary)",
                fontSize: "0.9375rem",
                lineHeight: 1.5,
                fontFamily: "inherit",
                outline: "none",
                minHeight: "24px",
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
                transition: "all 0.15s ease",
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
        </div>
      </div>

      {/* Source Panel - slides in from right, expandable on hover */}
      {selectedSource && (
        <div
          onMouseEnter={() => setIsPanelExpanded(true)}
          onMouseLeave={() => setIsPanelExpanded(false)}
          style={{
            width: isPanelExpanded ? 680 : 480,
            flexShrink: 0,
            borderLeft: "1px solid var(--border-subtle)",
            background: "var(--bg-elevated)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            animation: "slideIn 0.2s ease-out",
            transition: "width 0.3s ease",
            position: "relative",
          }}
        >
          {/* Expand indicator on left edge */}
          <div
            style={{
              position: "absolute",
              left: 0,
              top: "50%",
              transform: "translateY(-50%)",
              width: 4,
              height: 60,
              background: isPanelExpanded 
                ? "var(--accent)" 
                : "linear-gradient(180deg, transparent 0%, var(--border-default) 50%, transparent 100%)",
              borderRadius: "0 4px 4px 0",
              opacity: isPanelExpanded ? 1 : 0.5,
              transition: "all 0.3s ease",
              pointerEvents: "none",
            }}
          />
          
          {/* Panel Header */}
          <div
            style={{
              padding: "var(--space-md) var(--space-lg)",
              borderBottom: "1px solid var(--border-subtle)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexShrink: 0,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
              {panelView === "meeting" && (
                <button
                  onClick={handleBackToSource}
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
                    marginRight: "var(--space-xs)",
                  }}
                  title="Back to source"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M19 12H5M12 19l-7-7 7-7" />
                  </svg>
                </button>
              )}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2">
                {panelView === "source" ? (
                  <>
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </>
                ) : (
                  <>
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <line x1="3" y1="9" x2="21" y2="9" />
                    <line x1="9" y1="21" x2="9" y2="9" />
                  </>
                )}
              </svg>
              <span style={{ fontWeight: 600, fontSize: "0.9375rem", color: "var(--text-primary)" }}>
                {panelView === "source" ? "Source Details" : "Meeting Details"}
              </span>
            </div>
            <button
              onClick={handleCloseSourcePanel}
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
              title="Close panel"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Panel Content */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "var(--space-lg)",
            }}
          >
            {panelView === "source" ? (
              // Source View
              <>
                {/* Meeting Title */}
                <div style={{ marginBottom: "var(--space-lg)" }}>
                  <div
                    style={{
                      fontSize: "0.6875rem",
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      color: "var(--text-muted)",
                      marginBottom: "var(--space-xs)",
                    }}
                  >
                    Meeting
                  </div>
                  <div
                    style={{
                      fontSize: "1rem",
                      fontWeight: 600,
                      color: "var(--text-primary)",
                      lineHeight: 1.4,
                    }}
                  >
                    {selectedSource.meeting_title}
                  </div>
                </div>

                {/* Source Type & Score */}
                <div
                  style={{
                    display: "flex",
                    gap: "var(--space-md)",
                    marginBottom: "var(--space-lg)",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: "0.6875rem",
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        color: "var(--text-muted)",
                        marginBottom: "var(--space-xs)",
                      }}
                    >
                      Type
                    </div>
                    <span
                      style={{
                        fontSize: "0.75rem",
                        fontWeight: 500,
                        padding: "4px 10px",
                        borderRadius: 6,
                        background: `${getDocTypeColor(selectedSource.doc_type)}15`,
                        color: getDocTypeColor(selectedSource.doc_type),
                      }}
                    >
                      {getDocTypeLabel(selectedSource.doc_type)}
                    </span>
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: "0.6875rem",
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        color: "var(--text-muted)",
                        marginBottom: "var(--space-xs)",
                      }}
                    >
                      Relevance
                    </div>
                    <div
                      style={{
                        fontSize: "0.875rem",
                        fontWeight: 600,
                        color: "var(--text-primary)",
                      }}
                    >
                      {(selectedSource.score * 100).toFixed(0)}% match
                    </div>
                  </div>
                </div>

                {/* Content Snippet with Markdown */}
                {selectedSource.text_snippet && (
                  <div style={{ marginBottom: "var(--space-lg)" }}>
                    <div
                      style={{
                        fontSize: "0.6875rem",
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        color: "var(--text-muted)",
                        marginBottom: "var(--space-sm)",
                      }}
                    >
                      Content
                    </div>
                    <div
                      style={{
                        padding: "var(--space-md)",
                        background: "var(--bg-primary)",
                        borderRadius: "var(--radius-md)",
                        border: "1px solid var(--border-subtle)",
                        fontSize: "0.875rem",
                        lineHeight: 1.7,
                        color: "var(--text-secondary)",
                      }}
                    >
                      <MarkdownText text={selectedSource.text_snippet} />
                    </div>
                  </div>
                )}
              </>
            ) : (
              // Meeting View
              <>
                {isMeetingLoading ? (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "var(--space-2xl)",
                      color: "var(--text-muted)",
                    }}
                  >
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        border: "3px solid var(--border-subtle)",
                        borderTopColor: "var(--accent)",
                        borderRadius: "50%",
                        animation: "spin 1s linear infinite",
                        marginBottom: "var(--space-md)",
                      }}
                    />
                    Loading meeting...
                  </div>
                ) : meetingData ? (
                  <>
                    {/* Meeting Title */}
                    <div style={{ marginBottom: "var(--space-lg)" }}>
                      <div
                        style={{
                          fontSize: "0.6875rem",
                          fontWeight: 600,
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                          color: "var(--text-muted)",
                          marginBottom: "var(--space-xs)",
                        }}
                      >
                        Meeting Title
                      </div>
                      <div
                        style={{
                          fontSize: "1.125rem",
                          fontWeight: 600,
                          color: "var(--text-primary)",
                          lineHeight: 1.4,
                        }}
                      >
                        {meetingData.meeting.title || "Untitled Meeting"}
                      </div>
                    </div>

                    {/* Status */}
                    <div style={{ marginBottom: "var(--space-lg)" }}>
                      <div
                        style={{
                          fontSize: "0.6875rem",
                          fontWeight: 600,
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                          color: "var(--text-muted)",
                          marginBottom: "var(--space-xs)",
                        }}
                      >
                        Status
                      </div>
                      <span
                        style={{
                          fontSize: "0.75rem",
                          fontWeight: 500,
                          padding: "4px 10px",
                          borderRadius: 6,
                          background: meetingData.meeting.status === "finalized" 
                            ? "rgba(99, 102, 241, 0.1)" 
                            : "rgba(16, 185, 129, 0.1)",
                          color: meetingData.meeting.status === "finalized" 
                            ? "#4f46e5" 
                            : "#059669",
                          textTransform: "capitalize",
                        }}
                      >
                        {meetingData.meeting.status}
                      </span>
                    </div>

                    {/* Meeting Summary */}
                    {meetingData.currentState?.data?.meetingSummary && (
                      <div style={{ marginBottom: "var(--space-lg)" }}>
                        <div
                          style={{
                            fontSize: "0.6875rem",
                            fontWeight: 600,
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                            color: "var(--text-muted)",
                            marginBottom: "var(--space-sm)",
                          }}
                        >
                          Summary
                        </div>
                        <div
                          style={{
                            padding: "var(--space-md)",
                            background: "var(--bg-primary)",
                            borderRadius: "var(--radius-md)",
                            border: "1px solid var(--border-subtle)",
                            fontSize: "0.875rem",
                            lineHeight: 1.7,
                            color: "var(--text-secondary)",
                          }}
                        >
                          <MarkdownText text={meetingData.currentState.data.meetingSummary} />
                        </div>
                      </div>
                    )}

                    {/* Workflows */}
                    {meetingData.currentState?.data?.workflows && meetingData.currentState.data.workflows.length > 0 && (
                      <div style={{ marginBottom: "var(--space-lg)" }}>
                        <div
                          style={{
                            fontSize: "0.6875rem",
                            fontWeight: 600,
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                            color: "var(--text-muted)",
                            marginBottom: "var(--space-sm)",
                          }}
                        >
                          Workflows ({meetingData.currentState.data.workflows.length})
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
                          {meetingData.currentState.data.workflows.map((workflow: Workflow) => (
                            <div
                              key={workflow.id}
                              style={{
                                padding: "var(--space-md)",
                                background: "var(--bg-primary)",
                                borderRadius: "var(--radius-md)",
                                border: "1px solid var(--border-subtle)",
                              }}
                            >
                              <div
                                style={{
                                  fontSize: "0.9375rem",
                                  fontWeight: 600,
                                  color: "var(--text-primary)",
                                  marginBottom: "var(--space-sm)",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "var(--space-sm)",
                                }}
                              >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2">
                                  <circle cx="12" cy="12" r="3" />
                                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                                </svg>
                                {workflow.title}
                              </div>
                              <div
                                style={{
                                  fontSize: "0.75rem",
                                  color: "var(--text-muted)",
                                }}
                              >
                                {workflow.nodes.length} steps
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div
                    style={{
                      textAlign: "center",
                      padding: "var(--space-2xl)",
                      color: "var(--text-muted)",
                    }}
                  >
                    Failed to load meeting
                  </div>
                )}
              </>
            )}
          </div>

          {/* Panel Footer */}
          <div
            style={{
              padding: "var(--space-md) var(--space-lg)",
              borderTop: "1px solid var(--border-subtle)",
              flexShrink: 0,
            }}
          >
            {panelView === "source" ? (
              <button
                onClick={() => handleViewFullMeeting(selectedSource.meeting_id)}
                disabled={isMeetingLoading}
                style={{
                  width: "100%",
                  padding: "var(--space-sm) var(--space-md)",
                  background: "var(--accent)",
                  color: "white",
                  border: "none",
                  borderRadius: "var(--radius-md)",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  cursor: isMeetingLoading ? "default" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "var(--space-sm)",
                  transition: "opacity 0.15s ease",
                  opacity: isMeetingLoading ? 0.7 : 1,
                }}
                onMouseEnter={(e) => {
                  if (!isMeetingLoading) e.currentTarget.style.opacity = "0.9";
                }}
                onMouseLeave={(e) => {
                  if (!isMeetingLoading) e.currentTarget.style.opacity = "1";
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <line x1="3" y1="9" x2="21" y2="9" />
                  <line x1="9" y1="21" x2="9" y2="9" />
                </svg>
                View Full Meeting
              </button>
            ) : (
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", textAlign: "center" }}>
                Viewing meeting details • Click back arrow to return to source
              </div>
            )}
          </div>
        </div>
      )}
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
        
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
