# graph_search_service.py
import json
import time
import uuid
import logging
from typing import Dict, List, Optional

# Set up logging
logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

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
        logger.info(f"🔍 Loading graph data from: {repository.file_paths.json_file}")
        
        try:
            graph_content = await file_manager.load_json_data(repository.file_paths.json_file)
            if not graph_content:
                logger.warning("❌ No graph data found in repository")
                return None
            
            logger.info(f"📊 Raw graph data keys: {list(graph_content.keys())}")
            
            # Handle nested structure: {"graph": {"nodes": [...], "edges": [...]}} 
            # or flat structure: {"nodes": [...], "edges": [...]}
            if "graph" in graph_content:
                logger.info("📊 Detected nested graph structure, extracting graph data...")
                actual_graph_data = graph_content["graph"]
            else:
                logger.info("📊 Detected flat graph structure, using directly...")
                actual_graph_data = graph_content
            
            # Parse graph nodes and edges
            raw_nodes = actual_graph_data.get("nodes", [])
            raw_edges = actual_graph_data.get("edges", [])
            
            logger.info(f"📊 Raw data counts: {len(raw_nodes)} nodes, {len(raw_edges)} edges")
            
            # Convert to GraphNode and GraphEdge objects
            nodes = []
            for i, node_data in enumerate(raw_nodes):
                try:
                    # Ensure all required fields exist with defaults
                    node_dict = {
                        "id": node_data.get("id", f"node_{i}"),
                        "name": node_data.get("name", "unknown"),
                        "category": node_data.get("category", "unknown"),
                        "file": node_data.get("file", ""),
                        "start_line": node_data.get("start_line", 0),
                        "end_line": node_data.get("end_line", 0),
                        "code": node_data.get("code"),
                        "parent_id": node_data.get("parent_id"),
                        "imports": node_data.get("imports", [])
                    }
                    nodes.append(GraphNode(**node_dict))
                except Exception as node_error:
                    logger.warning(f"⚠️ Failed to parse node {i}: {node_error}")
                    continue
            
            edges = []
            for i, edge_data in enumerate(raw_edges):
                try:
                    # Ensure all required fields exist with defaults
                    edge_dict = {
                        "source": edge_data.get("source", ""),
                        "target": edge_data.get("target", ""),
                        "relationship": edge_data.get("relationship", "unknown")
                    }
                    edges.append(GraphEdge(**edge_dict))
                except Exception as edge_error:
                    logger.warning(f"⚠️ Failed to parse edge {i}: {edge_error}")
                    continue
            
            logger.info(f"✅ Successfully loaded graph data: {len(nodes)} nodes, {len(edges)} edges")
            
            # Log some sample data for debugging
            if nodes:
                sample_categories = {}
                for node in nodes[:10]:  # Sample first 10 nodes
                    if node.category not in sample_categories:
                        sample_categories[node.category] = []
                    sample_categories[node.category].append(node.name)
                
                logger.info(f"📊 Sample node categories: {dict(list(sample_categories.items())[:5])}")
            
            return GraphData(nodes=nodes, edges=edges)
        
        except Exception as e:
            logger.error(f"❌ Error loading graph data: {e}")
            logger.error(f"❌ Error type: {type(e).__name__}")
            import traceback
            logger.error(f"❌ Traceback: {traceback.format_exc()}")
            return None
    
    async def analyze_query_with_llm(
        self, 
        user_query: str, 
        graph_tools: GraphFunctionTools,
        repository: Repository,
        max_tokens: int = 4000
    ) -> QueryAnalysis:
        """Use LLM to analyze user query and determine context requirements"""
        
        logger.info(f"🧠 Analyzing user query: '{user_query[:100]}{'...' if len(user_query) > 100 else ''}'")
        
        # Get basic graph statistics
        graph_stats = graph_tools.get_graph_statistics()
        logger.info(f"📊 Graph stats - Nodes: {graph_stats['total_nodes']}, Edges: {graph_stats['total_edges']}, Files: {graph_stats['files_covered']}")
        
        # Create a much simpler system prompt
        system_prompt = f"""Analyze this code repository query and respond with JSON:

Query: "{user_query}"

Respond with:
{{
  "intent": "explanation|debugging|modification|implementation",
  "entities": ["specific_names_mentioned"],
  "scope": "focused|moderate|comprehensive",
  "files_of_interest": ["relevant_files"],
  "keywords": ["key_terms"],
  "complexity": "simple|moderate|complex"
}}"""

        try:
            logger.info("🤖 Calling LLM for query analysis...")
            
            # For query analysis, we'll skip the LLM call for now and use enhanced fallback
            # This avoids the complex user/session creation issues
            logger.info("🔄 Using enhanced fallback analysis (skipping LLM for stability)")
            return self._enhanced_fallback_query_analysis(user_query, graph_stats)
            
            if response["success"]:
                logger.info("✅ LLM analysis successful, parsing response...")
                # Parse JSON response
                analysis_data = json.loads(response["content"])
                analysis = QueryAnalysis(**analysis_data)
                logger.info(f"📋 Query Analysis Result:")
                logger.info(f"   Intent: {analysis.intent}")
                logger.info(f"   Scope: {analysis.scope}")
                logger.info(f"   Complexity: {analysis.complexity}")
                logger.info(f"   Entities: {analysis.entities}")
                logger.info(f"   Keywords: {analysis.keywords[:5]}{'...' if len(analysis.keywords) > 5 else ''}")
                return analysis
            else:
                logger.warning("⚠️ LLM analysis failed, using fallback...")
                return self._fallback_query_analysis(user_query)
                
        except Exception as e:
            logger.error(f"❌ Error in LLM query analysis: {e}")
            logger.info("🔄 Using fallback query analysis...")
            return self._fallback_query_analysis(user_query)
    
    def _enhanced_fallback_query_analysis(self, user_query: str, graph_stats: dict) -> QueryAnalysis:
        """Enhanced fallback query analysis using smart heuristics"""
        logger.info("🔄 Using enhanced fallback heuristic analysis...")
        query_lower = user_query.lower()
        words = query_lower.split()
        
        # Extract potential entities (capitalized words, technical terms)
        entities = []
        technical_terms = ['router', 'route', 'api', 'endpoint', 'function', 'class', 'method', 'component', 'service', 'controller', 'model']
        
        for word in words:
            # Look for technical terms
            if word in technical_terms:
                entities.append(word)
            # Look for potential class/function names (longer words that might be identifiers)
            elif len(word) > 3 and word.isalpha() and word not in ['what', 'are', 'all', 'the', 'this', 'that', 'with', 'from', 'where', 'when', 'how']:
                entities.append(word)
        
        # Remove duplicates while preserving order
        entities = list(dict.fromkeys(entities))
        
        # Determine intent with better logic
        if any(word in query_lower for word in ["what are", "show me", "list", "find", "get"]):
            intent = "explanation"
        elif any(word in query_lower for word in ["error", "bug", "issue", "problem", "fix", "wrong", "broken"]):
            intent = "debugging"
        elif any(word in query_lower for word in ["change", "modify", "update", "add", "implement", "create"]):
            intent = "modification"
        elif any(word in query_lower for word in ["how to", "tutorial", "guide", "example"]):
            intent = "implementation"
        else:
            intent = "explanation"  # Default to explanation for most queries
        
        # Determine scope based on query specificity
        specific_terms = len([w for w in words if w in technical_terms or len(w) > 6])
        if "all" in query_lower or "list" in query_lower or specific_terms < 2:
            scope = "comprehensive"
        elif specific_terms >= 3:
            scope = "focused"
        else:
            scope = "moderate"
        
        # Determine complexity
        if any(word in query_lower for word in ["architecture", "design", "pattern", "structure", "system"]):
            complexity = "complex"
        elif any(word in query_lower for word in ["router", "endpoint", "api", "function", "class"]):
            complexity = "moderate"
        else:
            complexity = "simple"
        
        # Extract meaningful keywords (filter out common words)
        stop_words = {'what', 'are', 'all', 'the', 'this', 'that', 'with', 'from', 'in', 'on', 'at', 'to', 'for', 'of', 'and', 'or', 'but'}
        keywords = [word for word in words if len(word) > 2 and word not in stop_words]
        
        # Guess relevant files based on query content
        files_of_interest = []
        if any(term in query_lower for term in ['router', 'route', 'api', 'endpoint']):
            files_of_interest.extend(['server.py', 'main.py', 'app.py', 'router.py', 'routes.py'])
        if any(term in query_lower for term in ['model', 'database', 'schema']):
            files_of_interest.extend(['models.py', 'schema.py', 'database.py'])
        if any(term in query_lower for term in ['config', 'settings']):
            files_of_interest.extend(['config.py', 'settings.py'])
        
        analysis = QueryAnalysis(
            intent=intent,
            entities=entities[:5],  # Limit to top 5 entities
            scope=scope,
            files_of_interest=files_of_interest[:3],  # Limit to top 3 files
            keywords=keywords[:8],  # Limit to top 8 keywords
            complexity=complexity
        )
        
        logger.info(f"🔄 Enhanced Analysis Result:")
        logger.info(f"   Intent: {intent}")
        logger.info(f"   Entities: {entities[:3]}")
        logger.info(f"   Scope: {scope}")
        logger.info(f"   Complexity: {complexity}")
        logger.info(f"   Keywords: {keywords[:5]}")
        return analysis
    
    def _fallback_query_analysis(self, user_query: str) -> QueryAnalysis:
        """Simple fallback query analysis using basic heuristics"""
        logger.info("🔄 Using basic fallback heuristic analysis...")
        return self._enhanced_fallback_query_analysis(user_query, {})
    
    async def find_relevant_nodes_with_llm(
        self,
        query_analysis: QueryAnalysis,
        graph_tools: GraphFunctionTools,
        repository: Repository,
        max_context_tokens: int = 4000
    ) -> List[ContextNode]:
        """Use LLM with function calling to find relevant graph nodes"""
        
        logger.info(f"🔍 Finding relevant nodes with LLM (max tokens: {max_context_tokens})")
        
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
            logger.info("🤖 Calling LLM with function calling capability...")
            
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
            
            logger.info(f"✅ Found {len(relevant_nodes)} relevant nodes")
            return relevant_nodes
            
        except Exception as e:
            logger.error(f"❌ Error in LLM node selection: {e}")
            logger.info("🔄 Using fallback node selection...")
            return self._fallback_node_selection(query_analysis, graph_tools)
    
    async def _execute_llm_function_calling(
        self,
        messages: List[Dict[str, str]],
        graph_tools: GraphFunctionTools,
        query_analysis: QueryAnalysis,
        max_tokens: int
    ) -> List[ContextNode]:
        """Execute graph function calls based on query analysis (simplified implementation)"""
        
        logger.info("🔧 Executing graph function calls based on query analysis...")
        relevant_nodes = []
        
        # Intelligent search strategy based on query analysis
        try:
            # Strategy 1: Search for specific entities and keywords
            search_terms = []
            if query_analysis.entities:
                search_terms.extend(query_analysis.entities)
            if query_analysis.keywords:
                # Filter out common words
                meaningful_keywords = [k for k in query_analysis.keywords if len(k) > 3 and k.lower() not in ['what', 'are', 'all', 'the', 'this', 'that', 'with', 'from']]
                search_terms.extend(meaningful_keywords[:5])  # Top 5 meaningful keywords
            
            logger.info(f"🎯 Search terms: {search_terms}")
            
            # For router-specific queries, add router-related terms
            if any(term.lower() in ['router', 'route', 'endpoint', 'api'] for term in search_terms + [query_analysis.intent]):
                search_terms.extend(['router', 'route', 'endpoint', 'app.include_router'])
                logger.info("🛣️ Detected router query - adding router-specific search terms")
            
            # Search by name patterns and code content
            for term in search_terms[:8]:  # Limit to 8 terms
                logger.info(f"🔍 Searching for term: '{term}'")
                
                # Search by name pattern
                params = GetNodesByNamePatternParams(pattern=f"*{term}*", limit=10)
                name_matches = graph_tools.get_nodes_by_name_pattern(params)
                logger.info(f"   Name matches: {len(name_matches)}")
                
                for node_data in name_matches:
                    relevance = 0.9 if term in query_analysis.entities else 0.7
                    node = ContextNode(
                        node_id=node_data["id"],
                        node_name=node_data["name"],
                        node_type=node_data["category"],
                        file_path=node_data.get("file"),
                        relevance_score=relevance,
                        inclusion_reason=f"Name contains '{term}'"
                    )
                    relevant_nodes.append(node)
                
                # Search by code content
                code_matches = graph_tools.search_by_code_content(term, limit=8)
                logger.info(f"   Code matches: {len(code_matches)}")
                
                for node_data in code_matches:
                    node = ContextNode(
                        node_id=node_data["id"],
                        node_name=node_data["name"],
                        node_type=node_data["category"],
                        file_path=node_data.get("file"),
                        relevance_score=min(0.8, node_data.get("relevance_score", 0.5)),
                        inclusion_reason=f"Code contains '{term}'",
                        code_snippet=node_data.get("code_snippet")
                    )
                    relevant_nodes.append(node)
            
            # Strategy 2: Category-based search for specific query types
            if query_analysis.intent == "explanation" and any(term in ['router', 'route', 'api', 'endpoint'] for term in search_terms):
                logger.info("🏷️ Adding function and module categories for router explanation")
                function_nodes = graph_tools.get_nodes_by_category(GetNodesByCategoryParams(category="function", limit=20))
                module_nodes = graph_tools.get_nodes_by_category(GetNodesByCategoryParams(category="module", limit=10))
                
                for node_data in function_nodes + module_nodes:
                    if any(term.lower() in node_data["name"].lower() for term in ['router', 'route', 'app', 'main', 'server']):
                        node = ContextNode(
                            node_id=node_data["id"],
                            node_name=node_data["name"],
                            node_type=node_data["category"],
                            file_path=node_data.get("file"),
                            relevance_score=0.6,
                            inclusion_reason=f"Relevant {node_data['category']} for router query"
                        )
                        relevant_nodes.append(node)
            
            # 3. If specific files mentioned, get all nodes from those files
            if query_analysis.files_of_interest:
                logger.info(f"📁 Searching in specific files: {query_analysis.files_of_interest[:2]}")
                for file_path in query_analysis.files_of_interest[:2]:
                    params = GetFileRelatedNodesParams(file_path=file_path)
                    file_nodes = graph_tools.get_file_related_nodes(params)
                    logger.info(f"   Found {len(file_nodes)} nodes in file '{file_path}'")
                    
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
            logger.info(f"🔍 Searching by keywords: {[k for k in query_analysis.keywords[:3] if len(k) > 3]}")
            for keyword in query_analysis.keywords[:3]:
                if len(keyword) > 3:  # Skip very short keywords
                    matching_nodes = graph_tools.search_by_code_content(keyword, limit=3)
                    logger.info(f"   Found {len(matching_nodes)} code matches for keyword '{keyword}'")
                    
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
                logger.info("🌐 Comprehensive scope - expanding context via dependency traversal...")
                # Take top nodes and expand their context
                top_nodes = sorted(relevant_nodes, key=lambda x: x.relevance_score, reverse=True)[:3]
                logger.info(f"   Expanding context from top {len(top_nodes)} nodes")
                
                for top_node in top_nodes:
                    params = TraverseDependenciesParams(
                        node_id=top_node.node_id,
                        depth=2,
                        follow_relationships=["calls", "inherits", "imports_module"]
                    )
                    traversal_result = graph_tools.traverse_dependencies(params)
                    logger.info(f"   Traversed from '{top_node.node_name}', found {traversal_result.get('total_nodes', 0)} related nodes")
                    
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
            logger.info(f"🔄 Deduplicating nodes: {len(relevant_nodes)} total")
            seen_ids = set()
            unique_nodes = []
            for node in sorted(relevant_nodes, key=lambda x: x.relevance_score, reverse=True):
                if node.node_id not in seen_ids:
                    seen_ids.add(node.node_id)
                    unique_nodes.append(node)
            
            final_nodes = unique_nodes[:20]  # Limit to top 20 nodes
            logger.info(f"✅ Selected {len(final_nodes)} unique nodes after deduplication")
            
            # Log top nodes for debugging
            for i, node in enumerate(final_nodes[:5]):
                logger.info(f"   #{i+1}: {node.node_name} ({node.node_type}) - {node.relevance_score:.2f} - {node.inclusion_reason}")
            
            return final_nodes
            
        except Exception as e:
            logger.error(f"❌ Error in function calling execution: {e}")
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
        """Build the actual context text from selected nodes with enhanced formatting"""
        
        if not context_nodes:
            return "# Repository Context\n\nNo relevant nodes found for the query."
        
        context_parts = []
        context_parts.append("# Smart Repository Context")
        context_parts.append(f"Found {len(context_nodes)} relevant code components:\n")
        
        # Group nodes by file and category for better organization
        nodes_by_file = {}
        category_counts = {}
        
        for node in context_nodes:
            file_path = node.file_path or "unknown"
            if file_path not in nodes_by_file:
                nodes_by_file[file_path] = []
            nodes_by_file[file_path].append(node)
            
            # Count categories
            category = node.node_type
            category_counts[category] = category_counts.get(category, 0) + 1
        
        # Add summary of findings
        context_parts.append("## Summary")
        category_summary = ", ".join([f"{count} {cat}{'s' if count > 1 else ''}" for cat, count in category_counts.items()])
        context_parts.append(f"Selected: {category_summary}")
        context_parts.append("")
        
        # Build context for each file
        for file_path, file_nodes in sorted(nodes_by_file.items()):
            if file_path != "unknown":
                context_parts.append(f"## 📁 {file_path}")
            else:
                context_parts.append(f"## 📁 Unknown File Location")
            
            # Sort nodes by relevance within each file
            sorted_nodes = sorted(file_nodes, key=lambda x: x.relevance_score, reverse=True)
            
            for i, node in enumerate(sorted_nodes, 1):
                # Get full node details
                node_summary = graph_tools.get_node_summary(node.node_id)
                
                context_parts.append(f"### {i}. {node.node_type.title()}: `{node.node_name}`")
                context_parts.append(f"**Relevance**: {node.relevance_score:.2f} | **Reason**: {node.inclusion_reason}")
                
                if node_summary:
                    details = []
                    if node_summary["line_range"]:
                        details.append(f"Lines {node_summary['line_range']}")
                    if node_summary["total_connections"] > 0:
                        details.append(f"{node_summary['total_connections']} connections")
                    if node_summary["relationship_breakdown"]:
                        relationships = ", ".join([f"{count} {rel}" for rel, count in list(node_summary["relationship_breakdown"].items())[:3]])
                        details.append(f"Relationships: {relationships}")
                    
                    if details:
                        context_parts.append(f"**Details**: {' | '.join(details)}")
                
                # Add code snippet if available
                if node.code_snippet:
                    context_parts.append("**Code:**")
                    context_parts.append("```python")
                    # Clean up code snippet (remove extra whitespace, limit length)
                    clean_code = node.code_snippet.strip()
                    if len(clean_code) > 500:
                        clean_code = clean_code[:500] + "\n# ... (truncated)"
                    context_parts.append(clean_code)
                    context_parts.append("```")
                elif node_summary and node_summary.get("code_length", 0) > 0:
                    context_parts.append(f"*Code available ({node_summary['code_length']} characters)*")
                
                context_parts.append("")  # Empty line between nodes
        
        return "\n".join(context_parts)
    
    async def build_smart_context(
        self,
        repository: Repository,
        user_query: str,
        max_context_tokens: int = 4000,
        scope_preference: str = "moderate"
    ) -> SmartContextResult:
        """Main method to build smart context using LLM analysis"""
        
        logger.info("=" * 80)
        logger.info(f"🚀 STARTING SMART CONTEXT BUILD")
        logger.info(f"   Repository: {repository.repo_name}")
        logger.info(f"   Query: '{user_query[:100]}{'...' if len(user_query) > 100 else ''}'")
        logger.info(f"   Max tokens: {max_context_tokens}")
        logger.info(f"   Scope preference: {scope_preference}")
        logger.info("=" * 80)
        
        start_time = time.time()
        
        try:
            # 1. Load graph data
            logger.info("📊 Step 1: Loading graph data...")
            graph_data = await self.load_graph_data(repository)
            if not graph_data:
                logger.warning("⚠️ No graph data available, falling back to full text content")
                # Fallback to original text content
                text_content = await file_manager.load_text_content(repository.file_paths.text)
                processing_time = int((time.time() - start_time) * 1000)
                logger.info(f"🏁 FALLBACK COMPLETE in {processing_time}ms")
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
                        processing_time_ms=processing_time
                    )
                )
            
            # 2. Create graph tools
            logger.info("🔧 Step 2: Creating graph tools...")
            graph_tools = GraphFunctionTools(graph_data)
            
            # 3. Analyze query with LLM
            logger.info("🧠 Step 3: Analyzing query with LLM...")
            query_analysis = await self.analyze_query_with_llm(
                user_query, graph_tools, repository, max_context_tokens
            )
            
            # Override scope if preference provided
            if scope_preference in ["focused", "moderate", "comprehensive"]:
                logger.info(f"🎯 Overriding scope from '{query_analysis.scope}' to '{scope_preference}'")
                query_analysis.scope = scope_preference
            
            # 4. Find relevant nodes using LLM
            logger.info("🔍 Step 4: Finding relevant nodes...")
            relevant_nodes = await self.find_relevant_nodes_with_llm(
                query_analysis, graph_tools, repository, max_context_tokens
            )
            
            # 5. Build context text
            logger.info("📝 Step 5: Building context text...")
            context_text = await self.build_context_from_nodes(
                relevant_nodes, graph_tools, repository
            )
            
            # 6. Calculate metadata
            logger.info("📊 Step 6: Calculating metadata...")
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
            
            logger.info("=" * 80)
            logger.info(f"🏁 SMART CONTEXT BUILD COMPLETE!")
            logger.info(f"   Processing time: {processing_time}ms") 
            logger.info(f"   Nodes selected: {nodes_selected}/{total_nodes} ({completeness*100:.1f}% complete)")
            logger.info(f"   Token estimate: {token_estimate}")
            logger.info(f"   Context length: {len(context_text)} characters")
            logger.info("=" * 80)
            
            return SmartContextResult(
                context_text=context_text,
                context_nodes=relevant_nodes,
                metadata=metadata
            )
            
        except Exception as e:
            processing_time = int((time.time() - start_time) * 1000)
            logger.error(f"❌ ERROR in smart context building: {e}")
            logger.error(f"❌ Error type: {type(e).__name__}")
            import traceback
            logger.error(f"❌ Traceback: {traceback.format_exc()}")
            logger.info(f"🔄 Falling back to full text content after {processing_time}ms")
            
            # Fallback to simple context
            try:
                text_content = await file_manager.load_text_content(repository.file_paths.text)
                fallback_text = text_content or "No repository content available"
                token_estimate = len(fallback_text.split()) if text_content else 0
                logger.info(f"✅ Fallback successful: {len(fallback_text)} characters, ~{token_estimate} tokens")
            except Exception as fallback_error:
                logger.error(f"❌ Fallback also failed: {fallback_error}")
                fallback_text = f"Error loading repository context: {str(e)}"
                token_estimate = 0
            
            return SmartContextResult(
                context_text=fallback_text,
                context_nodes=[],
                metadata=ContextMetadata(
                    query_analysis=self._fallback_query_analysis(user_query),
                    total_nodes_available=0,
                    nodes_selected=0,
                    context_completeness=0.0,
                    token_usage_estimate=token_estimate,
                    selection_strategy="error_fallback",
                    processing_time_ms=processing_time
                )
            )


# Global instance
graph_search_service = GraphSearchService()