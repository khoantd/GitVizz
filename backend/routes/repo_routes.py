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
    generate_structure_endpoint
)

router = APIRouter(prefix='/repo')

# Generating LLM-friendly text from a code repository or ZIP file
router.post(
    "/generate-text",
    response_model=TextResponse,
    summary="Generates LLM-friendly text from a code repository.",
    response_description="A JSON object containing repository structure, content, and a suggested filename.",
    responses={
        200: {"description": "Repository content as JSON.", "model": TextResponse},
        400: {
            "model": ErrorResponse,
            "description": "Invalid input (e.g., no URL or ZIP).",
        },
        404: {
            "model": ErrorResponse,
            "description": "Could not download or no suitable files found.",
        },
        500: {"model": ErrorResponse, "description": "Server error during processing."},
    },
)(generate_text_endpoint)

# Generating a graph representation of the repository structure
router.post(
    "/generate-graph",
    response_model=GraphResponse,
    summary="Generates a dependency graph from a code repository.",
    response_description="JSON containing graph nodes, edges, and URL to an HTML visualization.",
    responses={
        400: {"model": ErrorResponse, "description": "Invalid input."},
        404: {"model": ErrorResponse, "description": "Not found or no suitable files."},
        500: {"model": ErrorResponse, "description": "Server error."},
    },
)(generate_graph_endpoint)

router.post(
    "/generate-structure",
    response_model=StructureResponse,
    summary="Generates the file structure and content of a code repository.",  # Updated summary
    response_description="JSON containing the repository's directory tree and file contents.",  # Updated description
    responses={
        200: {
            "description": "Repository structure and content as JSON.",
            "model": StructureResponse,
        },  # Updated
        400: {"model": ErrorResponse, "description": "Invalid input."},
        404: {"model": ErrorResponse, "description": "Not found or no suitable files."},
        500: {"model": ErrorResponse, "description": "Server error."},
    },
)(generate_structure_endpoint)