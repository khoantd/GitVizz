import os
import re
import tempfile
import shutil
import zipfile
import ast
from pathlib import Path
from typing import List, Optional, Dict, Any, Tuple, Union
from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
import requests
import json

from graph_generator import GraphGenerator

# =====================
# App Configuration
# =====================
app = FastAPI(
    title="Repo Processing API",
    description="Process GitHub repos or ZIP files to generate text, dependency graphs, and file structures.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

CONFIG = {
    "max_file_size": 1024 * 1024,  # 1 MB
}


# =====================
# Models
# =====================
class ErrorResponse(BaseModel):
    detail: str


class GraphNode(BaseModel):
    id: str
    name: str
    category: str
    file: Optional[str] = None
    line: Optional[int] = Field(None, alias="start_line")
    end_line: Optional[int] = Field(None, alias="end_line")
    code: Optional[str] = None


class GraphEdge(BaseModel):
    source: str
    target: str
    relationship: str


class GraphResponse(BaseModel):
    html_url: str
    nodes: List[GraphNode]
    edges: List[GraphEdge]


# New model for individual file data
class FileData(BaseModel):
    path: str
    content: str
    # language: Optional[str] = None # Future: for syntax highlighting hints


class StructureResponse(BaseModel):
    directory_tree: str  # The visual tree string
    files: List[FileData]  # List of files with their content
    # file_count is removed, can be derived from len(files)


class TextResponse(BaseModel):
    text_content: str
    filename_suggestion: str


# =====================
# Utility Functions
# =====================
def parse_repo_url(repo_url: str) -> Dict[str, str]:
    """Parse GitHub repository URL into owner, repo, and optional branch/path."""
    pattern = r"github.com[:/](?P<owner>[^/]+)/(?P<repo>[^/#]+)(?:/(tree|blob)/(?P<last_string>.+))?"
    m = re.search(pattern, repo_url)
    if not m:
        # Allow non-GitHub URLs to pass through for now, but they won't be auto-parsed for owner/repo names
        # This means graph naming might be more generic for non-GitHub zip URLs.
        # Consider raising HTTPException if strictly GitHub URLs are expected for repo_url parameter.
        # For now, we assume repo_url if provided implies a downloadable zip.
        return {
            "owner": "unknown",
            "repo": "repository",
            "last_string": "",
        }  # Default for non-matching URLs
    return m.groupdict(default="")


async def _process_input(
    repo_url: Optional[str],
    branch: Optional[str],  # Now used if repo_url is a GitHub link
    zip_file: Optional[UploadFile],
) -> Tuple[List[Dict[str, Any]], str, List[str]]: # Returns (files, extract_dir_path, list_of_dirs_to_rmtree)
    """
    Processes input from either a GitHub URL or an uploaded ZIP file.
    Downloads from URL or saves uploaded file, then extracts ZIP.
    Returns:
        - List of extracted file details.
        - Path to the root temporary directory where files were extracted.
        - List of temporary directories created by this process that need cleanup via rmtree.
    """
    temp_zip_file_path: Optional[str] = None  # Path of the temporary ZIP file
    created_dirs_for_rmtree: List[str] = []  # Directories created by this function that need rmtree

    try:
        # Create a temporary file to store the zip.
        # We are responsible for deleting this file using os.unlink().
        with tempfile.NamedTemporaryFile(delete=False, suffix=".zip") as temp_zip_obj:
            temp_zip_file_path = temp_zip_obj.name

            if repo_url:
                # Construct download URL, assuming it's a GitHub link if branch is relevant
                actual_zip_url = repo_url # Default if not GitHub or parse fails
                if "github.com" in repo_url:  # Basic check
                    repo_info = parse_repo_url(repo_url)
                    owner, repo_name_from_url = repo_info.get("owner"), repo_info.get("repo")
                    if owner and repo_name_from_url and owner != "unknown":  # Successfully parsed as GitHub
                        actual_zip_url = (
                            f"https://github.com/{owner}/{repo_name_from_url}/archive/{branch}.zip"
                        )
                    # else: actual_zip_url remains repo_url if non-GitHub or parse failed
                # else: actual_zip_url remains repo_url if direct link to zip

                r = requests.get(actual_zip_url, stream=True, timeout=60)
                if r.status_code != 200:
                    raise HTTPException(
                        status_code=r.status_code,
                        detail=f"Could not download ZIP from URL (status={r.status_code}). URL: {actual_zip_url}",
                    )
                for chunk in r.iter_content(chunk_size=8192):
                    temp_zip_obj.write(chunk)
            elif zip_file:
                content = await zip_file.read()
                temp_zip_obj.write(content)
                await zip_file.close()
            else:
                raise HTTPException(
                    status_code=400, detail="Either repo_url or zip_file must be provided."
                )
        # temp_zip_obj is closed, content is in temp_zip_file_path

        # extract_zip_contents creates its own temp dir using mkdtemp
        extracted_files, temp_extract_dir_path = extract_zip_contents(temp_zip_file_path)
        # This directory was created by mkdtemp and needs to be cleaned up via rmtree.
        created_dirs_for_rmtree.append(temp_extract_dir_path)

        # The temp_zip_file_path itself will be cleaned up in the finally block.
        return extracted_files, temp_extract_dir_path, created_dirs_for_rmtree
    except Exception as e:
        # If an exception occurs, created_dirs_for_rmtree might be partially populated.
        # The caller's cleanup logic (via background_tasks or direct call in except block)
        # will use what's in created_dirs_for_rmtree.
        # The temp_zip_file_path is handled by the finally block here.
        if isinstance(e, HTTPException):
            raise
        else:
            # Consider logging the full traceback for unexpected errors
            # import traceback
            # print(f"Unexpected error in _process_input: {e}\n{traceback.format_exc()}")
            raise HTTPException(status_code=500, detail=f"Error processing input: {str(e)}")
    finally:
        # Always attempt to delete the temporary ZIP file if its path was set.
        if temp_zip_file_path and os.path.exists(temp_zip_file_path):
            os.unlink(temp_zip_file_path)


def extract_zip_contents(zip_file_path: str) -> tuple[List[dict], str]:
    """Extract files from a ZIP archive and return file list with paths."""
    temp_dir = tempfile.mkdtemp()
    files = []
    try:
        with zipfile.ZipFile(zip_file_path, "r") as zip_ref:
            zip_ref.extractall(temp_dir)
            for root, _, filenames in os.walk(temp_dir):
                for fname in filenames:
                    full_path = os.path.join(root, fname)
                    # Ensure rel_path is POSIX-style for consistency
                    rel_path = Path(os.path.relpath(full_path, temp_dir)).as_posix()
                    files.append({"path": rel_path, "full_path": full_path})
    except zipfile.BadZipFile:
        shutil.rmtree(temp_dir)  # Clean up extraction dir if zip is bad
        raise HTTPException(status_code=400, detail="Invalid ZIP file.")
    except Exception as e:
        shutil.rmtree(temp_dir)  # Clean up extraction dir on other errors
        raise HTTPException(status_code=500, detail=f"Failed to extract ZIP: {str(e)}")
    return files, temp_dir


def smart_filter_files(file_list: List[dict], temp_dir: str) -> List[dict]:
    """Filter files to include only source code and exclude images, binaries, etc.
    For .ipynb files, content is extracted from cells.
    """
    common_extensions = [
        ".py",
        ".js",
        ".ts",
        ".java",
        ".cpp",
        ".c",
        ".h",
        ".hpp",
        ".cs",
        ".go",
        ".rs",
        ".php",
        ".rb",
        ".swift",
        ".html",
        ".css",
        ".scss",
        ".json",
        ".yaml",
        ".yml",
        ".md",
        ".txt",
        ".xml",
        ".ini",
        ".conf",
        ".sh",
        ".bat",
        ".pl",
        ".toml",
        ".jsx",
        ".tsx",
        ".ipynb",
    ]
    blacklist_ext = [
        ".png",
        ".jpg",
        ".jpeg",
        ".gif",
        ".bmp",
        ".svg",
        ".ico",
        ".webp",
        ".tiff",
        ".mp3",
        ".mp4",
        ".avi",
        ".mov",
        ".mkv",
        ".wav",
        ".flac",
        ".exe",
        ".dll",
        ".so",
        ".bin",
        ".obj",
        ".o",
        ".a",
        ".lib",
        ".class",
        ".jar",
        ".pdf",
        ".zip",  # Exclude .zip from content processing
    ]
    filtered_files = []
    for file_info in file_list:
        ext = Path(file_info["path"]).suffix.lower()

        # full_path should already be correct from extract_zip_contents
        full_path = file_info["full_path"]

        if not os.path.exists(
            full_path
        ):  # Should not happen if extract_zip_contents is robust
            continue

        if (
            ext in common_extensions
            and ext not in blacklist_ext
            and not any(
                part.startswith(".")
                for part in Path(file_info["path"]).parts
                if part != Path(file_info["path"]).name
            )  # Allow hidden files, but not in hidden dirs
            and os.path.getsize(full_path) <= CONFIG["max_file_size"]
            and os.path.getsize(full_path) > 0  # Exclude empty files
        ):
            try:
                if ext == ".ipynb":
                    with open(full_path, "r", encoding="utf-8", errors="ignore") as f:
                        notebook_json_content = f.read()

                    parsed_notebook = json.loads(notebook_json_content)
                    all_cell_content_for_text_dump = []
                    python_code_for_graphing = []

                    for cell_idx, cell in enumerate(parsed_notebook.get("cells", [])):
                        cell_type = cell.get("cell_type")
                        source_list = cell.get("source", [])
                        cell_source_text = "".join(source_list)
                        all_cell_content_for_text_dump.append(
                            f"# CELL {cell_idx + 1}: {cell_type}\n{cell_source_text}\n"
                        )
                        if cell_type == "code":
                            # Basic check for python magic before adding to python_equivalent_content
                            lines = cell_source_text.splitlines()
                            if not any(
                                line.strip().startswith("%")
                                or line.strip().startswith("!")
                                for line in lines
                            ):
                                python_code_for_graphing.append(cell_source_text + "\n")

                    file_info["content"] = "\n".join(all_cell_content_for_text_dump)
                    file_info["python_equivalent_content"] = "".join(
                        python_code_for_graphing
                    )
                else:
                    with open(full_path, "r", encoding="utf-8", errors="ignore") as f:
                        file_info["content"] = f.read()

                filtered_files.append(file_info)
            except json.JSONDecodeError:
                # print(f"Skipping file {file_info['path']} due to JSON decode error (likely invalid .ipynb).")
                continue
            except Exception:
                # print(f"Skipping file {file_info['path']} due to error during content processing: {e}")
                continue
    return filtered_files


def format_repo_structure(files: List[dict]) -> str:
    """Format repository directory structure into text."""
    text = "Directory Structure:\n\n"
    tree = {}
    for file_item in files:  # Renamed 'file' to 'file_item' to avoid conflict
        parts = file_item["path"].split("/")
        current_level = tree
        for i, part in enumerate(parts):
            if part not in current_level:
                current_level[part] = {} if i < len(parts) - 1 else None
            current_level = current_level[part] if i < len(parts) - 1 else current_level

    def build_index(node, prefix="", depth=0):
        result = ""
        # Sort entries: folders first, then files, all alphabetically
        entries = sorted(node.items(), key=lambda x: (x[1] is None, x[0].lower()))
        for i, (name, subnode) in enumerate(entries):
            is_last = i == len(entries) - 1
            line_prefix = "└── " if is_last else "├── "
            child_prefix = "    " if is_last else "│   "
            result += (
                f"{prefix}{line_prefix}{name}{'/' if subnode is not None else ''}\n"
            )
            if subnode is not None:
                result += build_index(subnode, f"{prefix}{child_prefix}", depth + 1)
        return result

    text += build_index(tree)
    return text


def format_repo_contents(files: List[dict]) -> str:
    """Format repository contents into LLM-friendly text with directory structure."""
    structure_text = format_repo_structure(files)
    content_text = "\n\nFile Contents:\n"
    for file_item in sorted(
        files, key=lambda x: x["path"]
    ):  # Renamed 'file' to 'file_item'
        content_text += f"\n---\nFile: {file_item['path']}\n---\n{file_item.get('content', 'Error reading content or binary file.')}\n"
    return structure_text + content_text


def cleanup_temp_files(temp_dirs: List[str]):
    """Clean up temporary directories."""
    for temp_dir in temp_dirs:
        if temp_dir and os.path.exists(
            temp_dir
        ):  # Check if temp_dir is not None or empty
            shutil.rmtree(temp_dir, ignore_errors=True)


# =====================
# API Endpoints
# =====================
@app.post(
    "/api/generate-text",
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
)
async def generate_text_endpoint(
    background_tasks: BackgroundTasks,
    repo_url: Optional[str] = Form(
        None,
        description="URL to a downloadable ZIP of the repository (e.g., GitHub archive link).",
    ),
    branch: Optional[str] = Form(
        "main", description="Branch to use if repo_url is a GitHub repository link."
    ),
    zip_file_form_param: Any = File(None, alias="zip_file"), # Changed to Any and aliased
) -> TextResponse:
    actual_zip_file: Optional[UploadFile] = None
    if isinstance(zip_file_form_param, UploadFile):
        if zip_file_form_param.filename:  # Check if it's a real file upload
            actual_zip_file = zip_file_form_param
        # If UploadFile has no filename, it's likely an empty input, treat as None
    elif isinstance(zip_file_form_param, str) and not zip_file_form_param: # Handles empty string
        # If an empty string was sent for the file, treat as None
        actual_zip_file = None
    # If zip_file_form_param is None or other non-UploadFile type, actual_zip_file remains None

    if not repo_url and not actual_zip_file:
        raise HTTPException(
            status_code=400, detail="Either repo_url or zip_file must be provided."
        )

    temp_dirs_to_cleanup = []
    try:
        extracted_files, temp_extract_dir, temp_dirs_created = await _process_input(
            repo_url, branch, actual_zip_file # Use the processed actual_zip_file
        )
        temp_dirs_to_cleanup.extend(temp_dirs_created)

        if not extracted_files:
            raise HTTPException(
                status_code=404,
                detail="No files found in the provided repository source.",
            )

        filtered_files = smart_filter_files(extracted_files, temp_extract_dir)
        if not filtered_files:
            raise HTTPException(
                status_code=404,
                detail="No suitable source files found after filtering.",
            )

        formatted_text = format_repo_contents(filtered_files)

        filename_base = "repository_content"
        if repo_url:
            repo_info = parse_repo_url(repo_url)
            if repo_info.get("repo") and repo_info["repo"] != "repository":
                filename_base = (
                    f"{repo_info['owner']}_{repo_info['repo']}_{branch}_content"
                )
        elif actual_zip_file and actual_zip_file.filename: # Use actual_zip_file
            filename_base = f"{Path(actual_zip_file.filename).stem}_content" # Use actual_zip_file

        background_tasks.add_task(cleanup_temp_files, temp_dirs_to_cleanup)
        return TextResponse(
            text_content=formatted_text, filename_suggestion=f"{filename_base}.txt"
        )
    except HTTPException as he:
        cleanup_temp_files(
            temp_dirs_to_cleanup
        )  # Attempt cleanup on known HTTP errors too
        raise he
    except Exception as e:
        cleanup_temp_files(temp_dirs_to_cleanup)
        raise HTTPException(status_code=500, detail=f"Error generating text: {str(e)}")


@app.post(
    "/api/generate-graph",
    response_model=GraphResponse,
    summary="Generates a dependency graph from a code repository.",
    response_description="JSON containing graph nodes, edges, and URL to an HTML visualization.",
    responses={
        400: {"model": ErrorResponse, "description": "Invalid input."},
        404: {"model": ErrorResponse, "description": "Not found or no suitable files."},
        500: {"model": ErrorResponse, "description": "Server error."},
    },
)
async def generate_graph_endpoint(
    background_tasks: BackgroundTasks,
    repo_url: Optional[str] = Form(
        None, description="URL to a downloadable ZIP of the repository."
    ),
    branch: Optional[str] = Form("main", description="Branch for GitHub repo URL."),
    zip_file: Optional[UploadFile] = File(
        None, description="A ZIP file of the repository."
    ),
) -> GraphResponse:
    if not repo_url and not zip_file:
        raise HTTPException(
            status_code=400, detail="Either repo_url or zip_file must be provided."
        )

    temp_dirs_to_cleanup = []
    try:
        extracted_files, temp_extract_dir, temp_dirs_created = await _process_input(
            repo_url, branch, zip_file
        )
        temp_dirs_to_cleanup.extend(temp_dirs_created)

        if not extracted_files:
            raise HTTPException(
                status_code=404,
                detail="No files found in the provided repository source.",
            )

        filtered_files = smart_filter_files(extracted_files, temp_extract_dir)
        if not filtered_files:
            raise HTTPException(
                status_code=404,
                detail="No suitable files for graph generation after filtering.",
            )

        static_dir = Path(__file__).parent / "static"
        static_dir.mkdir(exist_ok=True)

        output_filename_base = "dependency_graph"
        if repo_url:
            repo_info = parse_repo_url(repo_url)  # May return defaults if not GitHub
            owner = repo_info.get("owner", "gh")
            repo_name = repo_info.get("repo", "repo")
            branch_name = branch
            output_filename_base = f"{owner}_{repo_name}_{branch_name}_dependency_graph"
        elif zip_file and zip_file.filename:
            sanitized_zip_name = re.sub(
                r"[^a-zA-Z0-9_.-]", "_", Path(zip_file.filename).stem
            )
            output_filename_base = f"zip_{sanitized_zip_name}_dependency_graph"

        graph_html_path = str(static_dir / f"{output_filename_base}.html")

        # Pass the original relative paths and content to GraphGenerator
        generator = GraphGenerator(
            files=filtered_files, output_html_path=graph_html_path
        )
        graph_data = generator.generate()
        graph_data["html_url"] = (
            f"/static/{Path(graph_html_path).name}"  # Relative URL for client
        )

        background_tasks.add_task(cleanup_temp_files, temp_dirs_to_cleanup)
        return GraphResponse(**graph_data)
    except HTTPException as he:
        cleanup_temp_files(temp_dirs_to_cleanup)
        raise he
    except Exception as e:
        cleanup_temp_files(temp_dirs_to_cleanup)
        # Log the full error server-side for debugging
        # import traceback
        # print(f"Error in generate_graph_endpoint: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Error generating graph: {str(e)}")


@app.post(
    "/api/generate-structure",
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
)
async def generate_structure_endpoint(
    background_tasks: BackgroundTasks,
    repo_url: Optional[str] = Form(
        None, description="URL to a downloadable ZIP of the repository."
    ),
    branch: Optional[str] = Form("main", description="Branch for GitHub repo URL."),
    zip_file: Optional[UploadFile] = File(
        None, description="A ZIP file of the repository."
    ),
) -> StructureResponse:
    if not repo_url and not zip_file:
        raise HTTPException(
            status_code=400, detail="Either repo_url or zip_file must be provided."
        )

    temp_dirs_to_cleanup = []
    try:
        extracted_files, temp_extract_dir, temp_dirs_created = await _process_input(
            repo_url, branch, zip_file
        )
        temp_dirs_to_cleanup.extend(temp_dirs_created)

        if (
            not extracted_files
        ):  # These are all files before filtering by smart_filter_files
            raise HTTPException(
                status_code=404,
                detail="No files found in the provided repository source.",
            )

        # For structure, we might want to show all files, not just "source" files.
        # However, smart_filter_files also handles .ipynb parsing and size limits.
        # Let's use smart_filter_files to get a sensible list for structure too.
        # If the goal is to show *all* files, then smart_filter_files would need adjustment or bypass.
        # For now, assume structure of "relevant" files is desired.
        relevant_files_for_structure = smart_filter_files(
            extracted_files, temp_extract_dir
        )

        if not relevant_files_for_structure:
            raise HTTPException(
                status_code=404,
                detail="No relevant files found for structure after filtering.",
            )

        directory_tree_string = format_repo_structure(relevant_files_for_structure)

        files_data_list: List[FileData] = []
        for file_info in relevant_files_for_structure:
            files_data_list.append(
                FileData(path=file_info["path"], content=file_info.get("content", ""))
            )  # Ensure content is present

        background_tasks.add_task(cleanup_temp_files, temp_dirs_to_cleanup)
        return StructureResponse(
            directory_tree=directory_tree_string, files=files_data_list
        )
    except HTTPException as he:
        cleanup_temp_files(temp_dirs_to_cleanup)
        raise he
    except Exception as e:
        cleanup_temp_files(temp_dirs_to_cleanup)
        raise HTTPException(
            status_code=500, detail=f"Error generating structure and content: {str(e)}"
        )


# Serve static files (for graph HTML)
static_files_path = Path(__file__).parent / "static"
static_files_path.mkdir(exist_ok=True)  # Ensure static directory exists
app.mount("/static", StaticFiles(directory=static_files_path), name="static")

# =====================
# Main Entrypoint
# =====================
if __name__ == "__main__":
    import uvicorn

    uvicorn.run("server:app", host="0.0.0.0", port=8003, reload=True)
