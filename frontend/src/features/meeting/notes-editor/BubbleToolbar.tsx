import type { Editor } from "@tiptap/react";
import { useCallback, useState, useEffect } from "react";

interface BubbleToolbarProps {
  editor: Editor;
  onSetLink: () => void;
}

type FormatType = 
  | "bold" 
  | "italic" 
  | "underline" 
  | "strike" 
  | "code" 
  | "highlight"
  | "link";

interface ToolbarButton {
  type: FormatType;
  icon: React.ReactNode;
  shortcut: string;
  action: () => void;
  isActive: boolean;
}

/**
 * Floating toolbar that appears on text selection.
 * Provides quick formatting options.
 */
export function BubbleToolbar({ editor, onSetLink }: BubbleToolbarProps) {
  const [showHeadingMenu, setShowHeadingMenu] = useState(false);
  const [currentHeadingLevel, setCurrentHeadingLevel] = useState(0);

  // Update heading level when selection changes
  useEffect(() => {
    const updateHeadingLevel = () => {
      const level = 
        editor.isActive("heading", { level: 1 }) ? 1 :
        editor.isActive("heading", { level: 2 }) ? 2 :
        editor.isActive("heading", { level: 3 }) ? 3 : 0;
      setCurrentHeadingLevel(level);
    };

    // Update immediately
    updateHeadingLevel();

    // Listen to selection and transaction updates
    editor.on("selectionUpdate", updateHeadingLevel);
    editor.on("transaction", updateHeadingLevel);

    return () => {
      editor.off("selectionUpdate", updateHeadingLevel);
      editor.off("transaction", updateHeadingLevel);
    };
  }, [editor]);

  // Close heading menu when clicking outside
  useEffect(() => {
    if (!showHeadingMenu) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Don't close if clicking inside the heading menu or selector
      if (target.closest(".heading-selector") || target.closest(".heading-menu")) {
        return;
      }
      setShowHeadingMenu(false);
    };

    // Add listener after a small delay to prevent immediate close
    const timeout = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 50);

    return () => {
      clearTimeout(timeout);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showHeadingMenu]);

  const toggleHeading = useCallback((level: 1 | 2 | 3) => {
    editor.chain().focus().toggleHeading({ level }).run();
    setShowHeadingMenu(false);
  }, [editor]);

  const buttons: ToolbarButton[] = [
    {
      type: "bold",
      icon: <BoldIcon />,
      shortcut: "⌘B",
      action: () => editor.chain().focus().toggleBold().run(),
      isActive: editor.isActive("bold"),
    },
    {
      type: "italic",
      icon: <ItalicIcon />,
      shortcut: "⌘I",
      action: () => editor.chain().focus().toggleItalic().run(),
      isActive: editor.isActive("italic"),
    },
    {
      type: "underline",
      icon: <UnderlineIcon />,
      shortcut: "⌘U",
      action: () => editor.chain().focus().toggleUnderline().run(),
      isActive: editor.isActive("underline"),
    },
    {
      type: "strike",
      icon: <StrikeIcon />,
      shortcut: "⌘⇧S",
      action: () => editor.chain().focus().toggleStrike().run(),
      isActive: editor.isActive("strike"),
    },
    {
      type: "code",
      icon: <CodeIcon />,
      shortcut: "⌘E",
      action: () => editor.chain().focus().toggleCode().run(),
      isActive: editor.isActive("code"),
    },
    {
      type: "highlight",
      icon: <HighlightIcon />,
      shortcut: "⌘⇧H",
      action: () => editor.chain().focus().toggleHighlight().run(),
      isActive: editor.isActive("highlight"),
    },
    {
      type: "link",
      icon: <LinkIcon />,
      shortcut: "⌘K",
      action: onSetLink,
      isActive: editor.isActive("link"),
    },
  ];

  return (
    <div className="bubble-toolbar">
      {/* Heading selector */}
      <div className="heading-selector">
        <button
          className={`toolbar-btn heading-btn ${currentHeadingLevel > 0 ? "active" : ""}`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setShowHeadingMenu((prev) => !prev);
          }}
          title="Heading"
        >
          <span className="heading-label">
            {currentHeadingLevel > 0 ? `H${currentHeadingLevel}` : "T"}
          </span>
          <ChevronIcon />
        </button>
        
        {showHeadingMenu && (
          <div className="heading-menu">
            <button
              className={`heading-option ${currentHeadingLevel === 0 ? "active" : ""}`}
              onClick={() => {
                editor.chain().focus().setParagraph().run();
                setShowHeadingMenu(false);
              }}
            >
              <span className="option-text">Text</span>
              <span className="option-shortcut">⌘⌥0</span>
            </button>
            <button
              className={`heading-option ${currentHeadingLevel === 1 ? "active" : ""}`}
              onClick={() => toggleHeading(1)}
            >
              <span className="option-text">Heading 1</span>
              <span className="option-shortcut">⌘⌥1</span>
            </button>
            <button
              className={`heading-option ${currentHeadingLevel === 2 ? "active" : ""}`}
              onClick={() => toggleHeading(2)}
            >
              <span className="option-text">Heading 2</span>
              <span className="option-shortcut">⌘⌥2</span>
            </button>
            <button
              className={`heading-option ${currentHeadingLevel === 3 ? "active" : ""}`}
              onClick={() => toggleHeading(3)}
            >
              <span className="option-text">Heading 3</span>
              <span className="option-shortcut">⌘⌥3</span>
            </button>
          </div>
        )}
      </div>

      <div className="toolbar-divider" />

      {/* Format buttons */}
      {buttons.map((btn) => (
        <button
          key={btn.type}
          className={`toolbar-btn ${btn.isActive ? "active" : ""}`}
          onClick={btn.action}
          title={`${btn.type.charAt(0).toUpperCase() + btn.type.slice(1)} (${btn.shortcut})`}
        >
          {btn.icon}
        </button>
      ))}
    </div>
  );
}

// Icons
function BoldIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" />
      <path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" />
    </svg>
  );
}

function ItalicIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="19" y1="4" x2="10" y2="4" />
      <line x1="14" y1="20" x2="5" y2="20" />
      <line x1="15" y1="4" x2="9" y2="20" />
    </svg>
  );
}

function UnderlineIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 3v7a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3" />
      <line x1="4" y1="21" x2="20" y2="21" />
    </svg>
  );
}

function StrikeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17.3 4.9c-1.7-1.4-3.9-1.9-6-1.4-2.5.6-4.3 2.3-4.3 4.5 0 1.3.7 2.5 1.8 3.2" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <path d="M8.8 15.4c-.1.3-.1.5-.1.8 0 2.2 2.2 4 5 4 2.3 0 4.3-1.2 4.9-3" />
    </svg>
  );
}

function CodeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  );
}

function HighlightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}
