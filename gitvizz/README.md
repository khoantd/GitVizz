# GitVizz Graphing Library

A powerful Python library for generating code dependency graphs from repository files. Supports multiple programming languages including Python, JavaScript, TypeScript, React, and Next.js applications.

## Features

- **Multi-language Support**: Parse Python, JavaScript, TypeScript, React (.jsx), and Next.js (.tsx) files
- **Dependency Graph Generation**: Create detailed dependency graphs showing relationships between code entities
- **AST-based Parsing**: Uses Tree-sitter for accurate and robust parsing
- **Interactive Visualizations**: Generate HTML visualizations using Pyvis
- **Modal Integration**: Optional serverless deployment support via Modal
- **Extensible Architecture**: Easy to add support for new languages and frameworks

## Installation

```bash
pip install gitvizz-graphing
```

For Modal support:

```bash
pip install gitvizz-graphing[modal]
```

For development:

```bash
pip install gitvizz-graphing[dev]
```

## Quick Start

### Basic Usage

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
git clone https://github.com/gitvizz/gitvizz.git
cd gitvizz-graphing
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

### 0.1.0 (Initial Release)

- Multi-language parsing support (Python, JavaScript, TypeScript, React, Next.js)
- AST-based dependency graph generation
- Tree-sitter integration for robust parsing
- Interactive HTML visualizations
- Modal serverless integration
- Extensible parser architecture
