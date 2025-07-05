from fastapi import APIRouter, HTTPException, BackgroundTasks, Form
from huggingface_hub import User
from pydantic import BaseModel
from typing import Optional, Dict, Any
import time
import asyncio
import os
from concurrent.futures import ThreadPoolExecutor
from documentationo_generator.core import DocumentationGenerator
from utils.jwt_utils import get_current_user
from models.repository import Repository
from beanie.operators import Or
from beanie import PydanticObjectId
import re
# from utils.file_utils import get_user

router = APIRouter(prefix="/documentation")

#FIXME: Global storage for task results (in production, use Redis or a database)
task_results: Dict[str, Dict[str, Any]] = {}

class WikiGenerationRequest(BaseModel):
    repository_url: str
    output_dir: Optional[str] = "./wiki_output"
    language: Optional[str] = "en"
    comprehensive: Optional[bool] = True

class WikiGenerationResponse(BaseModel):
    status: str
    message: str
    task_id: Optional[str] = None
    result: Optional[Dict[str, Any]] = None

class TaskStatus(BaseModel):
    task_id: str
    status: str  # "pending", "running", "completed", "failed"
    message: str
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    created_at: float
    completed_at: Optional[float] = None

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
        url = url.rstrip('/')
        
        # Extract path from URL
        if "github.com/" in url:
            path_part = url.split("github.com/", 1)[1]
            path_segments = path_part.split('/')
            
            if len(path_segments) >= 2:
                repo_owner = path_segments[0]
                repo_name = path_segments[1]
                
                # Remove .git extension if present
                if repo_name.endswith('.git'):
                    repo_name = repo_name[:-4]
                
                # Validate owner and repo name
                if not repo_owner or not repo_name:
                    raise ValueError("Invalid repository owner or name")
                
                return repo_owner, repo_name
            else:
                raise ValueError("Invalid GitHub repository URL format - missing owner or repository name")
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
            "description": "Wiki generation task accepted and started."
        },
        400: {
            "description": "Bad request. Invalid input parameters."
        },
        500: {
            "description": "Internal server error."
        }
    }
)
async def generate_wiki(
    token: str = Form(..., description="Authentication token for the request"),
    repository_url: str = Form(..., description="URL of the repository to generate documentation for"),
    language: Optional[str] = Form("en", description="Language for the documentation"),
    comprehensive: Optional[bool] = Form(True, description="Whether to generate comprehensive documentation")
):
    """Generate wiki documentation for a repository"""
    
    # Authenticate user
    user = await get_current_user(token)
        
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized: Invalid token")
    
    # Extract and validate repository information
    try:
        # Parse the repository URL to get owner and repo name
        repo_owner, repo_name = parse_github_url(repository_url)
        
        # Set output directory based on repo info
        repo = await Repository.find_one(
            Or(
                Repository.user == PydanticObjectId(user.id),
                Repository.github_url == repository_url.lower()
            ),
        )
                
        if not repo:
            raise HTTPException(status_code=404, detail="Repository not found for the user")
        
        # Use the repository's documentation base path
        output_dir = repo.file_paths.documentation_base_path
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse repository URL: {str(e)}")
    
    try:
        # Generate unique task ID
        task_id = f"wiki_{hash(repository_url)}_{int(time.time())}"
        
        # Initialize task status
        task_results[task_id] = {
            "task_id": task_id,
            "status": "pending",
            "message": "Wiki generation task queued",
            "result": None,
            "error": None,
            "created_at": time.time(),
            "completed_at": None
        }
        
        # Start the background task using asyncio.create_task (better approach)
        asyncio.create_task(
            _generate_wiki_background(
                task_id,
                repository_url,
                output_dir,
                language,
                comprehensive
            )
        )
        
        return WikiGenerationResponse(
            status="accepted",
            message="Wiki generation started",
            task_id=task_id
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

async def _generate_wiki_background(
    task_id: str, 
    repo_url: str, 
    output_dir: str, 
    language: str, 
    comprehensive: bool
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
            comprehensive
        )
        
        # Update task status on success
        task_results[task_id].update({
            "status": "completed",
            "message": "Wiki generation completed successfully",
            "result": result,
            "completed_at": time.time()
        })
        
    except Exception as e:
        # Update task status on error
        task_results[task_id].update({
            "status": "failed",
            "message": "Wiki generation failed",
            "error": str(e),
            "completed_at": time.time()
        })
        
def _run_wiki_generation(repo_url: str, output_dir: str, language: str, comprehensive: bool):
    """Synchronous function to run the actual wiki generation"""
    try:
        # Ensure output directory exists
        os.makedirs(output_dir, exist_ok=True)
        
        generator = DocumentationGenerator()
        result = generator.generate_complete_wiki(
            repo_url_or_path=repo_url,
            output_dir=output_dir,
            language=language
        )
        return result
    except Exception as e:
        raise e

@router.get(
    "/wiki-status/{task_id}",
    response_model=TaskStatus,
    summary="Get wiki generation status",
    description="Retrieves the current status of a wiki generation task using the provided task ID.",
    response_description="Current status of the wiki generation task.",
    responses={
        200: {
            "description": "Task status retrieved successfully."
        },
        404: {
            "description": "Task ID not found."
        },
        500: {
            "description": "Internal server error."
        }
    }
)
async def get_wiki_status(task_id: str, token: str = Form(..., description="Authentication token for the request")):
    """Get the status of a wiki generation task"""
    try:
        if task_id not in task_results:
            raise HTTPException(status_code=404, detail="Task ID not found")
        
        return TaskStatus(**task_results[task_id])
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get(
    "/wiki-tasks",
    summary="List all wiki generation tasks",
    description="Retrieves a list of all wiki generation tasks and their current status.",
    response_description="List of all wiki generation tasks.",
)
async def list_wiki_tasks(
    token: str = Form(..., description="Authentication token for the request")
):
    """List all wiki generation tasks"""
    try:
        return {"tasks": list(task_results.values())}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete(
    "/wiki-tasks/{task_id}",
    summary="Delete a wiki generation task",
    description="Deletes a completed or failed wiki generation task from memory.",
    response_description="Confirmation of task deletion.",
)
async def delete_wiki_task(task_id: str, token: str = Form(..., description="Authentication token for the request")):
    """Delete a wiki generation task"""
    try:
        if task_id not in task_results:
            raise HTTPException(status_code=404, detail="Task ID not found")
        
        # Only allow deletion of completed or failed tasks
        if task_results[task_id]["status"] in ["running", "pending"]:
            raise HTTPException(status_code=400, detail="Cannot delete running or pending tasks")
        
        del task_results[task_id]
        return {"message": "Task deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get(
    "/wiki-files/{task_id}",
    summary="List generated wiki files",
    description="Lists all generated wiki files for a specific repository.",
    response_description="List of generated wiki files.",
)
async def list_wiki_files(
    task_id: str,
    token: str = Form(..., description="Authentication token for the request")
):
    """List all generated wiki files for a repository"""
    try:
        # Authenticate user
        user = await get_current_user(token)
        if not user:
            raise HTTPException(status_code=401, detail="Unauthorized: Invalid token")
        
        # Check if task exists and is completed
        if task_id not in task_results:
            raise HTTPException(status_code=404, detail="Task ID not found")
        
        task = task_results[task_id]
        if task["status"] != "completed":
            raise HTTPException(status_code=400, detail="Task is not completed yet")
        
        # Get the documentation directory from task result
        result = task.get("result", {})
        output_dir = result.get("output_directory")
        
        if not output_dir or not os.path.exists(output_dir):
            raise HTTPException(status_code=404, detail="Documentation directory not found")
        
        # List all markdown files in the directory
        files = []
        for file in os.listdir(output_dir):
            if file.endswith('.md'):
                file_path = os.path.join(output_dir, file)
                file_size = os.path.getsize(file_path)
                file_modified = os.path.getmtime(file_path)
                
                files.append({
                    "filename": file,
                    "size": file_size,
                    "modified": file_modified
                })
        
        return {
            "task_id": task_id,
            "output_directory": output_dir,
            "files": files,
            "total_files": len(files)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    

# @router.get(
#     "/wiki-content/{task_id}/{filename}",
#     summary="Get wiki file content",
#     description="Retrieves the content of a specific wiki file.",
#     response_description="Content of the wiki file.",
# )
# async def get_wiki_file_content(
#     task_id: str,
#     filename: str,
#     token: str = Form(..., description="Authentication token for the request")
# ):
#     """Get content of a specific wiki file"""
#     try:
#         # Authenticate user
#         user = await get_current_user(token)
#         if not user:
#             raise HTTPException(status_code=401, detail="Unauthorized: Invalid token")
        
#         # Check if task exists and is completed
#         if task_id not in task_results:
#             raise HTTPException(status_code=404, detail="Task ID not found")
        
#         task = task_results[task_id]
#         if task["status"] != "completed":
#             raise HTTPException(status_code=400, detail="Task is not completed yet")
        
#         # Get the documentation directory from task result
#         result = task.get("result", {})
#         output_dir = result.get("output_directory")
        
#         if not output_dir or not os.path.exists(output_dir):
#             raise HTTPException(status_code=404, detail="Documentation directory not found")
        
#         # Validate filename (security check)
#         if not filename.endswith('.md') or '/' in filename or '\\' in filename:
#             raise HTTPException(status_code=400, detail="Invalid filename")
        
#         file_path = os.path.join(output_dir, filename)
#         if not os.path.exists(file_path):
#             raise HTTPException(status_code=404, detail="File not found")
        
#         # Read and return file content
#         with open(file_path, 'r', encoding='utf-8') as f:
#             content = f.read()
        
#         return {
#             "task_id": task_id,
#             "filename": filename,
#             "content": content,
#             "size": len(content)
#         }
        
#     except HTTPException:
#         raise
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=str(e))

# @router.get(
#     "/repository-docs/{repo_id}",
#     summary="List repository documentation files",
#     description="Lists all documentation files for a specific repository.",
#     response_description="List of documentation files for the repository.",
# )
# async def list_repository_docs(
#     repo_id: str,
#     token: str = Form(..., description="Authentication token for the request")
# ):
#     """List all documentation files for a repository"""
#     try:
#         # Authenticate user
#         user = await get_current_user(token)
#         if not user:
#             raise HTTPException(status_code=401, detail="Unauthorized: Invalid token")
        
#         # Find the repository
#         repo = await Repository.find_one({
#             "_id": PydanticObjectId(repo_id),
#             "user_id": PydanticObjectId(user.id)
#         })
        
#         if not repo:
#             raise HTTPException(status_code=404, detail="Repository not found")
        
#         # Get documentation directory
#         doc_dir = repo.file_paths.documentation_base_path
#         if not os.path.exists(doc_dir):
#             return {
#                 "repository_id": repo_id,
#                 "documentation_directory": doc_dir,
#                 "files": [],
#                 "total_files": 0,
#                 "message": "No documentation generated yet"
#             }
        
#         # List all markdown files in the directory
#         files = []
#         for file in os.listdir(doc_dir):
#             if file.endswith('.md'):
#                 file_path = os.path.join(doc_dir, file)
#                 file_size = os.path.getsize(file_path)
#                 file_modified = os.path.getmtime(file_path)
                
#                 files.append({
#                     "filename": file,
#                     "size": file_size,
#                     "modified": file_modified
#                 })
        
#         return {
#             "repository_id": repo_id,
#             "repository_name": repo.repo_name,
#             "documentation_directory": doc_dir,
#             "files": files,
#             "total_files": len(files)
#         }
        
#     except HTTPException:
#         raise
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=str(e))

# @router.get(
#     "/repository-docs/{repo_id}/{filename}",
#     summary="Get repository documentation file content",
#     description="Retrieves the content of a specific documentation file for a repository.",
#     response_description="Content of the documentation file.",
# )
# async def get_repository_doc_content(
#     repo_id: str,
#     filename: str,
#     token: str = Form(..., description="Authentication token for the request")
# ):
#     """Get content of a specific documentation file for a repository"""
#     try:
#         # Authenticate user
#         user = await get_current_user(token)
#         if not user:
#             raise HTTPException(status_code=401, detail="Unauthorized: Invalid token")
        
#         # Find the repository
#         repo = await Repository.find_one({
#             "_id": PydanticObjectId(repo_id),
#             "user_id": PydanticObjectId(user.id)
#         })
        
#         if not repo:
#             raise HTTPException(status_code=404, detail="Repository not found")
        
#         # Get documentation directory
#         doc_dir = repo.file_paths.documentation_base_path
#         if not os.path.exists(doc_dir):
#             raise HTTPException(status_code=404, detail="Documentation directory not found")
        
#         # Validate filename (security check)
#         if not filename.endswith('.md') or '/' in filename or '\\' in filename:
#             raise HTTPException(status_code=400, detail="Invalid filename")
        
#         file_path = os.path.join(doc_dir, filename)
#         if not os.path.exists(file_path):
#             raise HTTPException(status_code=404, detail="File not found")
        
#         # Read and return file content
#         with open(file_path, 'r', encoding='utf-8') as f:
#             content = f.read()
        
#         return {
#             "repository_id": repo_id,
#             "repository_name": repo.repo_name,
#             "filename": filename,
#             "content": content,
#             "size": len(content)
#         }
        
#     except HTTPException:
#         raise
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=str(e))