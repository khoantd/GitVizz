import os
import pickle
import numpy as np
import faiss
from sentence_transformers import SentenceTransformer
from typing import List

# Use absolute imports to avoid relative import issues
try:
    from structures import Document
except ImportError:
    # Fallback for when running as part of a package
    from .structures import Document


class SemanticEmbedder:
    def __init__(self, model_name: str = "all-MiniLM-L6-v2", cache_dir: str = "./embeddings_cache"):
        self.model_name = model_name
        self.cache_dir = cache_dir
        self.model = SentenceTransformer(model_name)
        self.dimension = self.model.get_sentence_embedding_dimension()
        self.index = None
        self.document_store = []
        
        os.makedirs(cache_dir, exist_ok=True)
        print(f"  Initialized semantic embedder: {model_name}")
    
    def build_index(self, documents: List[Document], repo_name: str = "default") -> None:
        print(f"   Building semantic search index for {len(documents)} documents...")
        
        # Check cache
        cache_path = os.path.join(self.cache_dir, f"{repo_name}_embeddings.pkl")
        if os.path.exists(cache_path):
            try:
                with open(cache_path, 'rb') as f:
                    cache_data = pickle.load(f)
                    self.index = cache_data['index']
                    self.document_store = cache_data['documents']
                print(f"   Loaded cached embeddings")
                return
            except:
                pass
        
        # Generate new embeddings
        print("  Generating embeddings...")
        texts = [f"FILE: {doc.meta_data.get('file_path', '')}\nCONTENT: {doc.text}" for doc in documents]
        
        embeddings = self.model.encode(texts, show_progress_bar=True, batch_size=16)
        embeddings = np.array(embeddings).astype('float32')
        
        # Build FAISS index
        self.index = faiss.IndexFlatIP(self.dimension)
        faiss.normalize_L2(embeddings)
        self.index.add(embeddings)
        self.document_store = documents
        
        # Save cache
        try:
            cache_data = {'index': self.index, 'documents': self.document_store}
            with open(cache_path, 'wb') as f:
                pickle.dump(cache_data, f)
            print(f"   Saved embeddings cache")
        except:
            pass
        
        print(f"   Semantic search ready! {self.index.ntotal} vectors")
    
    def semantic_search(self, query: str, k: int = 15) -> List[Document]:
        if self.index is None:
            return []
        
        query_embedding = self.model.encode([f"SEARCH: {query}"])
        query_embedding = np.array(query_embedding).astype('float32')
        faiss.normalize_L2(query_embedding)
        
        scores, indices = self.index.search(query_embedding, k)
        
        results = []
        for score, idx in zip(scores[0], indices[0]):
            if idx < len(self.document_store):
                doc = self.document_store[idx]
                doc_copy = Document(doc.text, {**doc.meta_data})
                doc_copy.meta_data['semantic_score'] = float(score)
                results.append(doc_copy)
        
        return results

    def embed(self, texts: List[str]) -> List[List[float]]:
        embeddings = self.model.encode(texts)
        return embeddings.tolist()

