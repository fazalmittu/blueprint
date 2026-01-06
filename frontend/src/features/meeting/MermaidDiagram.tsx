import { useEffect, useRef } from "react";
import mermaid from "mermaid";

interface MermaidDiagramProps {
  id: string;
  diagram: string;
}

// Initialize mermaid with light theme
mermaid.initialize({
  startOnLoad: false,
  theme: "base",
  themeVariables: {
    // Background
    background: "#ffffff",
    mainBkg: "#f8fafc",
    
    // Node colors
    primaryColor: "#e0f2fe",
    primaryTextColor: "#0c4a6e",
    primaryBorderColor: "#38bdf8",
    
    secondaryColor: "#fef3c7",
    secondaryTextColor: "#92400e",
    secondaryBorderColor: "#fbbf24",
    
    tertiaryColor: "#f0fdf4",
    tertiaryTextColor: "#166534",
    tertiaryBorderColor: "#4ade80",
    
    // Lines and labels
    lineColor: "#64748b",
    textColor: "#334155",
    
    // Clusters
    clusterBkg: "#f1f5f9",
    clusterBorder: "#cbd5e1",
    
    // Title
    titleColor: "#0f172a",
    
    // Edge labels
    edgeLabelBackground: "#ffffff",
    
    // Fonts
    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif',
    fontSize: "14px",
  },
  flowchart: {
    htmlLabels: true,
    curve: "basis",
    padding: 20,
    nodeSpacing: 50,
    rankSpacing: 60,
  },
});

/**
 * Renders a Mermaid diagram from a diagram string.
 * Uses light theme to match the app aesthetic.
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
          <div style="
            color: var(--error); 
            padding: var(--space-md); 
            font-family: var(--font-mono); 
            font-size: 0.75rem;
            background: #fef2f2;
            border-radius: var(--radius-sm);
          ">
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
        display: "flex",
        justifyContent: "center",
      }}
    />
  );
}
