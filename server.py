import os
import re
import tempfile
import shutil
import zipfile
import ast
from pathlib import Path
from typing import List, Optional, Dict, Any
from io import BytesIO
from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import requests

from graph_generator import GraphGenerator

# =====================
# App Configuration
# =====================
app = FastAPI(
    title="Repo2Txt API",
    description="Process GitHub repos or ZIP files to text and generate dependency graphs",
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
# Request Models
class RepoRequest(BaseModel):
    repo_url: str
    access_token: Optional[str] = None
    branch: Optional[str] = "main"


# Response Models
class ErrorResponse(BaseModel):
    detail: str


class RepoContentsResponse(BaseModel):
    content: str
    filename: str


class GraphNode(BaseModel):
    id: str
    name: str
    category: str
    file: Optional[str] = None
    line: Optional[int] = None
    code: Optional[str] = None


class GraphEdge(BaseModel):
    source: str
    target: str
    relationship: str


class GraphResponse(BaseModel):
    html_url: str
    nodes: List[GraphNode]
    edges: List[GraphEdge]


# =====================
# Utility Functions
# =====================
def parse_repo_url(repo_url: str):
    """Parse GitHub repository URL into owner, repo, and optional branch/path."""
    pattern = r"github.com[:/](?P<owner>[^/]+)/(?P<repo>[^/#]+)(?:/(tree|blob)/(?P<last_string>.+))?"
    m = re.search(pattern, repo_url)
    if not m:
        raise HTTPException(status_code=400, detail="Invalid GitHub repository URL.")
    return m.groupdict(default="")


def smart_filter_files(file_list: List[dict], temp_dir: str) -> List[dict]:
    """Filter files to include only source code and exclude images, binaries, etc."""
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
        ".zip",
        ".rar",
        ".7z",
        ".tar",
        ".gz",
        ".bz2",
        ".xz",
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
    ]
    filtered_files = []
    for file in file_list:
        ext = Path(file["path"]).suffix.lower()
        full_path = os.path.join(temp_dir, file["path"])
        if (
            ext in common_extensions
            and ext not in blacklist_ext
            and not any(part.startswith(".") for part in Path(file["path"]).parts)
            and os.path.getsize(full_path) <= CONFIG["max_file_size"]
        ):
            try:
                with open(full_path, "r", encoding="utf-8", errors="ignore") as f:
                    file["content"] = f.read()
                filtered_files.append(file)
            except Exception:
                continue
    return filtered_files


def format_repo_contents(files: List[dict]) -> str:
    """Format repository contents into LLM-friendly text with directory structure."""
    text = "Directory Structure:\n\n"
    tree = {}
    for file in files:
        parts = file["path"].split("/")
        current_level = tree
        for i, part in enumerate(parts):
            if part not in current_level:
                current_level[part] = {} if i < len(parts) - 1 else None
            current_level = current_level[part] if i < len(parts) - 1 else current_level

    def build_index(node, prefix="", depth=0):
        result = ""
        entries = sorted(node.items(), key=lambda x: (x[1] is None, x[0]))
        for i, (name, subnode) in enumerate(entries):
            is_last = i == len(entries) - 1
            line_prefix = "└── " if is_last else "├── "
            child_prefix = "    " if is_last else "│   "
            result += f"{prefix}{line_prefix}{name}\n"
            if subnode is not None:
                result += build_index(subnode, f"{prefix}{child_prefix}", depth + 1)
        return result

    text += build_index(tree)
    text += "\n\nFile Contents:\n"
    for file in sorted(files, key=lambda x: x["path"]):
        text += f"\n---\nFile: {file['path']}\n---\n{file['content']}\n"
    return text


def extract_zip_contents(zip_file_path: str) -> tuple[List[dict], str]:
    """Extract files from a ZIP archive and return file list with paths."""
    temp_dir = tempfile.mkdtemp()
    files = []
    with zipfile.ZipFile(zip_file_path, "r") as zip_ref:
        zip_ref.extractall(temp_dir)
        for root, _, filenames in os.walk(temp_dir):
            for fname in filenames:
                full_path = os.path.join(root, fname)
                rel_path = os.path.relpath(full_path, temp_dir)
                files.append({"path": rel_path, "full_path": full_path})
    return files, temp_dir


def cleanup_temp_files(temp_dirs: List[str]):
    """Clean up temporary directories."""
    for temp_dir in temp_dirs:
        if os.path.exists(temp_dir):
            shutil.rmtree(temp_dir, ignore_errors=True)


# =====================
# API Endpoints
# =====================
@app.post(
    "/api/github/fetch-zip",
    response_model=None,
    responses={
        200: {"description": "Repository content as text"},
        400: {"model": ErrorResponse, "description": "Invalid repository URL"},
        404: {
            "model": ErrorResponse,
            "description": "Repository not found or no suitable files",
        },
        500: {"model": ErrorResponse, "description": "Server error"},
    },
)
async def fetch_github_zip(
    background_tasks: BackgroundTasks, repo_request: RepoRequest
):
    """Download GitHub repo as ZIP, extract, filter, and return LLM-friendly text."""
    repo_info = parse_repo_url(repo_request.repo_url)
    owner, repo = repo_info["owner"], repo_info["repo"]
    branch = repo_request.branch

    zip_url = f"https://github.com/{owner}/{repo}/archive/{branch}.zip"
    temp_zip = tempfile.NamedTemporaryFile(delete=False, suffix=".zip")
    try:
        r = requests.get(zip_url, stream=True, timeout=60)
        if r.status_code != 200:
            raise HTTPException(
                status_code=404,
                detail=f"Could not download ZIP (status={r.status_code}). Check repo URL and branch.",
            )
        for chunk in r.iter_content(chunk_size=8192):
            temp_zip.write(chunk)
        temp_zip.close()

        files, temp_dir = extract_zip_contents(temp_zip.name)
        filtered_files = smart_filter_files(files, temp_dir)
        if not filtered_files:
            raise HTTPException(
                status_code=404,
                detail="No suitable source files found in the repository.",
            )

        formatted_text = format_repo_contents(filtered_files)
        background_tasks.add_task(
            cleanup_temp_files, [temp_dir, os.path.dirname(temp_zip.name)]
        )

        return StreamingResponse(
            BytesIO(formatted_text.encode()),
            media_type="text/plain",
            headers={
                "Content-Disposition": f"attachment; filename={repo}_{branch}_content.txt"
            },
        )
    except Exception as e:
        if os.path.exists(temp_zip.name):
            os.unlink(temp_zip.name)
        raise HTTPException(
            status_code=500, detail=f"Error processing repository: {str(e)}"
        )


@app.post(
    "/api/local/upload-zip",
    response_model=None,
    responses={
        200: {"description": "Repository content as text"},
        400: {"model": ErrorResponse, "description": "Invalid file format"},
        404: {"model": ErrorResponse, "description": "No suitable files found"},
        500: {"model": ErrorResponse, "description": "Server error"},
    },
)
async def upload_zip(
    background_tasks: BackgroundTasks, zip_file: UploadFile = File(...)
):
    """Process uploaded ZIP file, extract, filter, and return LLM-friendly text."""
    if not zip_file.filename.lower().endswith(".zip"):
        raise HTTPException(status_code=400, detail="Please upload a .zip file.")

    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".zip")
    try:
        content = await zip_file.read()
        temp_file.write(content)
        temp_file.close()

        files, temp_dir = extract_zip_contents(temp_file.name)
        filtered_files = smart_filter_files(files, temp_dir)
        if not filtered_files:
            raise HTTPException(
                status_code=404,
                detail="No suitable source files found in the ZIP file.",
            )

        formatted_text = format_repo_contents(filtered_files)
        background_tasks.add_task(
            cleanup_temp_files, [temp_dir, os.path.dirname(temp_file.name)]
        )

        return StreamingResponse(
            BytesIO(formatted_text.encode()),
            media_type="text/plain",
            headers={
                "Content-Disposition": "attachment; filename=uploaded_content.txt"
            },
        )
    except Exception as e:
        if os.path.exists(temp_file.name):
            os.unlink(temp_file.name)
        raise HTTPException(
            status_code=500, detail=f"Error processing ZIP file: {str(e)}"
        )


@app.post(
    "/api/github/generate-graph",
    response_model=GraphResponse,
    responses={
        404: {
            "model": ErrorResponse,
            "description": "Repository not found or no suitable files",
        },
        500: {"model": ErrorResponse, "description": "Server error"},
    },
)
async def github_generate_graph(
    background_tasks: BackgroundTasks, repo_request: RepoRequest
) -> GraphResponse:
    """Generate a dependency graph for Python files from a GitHub repository."""
    repo_info = parse_repo_url(repo_request.repo_url)
    owner, repo = repo_info["owner"], repo_info["repo"]
    branch = repo_request.branch
    temp_dirs = []

    try:
        zip_url = f"https://github.com/{owner}/{repo}/archive/{branch}.zip"
        temp_zip = tempfile.NamedTemporaryFile(delete=False, suffix=".zip")
        r = requests.get(zip_url, stream=True, timeout=60)
        if r.status_code != 200:
            raise HTTPException(
                status_code=404,
                detail=f"Could not download ZIP (status={r.status_code}).",
            )
        for chunk in r.iter_content(chunk_size=8192):
            temp_zip.write(chunk)
        temp_zip.close()

        files, temp_dir = extract_zip_contents(temp_zip.name)
        temp_dirs.append(temp_dir)
        temp_dirs.append(os.path.dirname(temp_zip.name))

        filtered_files = smart_filter_files(files, temp_dir)
        if not filtered_files:
            raise HTTPException(
                status_code=404,
                detail="No suitable source files found for graph generation.",
            )

        static_dir = Path(__file__).parent / "static"
        static_dir.mkdir(exist_ok=True)
        graph_html_path = str(
            static_dir / f"{owner}_{repo}_{branch}_dependency_graph.html"
        )

        generator = GraphGenerator(
            files=filtered_files, output_html_path=graph_html_path
        )
        graph_data = generator.generate()

        graph_data["html_url"] = f"/static/{Path(graph_html_path).name}"

        background_tasks.add_task(cleanup_temp_files, temp_dirs)
        return GraphResponse(**graph_data)
    except Exception as e:
        cleanup_temp_files(temp_dirs)
        raise HTTPException(status_code=500, detail=f"Error generating graph: {str(e)}")


@app.post(
    "/api/local/generate-graph",
    response_model=GraphResponse,
    responses={
        400: {"model": ErrorResponse, "description": "Invalid file format"},
        404: {"model": ErrorResponse, "description": "No suitable files found"},
        500: {"model": ErrorResponse, "description": "Server error"},
    },
)
async def local_generate_graph(
    background_tasks: BackgroundTasks, zip_file: UploadFile = File(...)
) -> GraphResponse:
    """Generate a dependency graph for Python files from an uploaded ZIP."""
    if not zip_file.filename.lower().endswith(".zip"):
        raise HTTPException(status_code=400, detail="Please upload a .zip file.")

    temp_dirs = []
    try:
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".zip")
        content = await zip_file.read()
        temp_file.write(content)
        temp_file.close()

        files, temp_dir = extract_zip_contents(temp_file.name)
        temp_dirs.append(temp_dir)
        temp_dirs.append(os.path.dirname(temp_file.name))

        filtered_files = smart_filter_files(files, temp_dir)
        if not filtered_files:
            raise HTTPException(
                status_code=404,
                detail="No suitable source files found for graph generation.",
            )

        static_dir = Path(__file__).parent / "static"
        static_dir.mkdir(exist_ok=True)
        graph_html_path = str(static_dir / f"local_upload_dependency_graph.html")

        generator = GraphGenerator(
            files=filtered_files, output_html_path=graph_html_path
        )
        graph_data = generator.generate()

        graph_data["html_url"] = f"/static/{Path(graph_html_path).name}"

        background_tasks.add_task(cleanup_temp_files, temp_dirs)
        return GraphResponse(**graph_data)
    except Exception as e:
        cleanup_temp_files(temp_dirs)
        raise HTTPException(status_code=500, detail=f"Error generating graph: {str(e)}")


# =====================
# Main Entrypoint
# =====================
if __name__ == "__main__":
    import uvicorn

    uvicorn.run("server:app", host="0.0.0.0", port=8003, reload=True)
