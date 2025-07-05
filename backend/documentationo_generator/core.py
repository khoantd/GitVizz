from typing import List, Dict, Any, Optional, Callable
import os
import time
from datetime import datetime
from dotenv import load_dotenv
from pathlib import Path
import shutil

# Load environment variables
load_dotenv()

import re 
try:
    from ai_client import GroqAIClient
    from analyzers import RepositoryAnalyzer
    from parsers import DocumentParser
    from embedders import SemanticEmbedder
    from structures import WikiStructure, WikiPage, Document, RepositoryAnalysis
    from utils import save_wiki_files, generate_index_page
except ImportError:
    # Fallback for when running as part of a package
    from .ai_client import GroqAIClient
    from .analyzers import RepositoryAnalyzer
    from .parsers import DocumentParser
    from .embedders import SemanticEmbedder
    from .structures import WikiStructure, WikiPage, Document, RepositoryAnalysis
    from .utils import save_wiki_files, generate_index_page

class DocumentationGenerator:
    """Main documentation generator - simplified like GraphGenerator"""
    
    def __init__(self, api_key: str = None, progress_callback: Callable[[str], None] = None):
        self.api_key = api_key or os.getenv("GROQ_API_KEY")
        if not self.api_key:
            raise ValueError("GROQ_API_KEY environment variable is required")
            
        # Initialize components (like graph_generator's parsers)
        self.ai_client = GroqAIClient(self.api_key)
        self.analyzer = RepositoryAnalyzer()
        self.parser = DocumentParser()
        self.embedder = SemanticEmbedder()
        
        # State management
        self.documents = []
        self.repo_info = {}
        self.repo_analysis = None
        self.progress_callback = progress_callback or self._default_progress_callback
    
    def _default_progress_callback(self, message: str):
        """Default progress callback that prints to console"""
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] {message}")
    
    def generate_complete_wiki(self, repo_url_or_path: str, output_dir: str = "./wiki_output", 
                         language: str = "en") -> Dict[str, Any]:
        """Main generation method - COMPLETE VERSION"""
        print(f"Starting comprehensive wiki generation for: {repo_url_or_path}")
        
        output_dir = Path(output_dir).resolve()  # Make it absolute
        repo_root = output_dir.parent            # Go one level up
        
        # modified the repo_root to temp_repo
        repo_root = repo_root / "temp_repo"

        # Step 1: Process repository
        self.documents = self.parser.process_repository(repo_url_or_path, repo_root)
        self.repo_info = self.parser.repo_info

        # Step 1.2: Clean up existing documents
        if output_dir.exists():
            shutil.rmtree(output_dir)
        
        if not self.documents:
            return {"status": "error", "message": "No documents found"}
        
        # Step 2: Analyze repository
        self.repo_analysis = self.analyzer.analyze(self.documents)
        
        # Step 3: Build semantic index
        self._build_semantic_index()
        
        # Step 4: Generate structure
        structure = self._generate_wiki_structure(language)
        
        # Step 5: Generate content for all pages with optimized rate limiting
        print("   Starting content generation with optimized rate limiting...")
        
        generated_pages = []
        for i, page in enumerate(structure.pages):
            if i > 0:
                # Reduced wait time - AI client handles internal rate limiting
                self.progress_callback(f"      Brief pause before next page ({i+1}/{len(structure.pages)})...")
                time.sleep(20)  # Reduced from 120s to 20s
            
            generated_page = self.generate_page_content(page, language)
            generated_pages.append(generated_page)
        
        # Step 6: Save files
        output_dir.mkdir(parents=True, exist_ok=True)
        
        result = save_wiki_files(generated_pages, structure, output_dir, self.repo_analysis)
        
        # Add comprehensive summary
        result.update({
            "repository": repo_url_or_path,
            "wiki_structure": structure,
            "analysis": {
                "languages": dict(self.repo_analysis.languages),
                "frameworks": self.repo_analysis.frameworks,
                "complexity_score": self.repo_analysis.complexity_score,
                "domain_type": self.repo_analysis.domain_type
            }
        })
        
        # Step 7: Cleanup temporary files
        self.progress_callback(f"      Cleaning up temporary files...")

        if repo_root.exists():
            shutil.rmtree(repo_root)

        self.progress_callback(f"      Cleanup complete. Wiki generated successfully!")
        return result
        
    def _build_semantic_index(self):
        """Build semantic search index"""
        repo_name = self.repo_info.get('repo', 'default')
        self.embedder.build_index(self.documents, repo_name)
    
    def _generate_wiki_structure(self, language: str) -> WikiStructure:
        """Generate wiki structure using AI"""
        file_tree = self._get_file_tree_string()
        readme_content = self._get_readme_content()
        
        return self.ai_client.generate_wiki_structure(
            self.repo_analysis, 
            file_tree,
            readme_content,
            self.repo_info,
            language,
            self.progress_callback
        )
    
    def _generate_all_pages(self, structure: WikiStructure, language: str) -> List[WikiPage]:
        """Generate content for all pages"""
        generated_pages = []
        for i, page in enumerate(structure.pages):
            if i > 0:
                time.sleep(120)  # Rate limiting
            
            relevant_docs = self._get_relevant_documents(page)
            page.content = self.ai_client.generate_page_content(page, relevant_docs, language)
            generated_pages.append(page)
        
        return generated_pages
    
    def _get_file_tree_string(self) -> str:
        """Generate file tree string"""
        if not self.repo_analysis:
            return "No file structure available"
        # Implementation here
        return "File tree..."
    
    def _get_readme_content(self) -> str:
        """Get README content"""
        for doc in self.documents:
            if 'readme' in doc.meta_data.get('file_path', '').lower():
                return doc.text
        return "No README found"
    

    def _get_relevant_documents(self, page: WikiPage) -> List[Document]:
        """Get enhanced relevant documents using semantic + keyword search - HYBRID APPROACH"""

        # Semantic search queries
        search_queries = [
            page.title,
            page.id.replace('_', ' ').replace('-', ' ')
        ]
        
        # Add context-specific queries
        page_id = page.id.lower()
        if 'api' in page_id:
            search_queries.extend(['endpoint', 'route', 'handler', 'controller'])
        elif 'architecture' in page_id:
            search_queries.extend(['design', 'pattern', 'structure', 'component'])
        elif 'setup' in page_id:
            search_queries.extend(['install', 'configure', 'environment', 'dependencies'])
        
        # Perform semantic search
        semantic_docs = []
        if hasattr(self.embedder, 'semantic_search'):
            for query in search_queries:
                semantic_docs.extend(self.embedder.semantic_search(query, k=5))
        
        # Keyword search (existing logic)
        page_keywords = page.title.lower().split() + (page.id.split('_') if '_' in page.id else [page.id])
        keyword_docs = []
        
        for doc in self.documents:
            score = 0
            file_path = doc.meta_data.get('file_path', '').lower()
            content_lower = doc.text.lower()
            
            # File path matching (10 points)
            for keyword in page_keywords:
                if keyword in file_path:
                    score += 10
            
            # Keyword frequency (2 points per occurrence)
            for keyword in page_keywords:
                score += content_lower.count(keyword) * 2
            
            # File type relevance (3 points)
            file_type = doc.meta_data.get('type', '')
            if file_type in ['py', 'js', 'ts', 'md']:
                score += 3
            
            if score > 0:
                doc.meta_data['keyword_score'] = score
                keyword_docs.append(doc)
        
        # Combine results
        combined_docs = {}
        
        # Add semantic results (higher priority)
        for doc in semantic_docs:
            doc_key = doc.meta_data.get('file_path', 'unknown')
            semantic_score = doc.meta_data.get('semantic_score', 0.5)
            combined_docs[doc_key] = doc
            combined_docs[doc_key].meta_data['final_score'] = semantic_score * 10 + 5
        
        # Add keyword results
        for doc in keyword_docs:
            doc_key = doc.meta_data.get('file_path', 'unknown')
            keyword_score = doc.meta_data.get('keyword_score', 0)
            if doc_key in combined_docs:
                # Boost existing semantic results
                combined_docs[doc_key].meta_data['final_score'] += keyword_score
            else:
                combined_docs[doc_key] = doc
                combined_docs[doc_key].meta_data['final_score'] = keyword_score
        
        # Sort and return
        final_docs = list(combined_docs.values())
        final_docs.sort(key=lambda x: x.meta_data.get('final_score', 0), reverse=True)
        
        print(f"🔍 Found {len(final_docs)} relevant docs using semantic + keyword search")
        return final_docs[:15]
    
    def _get_file_tree_string(self) -> str:
        """Generate a string representation of the file tree - EXACT SAME"""
        if not self.repo_analysis:
            return "No file structure available"

        file_structure = self.repo_analysis.file_structure
        if isinstance(file_structure, dict):
            tree_lines = []
            for directory, files in list(file_structure.items())[:20]:
                tree_lines.append(f"    {directory}/")
                for file in files[:10]:  # Limit files per directory
                    tree_lines.append(f"       {file}")
                if len(files) > 10:
                    tree_lines.append(f"  ... and {len(files) - 10} more files")
            return '\n'.join(tree_lines)
        elif isinstance(file_structure, list):
            return '\n'.join([f"     {file}" for file in file_structure[:50]])
        else:
            return str(file_structure)

    def _generate_wiki_structure(self, language: str) -> WikiStructure:
        """Generate wiki structure using AI"""
        file_tree = self._get_file_tree_string()
        readme_content = self._get_readme_content()
        
        return self.ai_client.generate_wiki_structure(
            self.repo_analysis, 
            file_tree,
            readme_content,
            self.repo_info,
            language,
            self.progress_callback
        )

    def generate_page_content(self, page: WikiPage, language: str = "en") -> WikiPage:
        """Generate comprehensive page content using AI with AI-generated titles"""
        self.progress_callback(f"      Generating AI content for: {page.title}")

        # Get relevant documents for this page
        relevant_docs = self._get_relevant_documents(page)
        
        # Generate AI-powered title if the current title is generic
        if self._is_generic_title(page.title):
            context = self._build_page_context(relevant_docs)
            ai_title = self.ai_client.generate_ai_title(page.id, context, self.repo_info)
            if ai_title:
                self.progress_callback(f"✨ Generated AI title: {ai_title}")
                page.title = ai_title

        # Generate content using AI with sophisticated prompts
        generated_content = self.ai_client.generate_page_content(page, relevant_docs, language)

        page.content = generated_content
        page.mermaid_diagrams = self._extract_mermaid_diagrams(generated_content)

        return page
    
    def _is_generic_title(self, title: str) -> bool:
        """Check if title is generic and needs AI enhancement"""
        generic_patterns = [
            'untitled', 'page', 'documentation', 'default',
            'unnamed', 'section', 'chapter', 'part'
        ]
        title_lower = title.lower()
        return any(pattern in title_lower for pattern in generic_patterns) or len(title.strip()) < 5
    
    def _build_page_context(self, relevant_docs: List[Document]) -> str:
        """Build context string from relevant documents for title generation"""
        context_parts = []
        for doc in relevant_docs[:3]:  # Limit to first 3 docs for context
            if doc.text:
                # Extract first few lines or important parts
                lines = doc.text.split('\n')[:5]
                context_parts.append(' '.join(lines))
        
        return ' '.join(context_parts)[:1000]  # Limit context size

    def _extract_mermaid_diagrams(self, content: str) -> List[str]:
        """Extract Mermaid diagrams from content - EXACT SAME"""
        diagrams = []
        pattern = r'```mermaid\n(.*?)\n```'
        matches = re.findall(pattern, content, re.DOTALL)
        for match in matches:
            diagrams.append(match.strip())
        return diagrams
        