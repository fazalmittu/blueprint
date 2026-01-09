import { Extension } from "@tiptap/core";
import { ReactRenderer } from "@tiptap/react";
import tippy from "tippy.js";
import type { Instance as TippyInstance } from "tippy.js";
import { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from "react";

interface CommandItem {
  title: string;
  description: string;
  icon: React.ReactNode;
  command: ({ editor }: { editor: any }) => void;
}

const commands: CommandItem[] = [
  {
    title: "Heading 1",
    description: "Large section heading",
    icon: <H1Icon />,
    command: ({ editor }) => {
      editor.chain().focus().toggleHeading({ level: 1 }).run();
    },
  },
  {
    title: "Heading 2",
    description: "Medium section heading",
    icon: <H2Icon />,
    command: ({ editor }) => {
      editor.chain().focus().toggleHeading({ level: 2 }).run();
    },
  },
  {
    title: "Heading 3",
    description: "Small section heading",
    icon: <H3Icon />,
    command: ({ editor }) => {
      editor.chain().focus().toggleHeading({ level: 3 }).run();
    },
  },
  {
    title: "Bullet List",
    description: "Create a simple bullet list",
    icon: <BulletListIcon />,
    command: ({ editor }) => {
      editor.chain().focus().toggleBulletList().run();
    },
  },
  {
    title: "Numbered List",
    description: "Create a numbered list",
    icon: <NumberedListIcon />,
    command: ({ editor }) => {
      editor.chain().focus().toggleOrderedList().run();
    },
  },
  {
    title: "Task List",
    description: "Create a to-do list with checkboxes",
    icon: <TaskListIcon />,
    command: ({ editor }) => {
      editor.chain().focus().toggleTaskList().run();
    },
  },
  {
    title: "Quote",
    description: "Add a blockquote",
    icon: <QuoteIcon />,
    command: ({ editor }) => {
      editor.chain().focus().toggleBlockquote().run();
    },
  },
  {
    title: "Code Block",
    description: "Add a code snippet",
    icon: <CodeBlockIcon />,
    command: ({ editor }) => {
      editor.chain().focus().toggleCodeBlock().run();
    },
  },
  {
    title: "Divider",
    description: "Add a horizontal line",
    icon: <DividerIcon />,
    command: ({ editor }) => {
      editor.chain().focus().setHorizontalRule().run();
    },
  },
];

interface CommandListProps {
  items: CommandItem[];
  command: (item: CommandItem) => void;
  query: string;
}

interface CommandListRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
  updateQuery: (query: string) => void;
}

const CommandList = forwardRef<CommandListRef, CommandListProps>(
  ({ items: initialItems, command, query: initialQuery }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [query, setQuery] = useState(initialQuery);
    
    // Filter items based on query
    const filteredItems = query
      ? commands.filter(
          (item) =>
            item.title.toLowerCase().includes(query.toLowerCase()) ||
            item.description.toLowerCase().includes(query.toLowerCase())
        )
      : initialItems;

    useEffect(() => {
      setSelectedIndex(0);
    }, [query]);

    const selectItem = useCallback((index: number) => {
      const item = filteredItems[index];
      if (item) {
        command(item);
      }
    }, [filteredItems, command]);

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }: { event: KeyboardEvent }) => {
        if (event.key === "ArrowUp") {
          setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % filteredItems.length);
          return true;
        }

        if (event.key === "ArrowDown") {
          setSelectedIndex((prev) => (prev + 1) % filteredItems.length);
          return true;
        }

        if (event.key === "Enter") {
          if (filteredItems.length > 0) {
            selectItem(selectedIndex);
          }
          return true;
        }

        return false;
      },
      updateQuery: (newQuery: string) => {
        setQuery(newQuery);
      },
    }));

    if (filteredItems.length === 0) {
      return (
        <div className="slash-menu">
          <div className="slash-menu-empty">
            No results
          </div>
        </div>
      );
    }

    return (
      <div className="slash-menu">
        {filteredItems.map((item, index) => (
          <button
            key={item.title}
            className={`slash-menu-item ${index === selectedIndex ? "selected" : ""}`}
            onClick={() => selectItem(index)}
            onMouseEnter={() => setSelectedIndex(index)}
          >
            <div className="slash-menu-icon">{item.icon}</div>
            <div className="slash-menu-content">
              <div className="slash-menu-title">{item.title}</div>
              <div className="slash-menu-description">{item.description}</div>
            </div>
          </button>
        ))}
      </div>
    );
  }
);

CommandList.displayName = "CommandList";

export const SlashCommand = Extension.create({
  name: "slashCommand",

  addKeyboardShortcuts() {
    return {
      "/": () => {
        // This gets called when / is pressed
        // We need to show the command menu
        const { editor } = this;
        const { selection } = editor.state;
        const { $from } = selection;
        
        // Check if at start of line or after space
        const textBefore = $from.parent.textBetween(
          0,
          $from.parentOffset,
          undefined,
          "\ufffc"
        );
        
        if (textBefore === "" || textBefore.endsWith(" ")) {
          // Show the menu after a brief delay to let the / be typed
          const currentPos = selection.from;
          setTimeout(() => {
            const coords = editor.view.coordsAtPos(currentPos + 1); // +1 because / will be inserted
            showCommandMenu(editor, coords, currentPos + 1);
          }, 10);
        }
        
        return false; // Don't prevent the / from being typed
      },
    };
  },
});

let currentPopup: TippyInstance | null = null;
let currentRenderer: ReactRenderer | null = null;
let slashPosition: number | null = null;
let currentQuery: string = "";

function showCommandMenu(editor: any, coords: { left: number; top: number }, position: number) {
  // Clean up any existing popup
  hideCommandMenu();
  
  // Store the position where "/" was typed
  slashPosition = position;
  currentQuery = "";

  const component = new ReactRenderer(CommandList, {
    props: {
      items: commands,
      query: "",
      command: (item: CommandItem) => {
        // Delete the "/" character AND any query text using stored position
        if (slashPosition !== null) {
          const deleteEnd = slashPosition + currentQuery.length;
          editor
            .chain()
            .focus()
            .deleteRange({ from: slashPosition - 1, to: deleteEnd })
            .run();
        }
        
        item.command({ editor });
        hideCommandMenu();
      },
    },
    editor,
  });

  currentRenderer = component;

  // Create a virtual element at the cursor position
  const virtualElement = {
    getBoundingClientRect: () => ({
      width: 0,
      height: 0,
      top: coords.top + 24,
      left: coords.left,
      right: coords.left,
      bottom: coords.top + 24,
      x: coords.left,
      y: coords.top + 24,
      toJSON: () => ({}),
    }),
  };

  currentPopup = tippy(document.body, {
    getReferenceClientRect: virtualElement.getBoundingClientRect as any,
    appendTo: () => document.body,
    content: component.element,
    showOnCreate: true,
    interactive: true,
    trigger: "manual",
    placement: "bottom-start",
    animation: "shift-away",
    duration: [200, 150],
  });

  // Handle keyboard navigation and text input
  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      hideCommandMenu();
      editor.commands.focus();
      return;
    }

    // Handle backspace - update query or close if query is empty
    if (event.key === "Backspace") {
      if (currentQuery.length > 0) {
        currentQuery = currentQuery.slice(0, -1);
        component.ref?.updateQuery?.(currentQuery);
      } else {
        // Query is empty and user pressed backspace - close menu
        hideCommandMenu();
      }
      return;
    }

    // Handle arrow keys and enter
    if (component.ref?.onKeyDown?.({ event })) {
      event.preventDefault();
      return;
    }

    // Handle text input (single printable characters)
    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      currentQuery += event.key;
      component.ref?.updateQuery?.(currentQuery);
    }
  };

  document.addEventListener("keydown", handleKeyDown);

  // Also listen for clicks outside to close
  const handleClickOutside = (event: MouseEvent) => {
    if (currentPopup && !currentPopup.popper.contains(event.target as Node)) {
      hideCommandMenu();
    }
  };

  document.addEventListener("mousedown", handleClickOutside);

  // Store cleanup function
  (currentPopup as any)._cleanup = () => {
    document.removeEventListener("keydown", handleKeyDown);
    document.removeEventListener("mousedown", handleClickOutside);
  };
}

function hideCommandMenu() {
  if (currentPopup) {
    (currentPopup as any)._cleanup?.();
    currentPopup.destroy();
    currentPopup = null;
  }
  if (currentRenderer) {
    currentRenderer.destroy();
    currentRenderer = null;
  }
  slashPosition = null;
  currentQuery = "";
}

// Icons
function H1Icon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 12h8" />
      <path d="M4 18V6" />
      <path d="M12 18V6" />
      <path d="M17 12l3-2v8" />
    </svg>
  );
}

function H2Icon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 12h8" />
      <path d="M4 18V6" />
      <path d="M12 18V6" />
      <path d="M21 18h-4c0-4 4-3 4-6 0-1.5-2-2.5-4-1" />
    </svg>
  );
}

function H3Icon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 12h8" />
      <path d="M4 18V6" />
      <path d="M12 18V6" />
      <path d="M17.5 10.5c1.7-1 3.5 0 3.5 1.5a2 2 0 0 1-2 2" />
      <path d="M17 17.5c2 1.5 4 .3 4-1.5a2 2 0 0 0-2-2" />
    </svg>
  );
}

function BulletListIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <circle cx="4" cy="6" r="1" fill="currentColor" />
      <circle cx="4" cy="12" r="1" fill="currentColor" />
      <circle cx="4" cy="18" r="1" fill="currentColor" />
    </svg>
  );
}

function NumberedListIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="10" y1="6" x2="21" y2="6" />
      <line x1="10" y1="12" x2="21" y2="12" />
      <line x1="10" y1="18" x2="21" y2="18" />
      <text x="3" y="8" fontSize="8" fill="currentColor" stroke="none">1</text>
      <text x="3" y="14" fontSize="8" fill="currentColor" stroke="none">2</text>
      <text x="3" y="20" fontSize="8" fill="currentColor" stroke="none">3</text>
    </svg>
  );
}

function TaskListIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="5" width="4" height="4" rx="0.5" />
      <rect x="3" y="14" width="4" height="4" rx="0.5" />
      <path d="M4 16l1 1 2-2" />
      <line x1="10" y1="7" x2="21" y2="7" />
      <line x1="10" y1="16" x2="21" y2="16" />
    </svg>
  );
}

function QuoteIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V21" />
      <path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3" />
    </svg>
  );
}

function CodeBlockIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  );
}

function DividerIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="3" y1="12" x2="21" y2="12" />
    </svg>
  );
}
