"use client"

import { useEffect, useState, useMemo, useCallback, useRef, memo } from "react"
import dynamic from "next/dynamic"
import { generateGraphFromGithub, generateGraphFromZip } from "@/utils/api"
import { GraphResponse, GraphNode as ApiGraphNode, GraphEdge as ApiGraphEdge } from "@/api-client/types.gen"
import { useResultData } from "@/context/ResultDataContext"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Network, FileText, Code, ActivityIcon as Function, Variable, Package, Layers, Info, Eye, EyeOff, MapIcon, Menu, X } from 'lucide-react'

// Properly import GraphCanvas with Next.js SSR handling
const GraphCanvas = dynamic(() => import("reagraph").then((mod) => mod.GraphCanvas), {
  ssr: false,
  loading: () => <GraphLoadingComponent />,
})

// Memoized loading component
const GraphLoadingComponent = memo(() => (
  <div className="flex justify-center items-center h-full">
    <div className="flex flex-col items-center gap-4 p-8">
      <div className="w-8 h-8 sm:w-12 sm:h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
      <div className="text-center space-y-2">
        <p className="text-xs sm:text-sm font-medium text-foreground">Loading Graph</p>
        <p className="text-xs text-muted-foreground">Analyzing code structure...</p>
      </div>
    </div>
  </div>
))
GraphLoadingComponent.displayName = "GraphLoadingComponent"

// Extend the API types to include the missing `line` property for backward compatibility
interface GraphNode extends ApiGraphNode {
  line: number // Map from start_line for backward compatibility
}

type GraphEdge = ApiGraphEdge

interface ApiResponse {
  html_url: string
  nodes: GraphNode[]
  edges: GraphEdge[]
}

// Define the source data types more explicitly
interface GitHubSourceData {
  repo_url: string
  access_token?: string
  branch?: string
}

type SourceData = GitHubSourceData | File

interface ReagraphVisualizationProps {
  setParentActiveTab: (tab: string) => void
  onError?: (error: string) => void
  onNodeClick?: (node: GraphNode) => void
}

// Define reagraph node and edge types
interface ReagraphNode {
  id: string
  label: string
  fill: string
  size: number
}

interface ReagraphEdge {
  id: string
  source: string
  target: string
  label?: string
}

interface ReagraphData {
  nodes: ReagraphNode[]
  edges: ReagraphEdge[]
}

// Define the category configuration type
interface CategoryConfig {
  color: string
  icon: typeof Network
  label: string
  description: string
}

type NodeCategories = Record<string, CategoryConfig>

// Cache interface for storing API responses
interface CacheEntry {
  data: ApiResponse
  timestamp: number
}

// In-memory cache (will be reset on page refresh)
const apiCache = new Map<string, CacheEntry>()

// Cache duration - you can adjust this as needed (e.g., 5 minutes)
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes in milliseconds

// Stable color palette and icon list (moved outside component to prevent recreation)
const COLOR_PALETTE = [
  "#F06292",
  "#64B5F6",
  "#81C784",
  "#FFD54F",
  "#BA68C8",
  "#FF8A65",
  "#90A4AE",
  "#A1887F",
  "#4DB6AC",
  "#9575CD",
]
const ICON_LIST = [Layers, Function, Code, Variable, Package, FileText, Network]

// Dynamically generate node categories from graph data - MEMOIZED
const getDynamicNodeCategories = (() => {
  const cache = new Map<string, NodeCategories>()

  return (nodes: GraphNode[] = []): NodeCategories => {
    // Create a cache key based on node categories
    const cacheKey = nodes
      .map((n) => n.category || "other")
      .sort()
      .join(",")

    if (cache.has(cacheKey)) {
      return cache.get(cacheKey)!
    }

    const categories: NodeCategories = {}
    let colorIdx = 0
    let iconIdx = 0

    for (const node of nodes) {
      const key = node.category?.toLowerCase() || "other"
      if (!categories[key]) {
        categories[key] = {
          color: COLOR_PALETTE[colorIdx % COLOR_PALETTE.length],
          icon: ICON_LIST[iconIdx % ICON_LIST.length],
          label: key.charAt(0).toUpperCase() + key.slice(1),
          description: `Nodes of type "${key}"`,
        }
        colorIdx++
        iconIdx++
      }
    }

    // Always include a default/other category for fallback
    if (!categories["other"]) {
      categories["other"] = {
        color: "#90A4AE",
        icon: Network,
        label: "Other",
        description: "Other code elements",
      }
    }

    cache.set(cacheKey, categories)
    return categories
  }
})()

// Transform API response to include backward compatibility - MEMOIZED
const transformApiResponseMemo = (() => {
  const cache = new WeakMap<GraphResponse, ApiResponse>()

  return (response: GraphResponse): ApiResponse => {
    if (cache.has(response)) {
      return cache.get(response)!
    }

    const transformedNodes: GraphNode[] = response.nodes.map((node) => ({
      ...node,
      line: node.start_line || 0, // Map start_line to line for backward compatibility
    }))

    const result = {
      html_url: response.html_url,
      nodes: transformedNodes,
      edges: response.edges,
    }

    cache.set(response, result)
    return result
  }
})()

// Helper function to check if cache entry is valid
function isCacheValid(entry: CacheEntry): boolean {
  return Date.now() - entry.timestamp < CACHE_DURATION
}

// Memoized sidebar content components
const OverviewTab = memo(
  ({ categoryData }: { categoryData: Array<{ key: string; config: CategoryConfig; count: number }> }) => (
    <div className="h-full overflow-hidden">
      <ScrollArea className="h-full">
        <div className="p-3 sm:p-4 space-y-4 sm:space-y-6">
          {/* Legend - No Statistics */}
          <div className="space-y-3">
            <h3 className="text-xs sm:text-sm font-semibold text-foreground">Node Types</h3>
            <div className="space-y-2">
              {categoryData.map(({ key, config, count }) => {
                const Icon = config.icon
                return (
                  <div
                    key={key}
                    className="flex items-center gap-2 sm:gap-3 p-2 rounded-lg sm:rounded-xl hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div
                        className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: config.color }}
                      />
                      <Icon className="w-3 h-3 sm:w-4 sm:h-4 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs sm:text-sm font-medium text-foreground truncate">{config.label}</p>
                        <p className="text-xs text-muted-foreground truncate">{config.description}</p>
                      </div>
                    </div>
                    {count > 0 && (
                      <Badge variant="secondary" className="text-xs px-1.5 py-0.5 rounded-full flex-shrink-0">
                        {count}
                      </Badge>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Instructions */}
          <div className="space-y-3">
            <h3 className="text-xs sm:text-sm font-semibold text-foreground">Interaction</h3>
            <div className="space-y-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-primary flex-shrink-0"></div>
                <span>Click nodes to view details</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-primary flex-shrink-0"></div>
                <span>Drag to pan the graph</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-primary flex-shrink-0"></div>
                <span>Scroll to zoom in/out</span>
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  ),
)
OverviewTab.displayName = "OverviewTab"

const DetailsTab = memo(
  ({
    selectedNode,
    getNodeColor,
    onOpenInExplorer,
  }: {
    selectedNode: GraphNode | null
    getNodeColor: (category: string) => string
    onOpenInExplorer: (node: GraphNode) => void
  }) => (
    <div className="h-full overflow-hidden">
      <ScrollArea className="h-full">
        <div className="p-3 sm:p-4">
          {selectedNode ? (
            <div className="space-y-4">
              {/* Node Header */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-3 h-3 sm:w-4 sm:h-4 rounded-full flex-shrink-0"
                    style={{
                      backgroundColor: getNodeColor(selectedNode.category),
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm sm:text-base font-semibold text-foreground truncate">
                      {selectedNode.name}
                    </h3>
                    <p className="text-xs sm:text-sm text-muted-foreground capitalize">{selectedNode.category}</p>
                  </div>
                </div>
              </div>

              {/* Node Details */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <h4 className="text-xs sm:text-sm font-medium text-foreground">File Location</h4>
                  <div className="bg-muted/30 rounded-lg sm:rounded-xl p-3">
                    <div className="flex items-center gap-2 text-sm">
                      <FileText className="w-3 h-3 sm:w-4 sm:h-4 text-muted-foreground flex-shrink-0" />
                      <span className="font-mono text-xs truncate">{selectedNode.file || "Unknown"}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm mt-1">
                      <span className="text-muted-foreground text-xs">Line:</span>
                      <span className="font-mono text-xs">{selectedNode.line}</span>
                    </div>
                  </div>
                </div>

                {selectedNode.code && (
                  <div className="space-y-2">
                    <h4 className="text-xs sm:text-sm font-medium text-foreground">Code Preview</h4>
                    <div className="bg-muted/30 rounded-lg sm:rounded-xl p-3">
                      <pre className="text-xs font-mono text-foreground/80 whitespace-pre-wrap overflow-hidden">
                        {selectedNode.code.length > 200
                          ? selectedNode.code.substring(0, 200) + "..."
                          : selectedNode.code}
                      </pre>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="space-y-2">
                  <Button
                    variant="outline"
                    className="w-full rounded-lg sm:rounded-xl text-xs sm:text-sm"
                    onClick={() => onOpenInExplorer(selectedNode)}
                  >
                    <FileText className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
                    Open in Explorer
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center space-y-4 py-8">
              <div className="w-10 h-10 sm:w-12 sm:h-12 mx-auto rounded-xl sm:rounded-2xl bg-muted/50 flex items-center justify-center">
                <Info className="h-5 w-5 sm:h-6 sm:w-6 text-muted-foreground/50" />
              </div>
              <div className="space-y-2">
                <h3 className="text-sm sm:text-base font-medium text-foreground">Select a Node</h3>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Click on any node in the graph to view its details
                </p>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  ),
)
DetailsTab.displayName = "DetailsTab"

const MapTab = memo(() => (
  <div className="p-3 sm:p-4 h-full overflow-hidden">
    <div className="space-y-4 h-full flex flex-col">
      <h3 className="text-xs sm:text-sm font-semibold text-foreground">Graph Overview</h3>

      {/* Minimap Container */}
      <div className="flex-1 bg-muted/20 rounded-xl sm:rounded-2xl border border-border/30 flex items-center justify-center min-h-0">
        <div className="text-center space-y-3 p-4">
          <div className="w-12 h-12 sm:w-16 sm:h-16 mx-auto rounded-xl sm:rounded-2xl bg-muted/50 flex items-center justify-center">
            <MapIcon className="h-6 w-6 sm:h-8 sm:w-8 text-muted-foreground/50" />
          </div>
          <div className="space-y-2">
            <h4 className="text-sm sm:text-base font-medium text-foreground">Minimap View</h4>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-sm">
              Navigate large graphs with an overview map showing your current viewport
            </p>
          </div>
        </div>
      </div>

      {/* Map Controls */}
      <div className="space-y-2 flex-shrink-0">
        <Button variant="outline" className="w-full rounded-lg sm:rounded-xl text-xs sm:text-sm" disabled>
          <MapIcon className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
          Reset View
        </Button>
        <Button variant="outline" className="w-full rounded-lg sm:rounded-xl text-xs sm:text-sm" disabled>
          <Network className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
          Fit to Screen
        </Button>
      </div>
    </div>
  </div>
))
MapTab.displayName = "MapTab"

export default function ReagraphVisualization({
  setParentActiveTab,
  onError,
  onNodeClick,
}: ReagraphVisualizationProps) {
  const { sourceType, sourceData, setSelectedFilePath, setSelectedFileLine, setCodeViewerSheetOpen } = useResultData()
  const [graphData, setGraphData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isClient, setIsClient] = useState(false)
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)
  const [showSidebar, setShowSidebar] = useState(true)
  const [activeTab, setActiveTab] = useState<"overview" | "details" | "map">("overview")
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)

  // Track if we've already loaded data for this session
  const hasLoadedRef = useRef(false)
  const currentRequestKeyRef = useRef<string | null>(null)

  // Ensure component only renders on client side
  useEffect(() => {
    setIsClient(true)
  }, [])

  // Helper function to check if sourceData is GitHubSourceData
  const isGitHubSourceData = useCallback((data: SourceData): data is GitHubSourceData => {
    return data !== null && typeof data === "object" && "repo_url" in data
  }, [])

  // Memoize the request key to prevent unnecessary re-computations
  const requestKey = useMemo(() => {
    if (!sourceType || !sourceData) return null

    if (sourceType === "github" && isGitHubSourceData(sourceData)) {
      return `github-${sourceData.repo_url}-${sourceData.access_token || ""}`
    }

    if (sourceType === "zip" && sourceData instanceof File) {
      return `zip-${sourceData.name}-${sourceData.size}-${sourceData.lastModified}`
    }

    return null
  }, [sourceType, sourceData, isGitHubSourceData])

  // API call effect - only runs when requestKey changes and we haven't loaded this data before
  useEffect(() => {
    if (!requestKey || !isClient) return

    // If we've already loaded data for this request key, don't load again
    if (hasLoadedRef.current && currentRequestKeyRef.current === requestKey) {
      return
    }

    // Check cache first
    const cachedEntry = apiCache.get(requestKey)
    if (cachedEntry && isCacheValid(cachedEntry)) {
      console.log("Loading from cache:", requestKey)
      setGraphData(cachedEntry.data)
      hasLoadedRef.current = true
      currentRequestKeyRef.current = requestKey
      return
    }

    let isCancelled = false

    const fetchGraph = async () => {
      setLoading(true)
      setError(null)

      try {
        console.log("Making API call for:", requestKey)
        let data: GraphResponse
        if (sourceType === "github" && sourceData && isGitHubSourceData(sourceData)) {
          data = await generateGraphFromGithub(sourceData)
        } else if (sourceType === "zip" && sourceData instanceof File) {
          data = await generateGraphFromZip(sourceData)
        } else {
          throw new Error("Invalid source type or data")
        }

        if (!isCancelled) {
          const transformedData = transformApiResponseMemo(data)

          // Cache the response
          apiCache.set(requestKey, {
            data: transformedData,
            timestamp: Date.now(),
          })

          setGraphData(transformedData)
          hasLoadedRef.current = true
          currentRequestKeyRef.current = requestKey
        }
      } catch (e) {
        if (!isCancelled) {
          const msg = e instanceof Error ? e.message : "Failed to load graph data"
          setError(msg)
          onError?.(msg)
          setGraphData(null)
        }
      } finally {
        if (!isCancelled) {
          setLoading(false)
        }
      }
    }

    fetchGraph()

    return () => {
      isCancelled = true
    }
  }, [requestKey, isClient, sourceType, sourceData, onError, isGitHubSourceData])

  // Reset loaded state when component unmounts or request key changes significantly
  useEffect(() => {
    return () => {
      // Only reset if we're changing to a completely different request
      if (currentRequestKeyRef.current !== requestKey) {
        hasLoadedRef.current = false
      }
    }
  }, [requestKey])

  // Memoize node categories and color mapping function - STABLE REFERENCES
  const nodeCategories = useMemo(() => getDynamicNodeCategories(graphData?.nodes), [graphData?.nodes])

  const getNodeColor = useCallback(
    (category: string) => nodeCategories[category?.toLowerCase()]?.color || nodeCategories["other"].color,
    [nodeCategories],
  )

  interface ReaGraphGraphNode {
    id: string
    label?: string
    type?: string
  }

  // Handle node click with proper typing - STABLE REFERENCE
  const handleNodeClick = useCallback(
    (node: ReaGraphGraphNode) => {
      const graphNode = graphData?.nodes.find((n) => n.id === node.id)
      if (graphNode) {
        setSelectedNode(graphNode)
        setActiveTab("details")
        setIsMobileSidebarOpen(true) // Open mobile sidebar when node is selected
        onNodeClick?.(graphNode)
      }
    },
    [graphData?.nodes, onNodeClick],
  )

  // Handle open in explorer - STABLE REFERENCE
  const handleOpenInExplorer = useCallback(
    (node: GraphNode) => {
      // Set file path and line in context, and open the code viewer sheet
      if (node.file) {
        setSelectedFilePath?.(node.file)
      }
      setSelectedFileLine?.(node.line)
      setCodeViewerSheetOpen?.(true)
      setParentActiveTab?.("explorer")
      setIsMobileSidebarOpen(false) // Close mobile sidebar
      onNodeClick?.(node)
    },
    [setSelectedFilePath, setSelectedFileLine, setCodeViewerSheetOpen, setParentActiveTab, onNodeClick],
  )

  // Memoize reagraph data transformation - DEEP COMPARISON
  const reagraphData = useMemo((): ReagraphData | null => {
    if (!graphData?.nodes?.length) return null

    return {
      nodes: graphData.nodes.map((node) => ({
        id: node.id,
        label: node.name,
        fill: getNodeColor(node.category),
        size: Math.max(8, Math.min(20, node.name.length * 0.8)),
      })),
      edges:
        graphData.edges?.map((edge, index) => ({
          id: `edge-${index}`,
          source: edge.source,
          target: edge.target,
          label: edge.relationship,
        })) || [],
    }
  }, [graphData?.nodes, graphData?.edges, getNodeColor])

  // Get category counts for legend - STABLE REFERENCE
  const categoryData = useMemo(() => {
    if (!graphData?.nodes) return []

    const categoryCount = graphData.nodes.reduce(
      (acc, node) => {
        const category = node.category?.toLowerCase() || "other"
        acc[category] = (acc[category] || 0) + 1
        return acc
      },
      {} as Record<string, number>,
    )

    return Object.entries(nodeCategories)
      .map(([key, config]) => ({
        key,
        config,
        count: categoryCount[key] || 0,
      }))
      .filter((item) => item.count > 0 || item.key === "other")
  }, [graphData?.nodes, nodeCategories])

  // Handle try again - STABLE REFERENCE
  const handleTryAgain = useCallback(() => {
    // Clear cache and reset state to retry
    if (requestKey) {
      apiCache.delete(requestKey)
    }
    hasLoadedRef.current = false
    currentRequestKeyRef.current = null
    window.location.reload()
  }, [requestKey])

  // Don't render anything on server side
  if (!isClient) {
    return (
      <div className="flex justify-center items-center h-full">
        <div className="flex flex-col items-center gap-4 p-8">
          <div className="w-8 h-8 sm:w-12 sm:h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
          <div className="text-center space-y-2">
            <p className="text-xs sm:text-sm font-medium text-foreground">Initializing</p>
            <p className="text-xs text-muted-foreground">Setting up graph visualization...</p>
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full">
        <div className="flex flex-col items-center gap-4 p-8">
          <div className="w-8 h-8 sm:w-12 sm:h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
          <div className="text-center space-y-2">
            <p className="text-xs sm:text-sm font-medium text-foreground">Analyzing Dependencies</p>
            <p className="text-xs text-muted-foreground">This may take a few moments...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex justify-center items-center h-full">
        <div className="text-center space-y-4 p-8">
          <div className="w-12 h-12 sm:w-16 sm:h-16 mx-auto rounded-xl sm:rounded-2xl bg-red-50 dark:bg-red-950/20 flex items-center justify-center">
            <Network className="h-6 w-6 sm:h-8 sm:w-8 text-red-500" />
          </div>
          <div className="space-y-2">
            <h3 className="text-sm sm:text-base font-medium text-foreground">Failed to Load Graph</h3>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-md">{error}</p>
          </div>
          <Button variant="outline" onClick={handleTryAgain} className="rounded-xl text-xs sm:text-sm">
            Try Again
          </Button>
        </div>
      </div>
    )
  }

  if (!reagraphData || reagraphData.nodes.length === 0) {
    return (
      <div className="flex justify-center items-center h-full">
        <div className="text-center space-y-4 p-8">
          <div className="w-12 h-12 sm:w-16 sm:h-16 mx-auto rounded-xl sm:rounded-2xl bg-muted/50 flex items-center justify-center">
            <Network className="h-5 w-5 sm:h-6 sm:w-6 text-muted-foreground/50" />
          </div>
          <div className="space-y-2">
            <h3 className="text-sm sm:text-base font-medium text-foreground">No Dependencies Found</h3>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-md">
              The repository may not have analyzable code structure or dependencies
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full w-full bg-background/60 backdrop-blur-xl rounded-xl sm:rounded-2xl overflow-hidden relative">
      {/* Mobile Sidebar Overlay */}
      {isMobileSidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-background/80 backdrop-blur-sm">
          <div className="h-full w-full max-w-sm bg-background border-r border-border/30 shadow-xl">
            <div className="flex items-center justify-between p-4 border-b border-border/30">
              <h3 className="font-semibold text-sm">Graph Details</h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsMobileSidebarOpen(false)}
                className="h-8 w-8 rounded-lg"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-hidden">
              <Tabs
                value={activeTab}
                onValueChange={(v) => setActiveTab(v as "overview" | "details" | "map")}
                className="flex-1 flex flex-col h-full"
              >
                {/* Mobile Tab Navigation */}
                <div className="p-3 border-b border-border/30">
                  <TabsList className="grid w-full grid-cols-2 bg-muted/30 backdrop-blur-sm rounded-xl">
                    <TabsTrigger
                      value="overview"
                      className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm text-xs"
                    >
                      <Network className="w-3 h-3 mr-1" />
                      Overview
                    </TabsTrigger>
                    <TabsTrigger
                      value="details"
                      className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm text-xs"
                    >
                      <Info className="w-3 h-3 mr-1" />
                      Details
                    </TabsTrigger>
                  </TabsList>
                </div>

                {/* Mobile Tab Content */}
                <div className="flex-1 overflow-hidden">
                  <TabsContent value="overview" className="h-full m-0 p-0">
                    <OverviewTab categoryData={categoryData} />
                  </TabsContent>

                  <TabsContent value="details" className="h-full m-0 p-0">
                    <DetailsTab
                      selectedNode={selectedNode}
                      getNodeColor={getNodeColor}
                      onOpenInExplorer={handleOpenInExplorer}
                    />
                  </TabsContent>

                  <TabsContent value="map" className="h-full m-0 p-0">
                    <MapTab />
                  </TabsContent>
                </div>
              </Tabs>
            </div>
          </div>
        </div>
      )}

      {/* Graph Canvas */}
      <div className="flex-1 relative min-w-0">
        <div className="absolute inset-0 bg-gradient-to-br from-background/80 to-background/40 backdrop-blur-sm">
          <GraphCanvas
            nodes={reagraphData.nodes}
            edges={reagraphData.edges}
            labelType="all"
            draggable={true}
            animated={true}
            layoutType="forceDirected2d"
            sizingType="centrality"
            onNodeClick={handleNodeClick}
          />
        </div>

        {/* Mobile Graph Controls */}
        <div className="lg:hidden absolute top-3 left-3 flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 rounded-xl bg-background/90 backdrop-blur-sm border-border/60"
            onClick={() => setIsMobileSidebarOpen(true)}
          >
            <Menu className="h-4 w-4" />
          </Button>
        </div>

        {/* Desktop Graph Controls */}
        <div className="hidden lg:flex absolute top-4 left-4 items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 rounded-xl bg-background/90 backdrop-blur-sm border-border/60"
                  onClick={() => setShowSidebar(!showSidebar)}
                >
                  {showSidebar ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{showSidebar ? "Hide Sidebar" : "Show Sidebar"}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Stats Badge */}
        <div className="absolute top-3 right-3 lg:top-4 lg:right-4">
          <Badge className="bg-background/90 backdrop-blur-sm border-border/60 text-foreground rounded-xl px-2 py-1 lg:px-3 text-xs">
            <span className="hidden sm:inline">{reagraphData.nodes.length} nodes • {reagraphData.edges.length} edges</span>
            <span className="sm:hidden">{reagraphData.nodes.length}N • {reagraphData.edges.length}E</span>
          </Badge>
        </div>
      </div>

      {/* Desktop Sidebar */}
      {showSidebar && (
        <div className="hidden lg:flex w-80 xl:w-96 border-l border-border/30 bg-background/40 backdrop-blur-sm flex-col">
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as "overview" | "details" | "map")}
            className="flex-1 flex flex-col h-full"
          >
            {/* Desktop Tab Navigation */}
            <div className="p-4 border-b border-border/30 flex-shrink-0">
              <TabsList className="grid w-full grid-cols-2 bg-muted/30 backdrop-blur-sm rounded-xl">
                <TabsTrigger
                  value="overview"
                  className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm text-sm"
                >
                  <Network className="w-4 h-4 mr-1.5" />
                  Overview
                </TabsTrigger>
                <TabsTrigger
                  value="details"
                  className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm text-sm"
                >
                  <Info className="w-4 h-4 mr-1.5" />
                  Details
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Desktop Tab Content */}
            <div className="flex-1 overflow-hidden">
              <TabsContent value="overview" className="h-full m-0 p-0">
                <OverviewTab categoryData={categoryData} />
              </TabsContent>

              <TabsContent value="details" className="h-full m-0 p-0">
                <DetailsTab
                  selectedNode={selectedNode}
                  getNodeColor={getNodeColor}
                  onOpenInExplorer={handleOpenInExplorer}
                />
              </TabsContent>

              <TabsContent value="map" className="h-full m-0 p-0">
                <MapTab />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      )}
    </div>
  )
}
