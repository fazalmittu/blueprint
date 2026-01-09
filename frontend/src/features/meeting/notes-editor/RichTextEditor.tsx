import { useEditor, EditorContent } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Underline from "@tiptap/extension-underline";
import Typography from "@tiptap/extension-typography";
import Highlight from "@tiptap/extension-highlight";
import { useCallback, useEffect, useState } from "react";
import { BubbleToolbar } from "./BubbleToolbar";
import { SlashCommand } from "./SlashCommand";
import "./editor.css";

interface RichTextEditorProps {
  content: string;
  onChange?: (content: string) => void;
  onSave?: (content: string) => Promise<void>;
  placeholder?: string;
  editable?: boolean;
  autoFocus?: boolean;
  noPadding?: boolean;
}

/**
 * A high-quality Notion-like rich text editor with full markdown support.
 */
export function RichTextEditor({
  content,
  onChange,
  onSave,
  placeholder = "Start writing...",
  editable = true,
  autoFocus = false,
  noPadding = false,
}: RichTextEditorProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
        codeBlock: {
          HTMLAttributes: {
            class: "code-block",
          },
        },
        bulletList: {
          HTMLAttributes: {
            class: "bullet-list",
          },
        },
        orderedList: {
          HTMLAttributes: {
            class: "ordered-list",
          },
        },
        blockquote: {
          HTMLAttributes: {
            class: "blockquote",
          },
        },
      }),
      Placeholder.configure({
        placeholder,
        emptyEditorClass: "is-editor-empty",
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "editor-link",
        },
      }),
      TaskList.configure({
        HTMLAttributes: {
          class: "task-list",
        },
      }),
      TaskItem.configure({
        nested: true,
        HTMLAttributes: {
          class: "task-item",
        },
      }),
      Underline,
      Typography,
      Highlight.configure({
        multicolor: false,
        HTMLAttributes: {
          class: "highlight",
        },
      }),
      SlashCommand,
    ],
    content: parseMarkdownToHTML(content),
    editable,
    autofocus: autoFocus ? "end" : false,
    editorProps: {
      attributes: {
        class: noPadding ? "rich-text-editor-content no-padding" : "rich-text-editor-content",
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      const markdown = parseHTMLToMarkdown(html);
      onChange?.(markdown);
      setHasUnsavedChanges(true);
    },
  });

  // Update content when prop changes (external updates)
  useEffect(() => {
    if (editor && !editor.isFocused) {
      const currentContent = parseHTMLToMarkdown(editor.getHTML());
      if (currentContent !== content) {
        editor.commands.setContent(parseMarkdownToHTML(content));
        setHasUnsavedChanges(false);
      }
    }
  }, [content, editor]);

  // Keyboard shortcut for save (Cmd+S)
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        if (editor && onSave && hasUnsavedChanges) {
          await handleSave();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [editor, onSave, hasUnsavedChanges]);

  const handleSave = useCallback(async () => {
    if (!editor || !onSave) return;
    
    setIsSaving(true);
    try {
      const markdown = parseHTMLToMarkdown(editor.getHTML());
      await onSave(markdown);
      setLastSaved(new Date());
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error("Failed to save:", error);
    } finally {
      setIsSaving(false);
    }
  }, [editor, onSave]);

  // Add link handler
  const setLink = useCallback(() => {
    if (!editor) return;
    
    const previousUrl = editor.getAttributes("link").href;
    const url = window.prompt("Enter URL", previousUrl);

    if (url === null) return;

    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }, [editor]);

  if (!editor) {
    return null;
  }

  return (
    <div className="rich-text-editor" style={{ position: "relative" }}>
      {/* Bubble menu - appears on text selection */}
      <BubbleMenu
        editor={editor}
        tippyOptions={{
          duration: 150,
          placement: "top",
        }}
        className="bubble-menu"
      >
        <BubbleToolbar editor={editor} onSetLink={setLink} />
      </BubbleMenu>

      {/* Editor content */}
      <EditorContent editor={editor} />

      {/* Floating status bar - only shows when there are unsaved changes */}
      {editable && onSave && hasUnsavedChanges && (
        <div className="editor-status-bar has-changes">
          <span className="unsaved-indicator">
            <span className="dot" />
            Unsaved
          </span>
          <span className="keyboard-hint">⌘S</span>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="save-button"
          >
            {isSaving ? "Saving..." : "Save"}
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Parse markdown string to HTML for TipTap.
 * Simple implementation - handles common markdown patterns.
 */
function parseMarkdownToHTML(markdown: string): string {
  if (!markdown) return "<p></p>";
  
  let html = markdown;
  
  // Split into lines for block-level processing
  const lines = html.split("\n");
  const processedLines: string[] = [];
  let inCodeBlock = false;
  let codeBlockContent: string[] = [];
  let inList = false;
  let listType = "";
  let listItems: string[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Code blocks
    if (line.startsWith("```")) {
      if (inCodeBlock) {
        processedLines.push(`<pre><code>${codeBlockContent.join("\n")}</code></pre>`);
        codeBlockContent = [];
        inCodeBlock = false;
      } else {
        // Close any open list
        if (inList) {
          processedLines.push(`<${listType}>${listItems.map(li => `<li><p>${li}</p></li>`).join("")}</${listType}>`);
          listItems = [];
          inList = false;
        }
        inCodeBlock = true;
      }
      continue;
    }
    
    if (inCodeBlock) {
      codeBlockContent.push(escapeHtml(line));
      continue;
    }
    
    // Check for list items (support -, *, and • bullet styles, with optional leading whitespace)
    const bulletMatch = line.match(/^\s*[\-\*•]\s+(.*)$/);
    const numberedMatch = line.match(/^\s*\d+\.\s+(.*)$/);
    const taskMatch = line.match(/^\s*[\-\*•]\s+\[([ xX])\]\s+(.*)$/);
    
    if (taskMatch) {
      // Close any non-task list
      if (inList && listType !== "ul" ) {
        processedLines.push(`<${listType}>${listItems.map(li => `<li><p>${li}</p></li>`).join("")}</${listType}>`);
        listItems = [];
        inList = false;
      }
      const checked = taskMatch[1].toLowerCase() === "x";
      const content = processInlineMarkdown(taskMatch[2]);
      processedLines.push(`<ul data-type="taskList"><li data-type="taskItem" data-checked="${checked}"><label><input type="checkbox" ${checked ? "checked" : ""}><span></span></label><div><p>${content}</p></div></li></ul>`);
      continue;
    }
    
    if (bulletMatch) {
      if (inList && listType !== "ul") {
        processedLines.push(`<${listType}>${listItems.map(li => `<li><p>${li}</p></li>`).join("")}</${listType}>`);
        listItems = [];
      }
      inList = true;
      listType = "ul";
      listItems.push(processInlineMarkdown(bulletMatch[1]));
      continue;
    }
    
    if (numberedMatch) {
      if (inList && listType !== "ol") {
        processedLines.push(`<${listType}>${listItems.map(li => `<li><p>${li}</p></li>`).join("")}</${listType}>`);
        listItems = [];
      }
      inList = true;
      listType = "ol";
      listItems.push(processInlineMarkdown(numberedMatch[1]));
      continue;
    }
    
    // Close any open list when we hit a non-list line
    if (inList) {
      processedLines.push(`<${listType}>${listItems.map(li => `<li><p>${li}</p></li>`).join("")}</${listType}>`);
      listItems = [];
      inList = false;
    }
    
    // Headings
    if (line.startsWith("### ")) {
      processedLines.push(`<h3>${processInlineMarkdown(line.slice(4))}</h3>`);
      continue;
    }
    if (line.startsWith("## ")) {
      processedLines.push(`<h2>${processInlineMarkdown(line.slice(3))}</h2>`);
      continue;
    }
    if (line.startsWith("# ")) {
      processedLines.push(`<h1>${processInlineMarkdown(line.slice(2))}</h1>`);
      continue;
    }
    
    // Blockquotes
    if (line.startsWith("> ")) {
      processedLines.push(`<blockquote><p>${processInlineMarkdown(line.slice(2))}</p></blockquote>`);
      continue;
    }
    
    // Horizontal rule
    if (line.match(/^[-*_]{3,}$/)) {
      processedLines.push("<hr>");
      continue;
    }
    
    // Empty line - preserve as empty paragraph
    if (line.trim() === "") {
      processedLines.push("<p></p>");
      continue;
    }
    
    // Regular paragraph
    processedLines.push(`<p>${processInlineMarkdown(line)}</p>`);
  }
  
  // Close any remaining list
  if (inList) {
    processedLines.push(`<${listType}>${listItems.map(li => `<li><p>${li}</p></li>`).join("")}</${listType}>`);
  }
  
  return processedLines.join("") || "<p></p>";
}

/**
 * Process inline markdown (bold, italic, code, links, etc.)
 */
function processInlineMarkdown(text: string): string {
  let result = text;
  
  // Escape HTML first
  result = escapeHtml(result);
  
  // Code (must be before bold/italic to avoid conflicts)
  result = result.replace(/`([^`]+)`/g, "<code>$1</code>");
  
  // Bold + Italic
  result = result.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
  result = result.replace(/___(.+?)___/g, "<strong><em>$1</em></strong>");
  
  // Bold
  result = result.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  result = result.replace(/__(.+?)__/g, "<strong>$1</strong>");
  
  // Italic
  result = result.replace(/\*(.+?)\*/g, "<em>$1</em>");
  result = result.replace(/_(.+?)_/g, "<em>$1</em>");
  
  // Strikethrough
  result = result.replace(/~~(.+?)~~/g, "<s>$1</s>");
  
  // Highlight
  result = result.replace(/==(.+?)==/g, "<mark>$1</mark>");
  
  // Links [text](url)
  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  
  return result;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Parse HTML back to markdown.
 */
function parseHTMLToMarkdown(html: string): string {
  if (!html || html === "<p></p>") return "";
  
  const doc = new DOMParser().parseFromString(html, "text/html");
  // Don't trim - preserve intentional whitespace, but remove trailing newline
  const result = nodeToMarkdown(doc.body);
  return result.replace(/\n$/, "");
}

function nodeToMarkdown(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent || "";
  }
  
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return "";
  }
  
  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();
  const children = Array.from(el.childNodes).map(nodeToMarkdown).join("");
  
  switch (tag) {
    case "p":
      // Empty paragraph = blank line, otherwise normal paragraph
      return (children || "") + "\n";
    case "h1":
      return `# ${children}\n`;
    case "h2":
      return `## ${children}\n`;
    case "h3":
      return `### ${children}\n`;
    case "strong":
    case "b":
      return `**${children}**`;
    case "em":
    case "i":
      return `*${children}*`;
    case "u":
      return children; // No markdown equivalent, just return text
    case "s":
    case "strike":
      return `~~${children}~~`;
    case "code":
      if (el.parentElement?.tagName.toLowerCase() === "pre") {
        return children;
      }
      return `\`${children}\``;
    case "pre":
      return "```\n" + children + "\n```\n";
    case "a":
      const href = el.getAttribute("href") || "";
      return `[${children}](${href})`;
    case "ul":
      if (el.getAttribute("data-type") === "taskList") {
        return children;
      }
      return children;
    case "ol":
      return children;
    case "li":
      if (el.getAttribute("data-type") === "taskItem") {
        const checked = el.getAttribute("data-checked") === "true";
        return `- [${checked ? "x" : " "}] ${children.trim()}\n`;
      }
      if (el.parentElement?.tagName.toLowerCase() === "ol") {
        const index = Array.from(el.parentElement.children).indexOf(el) + 1;
        return `${index}. ${children.trim()}\n`;
      }
      return `- ${children.trim()}\n`;
    case "blockquote":
      return `> ${children.trim()}\n`;
    case "hr":
      return "---\n";
    case "br":
      return "\n";
    case "mark":
      return `==${children}==`;
    case "div":
    case "span":
    case "label":
    case "input":
      return children;
    default:
      return children;
  }
}

function formatRelativeTime(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}

