# Documentation Base Path Integration

## Overview
This document describes the integration of the `documentation_base_path` field into the gitvizz repository caching and documentation generation system.

## Changes Made

### 1. Repository Model (`models/repository.py`)
- Added `documentation_base_path: str` field to the `FilePaths` model
- This field stores the base directory path where generated documentation files will be stored

### 2. File Management (`utils/file_utils.py`)
- **Updated `generate_file_paths` method**: Now creates and returns a `documentation_base_path` pointing to a `documentation` subdirectory within each repository's storage location
- **Added `get_documentation_storage_path` method**: Provides a convenient way to get the documentation storage path for a repository
- **Updated `validate_file_paths` method**: Now validates that the documentation directory exists
- **Added documentation file management methods**:
  - `save_documentation_files`: Save documentation pages to the repository's documentation directory
  - `list_documentation_files`: List all documentation files for a repository
  - `get_documentation_file_content`: Read content of a specific documentation file

### 3. Documentation Routes (`routes/documentation_routes.py`)
- **Updated `generate_wiki` endpoint**: Now uses the repository's `documentation_base_path` from the database instead of a generic output directory
- **Added `list_wiki_files` endpoint**: Lists all generated wiki files for a completed task
- **Added `get_wiki_file_content` endpoint**: Retrieves content of a specific wiki file by task ID
- **Added `list_repository_docs` endpoint**: Lists all documentation files for a repository directly
- **Added `get_repository_doc_content` endpoint**: Retrieves documentation file content by repository ID

## How it Works

### Repository Creation/Caching
1. When a repository is first processed (via GitHub URL or ZIP upload), the `save_and_cache_repository` function is called
2. This function calls `save_repository_files` from `file_utils.py`
3. `save_repository_files` uses `FileManager.generate_file_paths` to create the file structure
4. The `generate_file_paths` method now automatically creates a `documentation` subdirectory and includes its path in the `FilePaths` object
5. The repository is saved to the database with the `documentation_base_path` field populated

### Documentation Generation
1. When a user requests documentation generation via the `/documentation/generate-wiki` endpoint:
   - The system looks up the repository from the database
   - Uses the repository's `file_paths.documentation_base_path` as the output directory
   - Passes this path to the `DocumentationGenerator.generate_complete_wiki` method
2. Generated documentation files are saved directly to the repository's dedicated documentation directory
3. The files persist across sessions and are tied to the specific repository

### File Access
- Users can access generated documentation files through the new API endpoints
- Files are organized by repository and stored in a predictable location
- Security measures prevent directory traversal attacks

## Directory Structure
```
storage/
└── users/
    └── {user_id}/
        └── {repo_identifier}/
            ├── repository.zip
            ├── content.txt
            ├── data.json
            └── documentation/          # New documentation directory
                ├── README.md
                ├── strategic-overview.md
                ├── technical-architecture.md
                └── ...
```

## API Endpoints

### Generate Documentation
- **POST** `/documentation/generate-wiki`
  - Uses repository's `documentation_base_path` for output

### Access Documentation by Task
- **GET** `/documentation/wiki-files/{task_id}` - List files for a completed task
- **GET** `/documentation/wiki-content/{task_id}/{filename}` - Get file content by task

### Access Documentation by Repository
- **GET** `/documentation/repository-docs/{repo_id}` - List files for a repository
- **GET** `/documentation/repository-docs/{repo_id}/{filename}` - Get file content by repository

## Benefits

1. **Persistent Storage**: Documentation files are now permanently stored and associated with specific repositories
2. **Organized Structure**: Each repository has its own dedicated documentation directory
3. **Easy Access**: Multiple ways to access documentation (by task ID or repository ID)
4. **Automatic Setup**: Documentation directories are created automatically when repositories are cached
5. **Validation**: File path validation ensures documentation directories exist and are accessible

## Testing

A test script (`test_documentation_path.py`) has been created to verify the functionality:
- Tests file path generation
- Verifies documentation directory creation
- Validates file path validation functionality
- All tests pass successfully

## Migration Notes

- Existing repositories will need to be updated to include the `documentation_base_path` field
- The field is automatically populated for new repositories
- No manual intervention required for the documentation generation process
