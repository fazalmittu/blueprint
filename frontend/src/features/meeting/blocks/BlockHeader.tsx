import type { ReactNode } from "react";

interface BlockHeaderProps {
  title?: string;
  icon?: ReactNode;
  actions?: ReactNode;
}

/**
 * Reusable header for blocks. Acts as drag handle.
 */
export function BlockHeader({ title, icon, actions }: BlockHeaderProps) {
  return (
    <div
      data-drag-handle
      style={{
        padding: "var(--space-sm) var(--space-md)",
        background: "var(--bg-secondary)",
        borderBottom: "1px solid var(--border-subtle)",
        cursor: "grab",
        userSelect: "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "var(--space-sm)",
        minHeight: "36px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
        {icon}
        {title && (
          <span
            style={{
              fontSize: "0.8125rem",
              fontWeight: 600,
              color: "var(--text-primary)",
            }}
          >
            {title}
          </span>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-xs)" }}>
        {actions}
        <span
          style={{
            fontSize: "0.75rem",
            color: "var(--text-faint)",
            letterSpacing: "1px",
          }}
        >
          ::
        </span>
      </div>
    </div>
  );
}

