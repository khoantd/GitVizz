from fastapi import BackgroundTasks, HTTPException, Form, File, UploadFile
from typing import Optional, List
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
from pathlib import Path
from graphing.graph_generator import GraphGenerator


"""
Controller module for handling repository-related operations.

Includes endpoints for:
- Generating LLM-friendly text from a code repository or ZIP file (/api/generate-text)
- Generating a graph representation of the repository structure (/api/generate-graph)
- Generating the file structure and content of a code repository (/api/generate-structure)

These endpoints process uploaded ZIP files or remote GitHub/repo URLs,
extract code content, and return structured output suitable for further analysis.

Used by: routes/repo_routes.py
"""


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
) -> TextResponse:
    if not repo_url and not zip_file:
        raise HTTPException(
            status_code=400, detail="Either repo_url or zip_file must be provided."
        )

    temp_dirs_to_cleanup = []
    try:
        extracted_files, temp_extract_dir, temp_dirs_created = await _process_input(
            repo_url,
            branch,
            zip_file,  # Use the zip_file parameter directly
            access_token=access_token,  # Pass the GitHub token if provided
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
        elif zip_file and zip_file.filename:  # Use zip_file
            filename_base = f"{Path(zip_file.filename).stem}_content"  # Use zip_file

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
) -> GraphResponse:
    if not repo_url and not zip_file:
        raise HTTPException(
            status_code=400, detail="Either repo_url or zip_file must be provided."
        )

    temp_dirs_to_cleanup = []
    try:
        extracted_files, temp_extract_dir, temp_dirs_created = await _process_input(
            repo_url, branch, zip_file, access_token=access_token
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

        # Pass the original relative paths and content to GraphGenerator
        generator = GraphGenerator(files=filtered_files, output_html_path=None)
        graph_data = generator.generate()

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
) -> StructureResponse:
    if not repo_url and not zip_file:
        raise HTTPException(
            status_code=400, detail="Either repo_url or zip_file must be provided."
        )

    temp_dirs_to_cleanup = []
    try:
        extracted_files, temp_extract_dir, temp_dirs_created = await _process_input(
            repo_url, branch, zip_file, access_token=access_token
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