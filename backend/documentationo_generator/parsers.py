from typing import List, Dict, Any
import os

# Use absolute imports to avoid relative import issues
try:
    from structures import Document, RepositoryAnalysis
    from embedders import SemanticEmbedder
    from utils import download_repo, read_documents, chunk_documents
except ImportError:
    # Fallback for when running as part of a package
    from .structures import Document, RepositoryAnalysis
    from .embedders import SemanticEmbedder
    from .utils import download_repo, read_documents, chunk_documents

class DocumentParser:
    """Document parsing and processing"""

    def __init__(self):
        self.embedder = SemanticEmbedder()
        self.repo_info = {}
        self.documents = []
        self.semantic_index_built = False
    def process_repository(self, repo_url_or_path: str, local_dir: str = "./temp_repo") -> List[Document]:
        """Process repository with comprehensive analysis"""
        print(f"      Processing repository: {repo_url_or_path}")
        
        if repo_url_or_path.startswith('http'):
            download_repo(repo_url_or_path, local_dir)
            source_path = local_dir
            parts = repo_url_or_path.rstrip('/').split('/')
            self.repo_info = {
                "owner": parts[-2] if len(parts) >= 2 else "unknown",
                "repo": parts[-1].replace('.git', '') if parts else "unknown",
                "url": repo_url_or_path,
                "type": "github"
            }
        else:
            source_path = repo_url_or_path
            self.repo_info = {
                "owner": "local",
                "repo": os.path.basename(source_path),
                "url": source_path,
                "type": "local"
            }
        
        documents = read_documents(source_path)
        chunked_docs = chunk_documents(documents)
        self.documents = chunked_docs
        
        # Perform comprehensive analysis
        repo_name = self.repo_info.get('repo', 'default')
        self.embedder.build_index(chunked_docs, repo_name)
        self.semantic_index_built = True

        print(f"YOOOO Semantic search ready!")
        print(f"Processed {len(chunked_docs)} document chunks")
        # no more relevent after refactoring: print(f"Analysis complete: {len(self.repo_analysis.languages)} languages, {len(self.repo_analysis.frameworks)} frameworks detected")
        #no rag tho, only chunking of basic docs and stuff etc. 
        return chunked_docs
    #like a senior dev eh? 
