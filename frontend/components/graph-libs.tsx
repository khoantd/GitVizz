"use client";

import { useEffect, useRef, useState } from 'react';
import { useThemeGraph } from './use-theme-graph';
import Graph from 'graphology';
import Sigma from 'sigma';
import { circular } from 'graphology-layout';
import forceAtlas2 from 'graphology-layout-forceatlas2';
import PropertiesView from './PropertiesView';
import Legend from './Legend';
import GraphControls from './GraphControls';

interface GraphNode {
  id: string;
  label: string;
  type: string;
}

interface GraphEdge {
  source: string;
  target: string;
  type: string;
}

interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

interface GraphLibsProps {
  graphData: GraphData;
}

export default function GraphLibs({ graphData }: GraphLibsProps) {
  const theme = useThemeGraph();
  const containerRef = useRef<HTMLDivElement>(null);
  const sigmaRef = useRef<any>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null);
  const [showLegend, setShowLegend] = useState<boolean>(true);

  useEffect(() => {
    if (!containerRef.current || !graphData) return;

    // Theme-based colors
    const classColor = theme === 'dark' ? '#F06292' : '#E91E63';
    const functionColor = theme === 'dark' ? '#64B5F6' : '#2196F3';
    const otherColor = theme === 'dark' ? '#FFD54F' : '#FFC107';
    const edgeColor = theme === 'dark' ? '#BBB' : '#999';
    const labelColor = theme === 'dark' ? '#FFFFFF' : '#000000';
    const backgroundColor = theme === 'dark' ? '#1a1a1a' : '#FFFFFF';
    const highlightColor = theme === 'dark' ? '#FFFFFF' : '#000000';
    const highlightEdgeColor = theme === 'dark' ? '#FFFFFF' : '#000000';

    // Clean up any existing sigma instance
    if (sigmaRef.current) {
      sigmaRef.current.kill();
      sigmaRef.current = null;
    }
    
    console.log('Graph data:', {
      nodes: graphData.nodes.length,
      edges: graphData.edges.length
    });

    try {
      // Create a new graph
      const graph = new Graph();

      // Temporary storage for duplicate detection
      const processedNodeIds = new Set<string>();
      
      // Add nodes with validation
      graphData.nodes.forEach((node) => {
        // Skip nodes without valid IDs
        if (!node.id || typeof node.id !== 'string') {
          console.warn('Skipping node with invalid ID:', node);
          return;
        }
        
        // Skip duplicate nodes
        if (processedNodeIds.has(node.id)) {
          console.warn('Skipping duplicate node ID:', node.id);
          return;
        }
        
        processedNodeIds.add(node.id);
        
        // We'll use circles for all nodes, but differentiate with color and size
        
        try {
          const nodeSize = node.type === 'class' ? 8 : 
                          node.type === 'function' ? 5 : 3;
          const classColor = theme === 'dark' ? '#F06292' : '#E91E63';
          const functionColor = theme === 'dark' ? '#64B5F6' : '#2196F3';
          const otherColor = theme === 'dark' ? '#FFD54F' : '#FFC107';
          const nodeType = node.type || 'other';
          graph.addNode(node.id, {
            label: node.label || node.id,
            size: nodeSize,
            color: node.type === 'class' ? classColor : 
                   node.type === 'function' ? functionColor : otherColor,
            x: Math.random(),
            y: Math.random(),
            type: 'circle', // Always use circle type which is supported by default
            nodeType: nodeType, // Store the node type for details panel
            labelColor: labelColor // Set label color based on theme
          });
        } catch (error) {
          console.error(`Error adding node ${node.id}:`, error);
        }
      });

      // Add edges with validation
      graphData.edges.forEach((edge) => {
        if (!edge.source || !edge.target) {
          console.warn('Skipping edge with invalid source or target:', edge);
          return;
        }
        
        // Make sure source and target are strings and nodes exist
        const source = String(edge.source);
        const target = String(edge.target);
        
        // Check if both nodes exist and source !== target
        if (graph.hasNode(source) && 
            graph.hasNode(target) && 
            source !== target) {
          try {
            // Check if edge already exists to avoid duplicate errors
            if (!graph.hasEdge(source, target)) {
              const edgeColor = theme === 'dark' ? '#BBB' : '#999';
graph.addEdge(source, target, {
                label: '', // No label for edge type
                size: 1,
                color: edgeColor
              });
            }
          } catch (error) {
            console.warn(`Failed to add edge from ${source} to ${target}:`, error);
          }
        } else {
          console.warn(`Cannot add edge from ${source} to ${target}: one or both nodes do not exist in the graph or they are the same node`);
        }
      });

      // Apply layout
      circular.assign(graph);

      // Add a legend to help identify node types
      const legend = document.createElement('div');
      legend.style.position = 'absolute';
      legend.style.bottom = '10px';
      legend.style.left = '10px';
      legend.style.background = theme === 'dark' ? '#333' : 'white';
legend.style.padding = '10px';
legend.style.borderRadius = '5px';
legend.style.boxShadow = theme === 'dark' ? '0 0 10px rgba(255,255,255,0.1)' : '0 0 10px rgba(0,0,0,0.1)';
legend.style.zIndex = '1000';
legend.style.color = theme === 'dark' ? '#EEE' : '#222';
legend.innerHTML = `
  <div style="margin-bottom: 5px; font-weight: bold; color: inherit">Node Types:</div>
  <div style="display: flex; align-items: center; margin-bottom: 5px">
    <div style="width: 12px; height: 12px; border-radius: 50%; background: ${classColor}; margin-right: 5px"></div>
    <div style="color: inherit">Class</div>
  </div>
  <div style="display: flex; align-items: center; margin-bottom: 5px">
    <div style="width: 12px; height: 12px; border-radius: 50%; background: ${functionColor}; margin-right: 5px"></div>
    <div style="color: inherit">Function</div>
  </div>
  <div style="display: flex; align-items: center">
    <div style="width: 12px; height: 12px; border-radius: 50%; background: ${otherColor}; margin-right: 5px"></div>
    <div style="color: inherit">Other</div>
  </div>
`;
      
      // Only add legend if it doesn't already exist
      if (containerRef.current) {
        // Set container background based on theme
        containerRef.current.style.background = backgroundColor;
        const existingLegend = containerRef.current.querySelector('div[data-legend="true"]');
        if (!existingLegend) {
          legend.setAttribute('data-legend', 'true');
          containerRef.current.appendChild(legend);
        }
      }

      // We'll use React components for details panel instead of DOM manipulation

      // Create the sigma instance with custom node rendering
      sigmaRef.current = new Sigma(graph, containerRef.current, {
        renderEdgeLabels: true,
        allowInvalidContainer: true,
        labelSize: 14,
        defaultNodeColor: classColor,
        defaultEdgeColor: edgeColor,
        defaultNodeType: "circle", // Use circle as default
        labelDensity: 0.07,
        labelGridCellSize: 60,
        labelRenderedSizeThreshold: 6,
        renderLabels: true,
        labelColor: { color: labelColor }, // Use theme-based label color
        // Custom node reducer for highlighting and styling
        nodeReducer: (node, data) => {
          const isSelected = selectedNode === node;
          const isHovered = hoveredNode === node;
          
          // Create a properly typed result object
          const result: any = {
            ...data,
            type: 'circle', // Always use circle
            labelColor: { color: labelColor } // Apply theme-based label color
          };
          
          // Apply highlighting for selected or hovered nodes
          if (isSelected || isHovered) {
            result.highlighted = true;
            result.color = data.color; // Keep original color
            result.size = data.size * 1.5; // Increase size
            result.borderColor = highlightColor; // Add border
            result.borderWidth = 2; // Border width
          }
          
          // If a node is selected, highlight its neighbors too
          if (selectedNode && !isSelected && !isHovered) {
            try {
              const neighbors = graph.neighbors(selectedNode);
              if (neighbors.includes(node)) {
                result.color = data.color; // Keep original color
                result.borderColor = highlightColor; // Add border
                result.borderWidth = 1; // Thinner border for neighbors
              } else {
                // Dim non-connected nodes
                result.color = theme === 'dark' ? '#555555' : '#DDDDDD';
              }
            } catch (error) {
              console.error('Error in nodeReducer:', error);
            }
          }
          
          return result;
        },
        // Custom edge reducer for highlighting connections
        edgeReducer: (edge, data) => {
          // Create a properly typed result object
          const result: any = { ...data };
          
          // If a node is selected, highlight its edges
          if (selectedNode) {
            try {
              const edgeExtremities = graph.extremities(edge);
              if (edgeExtremities.includes(selectedNode)) {
                result.color = highlightEdgeColor;
                result.size = 2;
              } else {
                // Dim other edges
                result.color = theme === 'dark' ? '#333333' : '#EEEEEE';
              }
            } catch (error) {
              console.error('Error in edgeReducer:', error);
            }
          }
          
          // If an edge is selected, highlight it
          if (selectedEdge === edge) {
            result.color = highlightEdgeColor;
            result.size = 3;
          }
          
          return result;
        }
      });
      
      // Add event handlers for node and edge interactions
      sigmaRef.current.on('clickNode', ({ node }: { node: string }) => {
        setSelectedNode(prevNode => prevNode === node ? null : node);
        setSelectedEdge(null);
      });
      
      sigmaRef.current.on('enterNode', ({ node }: { node: string }) => {
        setHoveredNode(node);
      });
      
      sigmaRef.current.on('leaveNode', () => {
        setHoveredNode(null);
      });
      
      sigmaRef.current.on('clickEdge', ({ edge }: { edge: string }) => {
        setSelectedEdge(prevEdge => prevEdge === edge ? null : edge);
        setSelectedNode(null);
      });
      
      sigmaRef.current.on('clickStage', () => {
        setSelectedNode(null);
        setSelectedEdge(null);
      });

      // Run ForceAtlas2 for a better layout
      forceAtlas2.assign(graph, {
        iterations: 100,
        settings: {
          gravity: 1.5,
          scalingRatio: 8,
          strongGravityMode: true,
          slowDown: 5,
          barnesHutOptimize: true,
          barnesHutTheta: 0.5
        }
      });
      
      // Add event listeners for better interaction
      const camera = sigmaRef.current.getCamera();
      
      // Zoom to fit the graph
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

  // Handle zoom controls
  const handleZoomIn = () => {
    if (sigmaRef.current) {
      const camera = sigmaRef.current.getCamera();
      const ratio = camera.ratio;
      camera.animate({ ratio: ratio / 1.5 }, { duration: 200 });
    }
  };
  
  const handleZoomOut = () => {
    if (sigmaRef.current) {
      const camera = sigmaRef.current.getCamera();
      const ratio = camera.ratio;
      camera.animate({ ratio: ratio * 1.5 }, { duration: 200 });
    }
  };
  
  const handleResetZoom = () => {
    if (sigmaRef.current) {
      sigmaRef.current.getCamera().animate({ x: 0.5, y: 0.5, ratio: 1 }, { duration: 300 });
    }
  };
  
  const toggleLegend = () => {
    setShowLegend(!showLegend);
  };

  return (
    <div className="relative w-full h-[600px]">
      <div 
        ref={containerRef} 
        className="w-full h-full bg-background border border-border rounded-md"
      />
      
      {/* Properties panel for selected node/edge */}
      {(selectedNode || selectedEdge) && (
        <div className="absolute top-4 right-4 z-10">
          <PropertiesView 
            nodeId={selectedNode} 
            edgeId={selectedEdge}
            graph={sigmaRef.current?.getGraph()} 
          />
        </div>
      )}
      
      {/* Legend */}
      {showLegend && (
        <div className="absolute bottom-4 right-4 z-10">
          <Legend />
        </div>
      )}
      
      {/* Graph controls */}
      <GraphControls 
        sigma={sigmaRef.current}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onResetZoom={handleResetZoom}
        onToggleLegend={toggleLegend}
      />
    </div>
  );
}
