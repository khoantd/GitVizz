"""
Tree-sitter based parser for code graph generation.
"""
import os
from typing import Dict, List, Any, Optional

from tree_sitter import Parser, Language
import tree_sitter_python

from .base_parser import BaseParser


class TreeSitterParser(BaseParser):
    """
    Parser that uses tree-sitter to extract code structure.
    Currently supports Python, but can be extended to other languages.
    """
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """
        Initialize the Tree-sitter parser.
        
        Args:
            config: Optional configuration dictionary
        """
        super().__init__(config)
        self.repo_dir = self.config.get('repo_dir', '')
        
        # Initialize Python language parser
        self.parser = Parser()
        # Get the Python language from the tree-sitter-python package
        # Wrap the language in a Language object as required by the tree-sitter API
        self.py_language = Language(tree_sitter_python.language())
        # Set the language on the parser
        self.parser.language = self.py_language
        
        # Query for Python functions and classes
        # Create a query string for Python functions and classes
        self.query_string = """
            (class_definition
              name: (identifier) @class.name
              body: (block) @class.body)
            
            (function_definition
              name: (identifier) @function.name
              parameters: (parameters) @function.params
              body: (block) @function.body)
              
            (call
              function: (identifier) @call.name)
        """
        # Create the query from the string
        self.py_query = self.py_language.query(self.query_string)
    
    def parse_file(self, file_path: str) -> Dict[str, Any]:
        """
        Parse a file using tree-sitter and extract nodes and edges.
        
        Args:
            file_path: Path to the file
            
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
                source_code = f.read()
                tree = self.parser.parse(bytes(source_code, "utf8"))
        except Exception as e:
            print(f"Error parsing {file_path} with tree-sitter: {str(e)}")
            return {'nodes': [], 'edges': []}
        
        # Dictionary to store class and function nodes by their name
        class_nodes = {}
        function_nodes = {}
        
        # Process the query captures
        source_bytes = bytes(source_code, "utf8")
        captures = self.py_query.captures(tree.root_node, source_bytes)
        
        # First pass: collect all classes and functions
        for capture in captures:
            node, capture_name = capture
            
            if capture_name == "class.name":
                class_name = source_code[node.start_byte:node.end_byte]
                full_name = f"{module}:{class_name}"
                
                # Extract docstring if available
                docstring = self._extract_docstring(node.parent, source_code)
                
                # Extract the full class code
                class_body_node = node.parent
                class_code = source_code[class_body_node.start_byte:class_body_node.end_byte]
                
                class_nodes[class_name] = {
                    "id": full_name,
                    "label": class_name,
                    "type": "class",
                    "module": module,
                    "docstring": docstring,
                    "line": node.start_point[0] + 1,
                    "code": class_code
                }
                nodes.append(class_nodes[class_name])
            
            elif capture_name == "function.name":
                func_name = source_code[node.start_byte:node.end_byte]
                full_name = f"{module}:{func_name}"
                
                # Extract docstring if available
                docstring = self._extract_docstring(node.parent, source_code)
                
                # Check if function is inside a class
                parent_class = self._get_parent_class(node.parent, source_code)
                
                # Extract the full function code
                func_body_node = node.parent
                func_code = source_code[func_body_node.start_byte:func_body_node.end_byte]
                
                function_nodes[func_name] = {
                    "id": full_name,
                    "label": func_name,
                    "type": "function",
                    "module": module,
                    "docstring": docstring,
                    "line": node.start_point[0] + 1,
                    "parent_class": parent_class,
                    "code": func_code
                }
                nodes.append(function_nodes[func_name])
        
        # Second pass: create edges
        for func_name, func_data in function_nodes.items():
            # If function has a parent class, add method edge
            if func_data["parent_class"]:
                parent_class_name = func_data["parent_class"]
                parent_class_id = f"{module}:{parent_class_name}"
                
                edges.append({
                    "from": parent_class_id,
                    "to": func_data["id"],
                    "type": "method"
                })
        
        # Find function calls
        for capture in captures:
            node, capture_name = capture
            
            if capture_name == "call.name":
                callee_name = source_code[node.start_byte:node.end_byte]
                
                # Find the function that contains this call
                parent_func = self._get_parent_function(node, source_code)
                if parent_func:
                    caller_id = f"{module}:{parent_func}"
                    callee_id = f"{module}:{callee_name}"
                    
                    edges.append({
                        "from": caller_id,
                        "to": callee_id,
                        "type": "calls"
                    })
        
        return {'nodes': nodes, 'edges': edges}
    
    def _extract_docstring(self, node, source_code: str) -> str:
        """
        Extract docstring from a class or function node.
        
        Args:
            node: Tree-sitter node
            source_code: Source code string
            
        Returns:
            Docstring text or empty string
        """
        # Find the body block
        body_node = None
        for child in node.children:
            if child.type == "block":
                body_node = child
                break
        
        if not body_node or len(body_node.children) < 2:
            return ""
        
        # Check if first statement in body is an expression statement with a string
        first_stmt = body_node.children[1]  # Skip the ':' token
        if first_stmt.type == "expression_statement":
            for child in first_stmt.children:
                if child.type == "string":
                    # Extract the string content
                    docstring = source_code[child.start_byte:child.end_byte]
                    # Remove quotes
                    docstring = docstring.strip('"""').strip("'''").strip('"').strip("'")
                    return docstring
        
        return ""
    
    def _get_parent_class(self, func_node, source_code: str) -> str:
        """
        Determine if a function is inside a class.
        
        Args:
            func_node: Function node
            source_code: Source code string
            
        Returns:
            Class name or empty string
        """
        current = func_node.parent
        while current:
            if current.type == "class_definition":
                for child in current.children:
                    if child.type == "identifier":
                        return source_code[child.start_byte:child.end_byte]
                return ""
            current = current.parent
        
        return ""
    
    def _get_parent_function(self, call_node, source_code: str) -> str:
        """
        Find the function that contains a call node.
        
        Args:
            call_node: Call node
            source_code: Source code string
            
        Returns:
            Function name or empty string
        """
        current = call_node.parent
        while current:
            if current.type == "function_definition":
                for child in current.children:
                    if child.type == "identifier":
                        return source_code[child.start_byte:child.end_byte]
                return ""
            current = current.parent
        
        return ""
    
    def get_supported_languages(self) -> List[str]:
        """
        Get the list of languages supported by this parser.
        
        Returns:
            List containing only 'python' for now
        """
        return ['python']
    
    def get_supported_file_extensions(self) -> Dict[str, List[str]]:
        """
        Get the mapping of supported languages to file extensions.
        
        Returns:
            Dict mapping 'python' to ['.py']
        """
        return {'python': ['.py']}
