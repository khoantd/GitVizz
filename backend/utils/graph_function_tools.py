# graph_function_tools.py
import re
from typing import List, Dict, Any, Optional, Set

from schemas.graph_schemas import (
    GraphData,
    GetNodesByCategoryParams, GetNodesByNamePatternParams,
    GetConnectedNodesParams, GetFileRelatedNodesParams,
    TraverseDependenciesParams
)


class GraphFunctionTools:
    """Function tools for LLM to interact with graph data"""
    
    def __init__(self, graph_data: GraphData):
        self.graph_data = graph_data
        self.nodes_by_id = {node.id: node for node in graph_data.nodes}
        self.edges_by_source = {}
        self.edges_by_target = {}
        
        # Build edge indices for faster lookups
        for edge in graph_data.edges:
            if edge.source not in self.edges_by_source:
                self.edges_by_source[edge.source] = []
            self.edges_by_source[edge.source].append(edge)
            
            if edge.target not in self.edges_by_target:
                self.edges_by_target[edge.target] = []
            self.edges_by_target[edge.target].append(edge)
    
    def get_nodes_by_category(self, params: GetNodesByCategoryParams) -> List[Dict[str, Any]]:
        """Get all nodes of a specific category"""
        matching_nodes = [
            node for node in self.graph_data.nodes 
            if node.category == params.category
        ]
        
        # Sort by relevance (nodes with more connections first)
        def get_connection_count(node):
            return (
                len(self.edges_by_source.get(node.id, [])) + 
                len(self.edges_by_target.get(node.id, []))
            )
        
        matching_nodes.sort(key=get_connection_count, reverse=True)
        
        # Limit results
        limited_nodes = matching_nodes[:params.limit]
        
        return [
            {
                "id": node.id,
                "name": node.name,
                "category": node.category,
                "file": node.file,
                "start_line": node.start_line,
                "end_line": node.end_line,
                "connection_count": get_connection_count(node)
            }
            for node in limited_nodes
        ]
    
    def get_nodes_by_name_pattern(self, params: GetNodesByNamePatternParams) -> List[Dict[str, Any]]:
        """Find nodes matching a name pattern"""
        # Convert simple wildcards to regex
        pattern = params.pattern.replace("*", ".*").replace("?", ".")
        regex = re.compile(pattern, re.IGNORECASE)
        
        matching_nodes = [
            node for node in self.graph_data.nodes
            if regex.search(node.name) or regex.search(node.id)
        ]
        
        # Sort by exact matches first, then partial matches
        def match_score(node):
            name_lower = node.name.lower()
            pattern_lower = params.pattern.lower()
            
            if name_lower == pattern_lower:
                return 3  # Exact match
            elif name_lower.startswith(pattern_lower):
                return 2  # Prefix match
            elif pattern_lower in name_lower:
                return 1  # Contains match
            else:
                return 0  # Regex match only
        
        matching_nodes.sort(key=match_score, reverse=True)
        limited_nodes = matching_nodes[:params.limit]
        
        return [
            {
                "id": node.id,
                "name": node.name,
                "category": node.category,
                "file": node.file,
                "match_score": match_score(node)
            }
            for node in limited_nodes
        ]
    
    def get_connected_nodes(self, params: GetConnectedNodesParams) -> List[Dict[str, Any]]:
        """Get nodes connected to a specific node"""
        node_id = params.node_id
        if node_id not in self.nodes_by_id:
            return []
        
        connected = []
        
        # Get outgoing connections
        if params.direction in ["outgoing", "both"]:
            for edge in self.edges_by_source.get(node_id, []):
                if params.relationship is None or edge.relationship == params.relationship:
                    target_node = self.nodes_by_id.get(edge.target)
                    if target_node:
                        connected.append({
                            "id": target_node.id,
                            "name": target_node.name,
                            "category": target_node.category,
                            "file": target_node.file,
                            "relationship": edge.relationship,
                            "direction": "outgoing"
                        })
        
        # Get incoming connections
        if params.direction in ["incoming", "both"]:
            for edge in self.edges_by_target.get(node_id, []):
                if params.relationship is None or edge.relationship == params.relationship:
                    source_node = self.nodes_by_id.get(edge.source)
                    if source_node:
                        connected.append({
                            "id": source_node.id,
                            "name": source_node.name,
                            "category": source_node.category,
                            "file": source_node.file,
                            "relationship": edge.relationship,
                            "direction": "incoming"
                        })
        
        # Remove duplicates and limit
        seen = set()
        unique_connected = []
        for item in connected:
            if item["id"] not in seen:
                seen.add(item["id"])
                unique_connected.append(item)
                if len(unique_connected) >= params.limit:
                    break
        
        return unique_connected
    
    def get_file_related_nodes(self, params: GetFileRelatedNodesParams) -> List[Dict[str, Any]]:
        """Get all nodes related to a specific file"""
        file_nodes = [
            node for node in self.graph_data.nodes
            if node.file == params.file_path
        ]
        
        result = []
        for node in file_nodes:
            node_info = {
                "id": node.id,
                "name": node.name,
                "category": node.category,
                "file": node.file,
                "start_line": node.start_line,
                "end_line": node.end_line
            }
            
            # Add import/export information if requested
            if params.include_imports and node.imports:
                node_info["imports"] = node.imports
            
            if params.include_exports:
                # Find what this node exports (what depends on it)
                exports = []
                for edge in self.edges_by_source.get(node.id, []):
                    if edge.relationship in ["defines_class", "defines_function", "defines_method"]:
                        exports.append({
                            "target": edge.target,
                            "type": edge.relationship
                        })
                node_info["exports"] = exports
            
            result.append(node_info)
        
        return result
    
    def traverse_dependencies(self, params: TraverseDependenciesParams) -> Dict[str, Any]:
        """Traverse dependencies from a starting node"""
        if params.node_id not in self.nodes_by_id:
            return {"error": f"Node {params.node_id} not found"}
        
        visited = set()
        traversal_result = {
            "root_node": params.node_id,
            "depth_levels": {},
            "total_nodes": 0,
            "relationships_followed": params.follow_relationships
        }
        
        def traverse_level(node_ids: Set[str], current_depth: int):
            if current_depth > params.depth or not node_ids:
                return
            
            level_nodes = []
            next_level_ids = set()
            
            for node_id in node_ids:
                if node_id in visited:
                    continue
                
                visited.add(node_id)
                node = self.nodes_by_id.get(node_id)
                if not node:
                    continue
                
                node_info = {
                    "id": node.id,
                    "name": node.name,
                    "category": node.category,
                    "file": node.file,
                    "connections": []
                }
                
                # Find connections to follow
                for edge in self.edges_by_source.get(node_id, []):
                    if edge.relationship in params.follow_relationships:
                        target_node = self.nodes_by_id.get(edge.target)
                        if target_node and edge.target not in visited:
                            node_info["connections"].append({
                                "target_id": edge.target,
                                "target_name": target_node.name,
                                "relationship": edge.relationship
                            })
                            next_level_ids.add(edge.target)
                
                level_nodes.append(node_info)
            
            if level_nodes:
                traversal_result["depth_levels"][current_depth] = level_nodes
                traversal_result["total_nodes"] += len(level_nodes)
            
            # Continue to next level
            if current_depth < params.depth:
                traverse_level(next_level_ids, current_depth + 1)
        
        # Start traversal
        traverse_level({params.node_id}, 0)
        
        return traversal_result
    
    def search_by_code_content(self, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        """Search nodes by code content"""
        query_lower = query.lower()
        matching_nodes = []
        
        for node in self.graph_data.nodes:
            if node.code:
                code_lower = node.code.lower()
                if query_lower in code_lower:
                    # Calculate relevance score based on query occurrence
                    score = code_lower.count(query_lower) / len(code_lower.split())
                    matching_nodes.append({
                        "id": node.id,
                        "name": node.name,
                        "category": node.category,
                        "file": node.file,
                        "relevance_score": score,
                        "code_snippet": node.code[:200] + "..." if len(node.code) > 200 else node.code
                    })
        
        # Sort by relevance score
        matching_nodes.sort(key=lambda x: x["relevance_score"], reverse=True)
        return matching_nodes[:limit]
    
    def get_node_summary(self, node_id: str) -> Optional[Dict[str, Any]]:
        """Get comprehensive summary of a specific node"""
        if node_id not in self.nodes_by_id:
            return None
        
        node = self.nodes_by_id[node_id]
        
        # Get all connections
        incoming = len(self.edges_by_target.get(node_id, []))
        outgoing = len(self.edges_by_source.get(node_id, []))
        
        # Get relationship breakdown
        relationships = {}
        for edge in self.edges_by_source.get(node_id, []):
            rel = edge.relationship
            if rel not in relationships:
                relationships[rel] = 0
            relationships[rel] += 1
        
        return {
            "id": node.id,
            "name": node.name,
            "category": node.category,
            "file": node.file,
            "line_range": f"{node.start_line}-{node.end_line}" if node.start_line else None,
            "parent_id": node.parent_id,
            "incoming_connections": incoming,
            "outgoing_connections": outgoing,
            "total_connections": incoming + outgoing,
            "relationship_breakdown": relationships,
            "imports": node.imports if node.imports else [],
            "code_length": len(node.code) if node.code else 0
        }
    
    def get_graph_statistics(self) -> Dict[str, Any]:
        """Get overall graph statistics"""
        stats = {
            "total_nodes": len(self.graph_data.nodes),
            "total_edges": len(self.graph_data.edges),
            "node_categories": {},
            "edge_relationships": {},
            "files_covered": set(),
            "average_connections_per_node": 0
        }
        
        # Count node categories
        for node in self.graph_data.nodes:
            cat = node.category
            if cat not in stats["node_categories"]:
                stats["node_categories"][cat] = 0
            stats["node_categories"][cat] += 1
            
            if node.file:
                stats["files_covered"].add(node.file)
        
        # Count edge relationships
        total_connections = 0
        for edge in self.graph_data.edges:
            rel = edge.relationship
            if rel not in stats["edge_relationships"]:
                stats["edge_relationships"][rel] = 0
            stats["edge_relationships"][rel] += 1
            total_connections += 1
        
        stats["files_covered"] = len(stats["files_covered"])
        stats["average_connections_per_node"] = (
            total_connections / len(self.graph_data.nodes) if self.graph_data.nodes else 0
        )
        
        return stats


# Function definitions for LLM function calling
GRAPH_FUNCTIONS = [
    {
        "name": "get_nodes_by_category",
        "description": "Get all nodes of a specific category (module, class, function, method, directory, external_symbol)",
        "parameters": {
            "type": "object",
            "properties": {
                "category": {
                    "type": "string",
                    "enum": ["module", "class", "function", "method", "directory", "external_symbol"],
                    "description": "The category of nodes to retrieve"
                },
                "limit": {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": 200,
                    "default": 50,
                    "description": "Maximum number of nodes to return"
                }
            },
            "required": ["category"]
        }
    },
    {
        "name": "get_nodes_by_name_pattern",
        "description": "Find nodes matching a name pattern (supports wildcards * and ?)",
        "parameters": {
            "type": "object",
            "properties": {
                "pattern": {
                    "type": "string",
                    "description": "Name pattern to match (supports wildcards)"
                },
                "limit": {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": 100,
                    "default": 20,
                    "description": "Maximum number of nodes to return"
                }
            },
            "required": ["pattern"]
        }
    },
    {
        "name": "get_connected_nodes",
        "description": "Get nodes connected to a specific node through relationships",
        "parameters": {
            "type": "object",
            "properties": {
                "node_id": {
                    "type": "string",
                    "description": "ID of the node to find connections for"
                },
                "relationship": {
                    "type": "string",
                    "enum": ["defines_class", "defines_function", "defines_method", "inherits", "calls", "imports_module", "imports_symbol", "references_symbol"],
                    "description": "Specific relationship type to filter by (optional)"
                },
                "direction": {
                    "type": "string",
                    "enum": ["incoming", "outgoing", "both"],
                    "default": "both",
                    "description": "Direction of connections to retrieve"
                },
                "limit": {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": 100,
                    "default": 20,
                    "description": "Maximum number of connected nodes to return"
                }
            },
            "required": ["node_id"]
        }
    },
    {
        "name": "get_file_related_nodes",
        "description": "Get all nodes related to a specific file path",
        "parameters": {
            "type": "object",
            "properties": {
                "file_path": {
                    "type": "string",
                    "description": "Path of the file to get nodes for"
                },
                "include_imports": {
                    "type": "boolean",
                    "default": True,
                    "description": "Include import information"
                },
                "include_exports": {
                    "type": "boolean",
                    "default": True,
                    "description": "Include export information"
                }
            },
            "required": ["file_path"]
        }
    },
    {
        "name": "traverse_dependencies",
        "description": "Traverse dependencies from a starting node to understand code relationships",
        "parameters": {
            "type": "object",
            "properties": {
                "node_id": {
                    "type": "string",
                    "description": "Starting node ID for traversal"
                },
                "depth": {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": 3,
                    "default": 2,
                    "description": "Maximum depth to traverse"
                },
                "follow_relationships": {
                    "type": "array",
                    "items": {
                        "type": "string",
                        "enum": ["calls", "inherits", "imports_module", "imports_symbol", "defines_class", "defines_function", "defines_method"]
                    },
                    "default": ["calls", "inherits", "imports_module", "imports_symbol"],
                    "description": "Which relationships to follow during traversal"
                }
            },
            "required": ["node_id"]
        }
    },
    {
        "name": "search_by_code_content",
        "description": "Search for nodes containing specific code content",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Code content to search for"
                },
                "limit": {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": 20,
                    "default": 10,
                    "description": "Maximum number of results to return"
                }
            },
            "required": ["query"]
        }
    },
    {
        "name": "get_node_summary",
        "description": "Get comprehensive summary of a specific node including all its connections",
        "parameters": {
            "type": "object",
            "properties": {
                "node_id": {
                    "type": "string",
                    "description": "ID of the node to get summary for"
                }
            },
            "required": ["node_id"]
        }
    },
    {
        "name": "get_graph_statistics",
        "description": "Get overall statistics about the graph structure",
        "parameters": {
            "type": "object",
            "properties": {},
            "additionalProperties": False
        }
    }
]