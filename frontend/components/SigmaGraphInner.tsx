'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { SigmaContainer, useLoadGraph, useRegisterEvents, useSigma } from '@react-sigma/core';
import '@react-sigma/core/lib/style.css';
import { MultiDirectedGraph } from 'graphology';
import forceAtlas2 from 'graphology-layout-forceatlas2';
import random from 'graphology-layout/random';
import circular from 'graphology-layout/circular';
import forceSimple from 'graphology-layout-force';
import noverlap from 'graphology-layout-noverlap';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LayoutGrid, Shuffle, RotateCw, Zap, AlertTriangle } from 'lucide-react';

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

const sigmaContainerStyle: React.CSSProperties = { 
  height: '100%', 
  width: '100%',
  background: 'linear-gradient(135deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.05) 100%)',
};

function LoadGraph({
  data,
  onNodeClick,
  focusedNodeId,
  nodeCategories,
  currentLayout,
}: {
  data: SigmaGraphInnerData;
  onNodeClick?: (nodeId: string) => void;
  focusedNodeId?: string | null;
  nodeCategories?: NodeCategories;
  currentLayout?: string;
}) {
  const loadGraph = useLoadGraph();
  const registerEvents = useRegisterEvents();
  const sigma = useSigma();
  const [connectedNodes, setConnectedNodes] = useState<Set<string>>(new Set());
  
  // Layout application function - moved to top to avoid initialization issues
  const applyLayout = useCallback((graph: MultiDirectedGraph, layoutType: string, nodeCount: number) => {
    try {
      switch (layoutType) {
        case 'forceatlas2':
          // Start with random positions with larger scale
          random.assign(graph, { scale: 3 });
          
          // Apply ForceAtlas2 with anti-overlap settings
          const iterations = nodeCount <= 200 ? 300 : nodeCount <= 500 ? 150 : 80;
          forceAtlas2.assign(graph, {
            iterations,
            settings: {
              gravity: 0.01,
              scalingRatio: 25,
              slowDown: 3,
              barnesHutOptimize: nodeCount > 100,
              strongGravityMode: false,
              outboundAttractionDistribution: false,
              linLogMode: true,
              adjustSizes: true,
            },
          });
          
          // Always apply overlap removal
          noverlap.assign(graph, {
            maxIterations: nodeCount <= 200 ? 100 : 80,
            settings: {
              margin: 8,
              ratio: 1.5,
              speed: 2,
              gridSize: 20,
            },
          });
          break;
          
        case 'circular':
          circular.assign(graph, {
            scale: Math.max(200, Math.sqrt(nodeCount) * 20),
          });
          break;
          
        case 'grid':
          // Grid layout - arrange nodes in a grid pattern
          let idx = 0;
          const cols = Math.ceil(Math.sqrt(nodeCount));
          const spacing = 80;
          graph.forEachNode((nodeId) => {
            const row = Math.floor(idx / cols);
            const col = idx % cols;
            graph.mergeNodeAttributes(nodeId, {
              x: col * spacing - (cols * spacing) / 2,
              y: row * spacing - (Math.ceil(nodeCount / cols) * spacing) / 2,
            });
            idx++;
          });
          break;
          
        case 'random':
          random.assign(graph, { scale: Math.max(300, Math.sqrt(nodeCount) * 25) });
          break;
          
        case 'force':
          // Simple force-directed layout
          const forceIterations = nodeCount <= 200 ? 100 : nodeCount <= 500 ? 50 : 30;
          forceSimple.assign(graph, {
            maxIterations: forceIterations,
            settings: {
              attraction: 0.001,
              repulsion: 0.1,
            },
          });
          break;
      }
    } catch (error) {
      console.error('Layout failed:', error);
      // Fallback to circular layout if algorithms fail
      let idx = 0;
      const radius = Math.max(100, Math.sqrt(nodeCount) * 15);
      graph.forEachNode((n) => {
        const angle = (2 * Math.PI * idx++) / Math.max(1, nodeCount);
        graph.mergeNodeAttributes(n, { 
          x: Math.cos(angle) * radius, 
          y: Math.sin(angle) * radius 
        });
      });
    }
  }, []);

  // Update node appearance based on states (hover, focus, connected)
  const updateNodeAppearance = useCallback((graph: MultiDirectedGraph) => {
    graph.forEachNode((nodeId) => {
      const nodeData = data.nodes.find(n => n.id === nodeId);
      const originalColor = getColorForCategory(nodeData?.category, nodeCategories);
      
      // Smaller base sizes to prevent overlap
      let size = Math.max(5, Math.min(10, (nodeData?.name.length || 5) * 0.3 + 5));
      let color = originalColor;
      let borderColor = 'transparent';
      let borderSize = 0;
      
      // Focus state (only on click, no hover effects)
      if (nodeId === focusedNodeId) {
        size *= 1.8;
        borderColor = '#6b7280';
        borderSize = 3;
        color = getLighterColor(originalColor);
      }
      // Connected to focused node
      else if (focusedNodeId && connectedNodes.has(nodeId)) {
        size *= 1.1;
        color = getLighterColor(originalColor);
      }
      // Dimmed state (when something is focused but this node isn't connected)
      else if (focusedNodeId && !connectedNodes.has(nodeId) && nodeId !== focusedNodeId) {
        color = originalColor + '60'; // Add transparency
      }
      
      graph.mergeNodeAttributes(nodeId, {
        size,
        color,
        borderColor,
        borderSize,
      });
    });
    
    // Collect edge data and rebuild graph with proper rendering order
    interface EdgeData {
      id: string;
      source: string;
      target: string;
      attributes: Record<string, unknown>;
    }
    
    const edgesByLayer: { 
      dimmed: EdgeData[], 
      normal: EdgeData[], 
      focused: EdgeData[] 
    } = {
      dimmed: [],
      normal: [],
      focused: []
    };
    
    // Collect all edges and categorize by layer
    graph.forEachEdge((edgeId, attributes, source, target) => {
      let color = '#e5e7eb';
      let size = 0.8;
      let layer: 'dimmed' | 'normal' | 'focused' = 'normal';
      
      // Determine edge appearance and layer (only for focused, no hover)
      if (focusedNodeId && (source === focusedNodeId || target === focusedNodeId)) {
        color = '#9ca3af';
        size = 1.5;
        layer = 'focused';
      } else if (focusedNodeId && !connectedNodes.has(source) && !connectedNodes.has(target)) {
        color = '#e5e7eb50';
        layer = 'dimmed';
      }
      
      const newAttributes = { ...attributes, color, size };
      edgesByLayer[layer].push({ id: edgeId, source, target, attributes: newAttributes });
    });
    
    // If there are focused or dimmed edges, rebuild the graph edges in proper order
    if (edgesByLayer.focused.length > 0 || edgesByLayer.dimmed.length > 0) {
      // Remove all edges
      const allEdges = [...edgesByLayer.dimmed, ...edgesByLayer.normal, ...edgesByLayer.focused];
      allEdges.forEach(edge => {
        if (graph.hasEdge(edge.id)) {
          graph.dropEdge(edge.id);
        }
      });
      
      // Add edges back in layered order (dimmed first, normal second, focused last)
      [...edgesByLayer.dimmed, ...edgesByLayer.normal, ...edgesByLayer.focused].forEach(edge => {
        try {
          graph.addDirectedEdgeWithKey(edge.id, edge.source, edge.target, edge.attributes);
        } catch {
          // Edge might already exist or have invalid nodes
        }
      });
    } else {
      // No special layering needed, just update attributes
      edgesByLayer.normal.forEach(edge => {
        if (graph.hasEdge(edge.id)) {
          graph.mergeEdgeAttributes(edge.id, edge.attributes);
        }
      });
    }
  }, [data.nodes, connectedNodes, focusedNodeId, nodeCategories]);

  useEffect(() => {
    const graph = new MultiDirectedGraph();

    // Add nodes with enhanced styling and smaller base sizes
    for (const node of data.nodes) {
      const baseSize = Math.max(5, Math.min(10, node.name.length * 0.3 + 5)); // Smaller sizes
      const baseColor = getColorForCategory(node.category, nodeCategories);
      
      if (!graph.hasNode(node.id)) {
        graph.addNode(node.id, {
          label: node.name,
          size: baseSize,
          color: baseColor,
          originalColor: baseColor,
          borderColor: 'transparent',
          borderSize: 0,
        });
      }
    }

    // Add edges with enhanced styling
    for (const edge of data.edges) {
      try {
        const edgeAttributes = {
          color: '#e5e7eb',
          size: 0.8, // Thinner edges by default
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

    const nodeCount = graph.order;
    
    // Apply initial layout
    applyLayout(graph, currentLayout || 'forceatlas2', nodeCount);

    loadGraph(graph);
  }, [data, loadGraph, nodeCategories, currentLayout, applyLayout]);
  
  
  // Apply layout when currentLayout changes
  useEffect(() => {
    const graph = sigma.getGraph();
    if (graph && graph.order > 0 && currentLayout) {
      applyLayout(graph, currentLayout, graph.order);
      sigma.refresh();
    }
  }, [currentLayout, sigma, applyLayout]);

  // Update connected nodes when focus changes (for hierarchy tab integration)
  useEffect(() => {
    if (focusedNodeId) {
      const graph = sigma.getGraph();
      if (graph) {
        setConnectedNodes(getConnectedNodes(graph, focusedNodeId));
      }
    } else {
      setConnectedNodes(new Set());
    }
  }, [focusedNodeId, sigma]);

  // Update appearance when focus state changes
  useEffect(() => {
    const graph = sigma.getGraph();
    if (graph) {
      updateNodeAppearance(graph);
      sigma.refresh();
    }
  }, [connectedNodes, focusedNodeId, sigma, updateNodeAppearance]);

  useEffect(() => {
    registerEvents({
      clickNode: ({ node }) => {
        if (onNodeClick) onNodeClick(String(node));
      },
      clickStage: () => {
        // Click away from any node - clear focus and refocus the canvas
        if (onNodeClick) {
          onNodeClick(''); // Send empty string to indicate canvas click
        }
      },
    });
  }, [registerEvents, onNodeClick]);

  useEffect(() => {
    if (!focusedNodeId) return;
    try {
      const display = sigma.getNodeDisplayData(focusedNodeId);
      if (display) {
        // Center without changing zoom level - preserve current ratio
        const currentCamera = sigma.getCamera().getState();
        sigma.getCamera().animate({ 
          x: display.x, 
          y: display.y, 
          ratio: currentCamera.ratio // Keep current zoom level
        }, { duration: 300 });
      }
    } catch {
      // no-op
    }
  }, [focusedNodeId, sigma]);

  return null;
}

export default function SigmaGraphInner({
  data,
  onNodeClick,
  focusedNodeId,
  nodeCategories,
}: {
  data: SigmaGraphInnerData;
  onNodeClick?: (nodeId: string) => void;
  focusedNodeId?: string | null;
  nodeCategories?: NodeCategories;
}) {
  const [currentLayout, setCurrentLayout] = useState<'forceatlas2' | 'circular' | 'grid' | 'random' | 'force'>('forceatlas2');
  
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
            <h3 className="text-base font-medium text-foreground">
              Graph Too Large
            </h3>
            <p className="text-sm text-muted-foreground">
              This graph has {nodeCount.toLocaleString()} nodes, which exceeds the 10,000 node limit for optimal performance.
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

      {/* Layout Controls - bottom right corner */}
      <div className="absolute bottom-3 right-3 z-10">
        <div className="flex items-center gap-2">
          <Select value={currentLayout} onValueChange={(value) => setCurrentLayout(value as typeof currentLayout)}>
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
              <SelectItem value="force" className="text-xs">
                <div className="flex items-center gap-2">
                  <Zap className="h-3 w-3" />
                  Force Directed
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <SigmaContainer
        style={sigmaContainerStyle}
        graph={MultiDirectedGraph}
        settings={{
          allowInvalidContainer: true,
          renderLabels: true,
          renderEdgeLabels: false,
          defaultNodeType: 'circle',
          defaultEdgeType: 'arrow',
          labelFont: 'Arial, sans-serif',
          labelSize: 12,
          labelWeight: '500',
          labelColor: { color: '#374151' },
          edgeLabelFont: 'Arial, sans-serif',
          edgeLabelSize: 10,
          minCameraRatio: 0.05,
          maxCameraRatio: 10,
          enableEdgeEvents: true,
          hideEdgesOnMove: true,
          hideLabelsOnMove: false,
          zIndex: true,
        }}
      >
        <LoadGraph 
          data={data} 
          onNodeClick={onNodeClick} 
          focusedNodeId={focusedNodeId} 
          nodeCategories={nodeCategories}
          currentLayout={currentLayout}
        />
      </SigmaContainer>
    </div>
  );
}
