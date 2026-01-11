import { useState, useCallback, useRef, useEffect } from "react";

interface SearchBarProps {
  onSearch: (query: string) => void;
  isLoading?: boolean;
  placeholder?: string;
}

/**
 * Global search bar for org-wide search.
 * Features keyboard shortcut (Cmd+K) and loading state.
 */
export function SearchBar({ onSearch, isLoading = false, placeholder }: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut: Cmd+K to focus
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === "Escape") {
        inputRef.current?.blur();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      // Use either React state or direct input value (for browser automation compatibility)
      const searchValue = query.trim() || inputRef.current?.value.trim() || "";
      if (searchValue && !isLoading) {
        setQuery(searchValue); // Sync state if needed
        onSearch(searchValue);
      }
    },
    [query, isLoading, onSearch]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const searchValue = query.trim() || inputRef.current?.value.trim() || "";
      if (searchValue && !isLoading) {
        setQuery(searchValue);
        onSearch(searchValue);
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ width: "100%" }}>
      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
        }}
      >
        {/* Search icon */}
        <div
          style={{
            position: "absolute",
            left: 16,
            display: "flex",
            alignItems: "center",
            color: isFocused ? "var(--accent)" : "var(--text-muted)",
            transition: "color 0.15s ease",
          }}
        >
          {isLoading ? (
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              style={{ animation: "spin 1s linear infinite" }}
            >
              <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="12" />
            </svg>
          ) : (
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          )}
        </div>

        {/* Input */}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || "Ask anything about your meetings..."}
          disabled={isLoading}
          style={{
            width: "100%",
            padding: "14px 100px 14px 48px",
            fontSize: "1rem",
            fontFamily: "inherit",
            background: "var(--bg-elevated)",
            border: `2px solid ${isFocused ? "var(--accent)" : "var(--border-subtle)"}`,
            borderRadius: 12,
            color: "var(--text-primary)",
            outline: "none",
            transition: "all 0.2s ease",
            boxShadow: isFocused ? "0 0 0 4px rgba(99, 102, 241, 0.1)" : "none",
          }}
        />

        {/* Keyboard hint */}
        {!isFocused && !query && (
          <div
            style={{
              position: "absolute",
              right: 16,
              display: "flex",
              alignItems: "center",
              gap: 4,
              color: "var(--text-muted)",
              fontSize: "0.75rem",
            }}
          >
            <kbd
              style={{
                padding: "2px 6px",
                background: "var(--bg-tertiary)",
                borderRadius: 4,
                border: "1px solid var(--border-subtle)",
                fontFamily: "inherit",
              }}
            >
              ⌘K
            </kbd>
          </div>
        )}

        {/* Submit button */}
        {(isFocused || query) && (
          <button
            type="submit"
            disabled={!query.trim() || isLoading}
            style={{
              position: "absolute",
              right: 8,
              padding: "8px 16px",
              fontSize: "0.875rem",
              fontWeight: 500,
              fontFamily: "inherit",
              background: query.trim() && !isLoading ? "var(--accent)" : "var(--bg-tertiary)",
              color: query.trim() && !isLoading ? "white" : "var(--text-muted)",
              border: "none",
              borderRadius: 8,
              cursor: query.trim() && !isLoading ? "pointer" : "default",
              transition: "all 0.15s ease",
            }}
          >
            Search
          </button>
        )}
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </form>
  );
}
