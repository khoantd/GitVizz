"""
Codetext-based parser for code graph generation.
"""
import os
from typing import Dict, List, Any, Optional

from codetext.parser import (
    PythonParser, JavaParser, JavascriptParser, 
    GoParser, RubyParser, CppParser, CsharpParser, 
    PhpParser, RustParser
)

from .base_parser import BaseParser


class CodetextParser(BaseParser):
    """
    Parser that uses codetext to extract code structure.
    Supports multiple languages.
    """
    
    # Language to parser mapping
    LANGUAGE_PARSERS = {
        'python': PythonParser,
        'java': JavaParser,
        'javascript': JavascriptParser,
        'go': GoParser,
        'ruby': RubyParser,
        'cpp': CppParser,
        'c': CppParser,  # C uses the same parser as C++
        'c_sharp': CsharpParser,
        'php': PhpParser,
        'rust': RustParser
    }
    
    # File extension to language mapping
    EXTENSION_MAP = {
        '.py': 'python',
        '.java': 'java',
        '.js': 'javascript',
        '.jsx': 'javascript',
        '.ts': 'javascript',
        '.tsx': 'javascript',
        '.go': 'go',
        '.rb': 'ruby',
        '.cpp': 'cpp',
        '.cc': 'cpp',
        '.c': 'c',
        '.h': 'c',
        '.hpp': 'cpp',
        '.cs': 'c_sharp',
        '.php': 'php',
        '.rs': 'rust'
    }
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """
        Initialize the Codetext parser.
        
        Args:
            config: Optional configuration dictionary
        """
        super().__init__(config)
        self.repo_dir = self.config.get('repo_dir', '')
    
    def parse_file(self, file_path: str) -> Dict[str, Any]:
        """
        Parse a file using codetext and extract nodes and edges.
        
        Args:
            file_path: Path to the file
            
        Returns:
            Dict containing 'nodes' and 'edges' lists
        """
        # Get file extension and determine language
        _, ext = os.path.splitext(file_path)
        if ext not in self.EXTENSION_MAP:
            return {'nodes': [], 'edges': []}
        
        language = self.EXTENSION_MAP[ext]
        parser_class = self.LANGUAGE_PARSERS.get(language)
        
        if not parser_class:
            return {'nodes': [], 'edges': []}
        
        module = os.path.relpath(file_path, self.repo_dir)
        nodes = []
        edges = []
        
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                source_code = f.read()
        except Exception as e:
            print(f"Error reading {file_path}: {str(e)}")
            return {'nodes': [], 'edges': []}
        
        try:
            # Parse the code using tree-sitter (used by codetext)
            from tree_sitter import Parser
            parser = Parser()
            
            # Get appropriate language
            if language == 'python':
                import tree_sitter_python
                from tree_sitter import Language
                lang = Language(tree_sitter_python.language())
                parser.set_language(lang)
            else:
                # For other languages, you would need to load the appropriate language
                # This is a simplified version, you might need to add more language support
                return {'nodes': [], 'edges': []}
            
            tree = parser.parse(bytes(source_code, "utf8"))
            
            # Get classes and functions
            class_nodes = parser_class.get_class_list(tree.root_node)
            function_nodes = parser_class.get_function_list(tree.root_node)
            
            # Process classes
            for class_node in class_nodes:
                class_meta = parser_class.get_class_metadata(class_node)
                class_name = class_meta.get('identifier', '')
                if not class_name:
                    continue
                
                full_name = f"{module}:{class_name}"
                docstring = parser_class.get_docstring(class_node) or ""
                
                nodes.append({
                    "id": full_name,
                    "label": class_name,
                    "type": "class",
                    "module": module,
                    "docstring": docstring,
                    "line": class_node.start_point[0] + 1
                })
                
                # Process inheritance
                for parent_class, _ in class_meta.get('parameters', {}).items():
                    parent_full_name = f"{module}:{parent_class}"
                    edges.append({
                        "from": parent_full_name,
                        "to": full_name,
                        "type": "inherits"
                    })
            
            # Process functions
            for func_node in function_nodes:
                func_meta = parser_class.get_function_metadata(func_node)
                func_name = func_meta.get('identifier', '')
                if not func_name:
                    continue
                
                full_name = f"{module}:{func_name}"
                docstring = parser_class.get_docstring(func_node) or ""
                
                # Check if function is inside a class
                parent_class = self._get_parent_class(func_node, class_nodes, parser_class)
                
                nodes.append({
                    "id": full_name,
                    "label": func_name,
                    "type": "function",
                    "module": module,
                    "docstring": docstring,
                    "line": func_node.start_point[0] + 1
                })
                
                # If function has a parent class, add method edge
                if parent_class:
                    parent_full_name = f"{module}:{parent_class}"
                    edges.append({
                        "from": parent_full_name,
                        "to": full_name,
                        "type": "method"
                    })
            
        except Exception as e:
            print(f"Error parsing {file_path} with codetext: {str(e)}")
            return {'nodes': [], 'edges': []}
        
        return {'nodes': nodes, 'edges': edges}
    
    def _get_parent_class(self, func_node, class_nodes, parser_class) -> str:
        """
        Determine if a function is inside a class.
        
        Args:
            func_node: Function node
            class_nodes: List of class nodes
            parser_class: Language parser class
            
        Returns:
            Class name or empty string
        """
        func_start = func_node.start_point[0]
        func_end = func_node.end_point[0]
        
        for class_node in class_nodes:
            class_start = class_node.start_point[0]
            class_end = class_node.end_point[0]
            
            # If function is within class bounds
            if class_start <= func_start and func_end <= class_end:
                class_meta = parser_class.get_class_metadata(class_node)
                return class_meta.get('identifier', '')
        
        return ""
    
    def get_supported_languages(self) -> List[str]:
        """
        Get the list of languages supported by this parser.
        
        Returns:
            List of supported languages
        """
        return list(self.LANGUAGE_PARSERS.keys())
    
    def get_supported_file_extensions(self) -> Dict[str, List[str]]:
        """
        Get the mapping of supported languages to file extensions.
        
        Returns:
            Dict mapping languages to file extensions
        """
        result = {}
        for ext, lang in self.EXTENSION_MAP.items():
            if lang not in result:
                result[lang] = []
            result[lang].append(ext)
        return result
