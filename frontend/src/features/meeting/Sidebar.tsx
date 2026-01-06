import type { Workflow } from "@/types";

interface SidebarProps {
  summary: string;
  workflows: Workflow[];
}

/**
 * Left panel showing meeting summary and workflow list.
 */
export function Sidebar({ summary, workflows }: SidebarProps) {
  return (
    <aside
      style={{
        width: "320px",
        minWidth: "320px",
        height: "100%",
        background: "var(--bg-secondary)",
        borderRight: "1px solid var(--border-subtle)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Summary Section */}
      <section
        style={{
          padding: "var(--space-lg)",
          borderBottom: "1px solid var(--border-subtle)",
        }}
      >
        <h2
          style={{
            margin: "0 0 var(--space-md) 0",
            fontSize: "0.75rem",
            fontWeight: 500,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            color: "var(--text-muted)",
          }}
        >
          Meeting Summary
        </h2>
        <p
          style={{
            margin: 0,
            fontSize: "0.875rem",
            lineHeight: 1.6,
            color: "var(--text-secondary)",
          }}
        >
          {summary || "Waiting for updates..."}
        </p>
      </section>

      {/* Workflows List */}
      <section
        style={{
          flex: 1,
          padding: "var(--space-lg)",
          overflowY: "auto",
        }}
      >
        <h2
          style={{
            margin: "0 0 var(--space-md) 0",
            fontSize: "0.75rem",
            fontWeight: 500,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            color: "var(--text-muted)",
          }}
        >
          Workflows ({workflows.length})
        </h2>
        <ul
          style={{
            margin: 0,
            padding: 0,
            listStyle: "none",
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-sm)",
          }}
        >
          {workflows.map((workflow, index) => (
            <li
              key={workflow.id}
              style={{
                padding: "var(--space-sm) var(--space-md)",
                background: "var(--bg-tertiary)",
                borderRadius: "var(--radius-sm)",
                fontSize: "0.875rem",
                color: "var(--text-primary)",
                display: "flex",
                alignItems: "center",
                gap: "var(--space-sm)",
              }}
            >
              <span
                style={{
                  width: "20px",
                  height: "20px",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--accent-subtle)",
                  color: "var(--accent)",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: "var(--font-mono)",
                }}
              >
                {index + 1}
              </span>
              {workflow.title}
            </li>
          ))}
        </ul>
      </section>
    </aside>
  );
}

