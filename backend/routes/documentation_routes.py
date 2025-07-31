from fastapi import APIRouter, HTTPException, BackgroundTasks, Form
from huggingface_hub import User
from typing import Dict, Any, Optional
import time
import asyncio
import os
from concurrent.futures import ThreadPoolExecutor
from documentationo_generator.core import DocumentationGenerator
from utils.jwt_utils import get_current_user
from models.repository import Repository
from beanie.operators import Or
from beanie import PydanticObjectId
from datetime import datetime
import re
from cryptography.fernet import Fernet

# from utils.file_utils import get_user

from schemas.documentation_schemas import (
    WikiGenerationResponse,
    TaskStatus,
    RepositoryDocsResponse,
    IsWikiGeneratedRequest,
    IsWikiGeneratedResponse,
)

from models.chat import UserApiKey

router = APIRouter(prefix="/documentation")

# TODO: Global storage for task results (in production, use Redis or a database)
task_results: Dict[str, Dict[str, Any]] = {}

# Thread pool for CPU-bound tasks
executor = ThreadPoolExecutor(max_workers=4)


def parse_github_url(url: str) -> tuple[str, str]:
    """
    Parse GitHub URL to extract owner and repository name.
    Handles various GitHub URL formats:
    - https://github.com/owner/repo
    - https://github.com/owner/repo.git
    - https://github.com/owner/repo/
    - git@github.com:owner/repo.git
    """
    if not url:
        raise ValueError("Repository URL cannot be empty")

    # Handle SSH URLs
    if url.startswith("git@github.com:"):
        # Extract from SSH format: git@github.com:owner/repo.git
        match = re.match(r"git@github\.com:([^/]+)/([^/.]+)(?:\.git)?", url)
        if match:
            return match.group(1), match.group(2)
        else:
            raise ValueError("Invalid SSH GitHub URL format")

    # Handle HTTPS URLs
    if "github.com" in url:
        # Clean up the URL
        url = url.rstrip("/")

        # Extract path from URL
        if "github.com/" in url:
            path_part = url.split("github.com/", 1)[1]
            path_segments = path_part.split("/")

            if len(path_segments) >= 2:
                repo_owner = path_segments[0]
                repo_name = path_segments[1]

                # Remove .git extension if present
                if repo_name.endswith(".git"):
                    repo_name = repo_name[:-4]

                # Validate owner and repo name
                if not repo_owner or not repo_name:
                    raise ValueError("Invalid repository owner or name")

                return repo_owner, repo_name
            else:
                raise ValueError(
                    "Invalid GitHub repository URL format - missing owner or repository name"
                )
        else:
            raise ValueError("Invalid GitHub URL format")
    else:
        raise ValueError("Currently only GitHub repositories are supported")


@router.post(
    "/generate-wiki",
    response_model=WikiGenerationResponse,
    summary="Generate wiki documentation",
    description="Starts the process of generating wiki documentation for a given repository. The task runs in the background, and a task ID is returned to track its progress.",
    response_description="Task ID and status of the wiki generation process.",
    responses={
        202: {
            "model": WikiGenerationResponse,
            "description": "Wiki generation task accepted and started.",
        },
        400: {"description": "Bad request. Invalid input parameters."},
        500: {"description": "Internal server error."},
    },
)
async def generate_wiki(
    jwt_token: str = Form(..., description="Authentication jwt_token for the request"),
    repository_url: str = Form(
        ..., description="URL of the repository to generate documentation for"
    ),
    language: Optional[str] = Form("en", description="Language for the documentation"),
    comprehensive: Optional[bool] = Form(
        True, description="Whether to generate comprehensive documentation"
    ),
    provider_name: Optional[str] = Form(
        "", description="Provider name for the documentation generation"
    )
):
    """Generate wiki documentation for a repository"""

    # Authenticate user
    user = await get_current_user(jwt_token)

    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized: Invalid jwt_token")

    # Extract and validate repository information
    try:
        # Parse the repository URL to get owner and repo name
        repo_owner, repo_name = parse_github_url(repository_url)

        # Set output directory based on repo info
        repo = await Repository.find_one(
            Or(
                Repository.user == PydanticObjectId(user.id),
                Repository.github_url == repository_url.lower(),
            ),
        )

        if not repo:
            raise HTTPException(
                status_code=404, detail="Repository not found for the user"
            )

        # Use the repository's documentation base path
        output_dir = repo.file_paths.documentation_base_path

    except Exception as e:
        raise HTTPException(
            status_code=400, detail=f"Failed to parse repository URL: {str(e)}"
        )

    # --- API Key Logic ---
    api_key = None
    user_api_key = await UserApiKey.find_one(
        UserApiKey.user.id == user.id,
        UserApiKey.provider == provider_name,
    )

    if user_api_key:
        encryption_key = os.getenv("ENCRYPTION_KEY", Fernet.generate_key())
        cipher_suite = Fernet(encryption_key)
        api_key = cipher_suite.decrypt(user_api_key.encrypted_key).decode()

    # Fallback to system key if user is not using their own or no session exists
    if not api_key:
        api_key = os.getenv("GEMINI_API_KEY")

    # If no key is found from any source, raise an error
    if not api_key:
        raise HTTPException(
            status_code=400,
            detail="No Gemini API key found. Please configure your API key in settings or ensure a system key is available."
        )
    # --- End of API Key Logic ---


    try:
        # Generate unique task ID
        task_id = f"wiki_{hash(repository_url)}_{int(time.time())}"

        # Initialize task status
        task_results[task_id] = {
            "task_id": task_id,
            "repo_id": repo.id,
            "status": "pending",
            "message": "Wiki generation task queued",
            "result": None,
            "error": None,
            "created_at": time.time(),
            "completed_at": None,
        }

        # Start the background task using asyncio.create_task (better approach)
        asyncio.create_task(
            _generate_wiki_background(
                task_id, repository_url, output_dir, language, comprehensive, api_key
            )
        )

        return WikiGenerationResponse(
            status="accepted", message="Wiki generation started", task_id=task_id
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


async def _generate_wiki_background(
    task_id: str, repo_url: str, output_dir: str, language: str, comprehensive: bool, api_key: str
):
    """Background task for wiki generation using asyncio"""
    try:
        # Update status to running
        task_results[task_id]["status"] = "running"
        task_results[task_id]["message"] = "Wiki generation in progress"

        # Run the CPU-bound task in a thread pool to avoid blocking
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            executor,
            _run_wiki_generation,
            repo_url,
            output_dir,
            language,
            comprehensive,
            api_key
        )

        # Update task status on success
        task_results[task_id].update(
            {
                "status": "completed",
                "message": "Wiki generation completed successfully",
                "completed_at": time.time(),
            }
        )

    except Exception as e:
        # Update task status on error
        task_results[task_id].update(
            {
                "status": "failed",
                "message": "Wiki generation failed",
                "error": str(e),
                "completed_at": time.time(),
            }
        )


def _run_wiki_generation(
    repo_url: str, output_dir: str, language: str, comprehensive: bool, api_key: str
):
    """Synchronous function to run the actual wiki generation"""
    try:
        # Ensure output directory exists
        os.makedirs(output_dir, exist_ok=True)

        generator = DocumentationGenerator(api_key=api_key)
        result = generator.generate_complete_wiki(
            repo_url_or_path=repo_url, output_dir=output_dir, language=language
        )
        return result
    except Exception as e:
        raise e


def find_task_by_repo_id(repo_id: str):
    for task in task_results.values():
        if task.get("repo_id") == repo_id:
            return task
    return None


@router.post(
    "/wiki-status",
    response_model=TaskStatus,
    summary="Get wiki generation status",
    description="Retrieves the current status of a wiki generation task using the provided task ID.",
    response_description="Current status of the wiki generation task.",
    responses={
        200: {"description": "Task status retrieved successfully."},
        404: {"description": "Task ID not found."},
        500: {"description": "Internal server error."},
    },
)
async def get_wiki_status(
    repo_id: str = Form(
        ..., description="ID of the repository to check wiki generation status for"
    ),
    jwt_token: str = Form(..., description="Authentication jwt_token for the request"),
):
    """Get the status of a wiki generation task"""
    try:
        # Authenticate user
        user = await get_current_user(jwt_token)

        if not user:
            raise HTTPException(
                status_code=401, detail="Unauthorized: Invalid jwt_token"
            )

        # Find task by repo_id
        task = find_task_by_repo_id(PydanticObjectId(repo_id))
        if not task:
            raise HTTPException(
                status_code=404, detail="No task found for the given repo_id"
            )

        return TaskStatus(**task)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post(
    "/is-wiki-generated",
    summary="Check if wiki documentation is generated",
    description="Checks if wiki documentation has been generated for a specific repository.",
    response_description="Boolean indicating if wiki documentation is generated.",
    response_model=IsWikiGeneratedResponse,
)
async def is_wiki_generated(
    repo_id: str = Form(
        ..., description="ID of the repository to check wiki generation status for"
    ),
    jwt_token: str = Form(..., description="Authentication jwt_token for the request"),
):
    """Check if wiki documentation has been generated for a repository"""
    try:
        # Authenticate user
        user = await get_current_user(jwt_token)

        if not user:
            raise HTTPException(
                status_code=401, detail="Unauthorized: Invalid jwt_token"
            )

        # Find the repository
        repo = await Repository.find_one(
            Repository.id == PydanticObjectId(repo_id),
            Repository.user.id == PydanticObjectId(user.id),
        )

        if not repo:
            raise HTTPException(status_code=404, detail="Repository not found")

        doc_dir = repo.file_paths.documentation_base_path

        # Check if there's any documentation generation under process
        task = find_task_by_repo_id(repo.id)
        if task and task["status"] in ["running", "pending"]:
            return IsWikiGeneratedResponse(
                is_generated=False,
                status=task["status"],
                message="Wiki generation is currently in progress",
            )

        # Check if there's a failed task
        if task and task["status"] == "failed":
            return IsWikiGeneratedResponse(
                is_generated=False,
                status="failed",
                message="Wiki generation failed",
                error=task.get("error", "Unknown error occurred during generation"),
            )

        # Check if documentation directory exists and has content
        if os.path.exists(doc_dir):
            # Check if readme.md file exists
            readme_path = os.path.join(doc_dir, "readme.md")
            if os.path.exists(readme_path):
                return IsWikiGeneratedResponse(
                    is_generated=True,
                    status="completed",
                    message="Wiki documentation has been generated",
                )

        # If no documentation found and no active/failed tasks
        return IsWikiGeneratedResponse(
            is_generated=False,
            status="not_started",
            message="Wiki documentation has not been generated yet",
        )

    except HTTPException:
        raise
    except Exception as e:
        return IsWikiGeneratedResponse(
            is_generated=False,
            status="error",
            message="Error checking wiki generation status",
            error=str(e),
        )


@router.post(
    "/repository-docs",
    summary="List repository documentation files",
    description="Lists all documentation files for a specific repository with parsed content.",
    response_description="Structured documentation data for the repository.",
    response_model=RepositoryDocsResponse,
)
async def list_repository_docs(
    repo_id: str = Form(
        ..., description="ID of the repository to list documentation files for"
    ),
    jwt_token: str = Form(..., description="Authentication jwt_token for the request"),
):
    """List all documentation files for a repository with parsed README content"""
    try:
        # Authenticate user
        user = await get_current_user(jwt_token)
        if not user:
            raise HTTPException(
                status_code=401, detail="Unauthorized: Invalid jwt_token"
            )

        # Find the repository
        repo = await Repository.find_one(
            Repository.id == PydanticObjectId(repo_id),
            Repository.user.id == PydanticObjectId(user.id),
        )

        if not repo:
            raise HTTPException(status_code=404, detail="Repository not found")

        # Get documentation directory
        doc_dir = repo.file_paths.documentation_base_path
        if not os.path.exists(doc_dir):
            return {
                "success": False,
                "data": {
                    "repository": {
                        "id": repo_id,
                        "name": repo.repo_name,
                        "directory": doc_dir,
                    },
                    "analysis": {},
                    "navigation": {"sidebar": [], "total_pages": 0},
                    "content": {},
                    "folder_structure": [],
                },
                "message": "No documentation generated yet",
            }

        # Parse README.md file
        readme_path = os.path.join(doc_dir, "readme.md")
        sidebar = []
        repo_analysis = {}

        if os.path.exists(readme_path):
            with open(readme_path, "r", encoding="utf-8") as f:
                readme_content = f.read()

            # Parse repository analysis section
            repo_analysis = parse_repository_analysis(readme_content)

            # Parse documentation pages (sidebar)
            sidebar = parse_documentation_pages(readme_content)

        # List all markdown files in the directory with their content (including nested)
        files = {}
        folder_structure = []

        for root, dirs, filenames in os.walk(doc_dir):
            for file in filenames:
                if file.endswith(".md"):
                    file_path = os.path.join(root, file)
                    file_size = os.path.getsize(file_path)
                    file_modified = datetime.fromtimestamp(os.path.getmtime(file_path))

                    # Read file content
                    with open(file_path, "r", encoding="utf-8") as f:
                        content = f.read()

                    # Create relative path from doc_dir as key
                    relative_path = os.path.relpath(file_path, doc_dir)
                    file_key = relative_path.replace(".md", "").replace(
                        os.path.sep, "/"
                    )
                    directory = (
                        os.path.dirname(relative_path)
                        if os.path.dirname(relative_path)
                        else "/"
                    )

                    files[file_key] = {
                        "metadata": {
                            "filename": file,
                            "relative_path": relative_path,
                            "directory": directory,
                            "size": file_size,
                            "modified": file_modified.isoformat(),
                            "type": "markdown",
                        },
                        "content": content,
                        "preview": (
                            content[:200] + "..." if len(content) > 200 else content
                        ),
                        "word_count": len(content.split()),
                        "read_time": max(1, len(content.split()) // 200),
                    }

        # Build folder structure for frontend
        folder_structure = build_folder_structure(files)

        return {
            "success": True,
            "data": {
                "repository": {
                    "id": repo_id,
                    "name": repo.repo_name,
                    "directory": doc_dir,
                },
                "folder_structure": folder_structure,
                "analysis": repo_analysis,
                "navigation": {"sidebar": sidebar, "total_pages": len(files)},
                "content": files,
            },
            "message": "Documentation loaded successfully",
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def build_folder_structure(files: dict) -> list:
    """Build a hierarchical folder structure for frontend display"""
    structure = []
    folders = {}

    for file_key, file_data in files.items():
        path_parts = file_key.split("/")
        current_level = structure
        current_path = ""

        # Navigate/create folder structure
        for i, part in enumerate(path_parts[:-1]):  # Exclude the filename
            current_path = "/".join(path_parts[: i + 1])

            # Find or create folder at current level
            folder = None
            for item in current_level:
                if item["type"] == "folder" and item["name"] == part:
                    folder = item
                    break

            if not folder:
                folder = {
                    "type": "folder",
                    "name": part,
                    "path": current_path,
                    "children": [],
                    "file_count": 0,
                    "is_expanded": False,  # Frontend can use this for collapse/expand
                }
                current_level.append(folder)
                folders[current_path] = folder

            current_level = folder["children"]

        # Add the file
        filename = path_parts[-1]
        file_item = {
            "type": "file",
            "name": filename,
            "path": file_key,
            "filename": file_data["metadata"]["filename"],
            "size": file_data["metadata"]["size"],
            "modified": file_data["metadata"]["modified"],
            "word_count": file_data["word_count"],
            "read_time": file_data["read_time"],
        }
        current_level.append(file_item)

        # Update file count for parent folders
        for folder_path in folders:
            if file_key.startswith(folder_path):
                folders[folder_path]["file_count"] += 1

    # Sort structure: folders first, then files, both alphabetically
    def sort_structure(items):
        items.sort(key=lambda x: (x["type"] == "file", x["name"].lower()))
        for item in items:
            if item["type"] == "folder":
                sort_structure(item["children"])

    sort_structure(structure)
    return structure


def parse_repository_analysis(readme_content: str) -> dict:
    """Parse the repository analysis section from README content"""
    analysis = {}

    # Extract Repository Analysis section
    analysis_match = re.search(
        r"## 📊 Repository Analysis\n\n(.*?)(?=\n##|\n---|\Z)",
        readme_content,
        re.DOTALL,
    )
    if analysis_match:
        analysis_content = analysis_match.group(1)

        # Extract individual metrics
        domain_match = re.search(r"- \*\*Domain Type\*\*: (.+)", analysis_content)
        complexity_match = re.search(
            r"- \*\*Complexity Score\*\*: (.+)", analysis_content
        )
        languages_match = re.search(r"- \*\*Languages\*\*: (.+)", analysis_content)
        frameworks_match = re.search(r"- \*\*Frameworks\*\*: (.+)", analysis_content)
        pages_match = re.search(r"- \*\*Total Pages\*\*: (.+)", analysis_content)

        if domain_match:
            analysis["domain_type"] = domain_match.group(1).strip()
        if complexity_match:
            analysis["complexity_score"] = complexity_match.group(1).strip()
        if languages_match:
            analysis["languages"] = languages_match.group(1).strip()
        if frameworks_match:
            analysis["frameworks"] = frameworks_match.group(1).strip()
        if pages_match:
            analysis["total_pages"] = pages_match.group(1).strip()

    return analysis


def parse_documentation_pages(readme_content: str) -> list:
    """Parse the documentation pages section to create sidebar navigation"""
    sidebar = []

    # Extract Documentation Pages section
    pages_match = re.search(
        r"## 📖 Documentation Pages\n\n(.*?)(?=\n##|\n---|\Z)",
        readme_content,
        re.DOTALL,
    )
    if pages_match:
        pages_content = pages_match.group(1)

        # Find all markdown links
        link_pattern = r"- \[([^\]]+)\]\(([^)]+)\)"
        matches = re.findall(link_pattern, pages_content)

        for title, filename in matches:
            # Extract emoji and clean title
            emoji_match = re.match(r"([^\w\s]+)\s*(.+)", title)
            if emoji_match:
                emoji = emoji_match.group(1).strip()
                clean_title = emoji_match.group(2).strip()
            else:
                emoji = "📄"
                clean_title = title.strip()

            sidebar.append(
                {
                    "title": clean_title,
                    "filename": filename,
                    "emoji": emoji,
                    "url": f"/docs/{filename}",
                }
            )

    return sidebar
