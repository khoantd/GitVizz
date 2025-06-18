import os
import re
import tempfile
import shutil
import zipfile
import json
from pathlib import Path
from typing import List, Optional, Dict, Any, Tuple
from fastapi import UploadFile, HTTPException
import requests
from config import CONFIG

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
    branch: Optional[str],
    zip_file: Optional[UploadFile],
    access_token: Optional[str] = None,
) -> Tuple[List[Dict[str, Any]], str, List[str]]:
    temp_zip_file_path: Optional[str] = None
    created_dirs_for_rmtree: List[str] = []
    headers = {}

    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".zip") as temp_zip_obj:
            temp_zip_file_path = temp_zip_obj.name

            if repo_url:
                actual_zip_url = repo_url  # fallback

                if "github.com" in repo_url:
                    repo_info = parse_repo_url(repo_url)
                    owner, repo_name_from_url = repo_info["owner"], repo_info["repo"]

                    if owner != "unknown":
                        # Use GitHub API zipball URL for better support
                        actual_zip_url = f"https://api.github.com/repos/{owner}/{repo_name_from_url}/zipball/{branch or 'main'}"
                        headers = {
                            "Authorization": f"token {access_token}" if access_token else "",
                            "Accept": "application/vnd.github.v3+json",
                            "User-Agent": os.getenv("GITHUB_USER_AGENT", "fastapi-app"),
                        }

                r = requests.get(actual_zip_url, stream=True, timeout=60, headers=headers)
                if r.status_code != 200:
                    raise HTTPException(
                        status_code=r.status_code,
                        detail=f"Could not download ZIP from GitHub API (status={r.status_code}). URL: {actual_zip_url}",
                    )

                for chunk in r.iter_content(chunk_size=8192):
                    temp_zip_obj.write(chunk)

            elif zip_file:
                content = await zip_file.read()
                temp_zip_obj.write(content)
                await zip_file.close()
            else:
                raise HTTPException(
                    status_code=400,
                    detail="Either repo_url or zip_file must be provided.",
                )

        # Now extract
        extracted_files, temp_extract_dir_path = extract_zip_contents(temp_zip_file_path)
        created_dirs_for_rmtree.append(temp_extract_dir_path)

        return extracted_files, temp_extract_dir_path, created_dirs_for_rmtree

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error processing input: {str(e)}"
        )
    finally:
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