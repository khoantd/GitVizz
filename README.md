# Code Repository Analysis and Visualization API

This project provides a Python-based FastAPI backend designed to process, analyze, and visualize code repositories. It can ingest repositories from GitHub URLs or uploaded ZIP files, generating textual summaries, dependency graphs, and detailed file structures. This tool aims to make it easier to understand the architecture and relationships within codebases.

## Features

- **Repository Ingestion**: Supports fetching code from GitHub repositories (via URL) and processing local repositories (via ZIP upload).
- **Text Generation**: Converts repository contents into a consolidated text format, suitable for LLM processing or quick overviews.
- **Dependency Graph Generation**: Analyzes code (initially Python, with extensibility for other languages via tree-sitter) to create interactive dependency graphs showing relationships between modules, classes, and functions.
- **File Structure Extraction**: Provides a clear view of the repository's directory tree and the content of individual files.
- **FastAPI Backend**: Built with FastAPI, offering a modern, high-performance API.
- **Modal Integration**: Includes configuration for deploying the server as a Modal app for serverless execution (see `modal_server.py`).
- **Next.js Frontend**: Comes with a Next.js frontend (in the `frontend/` directory) for interacting with the API and visualizing the generated outputs.

## Frontend Features

The Next.js frontend provides a user-friendly interface to interact with the API and explore code repositories:

- **Interactive Graph Visualization**: Displays the generated dependency graph, allowing users to pan, zoom, and click on nodes to see details.
- **Structured Code Viewing**: Presents the repository's file structure in a navigable tree, similar to an IDE, with a code viewer to display file contents.
- **Dual Input Methods**: Users can either provide a GitHub repository URL (with an optional branch and access token for private repos) or upload a ZIP archive of a repository.
- **Dynamic Data Display**: Shows repository structure, code, and graph data in separate, manageable tabs.
- **Node Properties**: Displays detailed information about selected nodes in the graph (e.g., file, lines of code, category).
- **Graph Legend**: Helps users understand the different types of nodes and edges in the dependency graph.
- **Theme Customization**: Includes a theme toggle for light/dark mode.

## Project Structure

Here's an overview of the main files and directories in this project:

```
.
├── server.py               # Main FastAPI application: defines API endpoints, request handling, and core logic.
├── modal_server.py         # Configuration for deploying the FastAPI app using Modal.
├── graph_generator.py      # Contains logic for parsing code and generating graph data (nodes and edges).
├── custom_ast_parser.py    # Implements the tree-sitter based parsing logic for code analysis.
├── requirements.txt        # Python dependencies for the backend server.
├── README.md               # This file: project overview, setup, and usage instructions.
│
├── frontend/               # Contains the Next.js frontend application.
│   ├── app/                # Core application files for the frontend (pages, layout).
│   ├── components/         # Reusable React components for the UI.
│   ├── utils/              # Utility functions for the frontend.
│   ├── public/             # Static assets for the frontend.
│   ├── package.json        # Frontend dependencies and scripts.
│   └── ...                 # Other Next.js configuration files.
│
├── static/                 # Directory to serve static files, e.g., generated HTML graph visualizations.
├── archives/               # (Potentially) For storing or processing archived repository versions.
├── examples/               # Contains example ZIP files for testing.
├── lib/                    # (Potentially) For third-party client-side libraries if not managed by frontend's package manager.
├── templates/              # (Potentially) For HTML templates if the server rendered HTML directly (not primary use).
└── __pycache__/            # Python bytecode cache (auto-generated).
```

## Installation

1. Clone the repository
2. Install the required dependencies:

```bash
pip install -r requirements.txt
```

## Usage

### Running the server

```bash
uvicorn server:app --host 0.0.0.0 --port 8003 --reload
```

Or simply run:

```bash
python server.py
```

The server will be available at http://localhost:8003

### API Documentation

Once the server is running, you can access the auto-generated API documentation at:
- Swagger UI: http://localhost:8003/docs
- ReDoc: http://localhost:8003/redoc

## API Endpoints

The API provides the following endpoints for processing code repositories:

- `POST /api/generate-text`: Generates LLM-friendly text from a code repository. Accepts either a `repo_url` (for remote repositories, e.g., GitHub) or a `zip_file` (for uploaded archives) as form data.
- `POST /api/generate-graph`: Generates a dependency graph from a code repository. Accepts either a `repo_url` or a `zip_file` as form data.
- `POST /api/generate-structure`: Generates the file structure and content of a code repository. Accepts either a `repo_url` or a `zip_file` as form data.

Each endpoint processes the input and returns the respective output (text content, graph data, or file structure).

## Example Usage

### Generating Text from a GitHub Repository

To generate text from a GitHub repository, send a POST request with `repo_url` and optionally `branch` as form data:

```
POST /api/generate-text
Content-Type: multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW

------WebKitFormBoundary7MA4YWxkTrZu0gW
Content-Disposition: form-data; name="repo_url"

https://github.com/username/repository
------WebKitFormBoundary7MA4YWxkTrZu0gW
Content-Disposition: form-data; name="branch"

main
------WebKitFormBoundary7MA4YWxkTrZu0gW--
```
The server will respond with a JSON object containing the repository content and a suggested filename.

### Generating Structure from an Uploaded ZIP File

To generate the file structure from an uploaded ZIP file, send a POST request with `zip_file` as form data:

```
POST /api/generate-structure
Content-Type: multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW

------WebKitFormBoundary7MA4YWxkTrZu0gW
Content-Disposition: form-data; name="zip_file"; filename="my_repo.zip"
Content-Type: application/zip

(binary content of my_repo.zip)
------WebKitFormBoundary7MA4YWxkTrZu0gW--
```
The server will respond with a JSON object containing the repository's directory tree and file contents.

### Generating a Dependency Graph

Similarly, to generate a dependency graph, use the `/api/generate-graph` endpoint with either `repo_url` or `zip_file` as form data, similar to the examples above.

## Frontend Workflow

1.  **Access the Application**: The user navigates to the frontend URL in their web browser.
2.  **Input Repository**:
    *   The user chooses to either input a GitHub repository URL or upload a ZIP file.
    *   For GitHub URLs, they can specify a branch and, if necessary (for private repositories or to avoid rate limits), provide a GitHub personal access token.
3.  **Submit for Analysis**: The user submits the form.
4.  **API Interaction**: The frontend sends the repository information to the backend API (e.g., `/api/generate-graph`, `/api/generate-structure`).
5.  **Visualize Results**:
    *   **Dependency Graph**: If graph generation is successful, an interactive graph is displayed. Users can explore connections between different code entities.
    *   **File Structure & Code**: The repository's file tree is shown. Users can click on files to view their content in a code viewer, often with syntax highlighting.
    *   **Text Summary**: If text generation is requested, the summarized text is displayed.
6.  **Interaction**:
    *   Users can click on nodes in the graph to see more details or navigate to the corresponding code.
    *   Users can browse the file structure and read code.

## Frontend Integration

This API is designed to be easily integrated with frontend applications. You can build a custom frontend or use the existing JavaScript-based frontend with minimal modifications to point to these API endpoints.
