"use client";

import { useEffect, useState } from "react";

// Dynamic imports for client-side only libraries
import dynamic from "next/dynamic";

// Define graph data interface
interface GraphNode {
  id: string;
  label: string;
  type: string;
  module?: string;
  docstring?: string;
  line?: number;
}

interface GraphEdge {
  source: string;
  target: string;
  type: string;
}

interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  metadata?: Record<string, unknown>;
}

// We need to lazily load sigma and graphology since they're client-side only
const GraphLibs = dynamic(
  () => import("@/components/graph-libs").then((mod) => mod.default),
  {
    ssr: false,
    loading: () => (
      <div className="flex justify-center items-center h-[600px] bg-muted/20 rounded-md">
        <div className="w-10 h-10 border-4 border-primary/20 border-l-primary rounded-full animate-spin"></div>
      </div>
    ),
  }
);

// Props for the SigmaGraph component
interface SigmaGraphProps {
  formattedText?: string;
  useAst?: boolean;
  useTreeSitter?: boolean;
  useCodetext?: boolean;
  useLlm?: boolean;
  data?: GraphData;
}

// Create the component that will load sigma and graphology
export default function SigmaGraph({
  formattedText,
  useAst = true,
  useTreeSitter = false,
  useCodetext = false,
  useLlm = false,
  data,
}: SigmaGraphProps = {}) {
  const [isClient, setIsClient] = useState(false);
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Set graph data from props if provided
  useEffect(() => {
    if (data) {
      setGraphData(data);
      setIsLoading(false);
      return;
    }

    const fetchGraphData = async () => {
      try {
        setIsLoading(true);

        // If formatted text is provided, use the text-based API
        if (formattedText) {
          const response = await fetch("/api/graph-data-from-text", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              text: formattedText,
              use_ast: useAst,
              use_tree_sitter: useTreeSitter,
              use_codetext: useCodetext,
              use_llm: useLlm,
            }),
          });

          if (!response.ok) {
            throw new Error(
              `Failed to fetch graph data from text: ${response.statusText}`
            );
          }

          const responseData = await response.json();
          setGraphData(responseData);
        } else {
          // Otherwise use the regular API
          const queryParams = new URLSearchParams();
          queryParams.set("use_ast", String(useAst));
          queryParams.set("use_tree_sitter", String(useTreeSitter));
          queryParams.set("use_codetext", String(useCodetext));
          queryParams.set("use_llm", String(useLlm));

          const response = await fetch(
            `/api/graph-data?${queryParams.toString()}`
          );
          if (!response.ok) {
            throw new Error(
              `Failed to fetch graph data: ${response.statusText}`
            );
          }
          const responseData = await response.json();
          setGraphData(responseData);
        }
      } catch (err) {
        console.error("Error fetching graph data:", err);
        setError(
          err instanceof Error ? err.message : "Failed to load graph data"
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchGraphData();
  }, [data, formattedText, useAst, useTreeSitter, useCodetext, useLlm]);

  // Only render on client side
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-[600px] bg-muted/20 rounded-md">
        <div className="w-10 h-10 border-4 border-primary/20 border-l-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="flex justify-center items-center h-[600px] bg-muted/20 rounded-md">
        <div className="text-red-500 text-center p-4">
          <h3 className="text-lg font-semibold mb-2">Error loading graph</h3>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  // Show empty state
  if (!graphData || graphData.nodes.length === 0) {
    return (
      <div className="flex justify-center items-center h-[600px] bg-muted/20 rounded-md">
        <p className="text-muted-foreground">No graph data available</p>
      </div>
    );
  }

  // Render the graph with our data
  return isClient ? <GraphLibs graphData={graphData} /> : null;
}
