"""
Graph builder for code graph generation.
Combines multiple parsers to generate a unified graph.
"""
import os
from typing import Dict, List, Any, Optional

from .ast_parser import AstParser
from .tree_sitter_parser import TreeSitterParser
from .codetext_parser import CodetextParser
from .llm_parser import LLMParser


class GraphBuilder:
    """
    Graph builder that combines multiple parsers to generate a unified graph.
    """
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """
        Initialize the graph builder.
        
        Args:
            config: Optional configuration dictionary
        """
        self.config = config or {}
        self.repo_dir = self.config.get('repo_dir', os.path.dirname(os.path.abspath(__file__)))
        
        # Initialize parsers with the same config
        parser_config = {'repo_dir': self.repo_dir, **self.config}
        self.parsers = {
            'ast': AstParser(parser_config),
            'tree_sitter': TreeSitterParser(parser_config),
            'codetext': CodetextParser(parser_config),
            'llm': LLMParser(parser_config)
        }
        
        # Track which parsers are enabled
        self.enabled_parsers = {
            'ast': True,
            'tree_sitter': False,
            'codetext': False,
            'llm': False
        }
        
        # Override with config if provided
        if 'enabled_parsers' in self.config:
            for parser, enabled in self.config['enabled_parsers'].items():
                if parser in self.enabled_parsers:
                    self.enabled_parsers[parser] = enabled
    
    def enable_parser(self, parser_name: str, enabled: bool = True) -> None:
        """
        Enable or disable a parser.
        
        Args:
            parser_name: Name of the parser
            enabled: Whether to enable or disable
        """
        if parser_name in self.enabled_parsers:
            self.enabled_parsers[parser_name] = enabled
    
    def build_graph(self, directory: str = None, formatted_text: str = None) -> Dict[str, Any]:
        """
        Build a graph from the code in the specified directory or from formatted text.
        
        Args:
            directory: Directory to parse (defaults to repo_dir)
            formatted_text: Formatted text to parse with LLM parser (optional)
            
        Returns:
            Dict containing 'nodes' and 'edges' lists
        """
        if directory is None and formatted_text is None:
            directory = self.repo_dir
        
        # Get all file extensions supported by enabled parsers
        self._get_supported_extensions()
        
        # Collect all nodes and edges from enabled parsers
        all_nodes = []
        all_edges = []
        node_ids = set()
        
        # If formatted text is provided, use it with the LLM parser
        if formatted_text and self.enabled_parsers.get('llm', False):
            self.parsers['llm'].formatted_text = formatted_text
        
        for parser_name, parser in self.parsers.items():
            if not self.enabled_parsers[parser_name]:
                continue
                
            result = {}
            
            # Special handling for LLM parser with formatted text
            if parser_name == 'llm' and formatted_text:
                result = parser.parse_formatted_text(formatted_text)
            elif directory:  # Only parse directory if it's provided
                # Get extensions supported by this parser
                parser_extensions = []
                for exts in parser.get_supported_file_extensions().values():
                    parser_extensions.extend(exts)
                
                # Parse directory with this parser
                result = parser.parse_directory(directory, parser_extensions)
            
            # Add unique nodes
            for node in result['nodes']:
                if node['id'] not in node_ids:
                    all_nodes.append(node)
                    node_ids.add(node['id'])
            
            # Add all edges (will be deduplicated later)
            all_edges.extend(result['edges'])
        
        # Deduplicate edges
        unique_edges = self._deduplicate_edges(all_edges)
        
        # Add metadata to the graph
        graph = {
            'nodes': all_nodes,
            'edges': unique_edges,
            'metadata': {
                'parsers': [p for p, enabled in self.enabled_parsers.items() if enabled],
                'node_count': len(all_nodes),
                'edge_count': len(unique_edges),
                'languages': self._get_supported_languages()
            }
        }
        
        return graph
    
    def _get_supported_extensions(self) -> List[str]:
        """
        Get all file extensions supported by enabled parsers.
        
        Returns:
            List of file extensions
        """
        extensions = []
        for parser_name, parser in self.parsers.items():
            if not self.enabled_parsers[parser_name]:
                continue
            
            for exts in parser.get_supported_file_extensions().values():
                extensions.extend(exts)
        
        return list(set(extensions))
    
    def _get_supported_languages(self) -> List[str]:
        """
        Get all languages supported by enabled parsers.
        
        Returns:
            List of languages
        """
        languages = []
        for parser_name, parser in self.parsers.items():
            if not self.enabled_parsers[parser_name]:
                continue
            
            languages.extend(parser.get_supported_languages())
        
        return list(set(languages))
    
    def _deduplicate_edges(self, edges: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Deduplicate edges based on from, to, and type.
        
        Args:
            edges: List of edge dictionaries
            
        Returns:
            List of unique edges
        """
        unique_edges = []
        edge_keys = set()
        
        for edge in edges:
            key = (edge['from'], edge['to'], edge['type'])
            if key not in edge_keys:
                unique_edges.append(edge)
                edge_keys.add(key)
        
        return unique_edges
