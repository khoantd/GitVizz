"""
Base parser interface for code graph generation.
"""
from abc import ABC, abstractmethod
from typing import Dict, List, Any, Optional
import os


class BaseParser(ABC):
    """
    Base parser interface for code graph generation.
    All language parsers should inherit from this class.
    """
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """
        Initialize the parser with optional configuration.
        
        Args:
            config: Optional configuration dictionary
        """
        self.config = config or {}
        self.nodes = []
        self.edges = []
        self.node_ids = set()  # Track node IDs to avoid duplicates
    
    @abstractmethod
    def parse_file(self, file_path: str) -> Dict[str, Any]:
        """
        Parse a single file and extract nodes and edges.
        
        Args:
            file_path: Path to the file to parse
            
        Returns:
            Dict containing 'nodes' and 'edges' lists
        """
        pass
    
    def parse_directory(self, directory: str, file_extensions: Optional[List[str]] = None) -> Dict[str, Any]:
        """
        Parse all files in a directory with specified extensions.
        
        Args:
            directory: Directory path to parse
            file_extensions: List of file extensions to include (e.g., ['.py', '.js'])
            
        Returns:
            Dict containing 'nodes' and 'edges' lists
        """
        self.nodes = []
        self.edges = []
        self.node_ids = set()
        
        for root, _, files in os.walk(directory):
            for file in files:
                if file_extensions and not any(file.endswith(ext) for ext in file_extensions):
                    continue
                    
                file_path = os.path.join(root, file)
                try:
                    result = self.parse_file(file_path)
                    self._add_unique_nodes(result.get('nodes', []))
                    self.edges.extend(result.get('edges', []))
                except Exception as e:
                    print(f"Error parsing {file_path}: {str(e)}")
        
        return {
            'nodes': self.nodes,
            'edges': self.edges
        }
    
    def _add_unique_nodes(self, nodes: List[Dict[str, Any]]) -> None:
        """
        Add nodes to the graph, ensuring no duplicates by ID.
        
        Args:
            nodes: List of node dictionaries
        """
        for node in nodes:
            if node['id'] not in self.node_ids:
                self.nodes.append(node)
                self.node_ids.add(node['id'])
    
    def get_supported_languages(self) -> List[str]:
        """
        Get the list of languages supported by this parser.
        
        Returns:
            List of language identifiers (e.g., ['python', 'javascript'])
        """
        return []
    
    def get_supported_file_extensions(self) -> Dict[str, List[str]]:
        """
        Get the mapping of supported languages to file extensions.
        
        Returns:
            Dict mapping language identifiers to lists of file extensions
        """
        return {}
