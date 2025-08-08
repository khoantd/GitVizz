from fastapi import APIRouter
from schemas.response_schemas import (
    TextResponse,
    ErrorResponse,
    GraphResponse,
    StructureResponse
)

from controllers.repo_controller import (
    generate_text_endpoint,
    generate_graph_endpoint,
    generate_structure_endpoint,
    generate_subgraph_endpoint
)

router = APIRouter(prefix='/repo')

# Generating LLM-friendly text from a code repository or ZIP file
router.post(
    "/generate-text",
    response_model=TextResponse,
    summary="Generates LLM-friendly text from a code repository with smart caching.",
    description="""
    Generates LLM-friendly text from a code repository or ZIP file.
    """,
    response_description="A JSON object containing repository structure, content, and a suggested filename. Returns cached data if available and up-to-date.",
    responses={
        200: {"description": "Repository content as JSON (cached or newly generated).", "model": TextResponse},
        400: {
            "model": ErrorResponse,
            "description": "Invalid input (e.g., no URL or ZIP provided).",
        },
        401: {
            "model": ErrorResponse,
            "description": "Invalid or expired JWT token.",
        },
        404: {
            "model": ErrorResponse,
            "description": "Could not download repository or no suitable files found.",
        },
        500: {"model": ErrorResponse, "description": "Server error during processing."},
    },
)(generate_text_endpoint)

# Generating a graph representation of the repository structure
router.post(
    "/generate-graph",
    response_model=GraphResponse,
    summary="Generates a dependency graph from a code repository with smart caching.",
    description="""
    Generates a dependency graph representation from a code repository or ZIP file.
    """,
    response_description="JSON containing graph nodes, edges, and metadata. Returns cached data if available and up-to-date.",
    responses={
        200: {"description": "Dependency graph data as JSON (cached or newly generated).", "model": GraphResponse},
        400: {"model": ErrorResponse, "description": "Invalid input (e.g., no URL or ZIP provided)."},
        401: {
            "model": ErrorResponse,
            "description": "Invalid or expired JWT token.",
        },
        404: {"model": ErrorResponse, "description": "Repository not found or no suitable files for graph generation."},
        500: {"model": ErrorResponse, "description": "Server error during graph generation."},
    },
)(generate_graph_endpoint)

# Generate a subgraph (ego network or filtered view) for large graphs
router.post(
    "/generate-subgraph",
    response_model=GraphResponse,
    summary="Generates a subgraph (ego network or filtered subset) for large repositories.",
    description="""
    Returns a subset of the repository graph, centered at a node (ego network) and/or filtered by
    categories, file paths, or relationship types. Uses cached full graph if available.
    """,
    response_description="JSON containing subgraph nodes and edges.",
    responses={
        200: {"description": "Subgraph data as JSON.", "model": GraphResponse},
        400: {"model": ErrorResponse, "description": "Invalid input."},
        401: {"model": ErrorResponse, "description": "Invalid or expired JWT token."},
        404: {"model": ErrorResponse, "description": "Repository not found or no graph available."},
        500: {"model": ErrorResponse, "description": "Server error during subgraph generation."},
    },
)(generate_subgraph_endpoint)

router.post(
    "/generate-structure",
    response_model=StructureResponse,
    summary="Generates the file structure and content of a code repository with smart caching.",
    description="""
    Generates the complete file structure and content of a code repository or ZIP file.
    """,
    response_description="JSON containing the repository's directory tree and file contents. Returns cached data if available and up-to-date.",
    responses={
        200: {
            "description": "Repository structure and content as JSON (cached or newly generated).",
            "model": StructureResponse,
        },
        400: {"model": ErrorResponse, "description": "Invalid input (e.g., no URL or ZIP provided)."},
        401: {
            "model": ErrorResponse,
            "description": "Invalid or expired JWT token.",
        },
        404: {"model": ErrorResponse, "description": "Repository not found or no suitable files after filtering."},
        500: {"model": ErrorResponse, "description": "Server error during structure generation."},
    },
)(generate_structure_endpoint)