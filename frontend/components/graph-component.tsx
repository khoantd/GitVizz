import React, { useEffect, useState, useRef } from "react";
import Graph from "graphology";
import Sigma from "sigma";
import { circular } from "graphology-layout";
import forceAtlas2 from "graphology-layout-forceatlas2";

interface GraphData {
  nodes: { id: string; label: string; type: string }[];
  edges: { from: string; to: string; type: string }[];
}

const GraphComponent: React.FC = () => {
  const [graphData, setGraphData] = useState<GraphData>({
    nodes: [],
    edges: [],
  });
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const sigmaRef = useRef<Sigma | null>(null);

  useEffect(() => {
    const fetchGraphData = async () => {
      try {
        const response = await fetch("/api/graph-data");
        if (!response.ok) {
          throw new Error("Failed to fetch graph data");
        }
        const data = await response.json();
        setGraphData({
          nodes: data.nodes,
          edges: data.edges,
        });
      } catch (error) {
        console.error("Error fetching graph data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchGraphData();
  }, []);

  useEffect(() => {
    if (!containerRef.current || !graphData || graphData.nodes.length === 0)
      return;

    // Clean up any existing sigma instance
    if (sigmaRef.current) {
      sigmaRef.current.kill();
      sigmaRef.current = null;
    }

    try {
      // Create a new graph
      const graph = new Graph();

      // Add nodes
      graphData.nodes.forEach((node) => {
        let nodeType = "circle";
        if (node.type === "class") nodeType = "square";
        else if (node.type === "function") nodeType = "diamond";

        graph.addNode(node.id, {
          label: node.label || node.id,
          size: 5,
          color: node.type === "class" ? "#1E88E5" : "#43A047",
          x: Math.random(),
          y: Math.random(),
          type: nodeType,
        });
      });

      // Add edges
      graphData.edges.forEach((edge) => {
        const source = String(edge.from);
        const target = String(edge.to);

        if (
          graph.hasNode(source) &&
          graph.hasNode(target) &&
          source !== target &&
          !graph.hasEdge(source, target)
        ) {
          try {
            graph.addEdge(source, target, {
              label: edge.type || "",
              size: 1,
              color: "#999",
            });
          } catch (error) {
            console.warn(
              `Failed to add edge from ${source} to ${target}:`,
              error
            );
          }
        }
      });

      // Apply layout
      circular.assign(graph);

      // Create sigma instance
      sigmaRef.current = new Sigma(graph, containerRef.current, {
        renderEdgeLabels: true,
        allowInvalidContainer: true,
        labelSize: 14,
        defaultNodeColor: "#1E88E5",
        defaultEdgeColor: "#999",
        defaultNodeType: "circle",
        labelDensity: 0.07,
        labelGridCellSize: 60,
        labelRenderedSizeThreshold: 6,
        renderLabels: true,
        nodeReducer: (node, data) => {
          const type = [
            "circle",
            "square",
            "diamond",
            "equilateral",
            "star",
          ].includes(data.type)
            ? data.type
            : "circle";
          return { ...data, type };
        },
      });

      // Run ForceAtlas2 for better layout
      forceAtlas2.assign(graph, {
        iterations: 200,
        settings: {
          gravity: 1.5,
          scalingRatio: 8,
          strongGravityMode: true,
          slowDown: 5,
          barnesHutOptimize: true,
          barnesHutTheta: 0.5,
        },
      });

      // Add event listeners for better interaction
      const camera = sigmaRef.current.getCamera();
      camera.animatedReset();

      // Refresh the rendering
      sigmaRef.current.refresh();
    } catch (error) {
      console.error("Error creating graph:", error);
    }

    // Cleanup function
    return () => {
      if (sigmaRef.current) {
        sigmaRef.current.kill();
        sigmaRef.current = null;
      }
    };
  }, [graphData]);

  if (loading) {
    return <div>Loading graph data...</div>;
  }

  if (graphData.nodes.length === 0) {
    return <div>No graph data available.</div>;
  }

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: "600px" }}
      className="bg-background border border-border rounded-md"
    />
  );
};

export default GraphComponent;
