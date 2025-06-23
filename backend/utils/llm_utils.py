import os
import litellm
from typing import Optional, Dict, List, Any, Tuple, AsyncGenerator, Union
from cryptography.fernet import Fernet
from datetime import datetime
from models.chat import UserApiKey, ChatSession
from models.user import User
from beanie import BeanieObjectId


class LLMService:
    """Service for handling LLM operations with multiple providers"""
    
    def __init__(self):
        self.encryption_key = os.getenv("ENCRYPTION_KEY", Fernet.generate_key())
        self.cipher_suite = Fernet(self.encryption_key)
        
        # Default API keys from environment
        self.default_keys = {
            "openai": os.getenv("OPENAI_API_KEY"),
            "anthropic": os.getenv("ANTHROPIC_API_KEY"),
            "gemini": os.getenv("GEMINI_API_KEY")
        }
        
        # Daily limits for users without their own keys
        self.daily_limits = {
            "free": 10,      # Free tier users
            "premium": 50,   # Premium users
            "unlimited": -1  # Users with their own keys
        }
        
        # Model configurations
        self.model_configs = {
            "gemini": {
                "gemini-1.5-flash": {
                    "max_tokens": 1000000, 
                    "cost_per_1k": 0.0,  # Free tier
                    "rate_limit": "15 requests/minute",
                    "daily_limit": "1500 requests/day"
                },
            }
        }
    
    def encrypt_api_key(self, api_key: str) -> str:
        """Encrypt API key for secure storage"""
        return self.cipher_suite.encrypt(api_key.encode()).decode()
    
    def decrypt_api_key(self, encrypted_key: str) -> str:
        """Decrypt API key for usage"""
        return self.cipher_suite.decrypt(encrypted_key.encode()).decode()
    
    async def save_user_api_key(self, user: User, provider: str, api_key: str, key_name: Optional[str] = None) -> UserApiKey:
        """Save encrypted user API key"""
        encrypted_key = self.encrypt_api_key(api_key)
        
        # Check if key already exists for this provider
        existing_key = await UserApiKey.find_one(
            UserApiKey.user.id == BeanieObjectId(user.id),
            UserApiKey.provider == provider,
            UserApiKey.is_active == True
        )
        
        if existing_key:
            existing_key.encrypted_key = encrypted_key
            existing_key.key_name = key_name
            existing_key.updated_at = datetime.utcnow()
            await existing_key.save()
            return existing_key
        else:
            new_key = UserApiKey(
                user=user,
                provider=provider,
                encrypted_key=encrypted_key,
                key_name=key_name
            )
            await new_key.save()
            return new_key
    
    async def get_user_api_key(self, user: User, provider: str) -> Optional[str]:
        """Get decrypted user API key"""
        user_key = await UserApiKey.find_one(
            UserApiKey.user.id == BeanieObjectId(user.id),
            UserApiKey.provider == provider,
            UserApiKey.is_active == True
        )
        
        if user_key:
            try:
                return self.decrypt_api_key(user_key.encrypted_key)
            except Exception as e:
                print(f"Error decrypting API key: {e}")
                return None
        return None
    
    async def get_api_key_for_request(self, user: User, provider: str) -> Optional[str]:
        """Get API key to use for the request (user's or default)"""
        # First try to get user's API key
        user_key = await self.get_user_api_key(user, provider)
        if user_key:
            return user_key
        
        # Fall back to default key
        return self.default_keys.get(provider)
    
    def get_model_name_for_provider(self, provider: str, model: str) -> str:
        """Get the correct model name for litellm"""
        model_mapping = {
            "openai": model,
            "anthropic": f"claude-3-{model}" if not model.startswith("claude") else model,
            "gemini": f"gemini/{model}" if not model.startswith("gemini/") else model
        }
        return model_mapping.get(provider, model)
    
    async def check_rate_limit(self, chat_session: ChatSession, user_tier: str = "free") -> Tuple[bool, str]:
        """Check if user can make a request based on rate limits"""
        if chat_session.use_own_key:
            return True, "Using own API key"
        
        daily_limit = self.daily_limits.get(user_tier, self.daily_limits["free"])
        if daily_limit == -1:  # Unlimited
            return True, "Unlimited usage"
        
        chat_session.reset_daily_count_if_needed()
        
        if chat_session.daily_requests_count >= daily_limit:
            return False, f"Daily limit of {daily_limit} requests reached. Please upgrade or add your own API key."
        
        return True, f"Rate limit OK ({chat_session.daily_requests_count}/{daily_limit})"
    
    def prepare_messages_for_llm(self, messages: List[Dict], context: Optional[str] = None) -> List[Dict]:
        """Prepare messages for LLM with context injection"""
        llm_messages = []
        
        # Add system message with context if provided
        if context:
            system_message = {
                "role": "system",
                "content": f"""You are a helpful AI assistant that answers questions about code repositories. 
Use the following repository context to answer user questions accurately and helpfully.

Repository Context:
{context}

Instructions:
- Answer based on the provided repository context
- If the question cannot be answered from the context, say so clearly
- Be specific and reference relevant files/functions when possible
- Keep responses concise but informative"""
            }
            llm_messages.append(system_message)
        
        # Add conversation messages
        for msg in messages:
            if msg["role"] in ["user", "assistant"]:
                llm_messages.append({
                    "role": msg["role"],
                    "content": msg["content"]
                })
        
        return llm_messages
    
    async def generate_response(
        self,
        user: User,
        chat_session: ChatSession, 
        messages: List[Dict],
        context: Optional[str] = None,
        provider: str = "openai",
        model: str = "gpt-3.5-turbo",
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        stream: bool = False
    ) -> Union[Dict[str, Any], AsyncGenerator[Dict, None]]:
        """Generate response with optional streaming support"""
        
        try:
            # Check rate limits
            can_proceed, rate_limit_msg = await self.check_rate_limit(chat_session)
            if not can_proceed:
                error_response = {
                    "success": False,
                    "error": rate_limit_msg,
                    "error_type": "rate_limit"
                }
                if stream:
                    async def error_generator():
                        yield error_response
                    return error_generator()
                return error_response

            # Get API key
            api_key = await self.get_api_key_for_request(user, provider)
            if not api_key:
                error_response = {
                    "success": False,
                    "error": f"No API key available for {provider}",
                    "error_type": "no_api_key"
                }
                if stream:
                    async def error_generator():
                        yield error_response
                    return error_generator()
                return error_response

            # Prepare messages
            llm_messages = self.prepare_messages_for_llm(messages, context)
            
            # Get model name for provider
            model_name = self.get_model_name_for_provider(provider, model)
            
            # Return appropriate response type
            if stream:
                return self._generate_streaming_response(
                    api_key=api_key,
                    model_name=model_name,
                    messages=llm_messages,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    provider=provider,
                    chat_session=chat_session
                )
            else:
                return await self._generate_non_streaming_response(
                    api_key=api_key,
                    model_name=model_name,
                    messages=llm_messages,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    provider=provider,
                    chat_session=chat_session
                )
            
        except Exception as e:
            error_type = self._get_error_type(e)
            error_response = {
                "success": False,
                "error": str(e),
                "error_type": error_type
            }
            if stream:
                async def error_generator():
                    yield error_response
                return error_generator()
            return error_response

    async def _generate_non_streaming_response(
        self,
        api_key: str,
        model_name: str,
        messages: List[Dict],
        temperature: float,
        max_tokens: Optional[int],
        provider: str,
        chat_session: ChatSession
    ) -> Dict[str, Any]:
        """Generate non-streaming response"""
        response = await litellm.acompletion(
            model=model_name,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            timeout=120,
            api_key=api_key
        )
        
        response_content = response.choices[0].message.content
        usage = response.usage
        
        # Update request count
        chat_session.increment_request_count()
        await chat_session.save()
        
        return {
            "success": True,
            "content": response_content,
            "usage": {
                "prompt_tokens": usage.prompt_tokens,
                "completion_tokens": usage.completion_tokens,
                "total_tokens": usage.total_tokens
            },
            "model_used": model_name,
            "provider": provider
        }

    async def _generate_streaming_response(
        self,
        api_key: str,
        model_name: str,
        messages: List[Dict],
        temperature: float,
        max_tokens: Optional[int],
        provider: str,
        chat_session: ChatSession
    ) -> AsyncGenerator[Dict, None]:
        """Generate streaming response"""
        request_attempted = False
        try:
            # Start streaming request
            response = await litellm.acompletion(
                model=model_name,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
                timeout=120,
                stream=True,
                api_key=api_key
            )
            request_attempted = True
            
            # Stream responses
            async for chunk in response:
                if chunk.choices[0].delta.content:
                    yield {
                        "type": "token",
                        "token": chunk.choices[0].delta.content,
                        "provider": provider,
                        "model": model_name
                    }
            
            # Final status message
            yield {
                "type": "complete",
                "provider": provider,
                "model": model_name
            }
            
            # Update request count after successful stream
            chat_session.increment_request_count()
            await chat_session.save()
            
        except Exception as e:
            error_type = self._get_error_type(e)
            # Handle partial completion
            if request_attempted:
                chat_session.increment_request_count()
                await chat_session.save()
                
            yield {
                "type": "error",
                "error": str(e),
                "error_type": error_type,
                "provider": provider,
                "model": model_name
            }

    def _get_error_type(self, error: Exception) -> str:
        """Classify error types"""
        error_msg = str(error).lower()
        if "rate limit" in error_msg:
            return "provider_rate_limit"
        elif "quota" in error_msg:
            return "quota_exceeded"
        elif "unauthorized" in error_msg or "invalid" in error_msg:
            return "invalid_api_key"
        elif "timeout" in error_msg:
            return "timeout"
        return "unknown"

    def get_available_models(self) -> Dict[str, List[str]]:
        """Get available models for each provider"""
        return {
            provider: list(models.keys()) 
            for provider, models in self.model_configs.items()
        }
    
    def get_model_info(self, provider: str, model: str) -> Optional[Dict]:
        """Get information about a specific model"""
        return self.model_configs.get(provider, {}).get(model)


# Global instance
llm_service = LLMService()