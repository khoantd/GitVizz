from abc import ABC, abstractmethod
from typing import List, Dict, Any, Tuple, Optional
import ast
import re
from pathlib import Path
from pyvis.network import Network

# Graph Data Structures
GraphNodeData = Dict[str, Any]  # Detailed below
GraphEdgeData = Dict[str, Any]  # Detailed below

# Expected structure for GraphNodeData:
# {
#     "id": str,  # Fully qualified name, e.g., my.module.MyClass.my_method or my.module
#     "name": str,  # Simple name, e.g., my_method or my_module
#     "category": str,  # 'module', 'class', 'function', 'method', 'import_statement'
#     "file": str,  # File path relative to repo root
#     "start_line": int,
#     "end_line": int,
#     "code": Optional[str],  # Code snippet
#     "parent_id": Optional[str], # ID of the parent node (e.g., class for a method, module for a class/function)
#     "imports": Optional[List[Dict[str,str]]], # For module nodes: [{"name": "os", "alias": "my_os", "source_module": "os"}]
# }

# Expected structure for GraphEdgeData:
# {
#     "source": str,  # Source node_id
#     "target": str,  # Target node_id
#     "relationship": str,  # 'defines_class', 'defines_function', 'defines_method',
#                           # 'inherits', 'calls', 'imports_module', 'imports_symbol', 'references_symbol'
#     "file": Optional[str], # File where the relationship is observed (e.g., a call site)
#     "line": Optional[int]  # Line number of the relationship (e.g., call site line)
# }


def _get_node_end_line(node: ast.AST) -> int:
    """Safely get end_lineno for an AST node."""
    if hasattr(node, "end_lineno") and node.end_lineno is not None:
        return node.end_lineno
    return node.lineno  # Fallback for older Python or nodes without explicit end


class LanguageParser(ABC):
    @abstractmethod
    def parse(
        self, files: List[Dict[str, Any]], all_files_content: Dict[str, str]
    ) -> Tuple[List[GraphNodeData], List[GraphEdgeData]]:
        """
        Parses a list of files of a specific language and extracts graph nodes and edges.
        Each file in the list is a dictionary with at least 'path' and 'content'.
        all_files_content provides content of all files for cross-file analysis if needed.
        """
        pass


class PythonParser(LanguageParser):
    def parse(
        self, files: List[Dict[str, Any]], all_files_content: Dict[str, str]
    ) -> Tuple[List[GraphNodeData], List[GraphEdgeData]]:
        nodes_data: List[GraphNodeData] = []
        edges_data: List[GraphEdgeData] = []

        # To store module-level import information: {module_path: {alias: full_imported_name}}
        self.module_imports: Dict[str, Dict[str, str]] = {}
        # To store defined symbols for resolution: {fully_qualified_name: node_details}
        self.defined_symbols: Dict[str, GraphNodeData] = {}

        # First pass: Define modules, classes, functions and gather imports
        for file_data in files:
            if not file_data["path"].endswith(".py"):
                continue

            file_path = file_data["path"]
            module_name_from_path = file_path.replace("/", ".").rstrip(".py")

            # Create module node
            module_node_id = module_name_from_path
            module_node: GraphNodeData = {
                "id": module_node_id,
                "name": module_name_from_path.split(".")[-1],
                "category": "module",
                "file": file_path,
                "start_line": 1,
                "end_line": len(file_data["content"].splitlines()),  # Approximate
                "code": None,
                "parent_id": None,
                "imports": [],
            }
            nodes_data.append(module_node)
            self.defined_symbols[module_node_id] = module_node
            self.module_imports[file_path] = {}

            try:
                tree = ast.parse(file_data["content"], filename=file_path)
                for node in ast.walk(tree):
                    for child in ast.iter_child_nodes(node):
                        setattr(child, "parent_ast_node", node)  # For context

                for node in tree.body:  # Top-level statements
                    if isinstance(node, ast.Import):
                        for alias in node.names:
                            imported_name = alias.name
                            as_name = alias.asname or imported_name
                            self.module_imports[file_path][as_name] = imported_name
                            if module_node.get("imports"):
                                module_node["imports"].append(
                                    {
                                        "name": imported_name,
                                        "alias": as_name,
                                        "source_module": imported_name,
                                    }
                                )
                    elif isinstance(node, ast.ImportFrom):
                        from_module = (
                            node.module or ""
                        )  # Relative imports might have module as None initially
                        # TODO: Resolve relative imports based on file_path and project structure
                        for alias in node.names:
                            imported_name = alias.name
                            as_name = alias.asname or imported_name
                            full_imported_name = f"{from_module}.{imported_name}"
                            self.module_imports[file_path][as_name] = full_imported_name
                            if module_node.get("imports"):
                                module_node["imports"].append(
                                    {
                                        "name": imported_name,
                                        "alias": as_name,
                                        "source_module": from_module,
                                    }
                                )

                    elif isinstance(node, ast.ClassDef):
                        class_id = f"{module_node_id}.{node.name}"
                        class_node: GraphNodeData = {
                            "id": class_id,
                            "name": node.name,
                            "category": "class",
                            "file": file_path,
                            "start_line": node.lineno,
                            "end_line": _get_node_end_line(node),
                            "code": ast.unparse(node)
                            if hasattr(ast, "unparse")
                            else "Code unavailable",
                            "parent_id": module_node_id,
                        }
                        nodes_data.append(class_node)
                        self.defined_symbols[class_id] = class_node
                        edges_data.append(
                            {
                                "source": module_node_id,
                                "target": class_id,
                                "relationship": "defines_class",
                                "file": file_path,
                                "line": node.lineno,
                            }
                        )

                        for func_node in node.body:
                            if isinstance(func_node, ast.FunctionDef):
                                method_id = f"{class_id}.{func_node.name}"
                                method_node: GraphNodeData = {
                                    "id": method_id,
                                    "name": func_node.name,
                                    "category": "method",
                                    "file": file_path,
                                    "start_line": func_node.lineno,
                                    "end_line": _get_node_end_line(func_node),
                                    "code": ast.unparse(func_node)
                                    if hasattr(ast, "unparse")
                                    else "Code unavailable",
                                    "parent_id": class_id,
                                }
                                nodes_data.append(method_node)
                                self.defined_symbols[method_id] = method_node
                                edges_data.append(
                                    {
                                        "source": class_id,
                                        "target": method_id,
                                        "relationship": "defines_method",
                                        "file": file_path,
                                        "line": func_node.lineno,
                                    }
                                )

                    elif isinstance(node, ast.FunctionDef):
                        func_id = f"{module_node_id}.{node.name}"
                        func_node_data: GraphNodeData = {
                            "id": func_id,
                            "name": node.name,
                            "category": "function",
                            "file": file_path,
                            "start_line": node.lineno,
                            "end_line": _get_node_end_line(node),
                            "code": ast.unparse(node)
                            if hasattr(ast, "unparse")
                            else "Code unavailable",
                            "parent_id": module_node_id,
                        }
                        nodes_data.append(func_node_data)
                        self.defined_symbols[func_id] = func_node_data
                        edges_data.append(
                            {
                                "source": module_node_id,
                                "target": func_id,
                                "relationship": "defines_function",
                                "file": file_path,
                                "line": node.lineno,
                            }
                        )
            except Exception as e:
                print(f"Error parsing Python file (pass 1) {file_path}: {e}")
                continue

        # Second pass: Resolve calls, inheritance, and other relationships
        for file_data in files:
            if not file_data["path"].endswith(".py"):
                continue
            file_path = file_data["path"]
            module_name_from_path = file_path.replace("/", ".").rstrip(".py")
            current_module_id = module_name_from_path

            try:
                tree = ast.parse(file_data["content"], filename=file_path)
                # Assign parent AST nodes for context
                for node_walker in ast.walk(tree):
                    for child in ast.iter_child_nodes(node_walker):
                        setattr(child, "parent_ast_node", node_walker)

                for node in ast.walk(tree):
                    current_context_id = self._get_context_id(node, current_module_id)

                    if isinstance(node, ast.ClassDef):
                        class_id = f"{current_module_id}.{node.name}"
                        for base_node in node.bases:
                            base_name = (
                                ast.unparse(base_node)
                                if hasattr(ast, "unparse")
                                else "unknown_base"
                            )
                            resolved_base_id = self._resolve_symbol(
                                base_name, file_path, current_module_id
                            )
                            if (
                                resolved_base_id
                            ):  # Check if resolved_base_id is in self.defined_symbols
                                target_id = resolved_base_id
                            else:  # Fallback or create a placeholder external node
                                target_id = base_name  # Could be external or unresolved
                            if self.defined_symbols.get(
                                target_id
                            ) or not target_id.startswith(
                                current_module_id
                            ):  # Link if defined or external
                                edges_data.append(
                                    {
                                        "source": class_id,
                                        "target": target_id,
                                        "relationship": "inherits",
                                        "file": file_path,
                                        "line": base_node.lineno,
                                    }
                                )

                    elif isinstance(node, ast.Call):
                        if not current_context_id:
                            continue  # Call is not in a defined function/method

                        callee_name_str = ""
                        if isinstance(
                            node.func, ast.Name
                        ):  # Direct function call: my_func()
                            callee_name_str = node.func.id
                        elif isinstance(
                            node.func, ast.Attribute
                        ):  # Attribute call: obj.method() or module.func()
                            # Try to reconstruct the full attribute path
                            # This is simplified; proper resolution needs type inference
                            obj_name = (
                                ast.unparse(node.func.value)
                                if hasattr(ast, "unparse")
                                else "unknown_object"
                            )
                            callee_name_str = f"{obj_name}.{node.func.attr}"

                        if callee_name_str:
                            resolved_callee_id = self._resolve_symbol(
                                callee_name_str, file_path, current_module_id
                            )
                            if resolved_callee_id:
                                target_id = resolved_callee_id
                            else:
                                target_id = callee_name_str  # External or unresolved

                            # Add edge if target is defined or seems to be an external fully qualified name
                            if self.defined_symbols.get(target_id) or (
                                "." in target_id
                                and not target_id.startswith(current_module_id)
                            ):
                                edges_data.append(
                                    {
                                        "source": current_context_id,
                                        "target": target_id,
                                        "relationship": "calls",
                                        "file": file_path,
                                        "line": node.lineno,
                                    }
                                )
            except Exception as e:
                print(f"Error parsing Python file (pass 2) {file_path}: {e}")
                continue

        return nodes_data, edges_data

    def _get_context_id(self, ast_node: ast.AST, module_id: str) -> Optional[str]:
        """Helper to find the ID of the function/method/class containing the ast_node."""
        node = ast_node
        while node:
            if isinstance(node, ast.FunctionDef):
                parent = getattr(node, "parent_ast_node", None)
                if isinstance(parent, ast.ClassDef):
                    return f"{module_id}.{parent.name}.{node.name}"
                return f"{module_id}.{node.name}"
            elif isinstance(node, ast.ClassDef):
                return f"{module_id}.{node.name}"
            node = getattr(node, "parent_ast_node", None)
        return module_id  # Default to module if not in a specific context

    def _resolve_symbol(
        self, name: str, current_file_path: str, current_module_id: str
    ) -> Optional[str]:
        """Try to resolve a symbol name to its fully qualified ID."""
        # 1. Check if it's a defined symbol in the current module (already fully qualified if so)
        if name in self.defined_symbols:
            return name  # e.g. name is already "module.Class"

        # 2. Check if it's a direct name within the current module's scope
        potential_local_id = f"{current_module_id}.{name}"
        if potential_local_id in self.defined_symbols:
            return potential_local_id

        # 3. Check imports for the current file
        imports = self.module_imports.get(current_file_path, {})
        parts = name.split(".", 1)
        first_part = parts[0]

        if first_part in imports:
            imported_base = imports[
                first_part
            ]  # This could be 'module_x' or 'module_x.SymbolY'
            if len(parts) > 1:  # e.g. name is 'alias.sub_symbol'
                # If imported_base is 'module_x', then target is 'module_x.sub_symbol'
                # If imported_base is 'module_x.SymbolY' (and SymbolY is a class/obj), then this is an attribute access
                # This part needs more robust handling of whether imported_base is a module or a symbol itself
                if (
                    imported_base in self.defined_symbols
                    and self.defined_symbols[imported_base]["category"] == "module"
                ):
                    return f"{imported_base}.{parts[1]}"
                return (
                    f"{imported_base}.{parts[1]}"
                    if "." not in imported_base
                    else imported_base
                )  # Heuristic
            else:  # e.g. name is 'alias'
                return imported_base  # This is the fully_qualified_name of the import

        # 4. Check builtins (simplified) - Python's AST doesn't easily distinguish them without more context
        # if name in __builtins__: return f"builtins.{name}"

        # 5. If it contains '.', assume it might be an already fully qualified name from another module
        if "." in name:
            if name in self.defined_symbols:  # Check if it's a known FQN
                return name
            # It could be an FQN not yet in defined_symbols if it's from a file not yet parsed or an external lib
            # For now, we return it as is, and graph rendering will show it as a distinct node.
            return name

        return None  # Cannot resolve


class JavaScriptParser(LanguageParser):
    def parse(
        self, files: List[Dict[str, Any]], all_files_content: Dict[str, str]
    ) -> Tuple[List[GraphNodeData], List[GraphEdgeData]]:
        nodes_data: List[GraphNodeData] = []
        edges_data: List[GraphEdgeData] = []

        # Regex for functions, classes, and basic imports/exports.
        # WARNING: Regex-based parsing for JS/TS is very limited and error-prone.
        # A proper AST parser (e.g., esprima, acorn, or tree-sitter) is highly recommended for robust analysis.

        # function funcName(...) or const funcName = (...) => { ... } or let funcName = function(...)
        function_pattern = re.compile(
            r"^\s*(?:async\s+)?function\s+([a-zA-Z0-9_]+)\s*\(|"  # function foo()
            r"^\s*(?:const|let|var)\s+([a-zA-Z0-9_]+)\s*=\s*(?:async\s*)?\(?[^)]*\)?\s*=>|"  # const foo = () =>
            r"^\s*(?:const|let|var)\s+([a-zA-Z0-9_]+)\s*=\s*function\s*\(",  # const foo = function()
            re.MULTILINE,
        )

        class_pattern = re.compile(
            r"^\s*class\s+([a-zA-Z0-9_]+)(?:\s+extends\s+([a-zA-Z0-9_]+))?",
            re.MULTILINE,
        )

        # import defaultExport from 'module'; import { namedExport } from 'module'; import * as name from 'module';
        import_pattern = re.compile(
            r"import\s+(?:(.+?)\s+from\s+)?['\"]([^'\"]+)['\"]", re.MULTILINE
        )
        # export function/class ...; export default ...; export { name }
        export_pattern = re.compile(
            r"export\s+(?:(?:default\s+)?(?:function|class)\s+([a-zA-Z0-9_]+)|(?:\{(.+?)\}))",
            re.MULTILINE,
        )

        for file_data in files:
            path = file_data["path"]
            if not (path.endswith((".js", ".jsx", ".ts", ".tsx"))):
                continue

            content = file_data["content"]
            # Module ID from path, similar to Python
            module_id = path.replace("/", ".").rsplit(".", 1)[0]

            # Create module node
            module_node: GraphNodeData = {
                "id": module_id,
                "name": module_id.split(".")[-1],
                "category": "module",
                "file": path,
                "start_line": 1,
                "end_line": len(content.splitlines()),
                "code": None,
                "parent_id": None,
                "imports": [],
            }
            nodes_data.append(module_node)

            lines = content.splitlines()
            for lineno_idx, line_content in enumerate(lines):
                lineno = lineno_idx + 1

                # Functions
                for match in function_pattern.finditer(line_content):
                    func_name = match.group(1) or match.group(2) or match.group(3)
                    if func_name:
                        node_id = f"{module_id}.{func_name}"
                        # End line is hard with regex; for now, assume single line or use next non-empty line as heuristic
                        nodes_data.append(
                            {
                                "id": node_id,
                                "name": func_name,
                                "category": "function",
                                "file": path,
                                "start_line": lineno,
                                "end_line": lineno,  # Simplified
                                "code": line_content.strip(),
                                "parent_id": module_id,
                            }
                        )
                        edges_data.append(
                            {
                                "source": module_id,
                                "target": node_id,
                                "relationship": "defines_function",
                                "file": path,
                                "line": lineno,
                            }
                        )

                # Classes
                class_match = class_pattern.search(line_content)
                if class_match:
                    class_name = class_match.group(1)
                    base_class_name = class_match.group(2)
                    node_id = f"{module_id}.{class_name}"
                    nodes_data.append(
                        {
                            "id": node_id,
                            "name": class_name,
                            "category": "class",
                            "file": path,
                            "start_line": lineno,
                            "end_line": lineno,  # Simplified
                            "code": line_content.strip(),
                            "parent_id": module_id,
                        }
                    )
                    edges_data.append(
                        {
                            "source": module_id,
                            "target": node_id,
                            "relationship": "defines_class",
                            "file": path,
                            "line": lineno,
                        }
                    )
                    if base_class_name:
                        # Attempt to resolve base_class_name later or treat as external
                        target_base_id = (
                            f"{module_id}.{base_class_name}"  # Assume local for now
                        )
                        edges_data.append(
                            {
                                "source": node_id,
                                "target": target_base_id,
                                "relationship": "inherits",
                                "file": path,
                                "line": lineno,
                            }
                        )

                # Imports (very basic)
                for imp_match in import_pattern.finditer(line_content):
                    imported_items = imp_match.group(
                        1
                    )  # e.g., " D, { A, B as C }" or " * as ns "
                    source_module_path = imp_match.group(2)
                    # Create an 'imports_module' edge from current module to the source_module_path (treated as an ID)
                    # This doesn't create fine-grained symbol import edges yet.
                    target_module_like_id = (
                        source_module_path  # Could be relative, needs resolution
                    )
                    edges_data.append(
                        {
                            "source": module_id,
                            "target": target_module_like_id,
                            "relationship": "imports_module",
                            "file": path,
                            "line": lineno,
                        }
                    )
                    if module_node.get("imports") is not None:  # type guard
                        module_node["imports"].append(
                            {
                                "name": imported_items or source_module_path,
                                "alias": None,
                                "source_module": source_module_path,
                            }
                        )

        print(
            f"JS Parser found {len(nodes_data) - len(files)} entities in {len(files)} JS/TS files (excluding module nodes)."
        )
        return nodes_data, edges_data


class GraphGenerator:
    def __init__(self, files: List[Dict[str, Any]], output_html_path: str):
        self.files = files  # List of {"path": str, "content": str, "full_path": str}
        self.output_html_path = output_html_path
        self.parsers: Dict[str, LanguageParser] = {
            ".py": PythonParser(),
            ".js": JavaScriptParser(),
            ".jsx": JavaScriptParser(),
            ".ts": JavaScriptParser(),
            ".tsx": JavaScriptParser(),
        }
        self.all_nodes_data: List[GraphNodeData] = []
        self.all_edges_data: List[GraphEdgeData] = []
        self.node_details_map: Dict[str, GraphNodeData] = {}  # For quick lookup by ID

    def _get_parser(self, file_path: str) -> Optional[LanguageParser]:
        extension = Path(file_path).suffix.lower()
        return self.parsers.get(extension)

    def _generate_graph_elements(self):
        grouped_files_by_parser: Dict[LanguageParser, List[Dict[str, Any]]] = {}
        all_files_content = {
            file_data["path"]: file_data["content"] for file_data in self.files
        }

        for file_data in self.files:
            parser = self._get_parser(file_data["path"])
            if parser:
                if parser not in grouped_files_by_parser:
                    grouped_files_by_parser[parser] = []
                grouped_files_by_parser[parser].append(file_data)

        raw_nodes: List[GraphNodeData] = []
        raw_edges: List[GraphEdgeData] = []

        for parser, lang_files in grouped_files_by_parser.items():
            try:
                # Pass all_files_content for potential cross-file context, though parsers might not use it yet
                nodes, edges = parser.parse(lang_files, all_files_content)
                raw_nodes.extend(nodes)
                raw_edges.extend(edges)
            except Exception as e:
                print(f"Error during parsing with {type(parser).__name__}: {e}")
                # Optionally, log this error more formally or store it
                pass

        # Deduplicate nodes by ID, prioritizing already stored ones if any conflict (simple strategy)
        # And build node_details_map
        for node_data in raw_nodes:
            if node_data["id"] not in self.node_details_map:
                self.all_nodes_data.append(node_data)
                self.node_details_map[node_data["id"]] = node_data
            # else: node with this ID already exists, could merge or update if needed

        # Filter edges to ensure both source and target nodes exist in our map
        # This also helps remove edges pointing to unresolved or external symbols if we don't want them as distinct nodes
        for edge_data in raw_edges:
            source_exists = edge_data["source"] in self.node_details_map
            target_exists = edge_data["target"] in self.node_details_map

            # If target doesn't exist but looks like a FQN (e.g. external lib), create a placeholder node
            if source_exists and not target_exists and "." in edge_data["target"]:
                # Check if it's a standard library or common pattern we might want to represent
                # For now, create a simple external node
                ext_node_id = edge_data["target"]
                if ext_node_id not in self.node_details_map:
                    ext_node_data: GraphNodeData = {
                        "id": ext_node_id,
                        "name": ext_node_id.split(".")[-1],
                        "category": "external_symbol",
                        "file": "external",
                        "start_line": 0,
                        "end_line": 0,
                        "code": None,
                        "parent_id": None,
                    }
                    self.all_nodes_data.append(ext_node_data)
                    self.node_details_map[ext_node_id] = ext_node_data
                target_exists = True  # Now it exists

            if source_exists and target_exists:
                self.all_edges_data.append(edge_data)
            # else:
            # print(f"Skipping edge from {edge_data['source']} to {edge_data['target']} due to missing node(s). Source_exists: {source_exists}, Target_exists: {target_exists}")

    def _render_html_graph(self) -> str:
        net = Network(
            height="750px",
            width="100%",
            directed=True,
            bgcolor="#ffffff",
            font_color="black",
            notebook=False,
            # Improved physics for larger graphs
            # options='{"physics": {"barnesHut": {"gravitationalConstant": -30000, "centralGravity": 0.1, "springLength": 150, "springConstant": 0.05, "damping": 0.09, "avoidOverlap": 0.1}}}'
        )
        # net.show_buttons(filter_=['physics']) # If you want physics controls

        for node_data in self.all_nodes_data:  # Use the processed list
            node_id = node_data["id"]
            details = node_data  # self.node_details_map[node_id]

            label = details.get("name", node_id.split(".")[-1])
            category = details.get("category", "unknown")
            file_info = details.get("file", "N/A")
            start_line_info = details.get("start_line", "N/A")
            end_line_info = details.get("end_line", "N/A")
            code_snippet = (details.get("code", "") or "")[:200]  # Ensure not None

            color_map = {
                "module": "#10b981",  # Emerald
                "class": "#0ea5e9",  # Sky blue
                "method": "#f59e0b",  # Amber
                "function": "#f97316",  # Orange
                "import_statement": "#6366f1",  # Indigo
                "external_symbol": "#a3a3a3",  # Stone
                "default": "#6b7280",  # Gray
            }
            color = color_map.get(category, color_map["default"])

            title_parts = [
                f"ID: {node_id}",
                f"Type: {category}",
                f"File: {file_info} (Lines: {start_line_info}-{end_line_info})",
            ]
            if code_snippet:
                title_parts.append(f"Code: {code_snippet}...")
            title = "\\n".join(title_parts)

            shape_map = {
                "module": "box",
                "class": "ellipse",
                "method": "dot",
                "function": "dot",
                "external_symbol": "diamond",
                "default": "ellipse",
            }
            shape = shape_map.get(category, shape_map["default"])
            size = 15 if category in ["method", "function"] else 25

            net.add_node(
                node_id,
                label=label,
                title=title,
                color=color,
                category=category,
                shape=shape,
                size=size,
            )

        for edge in self.all_edges_data:  # Use the processed list
            src, dst, rel = (
                edge.get("source"),
                edge.get("target"),
                edge.get("relationship", "related"),
            )
            # Source and target should exist due to pre-filtering in _generate_graph_elements

            edge_color_map = {
                "defines_class": "#059669",
                "defines_function": "#059669",
                "defines_method": "#059669",  # Darker Emerald
                "inherits": "#0284c7",  # Sky (darker)
                "calls": "#7c3aed",  # Violet (darker)
                "imports_module": "#db2777",  # Pink
                "imports_symbol": "#db2777",
                "references_symbol": "#eab308",  # Yellow
                "default": "#6b7280",  # Gray
            }
            edge_color = edge_color_map.get(rel, edge_color_map["default"])

            edge_title = f"{rel}\\nFile: {edge.get('file', 'N/A')}\\nLine: {edge.get('line', 'N/A')}"

            net.add_edge(
                src, dst, title=edge_title, label=rel, color=edge_color
            )  # Added label to edge for visibility

        net.write_html(self.output_html_path)
        return "/static/" + Path(self.output_html_path).name

    def generate(self) -> Dict[str, Any]:
        self._generate_graph_elements()  # This now populates self.all_nodes_data and self.all_edges_data
        html_url = self._render_html_graph()
        return {
            "html_url": html_url,
            "nodes": self.all_nodes_data,  # Return the processed lists
            "edges": self.all_edges_data,
        }
