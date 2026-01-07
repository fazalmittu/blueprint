interface ToolbarProps {
  onAddText: () => void;
  onAddShape: (shape: "rectangle" | "circle" | "diamond") => void;
}

/**
 * Toolbar for adding new blocks to the canvas.
 */
export function Toolbar({ onAddText, onAddShape }: ToolbarProps) {
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        position: "fixed",
        top: "var(--toolbar-top)",
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        gap: "var(--space-xs)",
        padding: "var(--space-xs)",
        background: "var(--bg-elevated)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--shadow-lg)",
        zIndex: 100,
      }}
    >
      <ToolbarButton onClick={onAddText} title="Add text block">
        <TextIcon />
      </ToolbarButton>
      
      <ToolbarDivider />
      
      <ToolbarButton onClick={() => onAddShape("rectangle")} title="Add rectangle">
        <RectangleIcon />
      </ToolbarButton>
      
      <ToolbarButton onClick={() => onAddShape("circle")} title="Add circle">
        <CircleIcon />
      </ToolbarButton>
      
      <ToolbarButton onClick={() => onAddShape("diamond")} title="Add diamond">
        <DiamondIcon />
      </ToolbarButton>
    </div>
  );
}

function ToolbarButton({ 
  children, 
  onClick, 
  title 
}: { 
  children: React.ReactNode; 
  onClick: () => void; 
  title: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: "var(--space-2xl)",
        height: "var(--space-2xl)",
        border: "none",
        background: "transparent",
        cursor: "pointer",
        borderRadius: "var(--radius-md)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--text-secondary)",
        transition: "background var(--transition-fast), color var(--transition-fast)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "var(--bg-tertiary)";
        e.currentTarget.style.color = "var(--text-primary)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
        e.currentTarget.style.color = "var(--text-secondary)";
      }}
    >
      {children}
    </button>
  );
}

function ToolbarDivider() {
  return (
    <div
      style={{
        width: "1px",
        height: "var(--space-lg)",
        background: "var(--border-subtle)",
        alignSelf: "center",
        margin: "0 var(--space-xs)",
      }}
    />
  );
}

// Icons as simple SVGs
function TextIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 7V4h16v3" />
      <path d="M9 20h6" />
      <path d="M12 4v16" />
    </svg>
  );
}

function RectangleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="5" width="18" height="14" rx="2" />
    </svg>
  );
}

function CircleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
}

function DiamondIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2l9 10-9 10-9-10z" />
    </svg>
  );
}

