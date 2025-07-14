#!/usr/bin/env python3
"""
Test script to verify the documentation base path functionality
"""
import sys
import os
import tempfile
from pathlib import Path

# Add the backend directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from utils.file_utils import FileManager
from models.repository import FilePaths


def test_documentation_base_path():
    """Test that documentation base path is properly generated and created"""
    print("Testing documentation base path functionality...")
    
    # Create a temporary directory for testing
    with tempfile.TemporaryDirectory() as temp_dir:
        # Initialize FileManager with test directory
        file_manager = FileManager(temp_dir)
        
        # Test generate_file_paths
        user_id = "test_user_123"
        repo_identifier = "test_repo_456"
        
        print(f"Generating file paths for user: {user_id}, repo: {repo_identifier}")
        file_paths = file_manager.generate_file_paths(user_id, repo_identifier)
        
        # Verify all paths are set
        assert file_paths.zip, "ZIP path should be set"
        assert file_paths.text, "Text path should be set"
        assert file_paths.json_file, "JSON file path should be set"
        assert file_paths.documentation_base_path, "Documentation base path should be set"
        
        print(f"✓ ZIP path: {file_paths.zip}")
        print(f"✓ Text path: {file_paths.text}")
        print(f"✓ JSON path: {file_paths.json_file}")
        print(f"✓ Documentation path: {file_paths.documentation_base_path}")
        
        # Verify documentation directory exists
        doc_path = Path(file_paths.documentation_base_path)
        assert doc_path.exists(), "Documentation directory should exist"
        assert doc_path.is_dir(), "Documentation path should be a directory"
        
        print(f"✓ Documentation directory created: {doc_path}")
        
        # Test get_documentation_storage_path
        doc_storage_path = file_manager.get_documentation_storage_path(user_id, repo_identifier)
        assert doc_storage_path.exists(), "Documentation storage path should exist"
        assert str(doc_storage_path) == file_paths.documentation_base_path, "Paths should match"
        
        print(f"✓ Documentation storage path: {doc_storage_path}")
        
        # Test validation
        import asyncio
        validation_result = asyncio.run(file_manager.validate_file_paths(file_paths))
        assert "documentation" in validation_result, "Documentation should be in validation result"
        assert validation_result["documentation"] == True, "Documentation directory should be valid"
        
        print(f"✓ Validation result: {validation_result}")
        
        print("\n✅ All tests passed! Documentation base path functionality is working correctly.")


if __name__ == "__main__":
    test_documentation_base_path()
