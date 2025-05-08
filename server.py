# =====================
# Imports
# =====================
import os
import re
import tempfile
import shutil
import zipfile
import asyncio
import time
from pathlib import Path
from typing import List, Dict, Optional
from io import BytesIO
import requests
import httpx
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks, Request
from fastapi.responses import HTMLResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel

# =====================
# App Configuration
# =====================
app = FastAPI(title="Repo2Txt API", description="Convert GitHub repositories or local files to plain text")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

CONFIG = {
    "rate_limit": 60,  # Default rate limit (requests per minute)
    "github_api_base": "https://api.github.com"
}

# Jinja2 templates for HTML rendering
templates = Jinja2Templates(directory="templates")

# Static files setup
static_dir = Path(__file__).parent / "static"
static_dir.mkdir(exist_ok=True)
app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")

# =====================
# Models
# =====================
class RepoRequest(BaseModel):
    """GitHub repository request model."""
    repo_url: str
    access_token: Optional[str] = None

class FileInfo(BaseModel):
    """File information model."""
    path: str
    type: str
    url: Optional[str] = None

class DirectoryResponse(BaseModel):
    """Directory response model."""
    tree: List[FileInfo]

class FileContentRequest(BaseModel):
    """File content request model."""
    files: List[FileInfo]
    access_token: Optional[str] = None

class FileContent(BaseModel):
    """File content model."""
    path: str
    text: str
    url: Optional[str] = None

class FileContentResponse(BaseModel):
    """File content response model."""
    contents: List[FileContent]

# =====================
# Rate Limiting
# =====================
class RateLimiter:
    """Simple async token bucket rate limiter."""
    def __init__(self, rate_limit_per_minute):
        self.rate_limit = rate_limit_per_minute
        self.tokens = rate_limit_per_minute
        self.last_refill_time = time.time()
        self.lock = asyncio.Lock()

    async def acquire(self):
        async with self.lock:
            now = time.time()
            elapsed = now - self.last_refill_time
            refill = int(elapsed * self.rate_limit / 60)
            if refill > 0:
                self.tokens = min(self.rate_limit, self.tokens + refill)
                self.last_refill_time = now
            if self.tokens > 0:
                self.tokens -= 1
                return True
            return False

rate_limiter = RateLimiter(CONFIG["rate_limit"])

# =====================
# GitHub API Functions
# =====================
async def fetch_with_rate_limit(url: str, headers: Dict, client: httpx.AsyncClient):
    """Fetch data from GitHub API with rate limiting and error handling."""
    if not await rate_limiter.acquire():
        raise HTTPException(status_code=429, detail="Rate limit exceeded. Please try again later.")
    response = await client.get(url, headers=headers)
    if response.status_code != 200:
        handle_fetch_error(response)
    return response.json()

async def parse_repo_url(repo_url: str):
    """Parse GitHub repository URL into owner, repo, and optional ref/path."""
    pattern = r"github.com[:/](?P<owner>[^/]+)/(?P<repo>[^/#]+)(?:/(tree|blob)/(?P<last_string>.+))?"
    m = re.search(pattern, repo_url)
    if not m:
        raise HTTPException(status_code=400, detail="Invalid GitHub repository URL.")
    return m.groupdict(default='')

async def get_references(owner: str, repo: str, token: Optional[str], client: httpx.AsyncClient):
    """Fetch repository references (branches and tags)."""
    headers = {"Authorization": f"token {token}"} if token else {}
    url = f"{CONFIG['github_api_base']}/repos/{owner}/{repo}/branches"
    branches = await fetch_with_rate_limit(url, headers, client)
    url = f"{CONFIG['github_api_base']}/repos/{owner}/{repo}/tags"
    tags = await fetch_with_rate_limit(url, headers, client)
    return {"branches": [b['name'] for b in branches], "tags": [t['name'] for t in tags]}

async def fetch_repo_sha(owner: str, repo: str, ref: str, path: str, token: Optional[str], client: httpx.AsyncClient):
    """Fetch repository SHA for a given ref/path."""
    headers = {"Authorization": f"token {token}"} if token else {}
    if ref:
        url = f"{CONFIG['github_api_base']}/repos/{owner}/{repo}/git/refs/heads/{ref}"
        response = await client.get(url, headers=headers)
        if response.status_code == 200:
            return response.json()['object']['sha']
    # Default branch SHA
    url = f"{CONFIG['github_api_base']}/repos/{owner}/{repo}"
    response = await client.get(url, headers=headers)
    if response.status_code == 200:
        return response.json()['default_branch']
    raise HTTPException(status_code=404, detail="Could not determine repository SHA.")

async def fetch_repo_tree(owner: str, repo: str, sha: str, token: Optional[str], client: httpx.AsyncClient):
    """Fetch repository tree (file structure)."""
    headers = {"Authorization": f"token {token}"} if token else {}
    url = f"{CONFIG['github_api_base']}/repos/{owner}/{repo}/git/trees/{sha}?recursive=1"
    response = await client.get(url, headers=headers)
    if response.status_code == 200:
        return response.json()
    raise HTTPException(status_code=404, detail="Could not fetch repository tree.")

async def fetch_file_contents(files: List[FileInfo], token: Optional[str], client: httpx.AsyncClient):
    """Fetch contents of selected files from GitHub."""
    headers = {"Authorization": f"token {token}"} if token else {}
    contents = []
    for file in files:
        url = f"{CONFIG['github_api_base']}/repos/{file.url}"
        response = await client.get(url, headers=headers)
        if response.status_code == 200:
            contents.append(FileContent(path=file.path, text=response.text, url=file.url))
    return contents

def handle_fetch_error(response):
    """Handle fetch errors from GitHub API with user-friendly messages."""
    if response.status_code == 403:
        raise HTTPException(status_code=403, detail="GitHub API rate limit exceeded. Please use a personal access token.")
    elif response.status_code == 404:
        raise HTTPException(status_code=404, detail="Resource not found.")
    elif response.status_code == 401:
        raise HTTPException(
            status_code=401,
            detail=(
                "Unauthorized. Invalid or missing GitHub token. "
                "Please provide a valid personal access token if accessing private repositories or to increase your rate limit."
            )
        )
    else:
        raise HTTPException(status_code=response.status_code, detail=f"GitHub API error: {response.text}")

# Format repository contents into a single text
def format_repo_contents(contents: List[FileContent]) -> str:
    """Format repository contents into a single text"""
    text = ""
    index = ""
    
    # Sort contents by path
    contents.sort(key=lambda x: x.path)
    
    # Create a directory tree structure
    tree = {}
    for item in contents:
        parts = item.path.split('/')
        current_level = tree
        for i, part in enumerate(parts):
            if part not in current_level:
                current_level[part] = {} if i < len(parts) - 1 else None
            current_level = current_level[part] if i < len(parts) - 1 else current_level
    
    # Build the index recursively
    def build_index(node, prefix=""):
        result = ""
        entries = list(node.items())
        for i, (name, subnode) in enumerate(entries):
            is_last_item = i == len(entries) - 1
            line_prefix = "└── " if is_last_item else "├── "
            child_prefix = "    " if is_last_item else "│   "
            
            name = "." if name == "" else name
            
            result += f"{prefix}{line_prefix}{name}\n"
            if subnode is not None:
                result += build_index(subnode, f"{prefix}{child_prefix}")
        return result
    
    index = build_index(tree)
    
    for item in contents:
        text += f"\n\n---\nFile: {item.path}\n---\n\n{item.text}\n"
    
    return f"Directory Structure:\n\n{index}\n{text}"

# Local file processing functions
def process_directory_files(files: List[UploadFile]) -> List[FileInfo]:
    """Process uploaded directory files"""
    tree = []
    for file in files:
        file_path = file.filename
        if file_path:
            tree.append(FileInfo(
                path=file_path,
                type="blob",
                url=None  # Will be populated with a temporary file path
            ))
    return tree

async def save_uploaded_files(files: List[UploadFile]) -> Dict[str, str]:
    """Save uploaded files to temporary directory and return path mapping"""
    temp_dir = tempfile.mkdtemp()
    path_mapping = {}
    
    for file in files:
        if file.filename:
            file_path = os.path.join(temp_dir, file.filename)
            os.makedirs(os.path.dirname(file_path), exist_ok=True)
            
            # Save the file
            content = await file.read()
            with open(file_path, 'wb') as f:
                f.write(content)
            
            # Store the mapping
            path_mapping[file.filename] = file_path
            
            # Reset file position for potential reuse
            await file.seek(0)
    
    return path_mapping

def extract_zip_contents(zip_file_path: str) -> List[FileInfo]:
    """Extract files from a zip archive"""
    temp_dir = tempfile.mkdtemp()
    tree = []
    
    with zipfile.ZipFile(zip_file_path, 'r') as zip_ref:
        zip_ref.extractall(temp_dir)
        
        for root, _, files in os.walk(temp_dir):
            for file in files:
                full_path = os.path.join(root, file)
                relative_path = os.path.relpath(full_path, temp_dir)
                
                tree.append(FileInfo(
                    path=relative_path,
                    type="blob",
                    url=full_path  # Temporary file path
                ))
    
    return tree, temp_dir

async def read_local_file_contents(files: List[FileInfo]) -> List[FileContent]:
    """Read contents of local files"""
    contents = []
    
    for file in files:
        try:
            with open(file.url, 'r', encoding='utf-8', errors='replace') as f:
                text = f.read()
            contents.append(FileContent(path=file.path, text=text, url=file.url))
        except Exception as e:
            contents.append(FileContent(
                path=file.path,
                text=f"// Error: Could not read file content ({str(e)})",
                url=file.url
            ))
    
    return contents

# Cleanup function for temporary files
def cleanup_temp_files(temp_dirs):
    """Clean up temporary directories"""
    for temp_dir in temp_dirs:
        if os.path.exists(temp_dir):
            shutil.rmtree(temp_dir, ignore_errors=True)

# =====================
# API Endpoints
# =====================
@app.post("/api/github/smart-fetch")
async def smart_fetch_github(repo_request: RepoRequest):
    """
    Smart fetch a GitHub repository and return formatted text.
    - Ignores non-source files (images, binaries, archives, etc) based on extension blacklist and size threshold.
    - Uses extension whitelist for common programming languages.
    - Handles GitHub API rate limits and token usage gracefully.
    """
    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            # Parse repo URL
            repo_info = await parse_repo_url(repo_request.repo_url)
            owner, repo, last_string = repo_info["owner"], repo_info["repo"], repo_info["last_string"]

            ref_from_url = ''
            path_from_url = ''

            if last_string:
                references = await get_references(owner, repo, repo_request.access_token, client)
                all_refs = references["branches"] + references["tags"]
                matching_ref = next((ref for ref in all_refs if last_string.startswith(ref)), None)
                if matching_ref:
                    ref_from_url = matching_ref
                    path_from_url = last_string[len(matching_ref) + 1:] if len(matching_ref) < len(last_string) else ''
                else:
                    ref_from_url = last_string

            # Fetch repository structure (tree)
            sha = await fetch_repo_sha(owner, repo, ref_from_url, path_from_url, repo_request.access_token, client)
            tree_data = await fetch_repo_tree(owner, repo, sha, repo_request.access_token, client)

            # --- Smart file filtering ---
            # Whitelist: Common code/text extensions
            common_extensions = [
                '.py', '.js', '.ts', '.java', '.cpp', '.c', '.h', '.hpp', '.cs', '.go', '.rs', '.php', '.rb', '.swift',
                '.html', '.css', '.scss', '.json', '.yaml', '.yml', '.md', '.txt', '.xml', '.ini', '.conf', '.sh', '.bat', '.pl', '.toml', '.jsx', '.tsx'
            ]
            # Blacklist: Images, binaries, archives, media, large files
            blacklist_ext = [
                '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.svg', '.ico', '.webp', '.tiff',
                '.mp3', '.mp4', '.avi', '.mov', '.mkv', '.wav', '.flac',
                '.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.xz',
                '.exe', '.dll', '.so', '.bin', '.obj', '.o', '.a', '.lib', '.class', '.jar', '.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', '.db', '.sqlite', '.apk', '.ipa', '.dmg', '.iso', '.psd', '.ai', '.sketch', '.ttf', '.woff', '.woff2', '.eot', '.otf'
            ]
            max_file_size = 1024 * 1024  # 1 MB

            files = [
                FileInfo(path=f['path'], type=f['type'], url=f.get('url'))
                for f in tree_data['tree']
                if f['type'] == 'blob' and
                   any(f['path'].endswith(ext) for ext in common_extensions) and
                   not any(f['path'].endswith(ext) for ext in blacklist_ext) and
                   f.get('size', 0) < max_file_size
            ]
            if not files:
                raise HTTPException(status_code=404, detail="No suitable source files found in the repository.")

            # Fetch file contents
            contents = await fetch_file_contents(files, repo_request.access_token, client)
            formatted_text = format_repo_contents(contents)

            # Return as a downloadable text file
            return StreamingResponse(
                BytesIO(formatted_text.encode()),
                media_type="text/plain",
                headers={"Content-Disposition": "attachment; filename=repo_content.txt"}
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error fetching repository: {str(e)}")

@app.get("/", response_class=HTMLResponse)
async def get_html_ui(request: Request):
    """Serve the main HTML UI page."""
    return templates.TemplateResponse("index.html", {"request": request})

@app.post("/api/local/upload-zip")
async def upload_zip(background_tasks: BackgroundTasks, zip_file: UploadFile = File(...)):
    """Process uploaded zip file and return its structure."""
    if not zip_file.filename or not zip_file.filename.lower().endswith(('.zip', '.rar', '.7z')):
        raise HTTPException(status_code=400, detail="Invalid file format. Please upload a .zip, .rar, or .7z file.")
    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.zip')
    try:
        content = await zip_file.read()
        temp_file.write(content)
        temp_file.close()
        tree, temp_dir = extract_zip_contents(temp_file.name)
        # Do NOT clean up temp_dir here; cleanup will be handled after text generation
        # background_tasks.add_task(cleanup_temp_files, [temp_dir, os.path.dirname(temp_file.name)])
        return DirectoryResponse(tree=tree)
    except Exception as e:
        if os.path.exists(temp_file.name):
            os.unlink(temp_file.name)
        raise HTTPException(status_code=500, detail=f"Error processing zip file: {str(e)}")

@app.post("/api/local/upload-directory")
async def upload_directory(background_tasks: BackgroundTasks, files: List[UploadFile] = File(...)):
    """Process uploaded directory files and return their structure."""
    if not files:
        raise HTTPException(status_code=400, detail="No files uploaded")
    path_mapping = await save_uploaded_files(files)
    tree = [FileInfo(path=filename, type="blob", url=filepath) for filename, filepath in path_mapping.items()]
    # Do NOT clean up temp_dirs here; cleanup will be handled after text generation
    # temp_dirs = [os.path.dirname(next(iter(path_mapping.values())))] if path_mapping else []
    # background_tasks.add_task(cleanup_temp_files, temp_dirs)
    return DirectoryResponse(tree=tree)

@app.post("/api/local/generate-text")
async def generate_local_text(background_tasks: BackgroundTasks, request: FileContentRequest):
    """Generate a formatted text file from local files."""
    contents = await read_local_file_contents(request.files)
    formatted_text = format_repo_contents(contents)
    temp_dirs = set()
    for file in request.files:
        if file.url and os.path.exists(file.url):
            temp_dirs.add(os.path.dirname(os.path.dirname(file.url)))
    background_tasks.add_task(cleanup_temp_files, list(temp_dirs))
    return StreamingResponse(
        BytesIO(formatted_text.encode()),
        media_type="text/plain",
        headers={"Content-Disposition": "attachment; filename=local_content.txt"}
    )

@app.get("/api/config")
async def get_config():
    """Get current configuration."""
    return CONFIG

@app.post("/api/config")
async def update_config(rate_limit: int = Form(...)):
    """Update configuration (rate limit)."""
    if rate_limit < 1:
        raise HTTPException(status_code=400, detail="Rate limit must be at least 1 request per minute")
    CONFIG["rate_limit"] = rate_limit
    rate_limiter.rate_limit = rate_limit
    return {"message": "Configuration updated successfully", "config": CONFIG}

@app.post("/api/github/zip-fetch")
async def github_zip_fetch(repo_request: RepoRequest):
    """
    Download and parse a GitHub repo as ZIP if no token is provided. If token is provided, ask user to use smart-fetch endpoint instead.
    """
    if repo_request.access_token:
        raise HTTPException(status_code=400, detail="Access token provided; use /api/github/smart-fetch for authenticated fetch.")

    # Parse repo URL
    repo_info = await parse_repo_url(repo_request.repo_url)
    owner, repo, last_string = repo_info["owner"], repo_info["repo"], repo_info["last_string"]
    branch = "main"
    if last_string:
        branch = last_string.split("/")[0]
    
    # Download ZIP from GitHub
    zip_url = f"https://github.com/{owner}/{repo}/archive/{branch}.zip"
    temp_zip = tempfile.NamedTemporaryFile(delete=False, suffix='.zip')
    try:
        r = requests.get(zip_url, stream=True, timeout=60)
        if r.status_code != 200:
            raise HTTPException(status_code=404, detail=f"Could not download ZIP from GitHub (status={r.status_code}). Please check repo URL and branch.")
        for chunk in r.iter_content(chunk_size=8192):
            temp_zip.write(chunk)
        temp_zip.close()
        # Unzip to temp dir
        temp_dir = tempfile.mkdtemp()
        with zipfile.ZipFile(temp_zip.name, 'r') as zip_ref:
            zip_ref.extractall(temp_dir)
        # Walk and filter files
        code_files = []
        common_extensions = [
            '.py', '.js', '.ts', '.java', '.cpp', '.c', '.h', '.hpp', '.cs', '.go', '.rs', '.php', '.rb', '.swift',
            '.html', '.css', '.scss', '.json', '.yaml', '.yml', '.md', '.txt', '.xml', '.ini', '.conf', '.sh', '.bat', '.pl', '.toml', '.jsx', '.tsx'
        ]
        blacklist_ext = [
            '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.svg', '.ico', '.webp', '.tiff',
            '.mp3', '.mp4', '.avi', '.mov', '.mkv', '.wav', '.flac',
            '.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.xz',
            '.exe', '.dll', '.so', '.bin', '.obj', '.o', '.a', '.lib', '.class', '.jar', '.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', '.db', '.sqlite', '.apk', '.ipa', '.dmg', '.iso', '.psd', '.ai', '.sketch', '.ttf', '.woff', '.woff2', '.eot', '.otf'
        ]
        MAX_FILE_SIZE = 1024 * 1024  # 1 MB
        for root, dirs, files in os.walk(temp_dir):
            # Skip hidden dirs
            dirs[:] = [d for d in dirs if not d.startswith('.')]
            for fname in files:
                fpath = os.path.join(root, fname)
                ext = Path(fname).suffix.lower()
                rel_path = os.path.relpath(fpath, temp_dir)
                if (
                    ext in common_extensions
                    and ext not in blacklist_ext
                    and not any(part.startswith('.') for part in Path(rel_path).parts)
                ):
                    try:
                        if os.path.getsize(fpath) <= MAX_FILE_SIZE:
                            with open(fpath, 'r', encoding='utf-8', errors='ignore') as f:
                                text = f.read()
                            code_files.append(FileContent(path=rel_path, text=text, url=None))
                    except Exception:
                        continue
        # Format and return as text
        formatted_text = format_repo_contents(code_files)
        return {"text": formatted_text}
    finally:
        try:
            if os.path.exists(temp_zip.name):
                os.unlink(temp_zip.name)
            if 'temp_dir' in locals() and os.path.exists(temp_dir):
                shutil.rmtree(temp_dir)
        except Exception:
            pass

@app.post("/api/github/fetch-structure", response_model=DirectoryResponse)
async def fetch_github_structure(repo_request: RepoRequest):
    """Fetch the structure of a GitHub repository"""
    async with httpx.AsyncClient(timeout=30.0) as client:
        repo_info = await parse_repo_url(repo_request.repo_url)
        owner, repo, last_string = repo_info["owner"], repo_info["repo"], repo_info["last_string"]
        
        ref_from_url = ''
        path_from_url = ''
        
        if last_string:
            references = await get_references(owner, repo, repo_request.access_token, client)
            all_refs = references["branches"] + references["tags"]
            
            matching_ref = next((ref for ref in all_refs if last_string.startswith(ref)), None)
            if matching_ref:
                ref_from_url = matching_ref
                path_from_url = last_string[len(matching_ref) + 1:] if len(matching_ref) < len(last_string) else ''
            else:
                ref_from_url = last_string
        
        sha = await fetch_repo_sha(owner, repo, ref_from_url, path_from_url, repo_request.access_token, client)
        tree_data = await fetch_repo_tree(owner, repo, sha, repo_request.access_token, client)
        
        # Convert GitHub tree format to our format
        tree = []
        for item in tree_data:
            if item.get("type") == "blob":
                tree.append(FileInfo(
                    path=item.get("path", ""),
                    type=item.get("type", ""),
                    url=item.get("url", "")
                ))
        
        return DirectoryResponse(tree=tree)

@app.post("/api/github/fetch-contents", response_model=FileContentResponse)
async def fetch_github_contents(request: FileContentRequest):
    """Fetch the contents of selected files from a GitHub repository"""
    async with httpx.AsyncClient(timeout=60.0) as client:
        contents = await fetch_file_contents(request.files, request.access_token, client)
        return FileContentResponse(contents=contents)

@app.post("/api/github/generate-text")
async def generate_github_text(request: FileContentRequest):
    """Generate a formatted text file from GitHub repository contents."""
    async with httpx.AsyncClient(timeout=60.0) as client:
        contents = await fetch_file_contents(request.files, request.access_token, client)
        formatted_text = format_repo_contents(contents)
        return StreamingResponse(
            BytesIO(formatted_text.encode()),
            media_type="text/plain",
            headers={"Content-Disposition": "attachment; filename=repo_content.txt"}
        )

# Serve static files if they exist
try:
    static_dir = Path(__file__).parent / "static"
    if static_dir.exists():
        app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")
except Exception:
    pass

# =====================
# Main Entrypoint
# =====================
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8002, reload=True)
