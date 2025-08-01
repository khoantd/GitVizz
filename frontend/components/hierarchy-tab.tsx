'use client';

import { useState, useMemo, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  ChevronRight,
  ChevronDown,
  FileText,
  Code,
  ExternalLink,
  ExpandIcon,
  ShrinkIcon,
  TreePine,
  GitBranch,
  Layers,
  ActivityIcon as Function,
  Variable,
  Package,
  Network,
} from 'lucide-react';
import {
  buildHierarchyTree,
  toggleNodeExpansion,
  expandToDepth,
  expandAll,
  collapseAll,
  getVisibleNodes,
  getHierarchyStats,
} from '@/utils/hierarchy-builder';
import type { HierarchyTabProps, HierarchyNode, HierarchyTree } from '@/types/code-analysis';

// Icon mapping for different node categories
const categoryIcons = {
  function: Function,
  class: Layers,
  method: Code,
  variable: Variable,
  import: Package,
  export: Package,
  file: FileText,
  other: Network,
} as const;

// Color mapping for different node categories
const categoryColors = {
  function: '#F06292',
  class: '#64B5F6',
  method: '#81C784',
  variable: '#FFD54F',
  import: '#BA68C8',
  export: '#FF8A65',
  file: '#90A4AE',
  other: '#A1887F',
} as const;

interface HierarchyNodeComponentProps {
  node: HierarchyNode;
  tree: HierarchyTree;
  onToggleExpansion: (nodeId: string) => void;
  onOpenFile: (filePath: string, line?: number) => void;
  level: number;
}

function HierarchyNodeComponent({
  node,
  tree,
  onToggleExpansion,
  onOpenFile,
  level,
}: HierarchyNodeComponentProps) {
  const [showFullCode, setShowFullCode] = useState(false);
  const hasChildren = node.children.length > 0;
  const IconComponent = categoryIcons[node.category.toLowerCase() as keyof typeof categoryIcons] || Network;
  const nodeColor = categoryColors[node.category.toLowerCase() as keyof typeof categoryColors] || '#A1887F';

  const handleGoToEditor = useCallback(() => {
    onOpenFile(node.file, node.start_line);
  }, [node.file, node.start_line, onOpenFile]);

  const formatCode = (code: string, maxLines: number = 3) => {
    if (!code) return { preview: '', hasMore: false, totalLines: 0 };
    
    // Split into lines and filter out empty lines while preserving indentation
    const lines = code.split('\n').filter(line => line.trim().length > 0);
    
    // Find minimum indentation to normalize
    const nonEmptyLines = lines.filter(line => line.trim());
    const minIndent = nonEmptyLines.length > 0 ? 
      Math.min(...nonEmptyLines.map(line => line.match(/^\s*/)?.[0].length || 0)) : 0;
    
    // Normalize indentation and limit lines
    const normalizedLines = lines.map(line => line.slice(minIndent));
    const displayLines = normalizedLines.slice(0, maxLines);
    
    return {
      preview: displayLines.join('\n'),
      hasMore: normalizedLines.length > maxLines,
      totalLines: normalizedLines.length
    };
  };

  return (
    <div className={`${level > 0 ? 'ml-4 border-l border-border/30 pl-4' : ''} space-y-2`}>
      <Collapsible open={node.isExpanded} onOpenChange={() => hasChildren && onToggleExpansion(node.id)}>
        <div className="group relative">
          <div className="flex items-start gap-3 p-3 rounded-xl bg-background/50 hover:bg-background/80 transition-all duration-200 border border-border/30 hover:border-border/60">
            {/* Expansion toggle */}
            <div className="flex-shrink-0 pt-0.5">
              {hasChildren ? (
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 p-0 hover:bg-muted/50 rounded-lg"
                  >
                    {node.isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </CollapsibleTrigger>
              ) : (
                <div className="h-6 w-6 flex items-center justify-center">
                  <div className="h-2 w-2 rounded-full bg-border/40" />
                </div>
              )}
            </div>

            {/* Node content */}
            <div className="flex-1 min-w-0 space-y-2">
              {/* Node header */}
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: nodeColor }}
                />
                <IconComponent className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-medium text-foreground truncate">{node.name}</span>
                    <Badge variant="outline" className="text-xs px-2 py-0.5 rounded-full flex-shrink-0">
                      {node.category}
                    </Badge>
                  </div>
                  {/* Relationship and file info */}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                    {node.relationship && (
                      <>
                        <span className="flex-shrink-0">{node.relationship}</span>
                        <span className="flex-shrink-0">•</span>
                      </>
                    )}
                    <span className="truncate">{node.file.split('/').pop()}</span>
                    {node.start_line && (
                      <>
                        <span className="flex-shrink-0">•</span>
                        <span className="flex-shrink-0">L{node.start_line}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Code preview */}
              {node.code && (
                <div className="bg-muted/30 rounded-lg p-3">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="text-xs font-medium text-muted-foreground">Code Preview</span>
                    {formatCode(node.code).hasMore && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowFullCode(!showFullCode)}
                        className="h-5 px-2 text-xs rounded-md hover:bg-muted/50"
                      >
                        {showFullCode ? 'Show Less' : `Show All ${formatCode(node.code).totalLines} lines`}
                      </Button>
                    )}
                  </div>
                  <pre className="text-xs text-muted-foreground font-mono leading-relaxed whitespace-pre-wrap overflow-x-auto">
                    <code>
                      {showFullCode ? node.code.trim() : formatCode(node.code).preview}
                    </code>
                  </pre>
                </div>
              )}

              {/* Children count */}
              {hasChildren && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <GitBranch className="h-3 w-3" />
                  <span>{node.children.length} connected {node.children.length === 1 ? 'node' : 'nodes'}</span>
                </div>
              )}
            </div>

            {/* Go to Editor button */}
            <div className="flex-shrink-0">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleGoToEditor}
                      className="h-8 w-8 p-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Go to Editor</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </div>

        {/* Children */}
        {hasChildren && (
          <CollapsibleContent className="space-y-2">
            {node.children.map((child) => (
              <HierarchyNodeComponent
                key={child.id}
                node={child}
                tree={tree}
                onToggleExpansion={onToggleExpansion}
                onOpenFile={onOpenFile}
                level={level + 1}
              />
            ))}
          </CollapsibleContent>
        )}
      </Collapsible>
    </div>
  );
}

export function HierarchyTab({ selectedNode, graphData, maxDepth, onDepthChange, onOpenFile }: HierarchyTabProps) {
  const [currentDepth, setCurrentDepth] = useState(maxDepth);

  // Build hierarchy tree
  const hierarchyTree = useMemo(() => {
    return buildHierarchyTree(selectedNode, graphData, currentDepth);
  }, [selectedNode, graphData, currentDepth]);

  const [tree, setTree] = useState<HierarchyTree>(hierarchyTree);

  // Update tree when hierarchy changes
  useMemo(() => {
    setTree(hierarchyTree);
  }, [hierarchyTree]);

  const stats = useMemo(() => getHierarchyStats(tree), [tree]);
  const visibleNodes = useMemo(() => getVisibleNodes(tree), [tree]);

  const handleDepthChange = useCallback((value: number[]) => {
    const newDepth = value[0];
    setCurrentDepth(newDepth);
    onDepthChange(newDepth);
  }, [onDepthChange]);

  const handleToggleExpansion = useCallback((nodeId: string) => {
    setTree((prevTree) => toggleNodeExpansion(prevTree, nodeId));
  }, []);

  const handleExpandAll = useCallback(() => {
    setTree((prevTree) => expandAll(prevTree));
  }, []);

  const handleCollapseAll = useCallback(() => {
    setTree((prevTree) => collapseAll(prevTree));
  }, []);

  const handleExpandToDepth = useCallback((depth: number) => {
    setTree((prevTree) => expandToDepth(prevTree, depth));
  }, []);

  if (!selectedNode) {
    return (
      <div className="flex-1 flex items-center justify-center p-4 sm:p-8 min-h-[200px]">
        <div className="text-center space-y-4 max-w-xs">
          <div className="w-10 h-10 sm:w-12 sm:h-12 mx-auto rounded-xl bg-muted/30 flex items-center justify-center">
            <TreePine className="h-5 w-5 sm:h-6 sm:w-6 text-muted-foreground/50" />
          </div>
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-foreground">Select a Node</h3>
            <p className="text-xs text-muted-foreground">
              Click on any node in the graph to view its hierarchical relationships
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header with Controls - Fixed */}
      <div className="flex-shrink-0 p-3 sm:p-4 border-b border-border/20 bg-background/50 backdrop-blur-sm space-y-4">
        {/* Node Info and Stats */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-primary flex-shrink-0" />
            <h3 className="text-xs sm:text-sm font-semibold text-foreground truncate">
              {selectedNode.name}
            </h3>
            <Badge variant="outline" className="text-xs px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-full flex-shrink-0">
              {selectedNode.category}
            </Badge>
          </div>

          <div className="flex items-center gap-2 sm:gap-4 text-xs text-muted-foreground overflow-x-auto">
            <div className="flex items-center gap-1 flex-shrink-0">
              <TreePine className="w-3 h-3" />
              <span>{stats.totalNodes} nodes</span>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <GitBranch className="w-3 h-3" />
              <span>{visibleNodes.length} visible</span>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <Layers className="w-3 h-3" />
              <span>Depth: {stats.maxDepth}</span>
            </div>
          </div>
        </div>

        {/* Depth Control */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs sm:text-sm font-medium text-foreground">
              Hierarchy Depth
            </label>
            <span className="text-xs text-muted-foreground">
              {currentDepth} level{currentDepth !== 1 ? 's' : ''}
            </span>
          </div>
          <Slider
            value={[currentDepth]}
            onValueChange={handleDepthChange}
            min={1}
            max={5}
            step={1}
            className="w-full"
          />
        </div>

        {/* Tree Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExpandAll}
            className="flex-1 text-xs h-8 rounded-lg"
          >
            <ExpandIcon className="w-3 h-3 mr-1.5" />
            Expand All
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCollapseAll}
            className="flex-1 text-xs h-8 rounded-lg"
          >
            <ShrinkIcon className="w-3 h-3 mr-1.5" />
            Collapse All
          </Button>
        </div>

        {/* Quick Depth Buttons */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground flex-shrink-0">Quick expand:</span>
          {[1, 2, 3].map((depth) => (
            <Button
              key={depth}
              variant={currentDepth >= depth ? "default" : "outline"}
              size="sm"
              onClick={() => handleExpandToDepth(depth)}
              className="h-6 w-6 p-0 text-xs rounded-md"
            >
              {depth}
            </Button>
          ))}
        </div>
      </div>

      {/* Hierarchy Tree - Scrollable */}
      <div className="flex-1 min-h-0">
        <ScrollArea className="h-full">
          <div className="p-3 sm:p-4">
            {tree.totalNodes > 0 ? (
              <HierarchyNodeComponent
                node={tree.rootNode}
                tree={tree}
                onToggleExpansion={handleToggleExpansion}
                onOpenFile={onOpenFile}
                level={0}
              />
            ) : (
              <div className="text-center py-6 sm:py-8">
                <div className="w-10 h-10 sm:w-12 sm:h-12 mx-auto rounded-xl bg-muted/30 flex items-center justify-center mb-3 sm:mb-4">
                  <TreePine className="h-5 w-5 sm:h-6 sm:w-6 text-muted-foreground/50" />
                </div>
                <h3 className="text-sm font-medium text-foreground mb-2">No Hierarchy Available</h3>
                <p className="text-xs text-muted-foreground px-4">
                  This node doesn&apos;t have any connected relationships in the graph
                </p>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}