"""
AST-based parser for Python code graph generation.
"""
import ast
import os
from typing import Dict, List, Any, Optional

from .base_parser import BaseParser


class AstParser(BaseParser):
    """
    Parser that uses Python's built-in AST module to extract code structure.
    Only works for Python files.
    """
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """
        Initialize the AST parser.
        
        Args:
            config: Optional configuration dictionary
        """
        super().__init__(config)
        self.repo_dir = self.config.get('repo_dir', '')
    
    def parse_file(self, file_path: str) -> Dict[str, Any]:
        """
        Parse a Python file using AST and extract nodes and edges.
        
        Args:
            file_path: Path to the Python file
            
        Returns:
            Dict containing 'nodes' and 'edges' lists
        """
        if not file_path.endswith('.py'):
            return {'nodes': [], 'edges': []}
        
        module = os.path.relpath(file_path, self.repo_dir)
        nodes = []
        edges = []
        
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                tree = ast.parse(f.read(), filename=file_path)
        except Exception as e:
            print(f"Error parsing {file_path}: {str(e)}")
            return {'nodes': [], 'edges': []}
        
        # Set parent attributes for function->class mapping
        for node in ast.iter_child_nodes(tree):
            for child in ast.walk(node):
                for sub in ast.iter_child_nodes(child):
                    sub.parent = child
        
        # Extract classes and functions
        for node in ast.walk(tree):
            if isinstance(node, ast.ClassDef):
                class_name = f"{module}:{node.name}"
                nodes.append({
                    "id": class_name, 
                    "label": node.name, 
                    "type": "class",
                    "module": module,
                    "docstring": ast.get_docstring(node) or "",
                    "line": node.lineno
                })
                
                # Inheritance edges
                for base in node.bases:
                    if isinstance(base, ast.Name):
                        base_name = f"{module}:{base.id}"
                        edges.append({
                            "from": base_name, 
                            "to": class_name, 
                            "type": "inherits"
                        })
            
            elif isinstance(node, ast.FunctionDef):
                func_name = f"{module}:{node.name}"
                nodes.append({
                    "id": func_name, 
                    "label": node.name, 
                    "type": "function",
                    "module": module,
                    "docstring": ast.get_docstring(node) or "",
                    "line": node.lineno
                })
                
                # If inside a class, relate to class
                parent = getattr(node, 'parent', None)
                if parent and isinstance(parent, ast.ClassDef):
                    class_name = f"{module}:{parent.name}"
                    edges.append({
                        "from": class_name, 
                        "to": func_name, 
                        "type": "method"
                    })
                
                # Function calls
                for child in ast.walk(node):
                    if isinstance(child, ast.Call):
                        if isinstance(child.func, ast.Name):
                            callee = child.func.id
                            callee_name = f"{module}:{callee}"
                            edges.append({
                                "from": func_name, 
                                "to": callee_name, 
                                "type": "calls"
                            })
        
        return {'nodes': nodes, 'edges': edges}
    
    def get_supported_languages(self) -> List[str]:
        """
        Get the list of languages supported by this parser.
        
        Returns:
            List containing only 'python'
        """
        return ['python']
    
    def get_supported_file_extensions(self) -> Dict[str, List[str]]:
        """
        Get the mapping of supported languages to file extensions.
        
        Returns:
            Dict mapping 'python' to ['.py']
        """
        return {'python': ['.py']}
