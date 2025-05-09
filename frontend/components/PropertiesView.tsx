import { useEffect, useState } from "react";
import { useThemeGraph } from "./use-theme-graph";
import type { Graph } from "graphology";

interface NodeProperties {
  id: string;
  label: string;
  type: string;
  moduleName?: string;
  connections?: Array<{
    id: string;
    label: string;
    type: string;
    direction: "incoming" | "outgoing";
  }>;
}

interface EdgeProperties {
  source: string;
  target: string;
  type: string;
  sourceLabel?: string;
  targetLabel?: string;
}

interface PropertiesViewProps {
  nodeId?: string | null;
  edgeId?: string | null;
  graph: Graph;
}

const PropertiesView = ({ nodeId, edgeId, graph }: PropertiesViewProps) => {
  const [properties, setProperties] = useState<
    NodeProperties | EdgeProperties | null
  >(null);
  const [isNode, setIsNode] = useState<boolean>(true);
  const theme = useThemeGraph();

  useEffect(() => {
    if (!graph) return;

    if (nodeId && graph.hasNode(nodeId)) {
      // Get node properties
      const nodeData = graph.getNodeAttributes(nodeId);
      const connections: NodeProperties["connections"] = [];

      // Get connections (neighbors)
      try {
        const neighbors = graph.neighbors(nodeId);
        neighbors.forEach((neighborId: string) => {
          const neighborData = graph.getNodeAttributes(neighborId);
          const edges = graph.edges(nodeId, neighborId);

          edges.forEach((edgeId: string) => {
            const direction =
              graph.source(edgeId) === nodeId ? "outgoing" : "incoming";

            connections.push({
              id: neighborId,
              label: neighborData.label || neighborId,
              type: neighborData.nodeType || "unknown",
              direction,
            });
          });
        });
      } catch (error) {
        console.error("Error getting node connections:", error);
      }

      // Extract moduleName from id if it contains a colon (moduleName:name format)
      let moduleName = undefined;
      if (nodeId.includes(":")) {
        const parts = nodeId.split(":");
        moduleName = parts[0];
      }

      setProperties({
        id: nodeId,
        label: nodeData.label || nodeId,
        type: nodeData.nodeType || "unknown",
        moduleName,
        connections,
      });
      setIsNode(true);
    } else if (edgeId && graph.hasEdge(edgeId)) {
      // Get edge properties
      const source = graph.source(edgeId);
      const target = graph.target(edgeId);
      const edgeData = graph.getEdgeAttributes(edgeId);
      const sourceData = graph.getNodeAttributes(source);
      const targetData = graph.getNodeAttributes(target);

      setProperties({
        source,
        target,
        type: edgeData.type || "unknown",
        sourceLabel: sourceData.label || source,
        targetLabel: targetData.label || target,
      });
      setIsNode(false);
    } else {
      setProperties(null);
    }
  }, [nodeId, edgeId, graph]);

  if (!properties) {
    return null;
  }

  const bgColor = theme === "dark" ? "bg-gray-800" : "bg-white";
  const textColor = theme === "dark" ? "text-gray-200" : "text-gray-800";
  const borderColor = theme === "dark" ? "border-gray-700" : "border-gray-300";
  const headerColor = theme === "dark" ? "text-blue-400" : "text-blue-600";
  const sectionColor = theme === "dark" ? "text-amber-400" : "text-amber-600";

  return (
    <div
      className={`${bgColor} ${textColor} rounded-lg border ${borderColor} p-4 text-sm shadow-lg max-w-xs`}
    >
      {isNode ? (
        // Node properties view
        <div className="flex flex-col gap-2">
          <h3 className={`text-lg font-bold ${headerColor}`}>
            {(properties as NodeProperties).type.charAt(0).toUpperCase() +
              (properties as NodeProperties).type.slice(1)}
          </h3>

          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1">
              <span className="font-semibold">Name:</span>
              <span>{(properties as NodeProperties).label}</span>
            </div>

            {(properties as NodeProperties).moduleName && (
              <div className="flex items-center gap-1">
                <span className="font-semibold">Module:</span>
                <span className="text-xs overflow-hidden text-ellipsis">
                  {(properties as NodeProperties).moduleName}
                </span>
              </div>
            )}

            <div className="flex items-center gap-1">
              <span className="font-semibold">ID:</span>
              <span className="text-xs overflow-hidden text-ellipsis">
                {(properties as NodeProperties).id}
              </span>
            </div>
          </div>

          {(properties as NodeProperties).connections &&
            (properties as NodeProperties).connections!.length > 0 && (
              <>
                <h4 className={`text-md font-semibold mt-2 ${sectionColor}`}>
                  Connections
                </h4>
                <div className="max-h-40 overflow-y-auto">
                  {(properties as NodeProperties).connections!.map(
                    (conn, idx) => (
                      <div
                        key={idx}
                        className="flex flex-col py-1 border-b border-gray-200 dark:border-gray-700 last:border-0"
                      >
                        <div className="flex items-center gap-1">
                          <span className="font-semibold">{conn.label}</span>
                          <span className="text-xs">({conn.type})</span>
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {conn.direction === "outgoing"
                            ? "Calls"
                            : "Called by"}
                        </div>
                      </div>
                    )
                  )}
                </div>
              </>
            )}
        </div>
      ) : (
        // Edge properties view
        <div className="flex flex-col gap-2">
          <h3 className={`text-lg font-bold ${headerColor}`}>Relationship</h3>

          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1">
              <span className="font-semibold">Type:</span>
              <span>{(properties as EdgeProperties).type || "connection"}</span>
            </div>

            <div className="flex items-center gap-1">
              <span className="font-semibold">From:</span>
              <span>{(properties as EdgeProperties).sourceLabel}</span>
            </div>

            <div className="flex items-center gap-1">
              <span className="font-semibold">To:</span>
              <span>{(properties as EdgeProperties).targetLabel}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PropertiesView;
