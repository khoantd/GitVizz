# GitVizz - Code Analysis & Dependency Graph Library

A powerful Python library for generating code dependency graphs from repository files. This is the core graphing engine that powers [GitVizz](https://github.com/adithya-s-k/GitVizz) - the AI-powered repository analysis platform.

Supports multiple programming languages including Python, JavaScript, TypeScript, React, and Next.js applications.

## Features

- **Multi-language Support**: Parse Python, JavaScript, TypeScript, React (.jsx), and Next.js (.tsx) files
- **Dependency Graph Generation**: Create detailed dependency graphs showing relationships between code entities
- **AST-based Parsing**: Uses Tree-sitter for accurate and robust parsing
- **Interactive Visualizations**: Generate HTML visualizations using Pyvis
- **Modal Integration**: Optional serverless deployment support via Modal
- **Extensible Architecture**: Easy to add support for new languages and frameworks

## About GitVizz

This library is the core graphing engine that powers the [GitVizz platform](https://github.com/adithya-s-k/GitVizz) - a comprehensive AI-powered repository analysis tool that provides:

- 🌐 **Web Interface**: Interactive dashboard for exploring codebases
- 🤖 **AI Chat**: Conversation with your repositories using advanced LLMs
- 📊 **Visual Analytics**: Beautiful dependency graphs and code maps
- 📝 **Auto Documentation**: AI-generated comprehensive documentation
- 🔍 **Smart Search**: Intelligent code search and navigation
- 📱 **Multi-platform**: Web app with mobile-responsive design

**Try GitVizz**: Visit [gitvizz.com](https://gitvizz.com) or check out the [full platform on GitHub](https://github.com/adithya-s-k/GitVizz)

This standalone library allows you to integrate GitVizz's powerful code analysis capabilities into your own applications and workflows.

## Installation

Install directly from GitHub:

```bash
pip install git+https://github.com/adithya-s-k/GitVizz.git#subdirectory=gitvizz
```

Or for development:

```bash
git clone https://github.com/adithya-s-k/GitVizz.git
cd GitVizz/gitvizz
pip install -e .[dev]
```

### PyPI Installation (Coming Soon)

```bash
pip install gitvizz
```

## Quick Start

### New `from_source()` Method (Recommended)

GitVizz now provides a much more convenient way to create graphs directly from ZIP files or directories:

```python
from gitvizz import GraphGenerator

# From ZIP file
generator = GraphGenerator.from_source("repository.zip")
graph = generator.generate()

# From directory
generator = GraphGenerator.from_source("/path/to/project")
graph = generator.generate()

# Visualize in Jupyter
generator.visualize()
```

### Traditional Method

```python
from gitvizz import GraphGenerator

# Prepare your files data
files_data = [
    {
        "path": "src/main.py",
        "content": "# Your Python code here"
    },
    {
        "path": "src/utils.js",
        "content": "// Your JavaScript code here"
    }
]

# Generate the graph
generator = GraphGenerator(files=files_data, output_html_path="graph.html")
result = generator.generate()

# Access nodes and edges
nodes = result["nodes"]
edges = result["edges"]
html_url = result.get("html_url")  # If output_html_path was provided
```

### Modal Integration

```python
from gitvizz import generate_graph, MODAL_AVAILABLE

if MODAL_AVAILABLE:
    # Deploy to Modal for serverless processing
    result = generate_graph.remote(files_data, output_html_path="graph.html")
```

### Batch Processing

```python
from gitvizz import generate_graphs_batch

batch_requests = [
    {"files_data": files_data_1},
    {"files_data": files_data_2, "output_html_path": "graph2.html"}
]

results = generate_graphs_batch.remote(batch_requests)
```

## Supported Languages and Frameworks

| Language/Framework | File Extensions | Parser Type       |
| ------------------ | --------------- | ----------------- |
| Python             | `.py`, `.ipynb` | AST + Tree-sitter |
| JavaScript         | `.js`           | Tree-sitter       |
| React              | `.jsx`          | Tree-sitter       |
| TypeScript         | `.ts`           | Tree-sitter       |
| Next.js            | `.tsx`          | Tree-sitter       |

## Graph Data Structure

### Nodes

Each node represents a code entity with the following structure:

```python
{
    "id": str,              # Fully qualified name
    "name": str,            # Simple name
    "category": str,        # 'module', 'class', 'function', 'method', etc.
    "file": str,            # File path
    "start_line": int,      # Starting line number
    "end_line": int,        # Ending line number
    "code": str,            # Code snippet (optional)
    "parent_id": str,       # Parent entity ID (optional)
}
```

### Edges

Each edge represents a relationship between code entities:

```python
{
    "source": str,          # Source node ID
    "target": str,          # Target node ID
    "relationship": str,    # Type of relationship
    "file": str,           # File where relationship occurs
    "line": int,           # Line number (optional)
}
```

### Relationship Types

- `defines_class` - Module defines a class
- `defines_function` - Module/class defines a function/method
- `defines_method` - Class defines a method
- `inherits` - Class inheritance
- `calls` - Function/method calls
- `imports_module` - Module imports
- `imports_symbol` - Symbol imports
- `references_symbol` - Symbol references

## `from_source()` API Reference

### Method Signature

```python
@classmethod
def from_source(
    cls,
    source_path: Union[str, Path],
    file_extensions: List[str] = None,
    max_files: Optional[int] = None,
    encoding: str = 'utf-8',
    ignore_patterns: List[str] = None
) -> 'GraphGenerator'
```

**Parameters:**

- **`source_path`**: Path to ZIP file or directory
- **`file_extensions`**: List of extensions to include (default: `['.py', '.js', '.jsx', '.ts', '.tsx', '.ipynb']`)
- **`max_files`**: Limit number of files processed (useful for large repos)
- **`encoding`**: Text encoding for reading files (default: `'utf-8'`)
- **`ignore_patterns`**: Glob patterns to ignore (default includes common patterns like `__pycache__`, `node_modules`, etc.)

**Returns:** Ready-to-use `GraphGenerator` instance

### Configuration Examples

#### File Type Filtering

```python
# Only Python files
generator = GraphGenerator.from_source(
    "repo.zip",
    file_extensions=['.py']
)

# Web technologies only
generator = GraphGenerator.from_source(
    "webapp/",
    file_extensions=['.js', '.jsx', '.ts', '.tsx', '.vue']
)
```

#### Performance Tuning

```python
# Limit files for large repositories
generator = GraphGenerator.from_source(
    "huge_repo.zip",
    max_files=100  # Process only first 100 files
)
```

#### Smart Filtering

```python
# Custom ignore patterns
generator = GraphGenerator.from_source(
    "project/",
    ignore_patterns=[
        '**/test_*',           # Test files
        '**/.*',               # Hidden files
        '**/__pycache__/**',   # Python cache
        '**/node_modules/**',  # Node.js modules
        '**/dist/**',          # Build outputs
        '**/*.min.js',         # Minified files
        '**/coverage/**'       # Test coverage
    ]
)
```

### Supported Sources

#### ZIP Files

- ✅ Regular ZIP archives
- ✅ GitHub repository downloads
- ✅ Nested directory structures
- ✅ Cross-platform path handling

#### Directories

- ✅ Local directories
- ✅ Network paths
- ✅ Symbolic links (followed)
- ✅ Recursive subdirectory scanning

#### Special Files

- ✅ **Jupyter Notebooks**: Automatically extracts Python code from `.ipynb` files
- ✅ **Mixed Projects**: Handles multi-language repositories
- ✅ **Large Files**: Graceful handling of encoding issues

### Usage Examples

#### Quick Repository Analysis

```python
from gitvizz import GraphGenerator

# Analyze a downloaded GitHub ZIP
generator = GraphGenerator.from_source("react-project-main.zip")
graph = generator.generate()

print(f"Found {len(graph['nodes'])} nodes and {len(graph['edges'])} edges")

# Save results
generator.save_json("analysis.json")
generator.save_graphml("analysis.graphml")
```

#### Focused Analysis

```python
# Analyze only Python files, skip tests
generator = GraphGenerator.from_source(
    "python_project/",
    file_extensions=['.py'],
    ignore_patterns=[
        '**/test_*.py',
        '**/tests/**',
        '**/*_test.py',
        '**/conftest.py'
    ],
    max_files=50
)

# Generate and visualize
graph = generator.generate()
nx_graph = generator.to_networkx()

# Quick analysis
import networkx as nx
print(f"Density: {nx.density(nx_graph):.3f}")
print(f"Components: {nx.number_weakly_connected_components(nx_graph)}")
```

#### Jupyter Notebook Workflow

```python
# In a Jupyter notebook
from gitvizz import GraphGenerator

# Load and analyze
generator = GraphGenerator.from_source("../my_project")
generator.generate()

# Interactive visualization
generator.visualize(height=800)

# Network analysis
nx_graph = generator.to_networkx()
degrees = dict(nx_graph.degree())

# Show most connected components
top_nodes = sorted(degrees.items(), key=lambda x: x[1], reverse=True)[:10]
for node_id, degree in top_nodes:
    node = nx_graph.nodes[node_id]
    print(f"{node.get('name', node_id)} ({node.get('category')}): {degree} connections")
```

### Default Configurations

#### File Extensions (Default)

- `.py` - Python
- `.js` - JavaScript
- `.jsx` - React JSX
- `.ts` - TypeScript
- `.tsx` - React TypeScript
- `.ipynb` - Jupyter Notebooks

#### Ignore Patterns (Default)

- `**/.*` - Hidden files and directories
- `**/__pycache__/**` - Python cache
- `**/node_modules/**` - Node.js dependencies
- `**/dist/**` - Build outputs
- `**/build/**` - Build directories
- `**/*.min.js` - Minified JavaScript
- `**/*.map` - Source maps
- `**/coverage/**` - Test coverage reports
- `**/.git/**` - Git metadata

### Error Handling

The method includes robust error handling:

```python
try:
    generator = GraphGenerator.from_source("repo.zip")
except FileNotFoundError:
    print("Source path does not exist")
except ValueError:
    print("Source must be a ZIP file or directory")
except Exception as e:
    print(f"Unexpected error: {e}")
```

Individual file reading errors are handled gracefully with warnings, so corrupted or binary files won't stop the analysis.

## Advanced Usage

### Custom Parsers

```python
from gitvizz import LanguageParser, GraphGenerator

class MyCustomParser(LanguageParser):
    def parse(self, files, all_files_content):
        # Custom parsing logic
        return nodes, edges

# Use custom parser
generator = GraphGenerator(files=files_data)
generator.parsers[".mycustomext"] = MyCustomParser()
result = generator.generate()
```

### Project Type Detection

The library automatically detects project types and uses appropriate parsers:

- **Next.js**: Detected by `next.config.js`, `pages/`, `app/` directories
- **React**: Detected by React dependencies in `package.json`
- **Python**: Detected by `.py` files and Python project indicators
- **JavaScript**: Detected by `package.json`

## Development

### Setting up for Development

```bash
git clone https://github.com/adithya-s-k/GitVizz.git
cd GitVizz/gitvizz
pip install -e .[dev]
```

### Running Tests

```bash
pytest
```

### Code Formatting

```bash
black gitvizz/
isort gitvizz/
```

### Type Checking

```bash
mypy gitvizz/
```

## Modal Deployment

For serverless deployment using Modal:

1. Install Modal: `pip install modal`
2. Set up Modal account: `modal setup`
3. Deploy: `modal deploy gitvizz.modal_app`

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Changelog

### 0.1. (Latest)

- **New `from_source()` Method**: Convenient creation from ZIP files and directories
- **Enhanced File Processing**: Automatic file type detection and filtering
- **Smart Ignore Patterns**: Built-in patterns for common files to ignore
- **Performance Optimizations**: File limiting and encoding options
- **Jupyter Notebook Support**: Direct extraction of Python code from `.ipynb` files
- **Cross-platform Path Handling**: Robust support for different operating systems

### 0.1.0 (Initial Release)

- Multi-language parsing support (Python, JavaScript, TypeScript, React, Next.js)
- AST-based dependency graph generation
- Tree-sitter integration for robust parsing
- Interactive HTML visualizations
- Modal serverless integration
- Extensible parser architecture
