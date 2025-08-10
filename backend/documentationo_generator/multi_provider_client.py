import time
import json
import os
from typing import Callable, Optional, Dict, Any
from cryptography.fernet import Fernet

try:
    from structures import Document, WikiStructure, WikiPage, WikiSection, RepositoryAnalysis
except ImportError:
    from .structures import Document, WikiStructure, WikiPage, WikiSection, RepositoryAnalysis

try:
    import litellm
    LITELLM_AVAILABLE = True
except ImportError:
    LITELLM_AVAILABLE = False

class MultiProviderAIClient:
    """Multi-provider AI client for documentation generation"""
    
    def __init__(self, provider: str = "gemini", api_key: str = None, model: str = None, temperature: float = 0.7):
        if not LITELLM_AVAILABLE:
            raise ImportError("LiteLLM is required for multi-provider support.")
            
        self.provider = provider.lower()
        self.api_key = api_key
        self.temperature = temperature
        
        # Provider-specific model mapping
        self.provider_models = {
            "openai": {
                "default": "gpt-4o-mini",
                "models": ["gpt-4o", "gpt-4o-mini", "gpt-3.5-turbo"]
            },
            "anthropic": {
                "default": "claude-3-5-sonnet-20241022", 
                "models": ["claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022"]
            },
            "gemini": {
                "default": "gemini/gemini-2.0-flash",
                "models": ["gemini/gemini-2.0-flash", "gemini/gemini-1.5-pro"]
            }
        }
        
        # Set model based on provider
        if model:
            self.model = model
        else:
            self.model = self.provider_models.get(self.provider, {}).get("default", "gpt-4o-mini")
            
        # Provider-specific rate limits (requests per minute)
        self.rate_limits = {
            "openai": 60,
            "anthropic": 50, 
            "gemini": 15
        }
        
        # Set API key in litellm
        if self.api_key:
            if self.provider == "openai":
                litellm.openai_key = self.api_key
            elif self.provider == "anthropic":
                litellm.anthropic_key = self.api_key
            elif self.provider == "gemini":
                litellm.gemini_key = self.api_key
                
        litellm.set_verbose = False
    
    def get_rate_limit_delay(self) -> float:
        """Get appropriate delay between requests for the current provider"""
        rpm = self.rate_limits.get(self.provider, 30)
        return 60.0 / rpm  # Convert RPM to seconds between requests
    
    def generate_content(self, prompt: str, model: str = None,
                        temperature: float = None, max_tokens: int = 4000,
                        progress_callback: Callable[[str], None] = None) -> str:
        """Generate content using the configured provider"""
        
        model_name = model or self.model
        temp = temperature if temperature is not None else self.temperature
        
        # Provider-specific model prefixing
        if self.provider == "gemini" and not model_name.startswith("gemini/"):
            model_name = f"gemini/{model_name}"
        elif self.provider == "anthropic" and not model_name.startswith("claude"):
            # Ensure Claude models use correct naming
            if "claude" not in model_name:
                model_name = self.provider_models["anthropic"]["default"]
        
        return self._generate_with_retries(
            prompt, model_name, temp, max_tokens, progress_callback
        )
    
    def _generate_with_retries(self, prompt: str, model: str, temperature: float,
                             max_tokens: int, progress_callback: Callable[[str], None] = None) -> str:
        """Generate content with provider-specific retry logic"""
        
        max_retries = 3
        base_delay = self.get_rate_limit_delay()
        retry_delays = [base_delay, base_delay * 2, base_delay * 4]
        
        for attempt in range(max_retries):
            try:
                if progress_callback:
                    progress_callback(f"  AI request to {self.provider} (attempt {attempt + 1}/{max_retries})")
                
                start_time = time.time()
                timeout_seconds = 120
                
                response = litellm.completion(
                    model=model,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=temperature,
                    max_tokens=max_tokens,
                    stream=False,
                    timeout=timeout_seconds,
                    # Provider-specific parameters
                    **self._get_provider_params()
                )
                
                content = response.choices[0].message.content
                
                if progress_callback:
                    progress_callback(f"  Generated {len(content)} characters from {self.provider}")
                
                return content
                
            except Exception as e:
                elapsed = time.time() - start_time
                error_msg = str(e).lower()
                
                if ("rate_limit" in error_msg or "429" in error_msg or 
                    "quota" in error_msg or elapsed >= timeout_seconds):
                    
                    if attempt < max_retries - 1:
                        wait_time = retry_delays[attempt]
                        if progress_callback:
                            progress_callback(f"⏳ Rate limited on {self.provider}. Waiting {wait_time}s...")
                        time.sleep(wait_time)
                        continue
                    else:
                        # Provide provider-specific error guidance
                        guidance = self._get_error_guidance("rate_limit")
                        raise Exception(f"Rate limit exceeded for {self.provider}. {guidance}")
                        
                elif "authentication" in error_msg or "api_key" in error_msg or "401" in error_msg:
                    guidance = self._get_error_guidance("auth")
                    raise Exception(f"Authentication failed for {self.provider}. {guidance}")
                    
                elif "invalid_request" in error_msg or "400" in error_msg:
                    guidance = self._get_error_guidance("invalid_request")
                    raise Exception(f"Invalid request to {self.provider}. {guidance}")
                    
                else:
                    # Generic error with provider context
                    raise Exception(f"AI generation failed on {self.provider}: {str(e)}")
        
        raise Exception(f"Unexpected error: All retries exhausted for {self.provider}")
    
    def _get_provider_params(self) -> Dict[str, Any]:
        """Get provider-specific parameters"""
        if self.provider == "anthropic":
            return {
                "top_p": 0.9,
                "stop_sequences": ["Human:", "Assistant:"]
            }
        elif self.provider == "openai":
            return {
                "top_p": 0.9,
                "frequency_penalty": 0.0,
                "presence_penalty": 0.0
            }
        elif self.provider == "gemini":
            return {
                "top_p": 0.8,
                "top_k": 40
            }
        return {}
    
    def _get_error_guidance(self, error_type: str) -> str:
        """Get provider-specific error guidance"""
        guidance_map = {
            "rate_limit": {
                "openai": "Try using a lower rate or upgrade your OpenAI plan for higher limits.",
                "anthropic": "Consider using Claude Haiku for faster generation or check your usage limits.",
                "gemini": "Gemini has strict rate limits. Try waiting longer between requests."
            },
            "auth": {
                "openai": "Please check your OpenAI API key in settings. Ensure it has sufficient credits.",
                "anthropic": "Please verify your Anthropic API key and ensure it's not expired.",
                "gemini": "Please check your Google AI Studio API key and ensure it's properly configured."
            },
            "invalid_request": {
                "openai": "The request format may be incompatible with the selected OpenAI model.",
                "anthropic": "The request may exceed Claude's context limits or contain unsupported content.",
                "gemini": "The request may be too large for Gemini or contain unsupported content."
            }
        }
        
        return guidance_map.get(error_type, {}).get(self.provider, "Please check your API key and try again.")
    
    def generate_wiki_structure(self, repo_analysis: RepositoryAnalysis, file_tree: str,
                               readme_content: str, repo_info: dict, language: str = "en",
                               progress_callback: Callable[[str], None] = None) -> WikiStructure:
        """Generate wiki structure using multi-provider AI"""
        
        prompt = self._build_structure_prompt(repo_analysis, file_tree, readme_content, repo_info, language)
        
        if progress_callback:
            progress_callback(f"🏗️  Generating wiki structure using {self.provider}...")
        
        response = self.generate_content(
            prompt, 
            temperature=0.3,  # Lower temperature for structure generation
            max_tokens=3000,
            progress_callback=progress_callback
        )
        
        return self._parse_wiki_structure(response, progress_callback)
    
    def generate_page_content(self, page: WikiPage, repo_analysis: RepositoryAnalysis,
                             documents: list, language: str = "en", 
                             progress_callback: Callable[[str], None] = None) -> WikiPage:
        """Generate content for a specific wiki page"""
        
        if progress_callback:
            progress_callback(f"📝 Generating page: {page.title} using {self.provider}...")
        
        prompt = self._build_page_prompt(page, repo_analysis, documents, language)
        
        content = self.generate_content(
            prompt,
            temperature=self.temperature,
            max_tokens=6000,
            progress_callback=progress_callback
        )
        
        # Update page with generated content
        page.content = content
        page.generated_at = time.time()
        
        return page
    
    def _build_structure_prompt(self, repo_analysis: RepositoryAnalysis, file_tree: str,
                               readme_content: str, repo_info: dict, language: str) -> str:
        """Build prompt for wiki structure generation"""
        
        # Provider-specific prompt optimization
        if self.provider == "anthropic":
            system_instruction = "You are Claude, an expert technical documentation specialist."
        elif self.provider == "openai":
            system_instruction = "You are an expert technical writer and documentation specialist."
        elif self.provider == "gemini":
            system_instruction = "You are a helpful AI assistant specialized in creating comprehensive technical documentation."
        else:
            system_instruction = "You are an expert technical documentation specialist."
        
        prompt = f"""{system_instruction}

Repository Analysis:
- Domain: {repo_analysis.domain_type}
- Languages: {dict(repo_analysis.languages)}
- Frameworks: {repo_analysis.frameworks}
- Complexity: {repo_analysis.complexity_score}/10

File Structure:
{file_tree}

README Content:
{readme_content[:2000]}

Create a comprehensive wiki structure in JSON format with the following schema:
{{
  "title": "Repository Documentation",
  "description": "Comprehensive documentation",
  "pages": [
    {{
      "title": "Page Title",
      "filename": "page-filename", 
      "description": "Page description",
      "priority": 1-10,
      "sections": ["Section 1", "Section 2"]
    }}
  ]
}}

Focus on creating 5-8 essential pages covering: Overview, Architecture, API Reference, Setup Guide, and specific feature documentation."""

        return prompt
    
    def _build_page_prompt(self, page: WikiPage, repo_analysis: RepositoryAnalysis, 
                          documents: list, language: str) -> str:
        """Build prompt for individual page content generation"""
        
        # Get relevant documents for this page
        relevant_docs = self._get_relevant_documents(page, documents)
        
        context = "\n\n".join([f"File: {doc.path}\n{doc.content[:1000]}" for doc in relevant_docs[:5]])
        
        prompt = f"""Generate comprehensive documentation for: {page.title}

Page Description: {page.description}
Target Sections: {', '.join(page.sections)}
Language: {language}

Repository Context:
- Domain: {repo_analysis.domain_type}
- Languages: {dict(repo_analysis.languages)}
- Frameworks: {repo_analysis.frameworks}

Relevant Code:
{context}

Requirements:
1. Write in {language}
2. Use markdown format
3. Include code examples where appropriate
4. Add mermaid diagrams for complex concepts
5. Be comprehensive but well-structured
6. Include cross-references to other documentation pages

Generate the complete markdown content for this documentation page:"""

        return prompt
    
    def _get_relevant_documents(self, page: WikiPage, documents: list) -> list:
        """Find documents relevant to the page being generated"""
        # Simple relevance scoring based on filename and content
        scored_docs = []
        page_keywords = set(page.title.lower().split() + page.description.lower().split())
        
        for doc in documents:
            score = 0
            doc_text = (doc.path + " " + doc.content).lower()
            
            for keyword in page_keywords:
                if keyword in doc_text:
                    score += doc_text.count(keyword)
            
            if score > 0:
                scored_docs.append((score, doc))
        
        # Return top scoring documents
        scored_docs.sort(key=lambda x: x[0], reverse=True)
        return [doc for score, doc in scored_docs[:10]]
    
    def _parse_wiki_structure(self, response: str, progress_callback: Callable[[str], None] = None) -> WikiStructure:
        """Parse AI response into WikiStructure object"""
        try:
            # Extract JSON from response
            json_match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', response, re.DOTALL)
            if json_match:
                json_str = json_match.group(1)
            else:
                # Try to find JSON without code blocks
                json_str = response.strip()
            
            data = json.loads(json_str)
            
            # Create WikiStructure
            structure = WikiStructure()
            structure.title = data.get("title", "Documentation")
            structure.description = data.get("description", "Repository documentation")
            
            # Create WikiPages
            for page_data in data.get("pages", []):
                page = WikiPage()
                page.title = page_data.get("title", "Untitled")
                page.filename = page_data.get("filename", page.title.lower().replace(" ", "-"))
                page.description = page_data.get("description", "")
                page.priority = page_data.get("priority", 5)
                page.sections = page_data.get("sections", [])
                structure.pages.append(page)
            
            if progress_callback:
                progress_callback(f"  Created structure with {len(structure.pages)} pages")
            
            return structure
            
        except (json.JSONDecodeError, KeyError) as e:
            if progress_callback:
                progress_callback(f"  Error parsing structure, using fallback")
            
            # Fallback structure
            return self._create_fallback_structure()
    
    def _create_fallback_structure(self) -> WikiStructure:
        """Create a fallback wiki structure if AI parsing fails"""
        structure = WikiStructure()
        structure.title = "Repository Documentation"
        structure.description = "Comprehensive repository documentation"
        
        default_pages = [
            {"title": "Overview", "filename": "overview", "description": "Repository overview and introduction"},
            {"title": "Architecture", "filename": "architecture", "description": "System architecture and design"},
            {"title": "Setup Guide", "filename": "setup", "description": "Installation and setup instructions"},
            {"title": "API Reference", "filename": "api", "description": "API documentation and reference"},
            {"title": "Contributing", "filename": "contributing", "description": "Contribution guidelines"}
        ]
        
        for page_data in default_pages:
            page = WikiPage()
            page.title = page_data["title"]
            page.filename = page_data["filename"]
            page.description = page_data["description"]
            page.priority = 5
            page.sections = ["Introduction", "Details", "Examples"]
            structure.pages.append(page)
        
        return structure