"use client";

import React, { useCallback, useLayoutEffect, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Panel,
  NodeTypes,
  NodeProps,
  Handle,
  Position,
  useReactFlow,
  Node,
  Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { CodeiumEditor } from "@codeium/react-code-editor";
import { useTheme } from "next-themes";
import { Button } from "./ui/button";
import { RefreshCw, ZoomIn, Layers } from "lucide-react";

// Define node data types
interface GraphNode {
  id: string;
  label: string;
  type: string;
  module?: string;
  docstring?: string;
  line?: number;
  code?: string;
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

interface NodeWithPosition extends GraphNode {
  position: { x: number; y: number };
  velocity?: { x: number; y: number };
}

// Force-directed layout algorithm for auto-positioning nodes
const forceDirectedLayout = (
  nodes: NodeWithPosition[],
  edges: Edge[],
  options = { iterations: 100 }
): Node[] => {
  // Clone nodes to avoid modifying the originals
  const nodesCopy: NodeWithPosition[] = JSON.parse(JSON.stringify(nodes));

  // Set initial positions if not already set
  nodesCopy.forEach((node) => {
    if (!node.position) {
      node.position = { x: Math.random() * 800, y: Math.random() * 600 };
    }
  });

  // Create a map for quick node lookups
  const nodeMap = new Map<string, NodeWithPosition>();
  nodesCopy.forEach((node) => {
    nodeMap.set(node.id, node);
  });

  // Constants for the force-directed algorithm
  const REPULSION = 200; // Repulsion force between nodes
  const ATTRACTION = 0.1; // Attraction force for connected nodes
  const GRAVITY = 0.1; // Force pulling nodes to the center
  const DAMPING = 0.95; // Damping factor to stabilize the system
  const CENTER = { x: 400, y: 300 }; // Center of the layout

  // Initialize velocity for each node
  nodesCopy.forEach((node) => {
    node.velocity = { x: 0, y: 0 };
  });

  // Run iterations of the force-directed algorithm
  for (let i = 0; i < options.iterations; i++) {
    // Apply repulsion forces between all nodes
    for (let a = 0; a < nodesCopy.length; a++) {
      const nodeA = nodesCopy[a];

      // Apply gravity to pull nodes toward center
      const dx = CENTER.x - nodeA.position.x;
      const dy = CENTER.y - nodeA.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy) || 1;
      nodeA.velocity!.x += (dx / distance) * GRAVITY;
      nodeA.velocity!.y += (dy / distance) * GRAVITY;

      // Apply repulsion between nodes
      for (let b = a + 1; b < nodesCopy.length; b++) {
        const nodeB = nodesCopy[b];
        const dx = nodeB.position.x - nodeA.position.x;
        const dy = nodeB.position.y - nodeA.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy) || 1;

        if (distance < 250) {
          // Only apply repulsion when nodes are close
          const force = REPULSION / (distance * distance);
          nodeA.velocity!.x -= (dx / distance) * force;
          nodeA.velocity!.y -= (dy / distance) * force;
          nodeB.velocity!.x += (dx / distance) * force;
          nodeB.velocity!.y += (dy / distance) * force;
        }
      }
    }

    // Apply attraction forces for connected nodes
    edges.forEach((edge) => {
      const sourceNode = nodeMap.get(edge.source);
      const targetNode = nodeMap.get(edge.target);

      if (sourceNode && targetNode) {
        const dx = targetNode.position.x - sourceNode.position.x;
        const dy = targetNode.position.y - sourceNode.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = distance * ATTRACTION;

        sourceNode.velocity!.x += (dx / distance) * force;
        sourceNode.velocity!.y += (dy / distance) * force;
        targetNode.velocity!.x -= (dx / distance) * force;
        targetNode.velocity!.y -= (dy / distance) * force;
      }
    });

    // Update positions with velocity and apply damping
    nodesCopy.forEach((node) => {
      node.position.x += node.velocity!.x;
      node.position.y += node.velocity!.y;
      node.velocity!.x *= DAMPING;
      node.velocity!.y *= DAMPING;
    });
  }

  // Return the positioned nodes
  return nodesCopy.map(({ id, position }) => ({
    id,
    position,
    data: nodeMap.get(id),
    type: "codeNode",
  }));
};

// Hierarchical layout algorithm (top to bottom)
const hierarchicalLayout = (nodes: Node[], edges: Edge[]) => {
  // Create a directed graph representation
  const graph: Record<string, string[]> = {};
  const nodeMap = new Map<string, Node>();

  // Initialize the graph
  nodes.forEach((node) => {
    graph[node.id] = [];
    nodeMap.set(node.id, node);
  });

  // Add edges to the graph
  edges.forEach((edge) => {
    if (graph[edge.source]) {
      graph[edge.source].push(edge.target);
    }
  });

  // Find root nodes (nodes with no incoming edges)
  const hasIncoming: Record<string, boolean> = {};
  edges.forEach((edge) => {
    hasIncoming[edge.target] = true;
  });

  const rootNodes = nodes
    .filter((node) => !hasIncoming[node.id])
    .map((node) => node.id);

  // If no root nodes found, use the first node as root
  if (rootNodes.length === 0 && nodes.length > 0) {
    rootNodes.push(nodes[0].id);
  }

  // Assign levels to nodes via BFS
  const levels: Record<string, number> = {};
  const queue = rootNodes.map((id) => ({ id, level: 0 }));
  const visited = new Set<string>();

  while (queue.length > 0) {
    const { id, level } = queue.shift()!;

    if (visited.has(id)) {
      continue;
    }

    visited.add(id);
    levels[id] = level;

    for (const childId of graph[id] || []) {
      queue.push({ id: childId, level: level + 1 });
    }
  }

  // For any remaining unvisited nodes, assign them to level 0
  nodes.forEach((node) => {
    if (!levels[node.id]) {
      levels[node.id] = 0;
    }
  });

  // Group nodes by level
  const nodesByLevel: Record<number, string[]> = {};
  Object.entries(levels).forEach(([id, level]) => {
    if (!nodesByLevel[level]) {
      nodesByLevel[level] = [];
    }
    nodesByLevel[level].push(id);
  });

  // Position nodes based on their level
  const LEVEL_HEIGHT = 200;
  const NODE_WIDTH = 180;
  const newNodes = [...nodes];

  Object.entries(nodesByLevel).forEach(([level, nodeIds]) => {
    const levelNum = parseInt(level);
    const y = levelNum * LEVEL_HEIGHT + 100;

    nodeIds.forEach((id, index) => {
      const x =
        (index + 1) * (NODE_WIDTH + 50) -
        (nodeIds.length * (NODE_WIDTH + 50)) / 2 +
        500;
      const nodeIndex = newNodes.findIndex((n) => n.id === id);
      if (nodeIndex !== -1) {
        newNodes[nodeIndex].position = { x, y };
      }
    });
  });

  // Return the positioned nodes
  return newNodes.map((node) => ({
    ...node,
    type: "codeNode",
  }));
};

// Enhanced node with code preview
const CodeNode = ({ data, selected }: NodeProps) => {
  const { theme } = useTheme();
  const [showCodePreview, setShowCodePreview] = useState(false);

  // Apply node styling based on node type and theme
  let backgroundColor;
  if (data.type === "class") {
    backgroundColor = theme === "dark" ? "#F06292" : "#E91E63";
  } else if (data.type === "function") {
    backgroundColor = theme === "dark" ? "#64B5F6" : "#2196F3";
  } else {
    backgroundColor = theme === "dark" ? "#FFD54F" : "#FFC107";
  }

  const textColor = theme === "dark" ? "white" : "black";
  const nodeWidth = showCodePreview ? 280 : 180;
  const nodeHeight = showCodePreview ? 220 : "auto";

  // Format the code for preview
  const formatCodePreview = (code: string) => {
    if (!code) return "";
    // Extract first 8 lines at most
    return code.split("\n").slice(0, 8).join("\n");
  };

  return (
    <div
      className="group"
      style={{
        background: backgroundColor,
        color: textColor,
        borderRadius: "8px",
        padding: "10px",
        border: selected ? "2px solid white" : "1px solid rgba(0,0,0,0.1)",
        width: nodeWidth,
        height: nodeHeight,
        transition: "all 0.3s ease",
        boxShadow: selected ? "0 0 10px rgba(0,0,0,0.3)" : "none",
      }}
    >
      <Handle type="target" position={Position.Top} />
      <div className="flex justify-between items-center mb-1">
        <div className="font-medium text-sm truncate max-w-[70%]">
          {data.label}
        </div>
        <button
          className="w-5 h-5 rounded bg-opacity-20 hover:bg-opacity-40 bg-black flex items-center justify-center"
          onClick={(e) => {
            e.stopPropagation();
            setShowCodePreview(!showCodePreview);
          }}
        >
          {showCodePreview ? "−" : "+"}
        </button>
      </div>
      {data.module && (
        <div className="text-xs opacity-70 truncate">{data.module}</div>
      )}

      {showCodePreview && data.originalNode?.code && (
        <div
          className="mt-2 overflow-hidden rounded bg-gray-900 text-gray-100 p-2 text-xs font-mono"
          style={{ maxHeight: "160px", overflowY: "auto" }}
        >
          <pre className="whitespace-pre-wrap">
            {formatCodePreview(data.originalNode.code)}
          </pre>
        </div>
      )}

      <Handle type="source" position={Position.Bottom} />
    </div>
  );
};

// Custom edge types
const EdgeTypes = {
  imports: { color: "#10b981", label: "imports" },
  inherits: { color: "#0284c7", label: "inherits" },
  calls: { color: "#6366f1", label: "calls" },
  default: { color: "#64748b", label: "" },
};

interface ReactFlowCodeViewerProps {
  graphData?: GraphData;
  className?: string;
}

export default function ReactFlowCodeViewer({
  graphData,
  className,
}: ReactFlowCodeViewerProps) {
  const { theme } = useTheme();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [layoutAlgorithm, setLayoutAlgorithm] = useState<
    "force" | "hierarchical"
  >("force");
  const reactFlowInstance = useReactFlow();

  // Define custom node types
  const nodeTypes: NodeTypes = {
    codeNode: CodeNode,
  };

  // Handle node click
  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    setSelectedNode(node.data.originalNode);
    setIsSheetOpen(true);
  }, []);

  // Format edges from graph data
  const formatEdges = useCallback((edges: GraphEdge[]) => {
    return edges.map((edge, index) => {
      const edgeType =
        EdgeTypes[edge.type as keyof typeof EdgeTypes] || EdgeTypes.default;
      return {
        id: `e${index}`,
        source: edge.source,
        target: edge.target,
        animated: false,
        style: { stroke: edgeType.color },
        type: "smoothstep",
        label: edgeType.label || edge.type,
      };
    });
  }, []);

  // Format nodes from graph data
  const formatNodes = useCallback((nodes: GraphNode[]) => {
    return nodes.map((node) => ({
      id: node.id,
      type: "codeNode",
      position: { x: Math.random() * 800, y: Math.random() * 600 },
      data: {
        label: node.label,
        type: node.type,
        module: node.module,
        originalNode: node,
        showPreview: false,
      },
    }));
  }, []);

  // Apply layout to nodes
  const applyLayout = useCallback(
    (nodes: Node[], edges: Edge[], algorithm: "force" | "hierarchical") => {
      if (algorithm === "force") {
        return forceDirectedLayout(nodes, edges, { iterations: 150 });
      } else {
        return hierarchicalLayout(nodes, edges);
      }
    },
    []
  );

  // Initialize nodes and edges when graph data changes
  useLayoutEffect(() => {
    if (graphData) {
      const formattedNodes = formatNodes(graphData.nodes);
      const formattedEdges = formatEdges(graphData.edges);

      // Apply the selected layout algorithm
      const layoutedNodes = applyLayout(
        formattedNodes,
        formattedEdges,
        layoutAlgorithm
      );

      setNodes(layoutedNodes);
      setEdges(formattedEdges);

      // Center view after a small delay to ensure the layout is applied
      setTimeout(() => {
        reactFlowInstance.fitView({ padding: 0.2 });
      }, 100);
    }
  }, [
    graphData,
    formatNodes,
    formatEdges,
    applyLayout,
    layoutAlgorithm,
    reactFlowInstance,
    setNodes,
    setEdges,
  ]);

  // Handle layout change
  const handleLayoutChange = useCallback(
    (algorithm: "force" | "hierarchical") => {
      setLayoutAlgorithm(algorithm);

      if (nodes.length > 0 && edges.length > 0) {
        const layoutedNodes = applyLayout(nodes, edges, algorithm);
        setNodes(layoutedNodes);

        setTimeout(() => {
          reactFlowInstance.fitView({ padding: 0.2 });
        }, 100);
      }
    },
    [nodes, edges, applyLayout, reactFlowInstance, setNodes]
  );

  // Determine the language for the code editor based on the file extension
  const getLanguage = (filePath: string | undefined): string => {
    if (!filePath) return "javascript";

    const fileExt = filePath.split(".").pop()?.toLowerCase();
    const languageMap: Record<string, string> = {
      js: "javascript",
      jsx: "javascript",
      ts: "typescript",
      tsx: "typescript",
      py: "python",
      html: "html",
      css: "css",
      json: "json",
      md: "markdown",
      yml: "yaml",
      yaml: "yaml",
      java: "java",
      c: "c",
      cpp: "cpp",
      cs: "csharp",
      go: "go",
      rb: "ruby",
      php: "php",
      rust: "rust",
      rs: "rust",
    };

    return languageMap[fileExt || ""] || "plaintext";
  };

  return (
    <div
      className={`bg-background border border-border rounded-lg ${
        className || ""
      }`}
      style={{ height: "600px" }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={{ type: "smoothstep" }}
        fitView
        attributionPosition="bottom-right"
      >
        <Background color={theme === "dark" ? "#333" : "#eee"} />
        <Controls />
        <MiniMap />

        {/* Control Panel */}
        <Panel position="top-left">
          <div
            className={`p-3 rounded-md ${
              theme === "dark"
                ? "bg-gray-800 text-white"
                : "bg-white text-gray-800"
            } shadow-md`}
          >
            <h3 className="font-medium text-sm mb-2">Layout Controls</h3>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={layoutAlgorithm === "force" ? "default" : "outline"}
                onClick={() => handleLayoutChange("force")}
                className="text-xs h-8"
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Force-Directed
              </Button>
              <Button
                size="sm"
                variant={
                  layoutAlgorithm === "hierarchical" ? "default" : "outline"
                }
                onClick={() => handleLayoutChange("hierarchical")}
                className="text-xs h-8"
              >
                <Layers className="h-3 w-3 mr-1" />
                Hierarchical
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  reactFlowInstance.fitView({ padding: 0.2, duration: 800 });
                }}
                className="text-xs h-8"
              >
                <ZoomIn className="h-3 w-3 mr-1" />
                Fit View
              </Button>
            </div>

            <div className="flex gap-2 mt-3">
              <div className="flex items-center gap-1 text-xs">
                <span className="w-3 h-3 rounded-full bg-pink-500"></span> Class
              </div>
              <div className="flex items-center gap-1 text-xs">
                <span className="w-3 h-3 rounded-full bg-blue-500"></span>{" "}
                Function
              </div>
              <div className="flex items-center gap-1 text-xs">
                <span className="w-3 h-3 rounded-full bg-amber-500"></span>{" "}
                Other
              </div>
            </div>
          </div>
        </Panel>
      </ReactFlow>

      {/* Code editor sheet */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent
          side="right"
          className="w-3/4 sm:max-w-[90%] overflow-y-auto"
        >
          <SheetHeader className="pb-5">
            <SheetTitle>
              {selectedNode?.label || "Code Viewer"}
              {selectedNode?.type && (
                <span className="ml-2 text-sm opacity-70">
                  [{selectedNode.type}]
                </span>
              )}
              {selectedNode?.module && (
                <span className="ml-2 text-xs opacity-50">
                  {selectedNode.module}
                </span>
              )}
            </SheetTitle>
          </SheetHeader>
          <div className="h-[80vh]">
            {selectedNode?.code && (
              <CodeiumEditor
                language={getLanguage(selectedNode?.module)}
                theme={theme === "dark" ? "vs-dark" : "vs-light"}
                value={selectedNode.code}
                height="100%"
                fontSize={14}
                lineNumbers="on"
                readOnly={true}
                minimap={{ enabled: true }}
              />
            )}
            {!selectedNode?.code && (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                No code available for this node
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
