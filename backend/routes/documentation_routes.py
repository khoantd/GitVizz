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
import datetime
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

@router.post(
    "/wiki-status",
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
async def get_wiki_status(
    task_id: str = Form(..., description="ID of the wiki generation task to check status for"),
    token: str = Form(..., description="Authentication token for the request")):
    """Get the status of a wiki generation task"""
    try:
        if task_id not in task_results:
            raise HTTPException(status_code=404, detail="Task ID not found")
        
        return TaskStatus(**task_results[task_id])
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post(
    "/repository-docs",
    summary="List repository documentation files",
    description="Lists all documentation files for a specific repository with parsed content.",
    response_description="Structured documentation data for the repository.",
)
async def list_repository_docs(
    repo_id: str = Form(..., description="ID of the repository to list documentation files for"),
    token: str = Form(..., description="Authentication token for the request")
):
    """List all documentation files for a repository with parsed README content"""
    try:
        # Authenticate user
        user = await get_current_user(token)
        if not user:
            raise HTTPException(status_code=401, detail="Unauthorized: Invalid token")
        
        # Find the repository
        repo = await Repository.find_one(
            Repository.id == PydanticObjectId(repo_id),
            Repository.user.id == PydanticObjectId(user.id)
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
                        "directory": doc_dir
                    },
                    "analysis": {},
                    "navigation": {
                        "sidebar": [],
                        "total_pages": 0
                    },
                    "content": {}
                },
                "message": "No documentation generated yet"
            }
        
        # Parse README.md file
        readme_path = os.path.join(doc_dir, "readme.md")
        sidebar = []
        repo_analysis = {}
        
        if os.path.exists(readme_path):
            with open(readme_path, 'r', encoding='utf-8') as f:
                readme_content = f.read()
            
            # Parse repository analysis section
            repo_analysis = parse_repository_analysis(readme_content)
            
            # Parse documentation pages (sidebar)
            sidebar = parse_documentation_pages(readme_content)
        
        # List all markdown files in the directory with their content
        files = {}
        for file in os.listdir(doc_dir):
            if file.endswith('.md'):
                file_path = os.path.join(doc_dir, file)
                file_size = os.path.getsize(file_path)
                file_modified = datetime.fromtimestamp(os.path.getmtime(file_path))
                
                # Read file content
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                # Use filename (without extension) as key
                file_key = file.replace('.md', '')
                files[file_key] = {
                    "metadata": {
                        "filename": file,
                        "size": file_size,
                        "modified": file_modified.isoformat(),
                        "type": "markdown"
                    },
                    "content": content,
                    "preview": content[:200] + "..." if len(content) > 200 else content,
                    "word_count": len(content.split()),
                    "read_time": max(1, len(content.split()) // 200)  # Estimated reading time in minutes
                }
        
        return {
            "success": True,
            "data": {
                "repository": {
                    "id": repo_id,
                    "name": repo.repo_name,
                    "directory": doc_dir
                },
                "analysis": repo_analysis,
                "navigation": {
                    "sidebar": sidebar,
                    "total_pages": len(files)
                },
                "content": files
            },
            "message": "Documentation loaded successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def parse_repository_analysis(readme_content: str) -> dict:
    """Parse the repository analysis section from README content"""
    analysis = {}
    
    # Extract Repository Analysis section
    analysis_match = re.search(r'## 📊 Repository Analysis\n\n(.*?)(?=\n##|\n---|\Z)', readme_content, re.DOTALL)
    if analysis_match:
        analysis_content = analysis_match.group(1)
        
        # Extract individual metrics
        domain_match = re.search(r'- \*\*Domain Type\*\*: (.+)', analysis_content)
        complexity_match = re.search(r'- \*\*Complexity Score\*\*: (.+)', analysis_content)
        languages_match = re.search(r'- \*\*Languages\*\*: (.+)', analysis_content)
        frameworks_match = re.search(r'- \*\*Frameworks\*\*: (.+)', analysis_content)
        pages_match = re.search(r'- \*\*Total Pages\*\*: (.+)', analysis_content)
        
        if domain_match:
            analysis['domain_type'] = domain_match.group(1).strip()
        if complexity_match:
            analysis['complexity_score'] = complexity_match.group(1).strip()
        if languages_match:
            analysis['languages'] = languages_match.group(1).strip()
        if frameworks_match:
            analysis['frameworks'] = frameworks_match.group(1).strip()
        if pages_match:
            analysis['total_pages'] = pages_match.group(1).strip()
    
    return analysis


def parse_documentation_pages(readme_content: str) -> list:
    """Parse the documentation pages section to create sidebar navigation"""
    sidebar = []
    
    # Extract Documentation Pages section
    pages_match = re.search(r'## 📖 Documentation Pages\n\n(.*?)(?=\n##|\n---|\Z)', readme_content, re.DOTALL)
    if pages_match:
        pages_content = pages_match.group(1)
        
        # Find all markdown links
        link_pattern = r'- \[([^\]]+)\]\(([^)]+)\)'
        matches = re.findall(link_pattern, pages_content)
        
        for title, filename in matches:
            # Extract emoji and clean title
            emoji_match = re.match(r'([^\w\s]+)\s*(.+)', title)
            if emoji_match:
                emoji = emoji_match.group(1).strip()
                clean_title = emoji_match.group(2).strip()
            else:
                emoji = "📄"
                clean_title = title.strip()
            
            sidebar.append({
                "title": clean_title,
                "filename": filename,
                "emoji": emoji,
                "url": f"/docs/{filename}"
            })
    
    return sidebar