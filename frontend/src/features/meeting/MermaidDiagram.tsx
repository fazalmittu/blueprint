import { useEffect, useRef } from "react";
import mermaid from "mermaid";

interface MermaidDiagramProps {
  id: string;
  diagram: string;
}

// Initialize mermaid with dark theme
mermaid.initialize({
  startOnLoad: false,
  theme: "dark",
  themeVariables: {
    primaryColor: "#3b82f6",
    primaryTextColor: "#fafafa",
    primaryBorderColor: "#3f3f46",
    lineColor: "#71717a",
    secondaryColor: "#27272a",
    tertiaryColor: "#18181b",
    background: "#09090b",
    mainBkg: "#18181b",
    nodeBorder: "#3f3f46",
    clusterBkg: "#27272a",
    clusterBorder: "#3f3f46",
    titleColor: "#fafafa",
    edgeLabelBackground: "#18181b",
  },
  flowchart: {
    htmlLabels: true,
    curve: "basis",
  },
});

/**
 * Renders a Mermaid diagram from a diagram string.
 * Re-renders completely on diagram change (no diffing).
 */
export function MermaidDiagram({ id, diagram }: MermaidDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const render = async () => {
      if (!containerRef.current) return;

      try {
        // Clear previous content
        containerRef.current.innerHTML = "";

        // Generate unique ID for this render
        const elementId = `mermaid-${id}-${Date.now()}`;

        // Render the diagram
        const { svg } = await mermaid.render(elementId, diagram);
        containerRef.current.innerHTML = svg;
      } catch (error) {
        console.error("[MermaidDiagram] Render failed:", error);
        containerRef.current.innerHTML = `
          <div style="color: var(--error); padding: 1rem; font-family: var(--font-mono); font-size: 0.875rem;">
            Failed to render diagram
          </div>
        `;
      }
    };

    render();
  }, [id, diagram]);

  return (
    <div
      ref={containerRef}
      className="mermaid-container"
      style={{
        width: "100%",
        overflow: "auto",
        padding: "var(--space-md)",
      }}
    />
  );
}

