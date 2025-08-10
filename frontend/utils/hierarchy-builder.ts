import type {
  CodeReference,
  GraphData,
  HierarchyNode,
  HierarchyTree,
} from '../types/code-analysis';

/**
 * Builds a hierarchical tree structure from graph data starting from a selected node
 */
export function buildHierarchyTree(
  selectedNode: CodeReference,
  graphData: GraphData,
  maxDepth: number = 3,
): HierarchyTree {
  const visitedNodes = new Set<string>();
  const relationshipTypes = new Set<string>();
  let totalNodes = 0;

  // Create the root node
  const rootNode: HierarchyNode = {
    id: selectedNode.id,
    name: selectedNode.name,
    file: selectedNode.file,
    code: selectedNode.code,
    category: selectedNode.category,
    start_line: selectedNode.start_line,
    end_line: selectedNode.end_line,
    depth: 0,
    children: [],
    isExpanded: true,
  };

  visitedNodes.add(selectedNode.id);
  totalNodes++;

  /**
   * Recursively builds the hierarchy by finding connected nodes
   */
  function buildChildren(currentNode: HierarchyNode, currentDepth: number): void {
    if (currentDepth >= maxDepth) return;

    // Find all edges connected to the current node
    const connectedEdges = graphData.edges.filter(
      (edge) =>
        (edge.source === currentNode.id || edge.target === currentNode.id) &&
        !visitedNodes.has(edge.source === currentNode.id ? edge.target : edge.source),
    );

    // Sort edges by relationship type for consistent ordering
    connectedEdges.sort((a, b) => (a.relationship || '').localeCompare(b.relationship || ''));

    for (const edge of connectedEdges) {
      const childNodeId = edge.source === currentNode.id ? edge.target : edge.source;
      const childGraphNode = graphData.nodes.find((n) => n.id === childNodeId);

      if (!childGraphNode || visitedNodes.has(childNodeId)) continue;

      visitedNodes.add(childNodeId);
      totalNodes++;

      // Track relationship types
      if (edge.relationship) {
        relationshipTypes.add(edge.relationship);
      }

      // Determine the relationship direction and type
      const isIncoming = edge.target === currentNode.id;
      const relationshipLabel = edge.relationship || (isIncoming ? 'calls' : 'called by');

      // Create child hierarchy node
      const childNode: HierarchyNode = {
        id: childGraphNode.id,
        name: childGraphNode.name,
        file: childGraphNode.file,
        code: childGraphNode.code,
        category: childGraphNode.category,
        start_line: childGraphNode.start_line,
        end_line: childGraphNode.end_line,
        depth: currentDepth + 1,
        relationship: relationshipLabel,
        children: [],
        isExpanded: currentDepth < 2, // Auto-expand first 2 levels
        parentId: currentNode.id,
      };

      currentNode.children.push(childNode);

      // Recursively build children for this node
      buildChildren(childNode, currentDepth + 1);
    }

    // Sort children by name for consistent display
    currentNode.children.sort((a, b) => a.name.localeCompare(b.name));
  }

  // Build the tree starting from root
  buildChildren(rootNode, 0);

  // Add parent relationships to the root node (allow overlap with children)
  const parentNodes: HierarchyNode[] = [];
  const incomingEdges = graphData.edges.filter(edge => edge.target === selectedNode.id);
  
  for (const edge of incomingEdges) {
    const parentGraphNode = graphData.nodes.find(n => n.id === edge.source);
    if (parentGraphNode) {
      parentNodes.push({
        id: parentGraphNode.id,
        name: parentGraphNode.name,
        file: parentGraphNode.file,
        code: parentGraphNode.code,
        category: parentGraphNode.category,
        start_line: parentGraphNode.start_line,
        end_line: parentGraphNode.end_line,
        depth: -1,
        relationship: edge.relationship || 'called by',
        children: [],
        isExpanded: false,
        parentId: selectedNode.id,
      });
    }
  }
  
  rootNode.parents = parentNodes;

  return {
    rootNode,
    totalNodes,
    maxDepth: Math.min(maxDepth, getActualMaxDepth(rootNode)),
    relationshipTypes: Array.from(relationshipTypes).sort(),
  };
}

/**
 * Gets the actual maximum depth of the built tree
 */
function getActualMaxDepth(node: HierarchyNode): number {
  if (node.children.length === 0) return node.depth;
  return Math.max(...node.children.map(getActualMaxDepth));
}

/**
 * Toggles the expanded state of a node in the hierarchy
 */
export function toggleNodeExpansion(tree: HierarchyTree, nodeId: string): HierarchyTree {
  function toggleInNode(node: HierarchyNode): HierarchyNode {
    if (node.id === nodeId) {
      return { ...node, isExpanded: !node.isExpanded };
    }
    return {
      ...node,
      children: node.children.map(toggleInNode),
    };
  }

  return {
    ...tree,
    rootNode: toggleInNode(tree.rootNode),
  };
}

/**
 * Expands all nodes up to a certain depth
 */
export function expandToDepth(tree: HierarchyTree, targetDepth: number): HierarchyTree {
  function expandNode(node: HierarchyNode): HierarchyNode {
    return {
      ...node,
      isExpanded: node.depth < targetDepth,
      children: node.children.map(expandNode),
    };
  }

  return {
    ...tree,
    rootNode: expandNode(tree.rootNode),
  };
}

/**
 * Collapses all nodes except the root
 */
export function collapseAll(tree: HierarchyTree): HierarchyTree {
  function collapseNode(node: HierarchyNode): HierarchyNode {
    return {
      ...node,
      isExpanded: node.depth === 0, // Only keep root expanded
      children: node.children.map(collapseNode),
    };
  }

  return {
    ...tree,
    rootNode: collapseNode(tree.rootNode),
  };
}

/**
 * Expands all nodes in the tree
 */
export function expandAll(tree: HierarchyTree): HierarchyTree {
  function expandNode(node: HierarchyNode): HierarchyNode {
    return {
      ...node,
      isExpanded: true,
      children: node.children.map(expandNode),
    };
  }

  return {
    ...tree,
    rootNode: expandNode(tree.rootNode),
  };
}

/**
 * Finds a node in the hierarchy by its ID
 */
export function findNodeInTree(tree: HierarchyTree, nodeId: string): HierarchyNode | null {
  function searchNode(node: HierarchyNode): HierarchyNode | null {
    if (node.id === nodeId) return node;
    for (const child of node.children) {
      const found = searchNode(child);
      if (found) return found;
    }
    return null;
  }
  return searchNode(tree.rootNode);
}

/**
 * Gets all visible nodes (considering expanded state) for rendering
 */
export function getVisibleNodes(tree: HierarchyTree): HierarchyNode[] {
  const visibleNodes: HierarchyNode[] = [];

  function collectVisible(node: HierarchyNode): void {
    visibleNodes.push(node);
    if (node.isExpanded) {
      node.children.forEach(collectVisible);
    }
  }

  collectVisible(tree.rootNode);
  return visibleNodes;
}

/**
 * Calculates statistics for the hierarchy tree
 */
export function getHierarchyStats(tree: HierarchyTree) {
  const stats = {
    totalNodes: tree.totalNodes,
    visibleNodes: getVisibleNodes(tree).length,
    maxDepth: tree.maxDepth,
    relationshipTypes: tree.relationshipTypes,
    nodesByDepth: {} as Record<number, number>,
    nodesByCategory: {} as Record<string, number>,
  };

  function analyzeNode(node: HierarchyNode): void {
    // Count by depth
    stats.nodesByDepth[node.depth] = (stats.nodesByDepth[node.depth] || 0) + 1;
    
    // Count by category
    stats.nodesByCategory[node.category] = (stats.nodesByCategory[node.category] || 0) + 1;
    
    // Analyze children
    node.children.forEach(analyzeNode);
  }

  analyzeNode(tree.rootNode);
  return stats;
}