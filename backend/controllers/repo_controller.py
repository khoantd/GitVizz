from fastapi import BackgroundTasks, HTTPException, Form, File, UploadFile
from typing import Optional, List
from datetime import datetime
import os
import json
import hashlib
from pathlib import Path

from schemas.response_schemas import (
    TextResponse,
    GraphResponse,
    StructureResponse,
    FileData
)
from utils.repo_utils import (
    _process_input,
    smart_filter_files,
    format_repo_contents,
    cleanup_temp_files,
    parse_repo_url,
    format_repo_structure
)
from utils.jwt_utils import get_current_user
from graphing.graph_generator import GraphGenerator
from models.repository import Repository, FilePaths
from models.user import User
import requests


"""
Controller module for handling repository-related operations.

Includes endpoints for:
- Generating LLM-friendly text from a code repository or ZIP file (/api/generate-text)
- Generating a graph representation of the repository structure (/api/generate-graph)
- Generating the file structure and content of a code repository (/api/generate-structure)

These endpoints process uploaded ZIP files or remote GitHub/repo URLs,
extract code content, and return structured output suitable for further analysis.
Supports user-based caching when JWT token is provided.

Used by: routes/repo_routes.py
"""


async def get_latest_commit_sha(repo_url: str, branch: str = "main", access_token: Optional[str] = None) -> Optional[str]:
    """Get the latest commit SHA for a GitHub repository."""
    try:
        repo_info = parse_repo_url(repo_url)
        if repo_info["owner"] == "unknown":
            return None
            
        api_url = f"https://api.github.com/repos/{repo_info['owner']}/{repo_info['repo']}/branches/{branch}"
        headers = {
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": os.getenv("GITHUB_USER_AGENT", "fastapi-app"),
        }
        
        # Only add authorization header if we have a valid access token
        if access_token and access_token.strip() and access_token != "string":
            headers["Authorization"] = f"token {access_token}"
            
        response = requests.get(api_url, headers=headers, timeout=10)
        if response.status_code == 200:
            return response.json()["commit"]["sha"]
        elif response.status_code == 401 and access_token:
            # If we got 401 with a token, the token might be invalid
            print(f"Warning: GitHub API returned 401 with provided token for {repo_url}")
            return None
        # For public repos without token, we might still get commit info from other sources
        # but for now, we'll return None and let the system work without commit tracking
        return None
    except Exception as e:
        print(f"Error getting commit SHA for {repo_url}: {str(e)}")
        return None


def generate_repo_identifier(repo_url: Optional[str], zip_filename: Optional[str], branch: str = "main") -> str:
    """Generate a unique identifier for the repository."""
    if repo_url:
        repo_info = parse_repo_url(repo_url)
        return f"{repo_info['owner']}_{repo_info['repo']}_{branch}"
    elif zip_filename:
        # Create a hash of the filename for consistency
        return f"zip_{hashlib.md5(zip_filename.encode()).hexdigest()[:8]}"
    return f"unknown_repo_{datetime.utcnow().timestamp()}"


def is_valid_access_token(access_token: Optional[str]) -> bool:
    """Check if the access token is valid and not a placeholder."""
    return (access_token and 
            access_token.strip() and 
            access_token != "string" and 
            len(access_token.strip()) > 10)


async def save_files_to_storage(
    user_id: str, 
    repo_identifier: str, 
    formatted_text: str, 
    graph_data: Optional[dict] = None, 
    structure_data: Optional[dict] = None,
    zip_content: Optional[bytes] = None
) -> FilePaths:
    """Save generated files to user-specific storage directories."""
    
    try:
        # Create user directory structure: storage/users/{user_id}/{repo_identifier}/
        base_dir = Path("storage") / "users" / user_id / repo_identifier
        base_dir.mkdir(parents=True, exist_ok=True)
        
        # Define file paths
        zip_path = str(base_dir / "repository.zip")
        text_path = str(base_dir / "content.txt")
        json_path = str(base_dir / "data.json")
        
        file_paths = FilePaths(
            zip=zip_path,
            text=text_path,
            json_file=json_path
        )
        
        # Save text content
        with open(text_path, "w", encoding="utf-8") as f:
            f.write(formatted_text)
        
        # Save ZIP file if provided
        if zip_content:
            with open(zip_path, "wb") as f:
                f.write(zip_content)
        
        # Save JSON data (graph or structure)
        json_data = {}
        if graph_data:
            json_data["graph"] = graph_data
        if structure_data:
            json_data["structure"] = structure_data
        
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(json_data, f, indent=2)
        
        return file_paths
        
    except Exception as e:
        print(f"Error in save_files_to_storage: {e}")
        raise


async def check_existing_repository(
    user: User, 
    repo_identifier: str, 
    commit_sha: Optional[str] = None
) -> Optional[Repository]:
    """Check if repository already exists for user and if it's up to date."""
    
    try:
        existing_repo = await Repository.find_one(
            Repository.user.id == user.id,
            Repository.repo_name == repo_identifier
        )
        
        if not existing_repo:
            return None
        
        # If we have a commit SHA and it's different, repo is outdated
        if commit_sha and existing_repo.commit_sha != commit_sha:
            return None
        
        # Check if files still exist
        text_path = existing_repo.file_paths.text
        json_path = existing_repo.file_paths.json_file
        
        if (not os.path.exists(text_path) or not os.path.exists(json_path)):
            return None
        
        return existing_repo
        
    except Exception as e:
        print(f"Error in check_existing_repository: {e}")
        return None


async def get_zip_content_from_processing(
    repo_url: Optional[str],
    branch: str,
    zip_file: Optional[UploadFile],
    access_token: Optional[str]
) -> Optional[bytes]:
    """Extract ZIP content during processing for caching."""
    if zip_file:
        # If uploaded ZIP file, read its content
        zip_content = await zip_file.read()
        await zip_file.seek(0)  # Reset file pointer for later use
        return zip_content
    
    elif repo_url:
        # If GitHub URL, download the ZIP content
        try:
            actual_zip_url = repo_url  # fallback
            headers = {}

            if "github.com" in repo_url:
                repo_info = parse_repo_url(repo_url)
                owner, repo_name_from_url = repo_info["owner"], repo_info["repo"]

                if owner != "unknown":
                    # Use GitHub API zipball URL
                    actual_zip_url = f"https://api.github.com/repos/{owner}/{repo_name_from_url}/zipball/{branch or 'main'}"
                    headers = {
                        "Authorization": f"token {access_token}" if access_token else "",
                        "Accept": "application/vnd.github.v3+json",
                        "User-Agent": os.getenv("GITHUB_USER_AGENT", "fastapi-app"),
                    }

            response = requests.get(actual_zip_url, stream=True, timeout=60, headers=headers)
            if response.status_code == 200:
                return response.content
                
        except Exception as e:
            print(f"Error downloading ZIP content for caching: {e}")
    
    return None


async def generate_text_endpoint(
    background_tasks: BackgroundTasks,
    repo_url: Optional[str] = Form(
        None,
        description="URL to a downloadable ZIP of the repository (e.g., GitHub archive link).",
    ),
    branch: Optional[str] = Form(
        "main", description="Branch to use if repo_url is a GitHub repository link."
    ),
    zip_file: Optional[UploadFile] = File(
        None, description="A ZIP file of the repository."
    ),
    access_token: Optional[str] = Form(
        None,
        description="Optional GitHub token for accessing private repositories.",
        example="ghp_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
    ),
    jwt_token: Optional[str] = Form(
        None,
        description="Optional JWT token for user authentication.",
        example="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    ),
) -> TextResponse:
    if not repo_url and not zip_file:
        raise HTTPException(
            status_code=400, detail="Either repo_url or zip_file must be provided."
        )
    
    user = None
    zip_content = None
    
    # Get user if JWT token provided
    if jwt_token:
        user = await get_current_user(jwt_token)
        if not user:
            raise HTTPException(
                status_code=401, detail="Invalid or expired JWT token."
            )
    
    # Generate repository identifier
    repo_identifier = generate_repo_identifier(
        repo_url, 
        zip_file.filename if zip_file else None, 
        branch
    )
    
    # Get commit SHA if it's a GitHub repo AND we have a valid access token
    commit_sha = None
    if repo_url and "github.com" in repo_url and is_valid_access_token(access_token):
        commit_sha = await get_latest_commit_sha(repo_url, branch, access_token)
    
    # Check if user has this repository cached
    if user:
        existing_repo = await check_existing_repository(user, repo_identifier, commit_sha)
        if existing_repo:
            # Return cached content
            with open(existing_repo.file_paths.text, "r", encoding="utf-8") as f:
                cached_content = f.read()
            
            return TextResponse(
                text_content=cached_content,
                filename_suggestion=f"{repo_identifier}_content.txt"
            )

    temp_dirs_to_cleanup = []
    try:
        # Get ZIP content for caching before processing
        if user:
            valid_token = access_token if is_valid_access_token(access_token) else None
            zip_content = await get_zip_content_from_processing(repo_url, branch, zip_file, valid_token)
        
        # Only pass access_token if it's valid
        valid_token = access_token if is_valid_access_token(access_token) else None
        
        extracted_files, temp_extract_dir, temp_dirs_created = await _process_input(
            repo_url,
            branch,
            zip_file,
            access_token=valid_token,
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

        # Save to database if user is authenticated
        if user:
            file_paths = await save_files_to_storage(
                str(user.id), 
                repo_identifier, 
                formatted_text,
                zip_content=zip_content
            )
            
            # Create or update repository record
            repo_data = {
                "user": user,
                "repo_name": repo_identifier,
                "branch": branch,
                "commit_sha": commit_sha,
                "source": "github" if repo_url else "zip",
                "github_url": repo_url,
                "file_paths": file_paths,
                "updated_at": datetime.utcnow()
            }
            
            # Try to update existing or create new
            existing_repo = await Repository.find_one(
                Repository.user.id == user.id,
                Repository.repo_name == repo_identifier
            )
            
            if existing_repo:
                for key, value in repo_data.items():
                    if key != "user":  # Don't update the user field
                        setattr(existing_repo, key, value)
                await existing_repo.save()
            else:
                new_repo = Repository(**repo_data)
                await new_repo.save()

        filename_base = repo_identifier
        if repo_url:
            repo_info = parse_repo_url(repo_url)
            if repo_info.get("repo") and repo_info["repo"] != "repository":
                filename_base = f"{repo_info['owner']}_{repo_info['repo']}_{branch}_content"
        elif zip_file and zip_file.filename:
            filename_base = f"{Path(zip_file.filename).stem}_content"

        background_tasks.add_task(cleanup_temp_files, temp_dirs_to_cleanup)
        return TextResponse(
            text_content=formatted_text, 
            filename_suggestion=f"{filename_base}.txt"
        )
        
    except HTTPException as he:
        cleanup_temp_files(temp_dirs_to_cleanup)
        raise he
    except Exception as e:
        cleanup_temp_files(temp_dirs_to_cleanup)
        raise HTTPException(status_code=500, detail=f"Error generating text: {str(e)}")


async def generate_graph_endpoint(
    background_tasks: BackgroundTasks,
    repo_url: Optional[str] = Form(
        None, description="URL to a downloadable ZIP of the repository."
    ),
    branch: Optional[str] = Form("main", description="Branch for GitHub repo URL."),
    zip_file: Optional[UploadFile] = File(
        None, description="A ZIP file of the repository."
    ),
    access_token: Optional[str] = Form(
        None,
        description="Optional GitHub token for accessing private repositories.",
        example="ghp_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
    ),
    jwt_token: Optional[str] = Form(
        None,
        description="Optional JWT token for user authentication.",
        example="Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    ),
) -> GraphResponse:
    if not repo_url and not zip_file:
        raise HTTPException(
            status_code=400, detail="Either repo_url or zip_file must be provided."
        )

    user = None
    zip_content = None
    
    # Get user if JWT token provided
    if jwt_token:
        user = await get_current_user(jwt_token)
        if not user:
            raise HTTPException(
                status_code=401, detail="Invalid or expired JWT token."
            )
    
    # Generate repository identifier
    repo_identifier = generate_repo_identifier(
        repo_url, 
        zip_file.filename if zip_file else None, 
        branch
    )
    
    # Get commit SHA if it's a GitHub repo AND we have a valid access token
    commit_sha = None
    if repo_url and "github.com" in repo_url and is_valid_access_token(access_token):
        commit_sha = await get_latest_commit_sha(repo_url, branch, access_token)
    
    # Check if user has this repository cached
    if user:
        existing_repo = await check_existing_repository(user, repo_identifier, commit_sha)
        if existing_repo:
            # Return cached graph data
            with open(existing_repo.file_paths.json_file, "r", encoding="utf-8") as f:
                cached_data = json.load(f)
            
            if "graph" in cached_data:
                return GraphResponse(**cached_data["graph"])

    temp_dirs_to_cleanup = []
    try:
        # Get ZIP content for caching before processing
        if user:
            valid_token = access_token if is_valid_access_token(access_token) else None
            zip_content = await get_zip_content_from_processing(repo_url, branch, zip_file, valid_token)
        
        # Only pass access_token if it's valid
        valid_token = access_token if is_valid_access_token(access_token) else None
            
        extracted_files, temp_extract_dir, temp_dirs_created = await _process_input(
            repo_url, branch, zip_file, access_token=valid_token
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

        # Generate graph data
        generator = GraphGenerator(files=filtered_files, output_html_path=None)
        graph_data = generator.generate()

        # Save to database if user is authenticated
        if user:
            formatted_text = format_repo_contents(filtered_files)  # Also generate text for storage
            file_paths = await save_files_to_storage(
                str(user.id), 
                repo_identifier, 
                formatted_text,
                graph_data=graph_data,
                zip_content=zip_content
            )
            
            # Create or update repository record
            repo_data = {
                "user": user,
                "repo_name": repo_identifier,
                "branch": branch,
                "commit_sha": commit_sha,
                "source": "github" if repo_url else "zip",
                "github_url": repo_url,
                "file_paths": file_paths,
                "updated_at": datetime.utcnow()
            }
            
            existing_repo = await Repository.find_one(
                Repository.user.id == user.id,
                Repository.repo_name == repo_identifier
            )
            
            if existing_repo:
                for key, value in repo_data.items():
                    if key != "user":
                        setattr(existing_repo, key, value)
                await existing_repo.save()
            else:
                new_repo = Repository(**repo_data)
                await new_repo.save()

        background_tasks.add_task(cleanup_temp_files, temp_dirs_to_cleanup)
        return GraphResponse(**graph_data)
        
    except HTTPException as he:
        cleanup_temp_files(temp_dirs_to_cleanup)
        raise he
    except Exception as e:
        cleanup_temp_files(temp_dirs_to_cleanup)
        raise HTTPException(status_code=500, detail=f"Error generating graph: {str(e)}")
    

async def generate_structure_endpoint(
    background_tasks: BackgroundTasks,
    repo_url: Optional[str] = Form(
        None, description="URL to a downloadable ZIP of the repository."
    ),
    branch: Optional[str] = Form("main", description="Branch for GitHub repo URL."),
    zip_file: Optional[UploadFile] = File(
        None, description="A ZIP file of the repository."
    ),
    access_token: Optional[str] = Form(
        None,
        description="Optional GitHub token for accessing private repositories.",
        example="ghp_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
    ),
    jwt_token: Optional[str] = Form(
        None,
        description="Optional JWT token for user authentication.",
        example="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    ),
) -> StructureResponse:
    if not repo_url and not zip_file:
        raise HTTPException(
            status_code=400, detail="Either repo_url or zip_file must be provided."
        )

    user = None
    zip_content = None
    
    # Get user if JWT token provided
    if jwt_token:
        user = await get_current_user(jwt_token)
        if not user:
            raise HTTPException(
                status_code=401, detail="Invalid or expired JWT token."
            )
    
    # Generate repository identifier
    repo_identifier = generate_repo_identifier(
        repo_url, 
        zip_file.filename if zip_file else None, 
        branch
    )
    
    # Get commit SHA if it's a GitHub repo AND we have a valid access token
    commit_sha = None
    if repo_url and "github.com" in repo_url and is_valid_access_token(access_token):
        commit_sha = await get_latest_commit_sha(repo_url, branch, access_token)
    
    # Check if user has this repository cached
    if user:
        existing_repo = await check_existing_repository(user, repo_identifier, commit_sha)
        if existing_repo:
            # Return cached structure data
            with open(existing_repo.file_paths.json_file, "r", encoding="utf-8") as f:
                cached_data = json.load(f)
            
            if "structure" in cached_data:
                return StructureResponse(**cached_data["structure"])

    temp_dirs_to_cleanup = []
    try:
        # Get ZIP content for caching before processing
        if user:
            valid_token = access_token if is_valid_access_token(access_token) else None
            zip_content = await get_zip_content_from_processing(repo_url, branch, zip_file, valid_token)
        
        # Only pass access_token if it's valid
        valid_token = access_token if is_valid_access_token(access_token) else None
            
        extracted_files, temp_extract_dir, temp_dirs_created = await _process_input(
            repo_url, branch, zip_file, access_token=valid_token
        )
        temp_dirs_to_cleanup.extend(temp_dirs_created)

        if not extracted_files:
            raise HTTPException(
                status_code=404,
                detail="No files found in the provided repository source.",
            )

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
            )

        structure_data = {
            "directory_tree": directory_tree_string,
            "files": [{"path": f.path, "content": f.content} for f in files_data_list]
        }

        # Save to database if user is authenticated
        if user:
            formatted_text = format_repo_contents(relevant_files_for_structure)
            file_paths = await save_files_to_storage(
                str(user.id), 
                repo_identifier, 
                formatted_text,
                structure_data=structure_data,
                zip_content=zip_content
            )
            
            # Create or update repository record
            repo_data = {
                "user": user,
                "repo_name": repo_identifier,
                "branch": branch,
                "commit_sha": commit_sha,
                "source": "github" if repo_url else "zip",
                "github_url": repo_url,
                "file_paths": file_paths,
                "updated_at": datetime.utcnow()
            }
            
            existing_repo = await Repository.find_one(
                Repository.user.id == user.id,
                Repository.repo_name == repo_identifier
            )
            
            if existing_repo:
                for key, value in repo_data.items():
                    if key != "user":
                        setattr(existing_repo, key, value)
                await existing_repo.save()
            else:
                new_repo = Repository(**repo_data)
                await new_repo.save()

        background_tasks.add_task(cleanup_temp_files, temp_dirs_to_cleanup)
        return StructureResponse(
            directory_tree=directory_tree_string, 
            files=files_data_list
        )
        
    except HTTPException as he:
        cleanup_temp_files(temp_dirs_to_cleanup)
        raise he
    except Exception as e:
        cleanup_temp_files(temp_dirs_to_cleanup)
        raise HTTPException(
            status_code=500, detail=f"Error generating structure and content: {str(e)}"
        )