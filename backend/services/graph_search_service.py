# graph_search_service.py
import json
import time
import uuid
from typing import Dict, List, Optional

from models.repository import Repository
from utils.file_utils import file_manager
from utils.llm_utils import llm_service
from utils.graph_function_tools import GraphFunctionTools, GRAPH_FUNCTIONS
from schemas.graph_schemas import (
    GraphData, GraphNode, GraphEdge, QueryAnalysis, ContextNode, 
    ContextMetadata, SmartContextResult,
    GraphAnalysisSession, GetNodesByNamePatternParams,
    GetFileRelatedNodesParams, TraverseDependenciesParams
)


class GraphSearchService:
    """Service for intelligent graph-based context search using LLM analysis"""
    
    def __init__(self):
        self.active_sessions: Dict[str, GraphAnalysisSession] = {}
    
    async def load_graph_data(self, repository: Repository) -> Optional[GraphData]:
        """Load graph data from repository's data.json file"""
        try:
            graph_content = await file_manager.load_json_data(repository.file_paths.json_file)
            if not graph_content:
                return None
            
            # Parse graph data
            nodes = [GraphNode(**node_data) for node_data in graph_content.get("nodes", [])]
            edges = [GraphEdge(**edge_data) for edge_data in graph_content.get("edges", [])]
            
            return GraphData(nodes=nodes, edges=edges)
        
        except Exception as e:
            print(f"Error loading graph data: {e}")
            return None
    
    async def analyze_query_with_llm(
        self, 
        user_query: str, 
        graph_tools: GraphFunctionTools,
        repository: Repository,
        max_tokens: int = 4000
    ) -> QueryAnalysis:
        """Use LLM to analyze user query and determine context requirements"""
        
        # Get basic graph statistics
        graph_stats = graph_tools.get_graph_statistics()
        
        system_prompt = f"""You are a code analysis assistant. Analyze the user's query about a codebase and determine what context is needed.

Graph Statistics:
- Total nodes: {graph_stats['total_nodes']}
- Total edges: {graph_stats['total_edges']}
- Node categories: {graph_stats['node_categories']}
- Files covered: {graph_stats['files_covered']}

Analyze the user query and respond with a structured analysis.

User Query: "{user_query}"

Please analyze:
1. Intent: What is the user trying to accomplish? (debugging, explanation, modification, general_understanding, implementation)
2. Entities: What specific code entities are mentioned or implied? (classes, functions, files)
3. Scope: How much context is needed? (focused, moderate, comprehensive)
4. Files of interest: Which files are likely relevant?
5. Keywords: Important technical keywords from the query
6. Complexity: How complex is this query? (simple, moderate, complex)

Respond in valid JSON format matching this structure:
{
  "intent": "explanation",
  "entities": ["ClassName", "function_name", "file.py"],
  "scope": "moderate", 
  "files_of_interest": ["src/main.py", "lib/utils.py"],
  "keywords": ["authentication", "database", "error handling"],
  "complexity": "moderate"
}"""

        try:
            # Call LLM for initial analysis
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Analyze this query: {user_query}"}
            ]
            
            response = await llm_service.generate_response(
                user=None,
                use_user=False,
                chat_session=None,
                messages=messages,
                context="",
                provider="openai",
                model="gpt-4",
                temperature=0.1,
                max_tokens=500,
                stream=False
            )
            
            if response["success"]:
                # Parse JSON response
                analysis_data = json.loads(response["content"])
                return QueryAnalysis(**analysis_data)
            else:
                # Fallback analysis
                return self._fallback_query_analysis(user_query)
                
        except Exception as e:
            print(f"Error in LLM query analysis: {e}")
            return self._fallback_query_analysis(user_query)
    
    def _fallback_query_analysis(self, user_query: str) -> QueryAnalysis:
        """Fallback query analysis using simple heuristics"""
        query_lower = user_query.lower()
        
        # Determine intent
        if any(word in query_lower for word in ["error", "bug", "issue", "problem", "fix"]):
            intent = "debugging"
        elif any(word in query_lower for word in ["how", "what", "why", "explain", "understand"]):
            intent = "explanation"
        elif any(word in query_lower for word in ["change", "modify", "update", "add", "implement"]):
            intent = "modification"
        elif any(word in query_lower for word in ["create", "build", "implement", "develop"]):
            intent = "implementation"
        else:
            intent = "general_understanding"
        
        # Determine scope
        if len(query_lower.split()) < 10:
            scope = "focused"
        elif len(query_lower.split()) < 20:
            scope = "moderate"
        else:
            scope = "comprehensive"
        
        # Determine complexity
        if any(word in query_lower for word in ["architecture", "design", "pattern", "refactor"]):
            complexity = "complex"
        elif any(word in query_lower for word in ["function", "class", "method", "variable"]):
            complexity = "moderate"
        else:
            complexity = "simple"
        
        return QueryAnalysis(
            intent=intent,
            entities=[],
            scope=scope,
            files_of_interest=[],
            keywords=query_lower.split(),
            complexity=complexity
        )
    
    async def find_relevant_nodes_with_llm(
        self,
        query_analysis: QueryAnalysis,
        graph_tools: GraphFunctionTools,
        repository: Repository,
        max_context_tokens: int = 4000
    ) -> List[ContextNode]:
        """Use LLM with function calling to find relevant graph nodes"""
        
        session_id = str(uuid.uuid4())
        session = GraphAnalysisSession(
            session_id=session_id,
            repository_id=str(repository.id),
            user_query=query_analysis.model_dump_json()
        )
        self.active_sessions[session_id] = session
        
        # System prompt for LLM with function calling
        system_prompt = f"""You are a code analysis expert. Use the provided graph functions to find the most relevant code components for answering the user's query.

Query Analysis:
- Intent: {query_analysis.intent}
- Entities: {query_analysis.entities}
- Scope: {query_analysis.scope}
- Complexity: {query_analysis.complexity}
- Keywords: {query_analysis.keywords}

Available Functions:
{json.dumps([func['name'] for func in GRAPH_FUNCTIONS], indent=2)}

Your goal is to:
1. Use functions to explore the graph structure
2. Find nodes most relevant to the user's query
3. Include related dependencies when helpful
4. Prioritize nodes by relevance
5. Stay within the token budget of {max_context_tokens} tokens

Be strategic in your function calls. Start broad, then narrow down based on findings.
"""

        try:
            # Call LLM with function calling capability
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Find relevant code components for this analysis: {query_analysis.model_dump_json()}"}
            ]
            
            # This is a simplified version - in reality you'd need to implement
            # the actual function calling loop with the LLM
            relevant_nodes = await self._execute_llm_function_calling(
                messages, graph_tools, query_analysis, max_context_tokens
            )
            
            return relevant_nodes
            
        except Exception as e:
            print(f"Error in LLM node selection: {e}")
            return self._fallback_node_selection(query_analysis, graph_tools)
    
    async def _execute_llm_function_calling(
        self,
        messages: List[Dict[str, str]],
        graph_tools: GraphFunctionTools,
        query_analysis: QueryAnalysis,
        max_tokens: int
    ) -> List[ContextNode]:
        """Execute LLM function calling to find relevant nodes"""
        
        relevant_nodes = []
        
        # Simple strategy: try different approaches based on query analysis
        try:
            # 1. If specific entities mentioned, search for them
            if query_analysis.entities:
                for entity in query_analysis.entities[:3]:  # Limit to first 3
                    params = GetNodesByNamePatternParams(pattern=f"*{entity}*", limit=5)
                    matching_nodes = graph_tools.get_nodes_by_name_pattern(params)
                    
                    for node_data in matching_nodes:
                        node = ContextNode(
                            node_id=node_data["id"],
                            node_name=node_data["name"],
                            node_type=node_data["category"],
                            file_path=node_data.get("file"),
                            relevance_score=0.9,  # High relevance for direct matches
                            inclusion_reason=f"Direct name match for entity '{entity}'"
                        )
                        relevant_nodes.append(node)
            
            # 2. If specific files mentioned, get all nodes from those files
            if query_analysis.files_of_interest:
                for file_path in query_analysis.files_of_interest[:2]:
                    params = GetFileRelatedNodesParams(file_path=file_path)
                    file_nodes = graph_tools.get_file_related_nodes(params)
                    
                    for node_data in file_nodes:
                        node = ContextNode(
                            node_id=node_data["id"],
                            node_name=node_data["name"],
                            node_type=node_data["category"],
                            file_path=node_data.get("file"),
                            relevance_score=0.8,
                            inclusion_reason=f"From mentioned file '{file_path}'"
                        )
                        relevant_nodes.append(node)
            
            # 3. Search by keywords in code content
            for keyword in query_analysis.keywords[:3]:
                if len(keyword) > 3:  # Skip very short keywords
                    matching_nodes = graph_tools.search_by_code_content(keyword, limit=3)
                    
                    for node_data in matching_nodes:
                        node = ContextNode(
                            node_id=node_data["id"],
                            node_name=node_data["name"],
                            node_type=node_data["category"],
                            file_path=node_data.get("file"),
                            relevance_score=min(0.7, node_data.get("relevance_score", 0.5)),
                            inclusion_reason=f"Contains keyword '{keyword}' in code",
                            code_snippet=node_data.get("code_snippet")
                        )
                        relevant_nodes.append(node)
            
            # 4. If scope is comprehensive, add more context via traversal
            if query_analysis.scope == "comprehensive" and relevant_nodes:
                # Take top nodes and expand their context
                top_nodes = sorted(relevant_nodes, key=lambda x: x.relevance_score, reverse=True)[:3]
                
                for top_node in top_nodes:
                    params = TraverseDependenciesParams(
                        node_id=top_node.node_id,
                        depth=2,
                        follow_relationships=["calls", "inherits", "imports_module"]
                    )
                    traversal_result = graph_tools.traverse_dependencies(params)
                    
                    # Add nodes from traversal
                    for depth, level_nodes in traversal_result.get("depth_levels", {}).items():
                        if int(depth) > 1:  # Skip the root node
                            for node_data in level_nodes[:2]:  # Limit to 2 per level
                                node = ContextNode(
                                    node_id=node_data["id"],
                                    node_name=node_data["name"],
                                    node_type=node_data["category"],
                                    file_path=node_data.get("file"),
                                    relevance_score=0.6 - (int(depth) * 0.1),  # Decrease score by depth
                                    inclusion_reason=f"Related to {top_node.node_name} via dependency"
                                )
                                relevant_nodes.append(node)
            
            # Remove duplicates and sort by relevance
            seen_ids = set()
            unique_nodes = []
            for node in sorted(relevant_nodes, key=lambda x: x.relevance_score, reverse=True):
                if node.node_id not in seen_ids:
                    seen_ids.add(node.node_id)
                    unique_nodes.append(node)
            
            return unique_nodes[:20]  # Limit to top 20 nodes
            
        except Exception as e:
            print(f"Error in function calling execution: {e}")
            return []
    
    def _fallback_node_selection(self, query_analysis: QueryAnalysis, graph_tools: GraphFunctionTools) -> List[ContextNode]:
        """Fallback node selection without LLM"""
        relevant_nodes = []
        
        # Simple keyword-based search
        for keyword in query_analysis.keywords[:5]:
            if len(keyword) > 3:
                params = GetNodesByNamePatternParams(pattern=f"*{keyword}*", limit=3)
                matching_nodes = graph_tools.get_nodes_by_name_pattern(params)
                
                for node_data in matching_nodes:
                    node = ContextNode(
                        node_id=node_data["id"],
                        node_name=node_data["name"],
                        node_type=node_data["category"],
                        file_path=node_data.get("file"),
                        relevance_score=0.5,
                        inclusion_reason=f"Keyword match: {keyword}"
                    )
                    relevant_nodes.append(node)
        
        return relevant_nodes[:10]
    
    async def build_context_from_nodes(
        self,
        context_nodes: List[ContextNode],
        graph_tools: GraphFunctionTools,
        repository: Repository
    ) -> str:
        """Build the actual context text from selected nodes"""
        
        context_parts = []
        context_parts.append("# Repository Context\n")
        
        # Group nodes by file for better organization
        nodes_by_file = {}
        for node in context_nodes:
            file_path = node.file_path or "unknown"
            if file_path not in nodes_by_file:
                nodes_by_file[file_path] = []
            nodes_by_file[file_path].append(node)
        
        # Build context for each file
        for file_path, file_nodes in nodes_by_file.items():
            if file_path != "unknown":
                context_parts.append(f"\n## File: {file_path}\n")
            
            for node in sorted(file_nodes, key=lambda x: x.relevance_score, reverse=True):
                # Get full node details
                node_summary = graph_tools.get_node_summary(node.node_id)
                if node_summary:
                    context_parts.append(f"### {node.node_type.title()}: {node.node_name}")
                    context_parts.append(f"- ID: {node.node_id}")
                    context_parts.append(f"- Relevance: {node.relevance_score:.2f}")
                    context_parts.append(f"- Reason: {node.inclusion_reason}")
                    
                    if node_summary["line_range"]:
                        context_parts.append(f"- Lines: {node_summary['line_range']}")
                    
                    if node_summary["total_connections"] > 0:
                        context_parts.append(f"- Connections: {node_summary['total_connections']}")
                    
                    # Add code snippet if available and not too long
                    if node.code_snippet:
                        context_parts.append("```")
                        context_parts.append(node.code_snippet)
                        context_parts.append("```")
                    
                    context_parts.append("")  # Empty line
        
        return "\n".join(context_parts)
    
    async def build_smart_context(
        self,
        repository: Repository,
        user_query: str,
        max_context_tokens: int = 4000,
        scope_preference: str = "moderate"
    ) -> SmartContextResult:
        """Main method to build smart context using LLM analysis"""
        
        start_time = time.time()
        
        try:
            # 1. Load graph data
            graph_data = await self.load_graph_data(repository)
            if not graph_data:
                # Fallback to original text content
                text_content = await file_manager.load_text_content(repository.file_paths.text)
                return SmartContextResult(
                    context_text=text_content or "No context available",
                    context_nodes=[],
                    metadata=ContextMetadata(
                        query_analysis=self._fallback_query_analysis(user_query),
                        total_nodes_available=0,
                        nodes_selected=0,
                        context_completeness=0.0,
                        token_usage_estimate=len(text_content.split()) if text_content else 0,
                        selection_strategy="fallback_full_text",
                        processing_time_ms=int((time.time() - start_time) * 1000)
                    )
                )
            
            # 2. Create graph tools
            graph_tools = GraphFunctionTools(graph_data)
            
            # 3. Analyze query with LLM
            query_analysis = await self.analyze_query_with_llm(
                user_query, graph_tools, repository, max_context_tokens
            )
            
            # Override scope if preference provided
            if scope_preference in ["focused", "moderate", "comprehensive"]:
                query_analysis.scope = scope_preference
            
            # 4. Find relevant nodes using LLM
            relevant_nodes = await self.find_relevant_nodes_with_llm(
                query_analysis, graph_tools, repository, max_context_tokens
            )
            
            # 5. Build context text
            context_text = await self.build_context_from_nodes(
                relevant_nodes, graph_tools, repository
            )
            
            # 6. Calculate metadata
            processing_time = int((time.time() - start_time) * 1000)
            token_estimate = len(context_text.split())
            
            # Calculate completeness based on coverage
            total_nodes = len(graph_data.nodes)
            nodes_selected = len(relevant_nodes)
            completeness = min(1.0, nodes_selected / max(1, total_nodes * 0.1))  # Assume 10% is "complete"
            
            metadata = ContextMetadata(
                query_analysis=query_analysis,
                total_nodes_available=total_nodes,
                nodes_selected=nodes_selected,
                context_completeness=completeness,
                token_usage_estimate=token_estimate,
                selection_strategy="llm_function_calling",
                processing_time_ms=processing_time
            )
            
            return SmartContextResult(
                context_text=context_text,
                context_nodes=relevant_nodes,
                metadata=metadata
            )
            
        except Exception as e:
            print(f"Error in smart context building: {e}")
            # Fallback to simple context
            text_content = await file_manager.load_text_content(repository.file_paths.text)
            return SmartContextResult(
                context_text=text_content or "Error loading context",
                context_nodes=[],
                metadata=ContextMetadata(
                    query_analysis=self._fallback_query_analysis(user_query),
                    total_nodes_available=0,
                    nodes_selected=0,
                    context_completeness=0.0,
                    token_usage_estimate=0,
                    selection_strategy="error_fallback",
                    processing_time_ms=int((time.time() - start_time) * 1000)
                )
            )


# Global instance
graph_search_service = GraphSearchService()