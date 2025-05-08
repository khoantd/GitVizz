# Repo2Txt Python API

This is a Python-based FastAPI implementation of the Repo2Txt tool that converts GitHub repositories or local files to plain text format.

## Features

- GitHub repository conversion to plain text
- Local directory upload and conversion
- ZIP file upload and conversion
- Configurable rate limiting for GitHub API requests
- Clean API endpoints for integration with frontend applications

## Installation

1. Clone the repository
2. Install the required dependencies:

```bash
pip install -r requirements.txt
```

## Usage

### Running the server

```bash
uvicorn server:app --host 0.0.0.0 --port 8000 --reload
```

Or simply run:

```bash
python server.py
```

The server will be available at http://localhost:8000

### API Documentation

Once the server is running, you can access the auto-generated API documentation at:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## API Endpoints

### GitHub Repository Endpoints

- `POST /api/github/fetch-structure`: Fetch the structure of a GitHub repository
- `POST /api/github/fetch-contents`: Fetch the contents of selected files from a GitHub repository
- `POST /api/github/generate-text`: Generate a formatted text file from GitHub repository contents

### Local File Endpoints

- `POST /api/local/upload-directory`: Process uploaded directory files
- `POST /api/local/upload-zip`: Process uploaded zip file
- `POST /api/local/generate-text`: Generate a formatted text file from local files

### Configuration Endpoints

- `GET /api/config`: Get current configuration
- `POST /api/config`: Update configuration (rate limit)

## Rate Limiting

The API implements rate limiting for GitHub API requests to avoid hitting GitHub's rate limits. By default, it's set to 60 requests per minute, but this can be configured via the `/api/config` endpoint.

## Example Usage

### Converting a GitHub Repository

1. Fetch the repository structure:
```
POST /api/github/fetch-structure
{
    "repo_url": "https://github.com/username/repository",
    "access_token": "your_github_token" (optional)
}
```

2. Generate text from selected files:
```
POST /api/github/generate-text
{
    "files": [
        {
            "path": "file/path.js",
            "type": "blob",
            "url": "https://api.github.com/repos/username/repository/git/blobs/sha"
        }
    ],
    "access_token": "your_github_token" (optional)
}
```

### Converting Local Files

1. Upload a directory:
```
POST /api/local/upload-directory
[Form data with files]
```

2. Generate text from selected files:
```
POST /api/local/generate-text
{
    "files": [
        {
            "path": "file/path.js",
            "type": "blob",
            "url": "/tmp/path/to/file.js"
        }
    ]
}
```

## Frontend Integration

This API is designed to be easily integrated with frontend applications. You can build a custom frontend or use the existing JavaScript-based frontend with minimal modifications to point to these API endpoints.
