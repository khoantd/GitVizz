'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  SigmaContainer,
  useLoadGraph,
  useRegisterEvents,
  useSigma,
  useCamera,
} from '@react-sigma/core';
import '@react-sigma/core/lib/style.css';
import { MultiDirectedGraph } from 'graphology';
import { useLayoutForceAtlas2 } from '@react-sigma/layout-forceatlas2';
import { useLayoutForce } from '@react-sigma/layout-force';
import { useLayoutNoverlap } from '@react-sigma/layout-noverlap';
import { useLayoutCircular } from '@react-sigma/layout-circular';
import { useLayoutRandom } from '@react-sigma/layout-random';
import { animateNodes } from 'sigma/utils';
import { EdgeArrowProgram, NodePointProgram, NodeCircleProgram } from 'sigma/rendering';
import { NodeBorderProgram } from '@sigma/node-border';
import { EdgeCurvedArrowProgram, createEdgeCurveProgram } from '@sigma/edge-curve';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  LayoutGrid,
  Shuffle,
  RotateCw,
  Zap,
  AlertTriangle,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Focus,
  Pause,
} from 'lucide-react';

type InnerNode = { id: string; name: string; category?: string };
type InnerEdge = { id?: string; source: string; target: string };

export interface SigmaGraphInnerData {
  nodes: InnerNode[];
  edges: InnerEdge[];
}

interface NodeCategories {
  [key: string]: {
    color: string;
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    description: string;
  };
}

// Use the same color mapping system as ReagraphVisualization
function getColorForCategory(category?: string, nodeCategories?: NodeCategories): string {
  if (!category || !nodeCategories) return '#90A4AE';
  const key = category.toLowerCase();
  return nodeCategories[key]?.color || nodeCategories['other']?.color || '#90A4AE';
}

// Get a lighter version of a color for hover states
function getLighterColor(color: string): string {
  // Convert hex to RGB and lighten
  const hex = color.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  // Lighten by increasing RGB values
  const lighten = (c: number) => Math.min(255, Math.floor(c + (255 - c) * 0.3));

  const newR = lighten(r).toString(16).padStart(2, '0');
  const newG = lighten(g).toString(16).padStart(2, '0');
  const newB = lighten(b).toString(16).padStart(2, '0');

  return `#${newR}${newG}${newB}`;
}

// Get connected nodes for a given node
function getConnectedNodes(graph: MultiDirectedGraph, nodeId: string): Set<string> {
  const connected = new Set<string>();
  try {
    // Add neighbors (both in and out)
    graph.forEachNeighbor(nodeId, (neighbor) => {
      connected.add(neighbor);
    });
  } catch {
    // Node might not exist
  }
  return connected;
}

// Calculate node depths from a root node using BFS
function calculateNodeDepths(
  graph: MultiDirectedGraph,
  rootNodeId: string,
  maxDepth: number,
): Map<string, number> {
  const depths = new Map<string, number>();
  if (!rootNodeId || !graph.hasNode(rootNodeId)) return depths;

  const queue: Array<{ nodeId: string; depth: number }> = [{ nodeId: rootNodeId, depth: 0 }];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const { nodeId, depth } = queue.shift()!;

    if (visited.has(nodeId) || depth > maxDepth) continue;
    visited.add(nodeId);
    depths.set(nodeId, depth);

    // Add all neighbors to queue with increased depth
    try {
      graph.forEachNeighbor(nodeId, (neighborId) => {
        if (!visited.has(neighborId)) {
          queue.push({ nodeId: neighborId, depth: depth + 1 });
        }
      });
    } catch {
      // Node might not exist
    }
  }

  return depths;
}

const sigmaContainerStyle: React.CSSProperties = {
  height: '100%',
  width: '100%',
  background: 'linear-gradient(135deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.05) 100%)',
};

// Enhanced Sigma settings with advanced features
const enhancedSigmaSettings = {
  allowInvalidContainer: true,
  defaultNodeType: 'default',
  defaultEdgeType: 'curvedNoArrow',
  renderLabels: true,
  renderEdgeLabels: false,
  edgeProgramClasses: {
    arrow: EdgeArrowProgram,
    curvedArrow: EdgeCurvedArrowProgram,
    curvedNoArrow: createEdgeCurveProgram(),
  },
  nodeProgramClasses: {
    default: NodeBorderProgram,
    circle: NodeCircleProgram,
    point: NodePointProgram,
  },
  labelFont: 'Arial, sans-serif',
  labelSize: 12,
  labelWeight: '500',
  labelColor: { color: '#374151' },
  labelGridCellSize: 60,
  labelRenderedSizeThreshold: 12,
  edgeLabelFont: 'Arial, sans-serif',
  edgeLabelSize: 10,
  edgeLabelColor: { color: '#6b7280' },
  minCameraRatio: 0.05,
  maxCameraRatio: 10,
  enableEdgeEvents: true,
  hideEdgesOnMove: true,
  hideLabelsOnMove: false,
  zIndex: true,
};

// Node dragging component
function GraphEvents({ enableNodeDrag = true }: { enableNodeDrag?: boolean }) {
  const registerEvents = useRegisterEvents();
  const sigma = useSigma();
  const [draggedNode, setDraggedNode] = useState<string | null>(null);

  useEffect(() => {
    if (!enableNodeDrag) return;

    registerEvents({
      downNode: (e) => {
        setDraggedNode(e.node);
        sigma.getGraph().setNodeAttribute(e.node, 'highlighted', true);
      },
      mousemovebody: (e) => {
        if (!draggedNode) return;
        const pos = sigma.viewportToGraph(e);
        sigma.getGraph().setNodeAttribute(draggedNode, 'x', pos.x);
        sigma.getGraph().setNodeAttribute(draggedNode, 'y', pos.y);
        e.preventSigmaDefault();
        e.original.preventDefault();
        e.original.stopPropagation();
      },
      mouseup: () => {
        if (draggedNode) {
          setDraggedNode(null);
          sigma.getGraph().removeNodeAttribute(draggedNode, 'highlighted');
        }
      },
      mousedown: (e) => {
        const mouseEvent = e.original as MouseEvent;
        if (mouseEvent.buttons !== 0 && !sigma.getCustomBBox()) {
          sigma.setCustomBBox(sigma.getBBox());
        }
      },
    });
  }, [registerEvents, sigma, draggedNode, enableNodeDrag]);

  return null;
}

function LoadGraph({
  data,
  onNodeClick,
  focusedNodeId,
  nodeCategories,
  currentLayout,
  hierarchyDepth,
  selectedRootNodeId,
}: {
  data: SigmaGraphInnerData;
  onNodeClick?: (nodeId: string) => void;
  focusedNodeId?: string | null;
  nodeCategories?: NodeCategories;
  currentLayout?: string;
  hierarchyDepth?: number;
  selectedRootNodeId?: string;
}) {
  const loadGraph = useLoadGraph();
  const registerEvents = useRegisterEvents();
  const sigma = useSigma();
  const [connectedNodes, setConnectedNodes] = useState<Set<string>>(new Set());
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [nodeDepths, setNodeDepths] = useState<Map<string, number>>(new Map());

  // Enhanced layout hooks
  const layoutForceAtlas2 = useLayoutForceAtlas2({ iterations: 300 });
  const layoutForce = useLayoutForce({
    maxIterations: 100,
    settings: {
      attraction: 0.0003,
      repulsion: 0.02,
      gravity: 0.02,
      inertia: 0.4,
      maxMove: 100,
    },
  });
  const layoutNoverlap = useLayoutNoverlap({
    maxIterations: 100,
    settings: {
      margin: 5,
      expansion: 1.1,
      gridSize: 1,
      ratio: 1,
      speed: 3,
    },
  });
  const layoutCircular = useLayoutCircular();
  const layoutRandom = useLayoutRandom();

  // Stable layout application function (not recreated on every render)
  const applyLayoutStable = useCallback(
    (layoutType: string, animate = true) => {
      const graph = sigma.getGraph();
      if (!graph || graph.order === 0) return;

      try {
        let positions: Record<string, { x: number; y: number }> = {};

        switch (layoutType) {
          case 'forceatlas2':
            positions = layoutForceAtlas2.positions() as Record<string, { x: number; y: number }>;
            break;
          case 'force':
            positions = layoutForce.positions() as Record<string, { x: number; y: number }>;
            break;
          case 'noverlap':
            positions = layoutNoverlap.positions() as Record<string, { x: number; y: number }>;
            break;
          case 'circular':
            positions = layoutCircular.positions() as Record<string, { x: number; y: number }>;
            break;
          case 'random':
            positions = layoutRandom.positions() as Record<string, { x: number; y: number }>;
            break;
          case 'grid':
            const nodeCount = graph.order;
            const cols = Math.ceil(Math.sqrt(nodeCount));
            const spacing = 80;
            positions = {};
            let idx = 0;
            graph.forEachNode((nodeId) => {
              const row = Math.floor(idx / cols);
              const col = idx % cols;
              positions[nodeId] = {
                x: col * spacing - (cols * spacing) / 2,
                y: row * spacing - (Math.ceil(nodeCount / cols) * spacing) / 2,
              };
              idx++;
            });
            break;
          default:
            console.warn('Unknown layout type:', layoutType);
            return;
        }

        if (animate && Object.keys(positions).length > 0) {
          animateNodes(graph, positions, { duration: 400 });
        } else if (Object.keys(positions).length > 0) {
          graph.forEachNode((node) => {
            if (positions[node]) {
              graph.setNodeAttribute(node, 'x', positions[node].x);
              graph.setNodeAttribute(node, 'y', positions[node].y);
            }
          });
          sigma.refresh();
        }
      } catch (error) {
        console.error('Layout failed:', error);
      }
    },
    [sigma, layoutCircular, layoutForce, layoutForceAtlas2, layoutNoverlap, layoutRandom],
  );

  // Update node appearance based on states (optimized to prevent constant refreshing)
  const updateNodeAppearance = useCallback(
    (graph: MultiDirectedGraph) => {
      graph.forEachNode((nodeId) => {
        const nodeData = data.nodes.find((n) => n.id === nodeId);
        const originalColor = getColorForCategory(nodeData?.category, nodeCategories);
        const baseSize = graph.getNodeAttribute(nodeId, 'originalSize') || 8;
        const nodeDepth = nodeDepths.get(nodeId);

        let size = baseSize;
        let color = originalColor;
        let borderColor = 'transparent';
        let borderSize = 0;

        // Hierarchy depth highlighting (takes precedence when enabled)
        if (selectedRootNodeId && hierarchyDepth && nodeDepth !== undefined) {
          if (nodeId === selectedRootNodeId) {
            // Root node - special highlighting
            size = baseSize * 1.6;
            borderColor = '#8b5cf6'; // Purple border for root
            borderSize = 4;
            color = getLighterColor(originalColor);
          } else if (nodeDepth <= hierarchyDepth) {
            // Within hierarchy depth - highlight based on depth level
            const depthIntensity = 1 - (nodeDepth / hierarchyDepth) * 0.4; // Fade based on depth
            size = baseSize * (1 + depthIntensity * 0.3);
            borderColor = '#8b5cf6';
            borderSize = Math.max(1, 3 - nodeDepth);
            color = getLighterColor(originalColor);
          } else {
            // Outside hierarchy depth - dim significantly
            color = originalColor + '30';
          }
        }
        // Focus state (only if hierarchy is not active)
        else if (nodeId === focusedNodeId) {
          size = baseSize * 1.8;
          borderColor = '#6b7280';
          borderSize = 3;
          color = getLighterColor(originalColor);
        }
        // Connected to focused node
        else if (focusedNodeId && connectedNodes.has(nodeId)) {
          size = baseSize * 1.1;
          color = getLighterColor(originalColor);
        }
        // Hover state (only if not focused and no hierarchy)
        else if (!focusedNodeId && !selectedRootNodeId && nodeId === hoveredNode) {
          size = baseSize * 1.2;
          color = getLighterColor(originalColor);
        }
        // Connected to hovered node
        else if (
          !focusedNodeId &&
          !selectedRootNodeId &&
          hoveredNode &&
          connectedNodes.has(nodeId)
        ) {
          color = getLighterColor(originalColor);
        }
        // Dimmed state
        else if (
          (focusedNodeId && !connectedNodes.has(nodeId) && nodeId !== focusedNodeId) ||
          (!focusedNodeId &&
            !selectedRootNodeId &&
            hoveredNode &&
            !connectedNodes.has(nodeId) &&
            nodeId !== hoveredNode)
        ) {
          color = originalColor + '60';
        }

        graph.mergeNodeAttributes(nodeId, {
          size,
          color,
          borderColor,
          borderSize,
        });
      });

      // Update edges
      graph.forEachEdge((edgeId, attributes, source, target) => {
        let color = '#e5e7eb';
        let size = 0.8;

        // Hierarchy depth edge highlighting (takes precedence)
        if (selectedRootNodeId && hierarchyDepth) {
          const sourceDepth = nodeDepths.get(source);
          const targetDepth = nodeDepths.get(target);

          if (
            sourceDepth !== undefined &&
            targetDepth !== undefined &&
            sourceDepth <= hierarchyDepth &&
            targetDepth <= hierarchyDepth
          ) {
            // Both nodes are within hierarchy depth
            color = '#000000'; // Black edges for hierarchy
            size = 1.2;
          } else if (
            (sourceDepth !== undefined && sourceDepth <= hierarchyDepth) ||
            (targetDepth !== undefined && targetDepth <= hierarchyDepth)
          ) {
            // One node is within hierarchy depth
            color = '#374151'; // Dark gray
            size = 1.0;
          } else {
            // Outside hierarchy
            color = '#e5e7eb30';
            size = 0.6;
          }
        }
        // Regular focus/hover highlighting (only if no hierarchy)
        else {
          const activeNode = focusedNodeId || hoveredNode;
          if (activeNode && (source === activeNode || target === activeNode)) {
            color = '#9ca3af';
            size = 1.5;
          } else if (activeNode && !connectedNodes.has(source) && !connectedNodes.has(target)) {
            color = '#e5e7eb50';
          }
        }

        graph.mergeEdgeAttributes(edgeId, { color, size });
      });
    },
    [
      data.nodes,
      connectedNodes,
      focusedNodeId,
      hoveredNode,
      nodeCategories,
      nodeDepths,
      selectedRootNodeId,
      hierarchyDepth,
    ],
  );

  useEffect(() => {
    const graph = new MultiDirectedGraph();
    const currentNodeCount = data.nodes.length;

    // Performance optimized node sizing based on graph size
    const minNodeSize = currentNodeCount > 1000 ? 3 : currentNodeCount > 500 ? 4 : 5;
    const maxNodeSize = currentNodeCount > 1000 ? 8 : currentNodeCount > 500 ? 12 : 15;

    // Calculate node degrees for size scaling
    const nodeDegrees = new Map<string, number>();
    for (const edge of data.edges) {
      nodeDegrees.set(edge.source, (nodeDegrees.get(edge.source) || 0) + 1);
      nodeDegrees.set(edge.target, (nodeDegrees.get(edge.target) || 0) + 1);
    }

    const maxDegree = Math.max(...Array.from(nodeDegrees.values()), 1);
    const minDegree = 1;
    const degreeRange = maxDegree - minDegree || 1;
    const sizeScale = maxNodeSize - minNodeSize;

    // Add nodes with enhanced styling and degree-based sizing
    for (const node of data.nodes) {
      const degree = nodeDegrees.get(node.id) || 1;
      const baseSize = Math.round(
        minNodeSize + sizeScale * Math.pow((degree - minDegree) / degreeRange, 0.5),
      );
      const baseColor = getColorForCategory(node.category, nodeCategories);

      if (!graph.hasNode(node.id)) {
        graph.addNode(node.id, {
          label: node.name,
          size: baseSize,
          originalSize: baseSize,
          color: baseColor,
          originalColor: baseColor,
          borderColor: 'transparent',
          borderSize: 0.2,
          degree: degree,
          x: Math.random(),
          y: Math.random(),
        });
      }
    }

    // Performance optimized edge sizing
    const minEdgeSize = currentNodeCount > 1000 ? 0.5 : 0.8;

    // Add edges with enhanced styling and performance optimizations
    for (const edge of data.edges) {
      try {
        const edgeAttributes = {
          color: '#e5e7eb',
          size: minEdgeSize,
          type: 'curvedNoArrow' as const,
          originalWeight: 1,
        };

        if (edge.id) {
          graph.addDirectedEdgeWithKey(edge.id, edge.source, edge.target, edgeAttributes);
        } else {
          graph.addDirectedEdge(edge.source, edge.target, edgeAttributes);
        }
      } catch {
        // Ignore duplicate/invalid edge errors if any
      }
    }

    // Apply initial layout without animation for faster startup
    applyLayoutStable(currentLayout || 'forceatlas2', false);

    loadGraph(graph);
  }, [data, loadGraph, nodeCategories, currentLayout, applyLayoutStable]);

  // Apply layout when currentLayout changes with animation
  useEffect(() => {
    const graph = sigma.getGraph();
    if (graph && graph.order > 0 && currentLayout) {
      applyLayoutStable(currentLayout, true);
    }
  }, [currentLayout, sigma, applyLayoutStable]);

  // Calculate node depths when hierarchy parameters change
  useEffect(() => {
    if (!selectedRootNodeId || !hierarchyDepth) {
      setNodeDepths(new Map());
      return;
    }

    const graph = sigma.getGraph();
    if (!graph || graph.order === 0) return;

    const depths = calculateNodeDepths(graph, selectedRootNodeId, hierarchyDepth);
    setNodeDepths(depths);
  }, [selectedRootNodeId, hierarchyDepth, sigma, data]);

  // Update connected nodes when focus changes (for hierarchy tab integration) - debounced
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (focusedNodeId) {
        const graph = sigma.getGraph();
        if (graph) {
          setConnectedNodes(getConnectedNodes(graph, focusedNodeId));
        }
      } else {
        setConnectedNodes(new Set());
      }
    }, 50); // 50ms debounce

    return () => clearTimeout(timeoutId);
  }, [focusedNodeId, sigma]);

  // Update appearance when focus/hover changes (debounced to prevent excessive refreshing)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const graph = sigma.getGraph();
      if (graph && graph.order > 0) {
        updateNodeAppearance(graph);
        sigma.refresh();
      }
    }, 50); // 50ms debounce

    return () => clearTimeout(timeoutId);
  }, [connectedNodes, focusedNodeId, hoveredNode, sigma, updateNodeAppearance]);

  // Enhanced event handling with hover effects
  useEffect(() => {
    const isButtonPressed = (ev: MouseEvent | TouchEvent) => {
      if (ev.type.startsWith('mouse')) {
        return (ev as MouseEvent).buttons !== 0;
      }
      return false;
    };

    registerEvents({
      clickNode: ({ node }) => {
        if (onNodeClick) onNodeClick(String(node));
      },
      clickStage: () => {
        if (onNodeClick) {
          onNodeClick('');
        }
      },
      enterNode: ({ node, event }) => {
        if (!isButtonPressed(event.original)) {
          setHoveredNode(String(node));
        }
      },
      leaveNode: ({ event }) => {
        if (!isButtonPressed(event.original)) {
          setHoveredNode(null);
        }
      },
    });
  }, [registerEvents, onNodeClick]);

  // Camera animation when focusing on nodes (debounced)
  useEffect(() => {
    if (!focusedNodeId) return;

    const timeoutId = setTimeout(() => {
      try {
        const display = sigma.getNodeDisplayData(focusedNodeId);
        if (display) {
          const currentCamera = sigma.getCamera().getState();
          sigma.getCamera().animate(
            {
              x: display.x,
              y: display.y,
              ratio: currentCamera.ratio,
            },
            { duration: 300 },
          );
        }
      } catch {
        // no-op
      }
    }, 100); // 100ms debounce for camera movements

    return () => clearTimeout(timeoutId);
  }, [focusedNodeId, sigma]);

  return null;
}

// Enhanced zoom and camera controls
function ZoomControls() {
  const sigma = useSigma();
  const { zoomIn, zoomOut, reset } = useCamera({ duration: 200, factor: 1.5 });

  const handleResetView = useCallback(() => {
    try {
      sigma.setCustomBBox(null);
      sigma.refresh();
      const graph = sigma.getGraph();

      if (!graph?.order || graph.nodes().length === 0) {
        reset();
        return;
      }

      sigma.getCamera().animate({ x: 0.5, y: 0.5, ratio: 1.1 }, { duration: 1000 });
    } catch (error) {
      console.error('Error resetting view:', error);
      reset();
    }
  }, [sigma, reset]);

  const handleRotate = useCallback(() => {
    const camera = sigma.getCamera();
    const currentAngle = camera.angle;
    camera.animate({ angle: currentAngle + Math.PI / 8 }, { duration: 200 });
  }, [sigma]);

  const handleRotateCounterClockwise = useCallback(() => {
    const camera = sigma.getCamera();
    const currentAngle = camera.angle;
    camera.animate({ angle: currentAngle - Math.PI / 8 }, { duration: 200 });
  }, [sigma]);

  return (
    <div className="absolute bottom-3 left-3 z-10">
      <div className="flex flex-col gap-1 bg-background/90 backdrop-blur-sm border border-border/60 rounded-xl p-1">
        <Button size="sm" variant="ghost" onClick={handleRotate} className="h-8 w-8 p-0">
          <RotateCw className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleRotateCounterClockwise}
          className="h-8 w-8 p-0"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
        <Button size="sm" variant="ghost" onClick={handleResetView} className="h-8 w-8 p-0">
          <Focus className="h-4 w-4" />
        </Button>
        <Button size="sm" variant="ghost" onClick={() => zoomIn()} className="h-8 w-8 p-0">
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button size="sm" variant="ghost" onClick={() => zoomOut()} className="h-8 w-8 p-0">
          <ZoomOut className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// Layout control with animation
function LayoutControl({
  currentLayout,
  onLayoutChange,
}: {
  currentLayout: string;
  onLayoutChange: (layout: string) => void;
}) {
  const [isAnimating, setIsAnimating] = useState(false);

  const handleLayoutChange = useCallback(
    (newLayout: string) => {
      if (isAnimating) return;
      setIsAnimating(true);
      onLayoutChange(newLayout);

      // Reset animation state after layout completes
      setTimeout(() => setIsAnimating(false), 500);
    },
    [onLayoutChange, isAnimating],
  );

  return (
    <div className="flex items-center gap-2">
      {isAnimating && (
        <Button size="sm" variant="ghost" className="h-8 px-2">
          <Pause className="h-3 w-3" />
        </Button>
      )}
      <Select value={currentLayout} onValueChange={handleLayoutChange}>
        <SelectTrigger className="w-auto h-8 bg-background/90 backdrop-blur-sm border-border/60 rounded-xl px-3 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="rounded-xl">
          <SelectItem value="forceatlas2" className="text-xs">
            <div className="flex items-center gap-2">
              <Zap className="h-3 w-3" />
              Force Atlas 2
            </div>
          </SelectItem>
          <SelectItem value="force" className="text-xs">
            <div className="flex items-center gap-2">
              <Zap className="h-3 w-3" />
              Force Directed
            </div>
          </SelectItem>
          <SelectItem value="noverlap" className="text-xs">
            <div className="flex items-center gap-2">
              <LayoutGrid className="h-3 w-3" />
              No Overlap
            </div>
          </SelectItem>
          <SelectItem value="circular" className="text-xs">
            <div className="flex items-center gap-2">
              <RotateCw className="h-3 w-3" />
              Circular
            </div>
          </SelectItem>
          <SelectItem value="grid" className="text-xs">
            <div className="flex items-center gap-2">
              <LayoutGrid className="h-3 w-3" />
              Grid
            </div>
          </SelectItem>
          <SelectItem value="random" className="text-xs">
            <div className="flex items-center gap-2">
              <Shuffle className="h-3 w-3" />
              Random
            </div>
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

export default function SigmaGraphInner({
  data,
  onNodeClick,
  focusedNodeId,
  nodeCategories,
  hierarchyDepth,
  selectedRootNodeId,
}: {
  data: SigmaGraphInnerData;
  onNodeClick?: (nodeId: string) => void;
  focusedNodeId?: string | null;
  nodeCategories?: NodeCategories;
  hierarchyDepth?: number;
  selectedRootNodeId?: string;
}) {
  const [currentLayout, setCurrentLayout] = useState<
    'forceatlas2' | 'circular' | 'grid' | 'random' | 'force' | 'noverlap'
  >('forceatlas2');

  const nodeCount = data.nodes.length;
  const showPerformanceWarning = nodeCount > 3000;
  const showMaxWarning = nodeCount > 10000;

  if (showMaxWarning) {
    return (
      <div className="flex justify-center items-center h-full">
        <div className="text-center space-y-4 p-8 max-w-md">
          <div className="w-12 h-12 mx-auto rounded-xl bg-red-50 dark:bg-red-950/20 flex items-center justify-center">
            <AlertTriangle className="h-6 w-6 text-red-500" />
          </div>
          <div className="space-y-2">
            <h3 className="text-base font-medium text-foreground">Graph Too Large</h3>
            <p className="text-sm text-muted-foreground">
              This graph has {nodeCount.toLocaleString()} nodes, which exceeds the 10,000 node limit
              for optimal performance.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      {/* Performance Warning - top center */}
      {showPerformanceWarning && (
        <div className="absolute top-3 left-1/2 transform -translate-x-1/2 z-10 max-w-md">
          <Alert className="bg-yellow-50/90 dark:bg-yellow-950/20 backdrop-blur-sm border-yellow-200 dark:border-yellow-800 rounded-xl">
            <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
            <AlertDescription className="text-xs text-yellow-800 dark:text-yellow-200">
              Large graph ({nodeCount.toLocaleString()} nodes) - performance may be impacted
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* Stats Badge - top right corner */}
      <div className="absolute top-3 right-3 z-10">
        <Badge className="bg-background/90 backdrop-blur-sm border-border/60 text-foreground rounded-xl px-2 py-1 text-xs">
          {data.nodes.length}N • {data.edges.length}E
        </Badge>
      </div>

      <SigmaContainer
        style={sigmaContainerStyle}
        graph={MultiDirectedGraph}
        settings={enhancedSigmaSettings}
      >
        <GraphEvents enableNodeDrag={true} />
        <LoadGraph
          data={data}
          onNodeClick={onNodeClick}
          focusedNodeId={focusedNodeId}
          nodeCategories={nodeCategories}
          currentLayout={currentLayout}
          hierarchyDepth={hierarchyDepth}
          selectedRootNodeId={selectedRootNodeId}
        />

        {/* Enhanced Zoom Controls - bottom left corner */}
        <ZoomControls />

        {/* Enhanced Layout Controls - bottom right corner */}
        <div className="absolute bottom-3 right-3 z-10">
          <LayoutControl
            currentLayout={currentLayout}
            onLayoutChange={(layout) => setCurrentLayout(layout as typeof currentLayout)}
          />
        </div>
      </SigmaContainer>
    </div>
  );
}
