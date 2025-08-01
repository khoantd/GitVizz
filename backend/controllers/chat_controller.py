import json
from fastapi import HTTPException, Form, Depends
from typing import Optional, AsyncGenerator, Annotated
import uuid
import time
from datetime import datetime, timedelta
import re
from beanie import BeanieObjectId

from models.chat import ChatSession, Conversation, UserApiKey
from models.repository import Repository
from models.user import User
from utils.llm_utils import llm_service
from utils.file_utils import file_manager
from utils.jwt_utils import get_current_user
from services.graph_search_service import graph_search_service
from schemas.chat_schemas import (
    ChatResponse, ConversationHistoryResponse, 
    ChatSessionResponse, ApiKeyResponse,
    AvailableModelsResponse, ChatSettingsResponse,
    ContextSearchResponse, MessageResponse, StreamChatResponse, ChatSessionListItem, ChatSessionListResponse
)


class ChatController:
    """Controller for handling chat-related operations"""
    
    async def get_or_create_chat_session(
        self, 
        user: User, 
        repository_id: str,
        chat_id: Optional[str] = None
    ) -> ChatSession:
        """Get existing chat session or create a new one"""
        
        # Verify repository exists and user has access
        repository = await Repository.find_one(
            Repository.id == BeanieObjectId(repository_id),
            Repository.user.id == user.id
        )
        
        if not repository:
            raise HTTPException(
                status_code=404, 
                detail="Repository not found or access denied"
            )
        
        if chat_id:
            # Try to find existing chat session with fetch_links to get full repository
            chat_session = await ChatSession.find_one(
                ChatSession.chat_id == chat_id,
                ChatSession.user.id == BeanieObjectId(user.id),
                ChatSession.repository.id == BeanieObjectId(repository_id),
                fetch_links=True  # This ensures repository is fully loaded
            )
            if chat_session:
                # Additional safety check - if repository is still a Link, fetch it manually
                if hasattr(chat_session.repository, 'id') and not hasattr(chat_session.repository, 'file_paths'):
                    chat_session.repository = await Repository.get(chat_session.repository.id)
                return chat_session
        
        # Create new chat session
        new_chat_id = chat_id or str(uuid.uuid4())
        chat_session = ChatSession(
            user=user,
            repository=repository,
            chat_id=new_chat_id,
            title=f"Chat about {repository.repo_name}"
        )
        await chat_session.save()
        return chat_session
    
    async def get_repository_context(
        self, 
        repository: Repository, 
        include_full: bool = False,
        search_query: Optional[str] = None,
        user_query: Optional[str] = None,
        max_context_tokens: int = 4000,
        scope_preference: str = "moderate"
    ) -> tuple[str, Optional[dict]]:
        """Get repository context for the conversation using smart graph search"""
        try:
            # Ensure we have a full Repository object, not just a Link
            if hasattr(repository, 'id') and not hasattr(repository, 'file_paths'):
                # It's a Link object, fetch the full repository
                repository = await Repository.get(repository.id)
                if not repository:
                    return "Repository not found.", None
            
            # If include_full is True or user_query is not provided, fall back to original behavior
            if include_full or not user_query:
                full_content = await file_manager.load_text_content(repository.file_paths.text)
                if full_content:
                    return full_content, None
                return "Repository content not available.", None
            
            # Use smart graph search for context
            try:
                smart_context_result = await graph_search_service.build_smart_context(
                    repository=repository,
                    user_query=user_query,
                    max_context_tokens=max_context_tokens,
                    scope_preference=scope_preference
                )
                
                # Return both context and metadata
                context_metadata = {
                    "query_analysis": smart_context_result.metadata.query_analysis.model_dump(),
                    "nodes_selected": smart_context_result.metadata.nodes_selected,
                    "total_nodes_available": smart_context_result.metadata.total_nodes_available,
                    "context_completeness": smart_context_result.metadata.context_completeness,
                    "token_usage_estimate": smart_context_result.metadata.token_usage_estimate,
                    "selection_strategy": smart_context_result.metadata.selection_strategy,
                    "processing_time_ms": smart_context_result.metadata.processing_time_ms,
                    "context_nodes": [node.model_dump() for node in smart_context_result.context_nodes]
                }
                
                return smart_context_result.context_text, context_metadata
                
            except Exception as graph_error:
                print(f"Error in smart graph search, falling back to full content: {graph_error}")
                # Fallback to original behavior if graph search fails
                full_content = await file_manager.load_text_content(repository.file_paths.text)
                if full_content:
                    return full_content, None
                return "Repository content not available.", None
            
        except Exception as e:
            print(f"Error loading repository context: {e}")
            return "Error loading repository context.", None
    
    def generate_conversation_title(self, message: str) -> str:
        """Generate a meaningful and unique title for a conversation based on the user's query"""
        # Use the user's query (message) as the base for the title
        base_title = message.strip()

        # Truncate to a reasonable length for display
        if len(base_title) > 50:
            base_title = base_title[:47] + "..."

        # Add a short unique suffix using a portion of a UUID
        unique_suffix = str(uuid.uuid4())[:8]
        return f"{base_title} [{unique_suffix}]"
    
    async def process_chat_message(
        self,
        token: Annotated[str, Form(description="JWT authentication token")],
        message: Annotated[str, Form(description="User's message/question")],
        repository_id: Annotated[str, Form(description="Repository ID to chat about")],
        use_user: Annotated[bool, Form(description="Whether to use the user's saved API key")] = False,
        chat_id: Annotated[Optional[str], Form(description="Chat session ID (auto-generated if not provided)")] = None,
        conversation_id: Annotated[Optional[str], Form(description="Conversation thread ID (auto-generated if not provided)")] = None,
        provider: Annotated[str, Form(description="LLM provider (openai, anthropic, gemini)")] = "openai",
        model: Annotated[str, Form(description="Model name")] = "gpt-3.5-turbo",
        temperature: Annotated[float, Form(description="Response randomness (0.0-2.0)", ge=0.0, le=2.0)] = 0.7,
        max_tokens: Annotated[Optional[int], Form(description="Maximum tokens in response (1-4000)", ge=1, le=4000)] = None,
        include_full_context: Annotated[bool, Form(description="Include full repository content as context")] = False,
        context_search_query: Annotated[Optional[str], Form(description="Specific search query for context retrieval")] = None,
        scope_preference: Annotated[str, Form(description="Context scope preference: focused, moderate, or comprehensive")] = "moderate"
    ) -> ChatResponse:
        """Process a chat message and generate AI response"""
        
        start_time = time.time()
        
        try:
            # Authenticate user
            user = await get_current_user(token)
            if not user:
                raise HTTPException(status_code=401, detail="Invalid JWT token")
            
            # Get or create chat session
            chat_session = await self.get_or_create_chat_session(
                user, 
                repository_id,
                chat_id
            )
            
            # Generate conversation ID if not provided
            conversation_id = conversation_id or str(uuid.uuid4())
            
            # Get or create conversation
            conversation = await Conversation.find_one(
                Conversation.conversation_id == conversation_id,
                Conversation.user.id == user.id
            )
            
            if not conversation:
                conversation = Conversation(
                    user=user,
                    repository=chat_session.repository,
                    chat_id=chat_session.chat_id,
                    conversation_id=conversation_id,
                    title=self.generate_conversation_title(message),
                    model_provider=provider,
                    model_name=model,
                    temperature=temperature,
                    max_tokens=max_tokens
                )
                await conversation.save()
            
            # Add user message to conversation
            conversation.add_message("user", message)
            
            # Get repository context
            context, context_metadata = await self.get_repository_context(
                chat_session.repository,
                include_full_context,
                context_search_query,
                user_query=message,
                max_context_tokens=max_tokens or 4000,
                scope_preference=scope_preference
            )
            
            # Prepare messages for LLM
            messages = [
                {"role": msg.role, "content": msg.content} 
                for msg in conversation.messages[-10:]  # Last 10 messages for context
            ]
            
            # Generate AI response
            llm_response = await llm_service.generate_response(
                user=user,
                use_user=use_user,
                chat_session=chat_session,
                messages=messages,
                context=context,
                provider=provider,
                model=model,
                temperature=temperature,
                max_tokens=max_tokens,
                stream=False  # Non-streaming response
            )
            
            if not llm_response["success"]:
                return ChatResponse(
                    success=False,
                    error=llm_response["error"],
                    error_type=llm_response["error_type"],
                    chat_id=chat_session.chat_id,
                    conversation_id=conversation_id
                )
            
            # Add AI response to conversation
            ai_message = conversation.add_message(
                "assistant", 
                llm_response["content"],
                context_used=context[:500] + "..." if len(context) > 500 else context,
                metadata=llm_response.get("usage", {})
            )
            
            # Update conversation metadata
            if llm_response.get("usage"):
                conversation.total_tokens_used += llm_response["usage"].get("total_tokens", 0)
            
            await conversation.save()
            
            # Calculate response time
            response_time = time.time() - start_time
            
            # Prepare daily usage info
            daily_usage = {
                "requests_used": chat_session.daily_requests_count,
                "requests_limit": 50 if not chat_session.use_own_key else -1,
                "reset_date": (datetime.utcnow() + timedelta(days=1)).date().isoformat()
            }
            
            return ChatResponse(
                success=True,
                chat_id=chat_session.chat_id,
                conversation_id=conversation_id,
                ai_response=llm_response["content"],
                context_used=context[:500] + "..." if len(context) > 500 else context,
                context_metadata=context_metadata,
                usage=llm_response.get("usage"),
                model_used=llm_response.get("model_used"),
                provider=llm_response.get("provider"),
                response_time=response_time,
                daily_usage=daily_usage
            )
            
        except Exception as e:
            return ChatResponse(
                success=False,
                error=str(e),
                error_type="server_error",
                chat_id=chat_id or "",
                conversation_id=conversation_id or ""
            )
    
    async def process_streaming_chat(
        self,
        token: Annotated[str, Form(description="JWT authentication token")],
        message: Annotated[str, Form(description="User's message/question")],
        repository_id: Annotated[str, Form(description="Repository ID to chat about")],
        use_user: Annotated[bool, Form(description="Whether to use the user's saved API key")] = False,
        chat_id: Annotated[Optional[str], Form(description="Chat session ID (auto-generated if not provided)")] = None,
        conversation_id: Annotated[Optional[str], Form(description="Conversation thread ID (auto-generated if not provided)")] = None,
        provider: Annotated[str, Form(description="LLM provider (openai, anthropic, gemini)")] = "openai",
        model: Annotated[str, Form(description="Model name")] = "gpt-3.5-turbo",
        temperature: Annotated[float, Form(description="Response randomness (0.0-2.0)", ge=0.0, le=2.0)] = 0.7,
        max_tokens: Annotated[Optional[int], Form(description="Maximum tokens in response (1-4000)", ge=1, le=4000)] = None,
        include_full_context: Annotated[bool, Form(description="Include full repository content as context")] = False,
        context_search_query: Annotated[Optional[str], Form(description="Specific search query for context retrieval")] = None,
        scope_preference: Annotated[str, Form(description="Context scope preference: focused, moderate, or comprehensive")] = "moderate"
    ) -> AsyncGenerator[str, None]:
        """Process a chat message with streaming response - yields JSON strings"""
        try:
            # Authenticate user
            user = await get_current_user(token)
            if not user:
                yield json.dumps(StreamChatResponse(
                    event="error",
                    error="Invalid JWT token",
                    error_type="authentication_error"
                ).model_dump()) + "\n"
                return
            
            # Get or create chat session
            chat_session = await self.get_or_create_chat_session(
                user, 
                repository_id,
                chat_id
            )
            
            # Generate conversation ID if not provided
            conversation_id = conversation_id or str(uuid.uuid4())
            
            # EARLY API KEY VALIDATION - Check if user has valid API key when use_user=True
            if use_user:
                try:
                    api_key = await llm_service.get_api_key_for_request(user, provider, use_user=True)
                    if not api_key:
                        yield json.dumps(StreamChatResponse(
                            event="error",
                            error=f"No valid API key found for {provider}. Please add your API key or disable 'use own key' option.",
                            error_type="no_api_key",
                            provider=provider,
                            model=model,
                            chat_id=chat_session.chat_id,
                            conversation_id=conversation_id
                        ).model_dump()) + "\n"
                        return
                except Exception as e:
                    yield json.dumps(StreamChatResponse(
                        event="error",
                        error=str(e),
                        error_type="invalid_api_key",
                        provider=provider,
                        model=model,
                        chat_id=chat_session.chat_id,
                        conversation_id=conversation_id
                    ).model_dump()) + "\n"
                    return
            
            # Get or create conversation - fetch with links to ensure repository is loaded
            conversation = await Conversation.find_one(
                Conversation.conversation_id == conversation_id,
                Conversation.user.id == BeanieObjectId(user.id),
                fetch_links=True  # Ensure linked objects are fully loaded
            )
            
            if not conversation:
                conversation = Conversation(
                    user=user,
                    repository=chat_session.repository,
                    chat_id=chat_session.chat_id,
                    conversation_id=conversation_id,
                    title=self.generate_conversation_title(message),
                    model_provider=provider,
                    model_name=model,
                    temperature=temperature,
                    max_tokens=max_tokens
                )
                await conversation.save()
            else:
                # Ensure repository is fully loaded if it's a Link
                if hasattr(conversation.repository, 'id') and not hasattr(conversation.repository, 'file_paths'):
                    conversation.repository = await Repository.get(conversation.repository.id)
            
            # Add user message to conversation
            conversation.add_message("user", message)
            
            # Get repository context - use the repository from chat_session which we know is fully loaded
            context, context_metadata = await self.get_repository_context(
                chat_session.repository,
                include_full_context,
                context_search_query,
                user_query=message,
                max_context_tokens=max_tokens or 4000,
                scope_preference=scope_preference
            )
            
            # Prepare messages for LLM
            messages = [
                {"role": msg.role, "content": msg.content} 
                for msg in conversation.messages[-10:]  # Last 10 messages for context
            ]
            
            # Generate streaming response
            response_generator = await llm_service.generate_response(
                user=user,
                use_user=use_user,
                chat_session=chat_session,
                messages=messages,
                context=context,
                provider=provider,
                model=model,
                temperature=temperature,
                max_tokens=max_tokens,
                stream=True  # Streaming response
            )
            
            # Handle response based on type
            if hasattr(response_generator, '__aiter__'):
                # It's an async generator
                response_content = ""
                final_usage = None
                
                async for chunk in response_generator:
                    if chunk.get("type") == "token":
                        token_content = chunk.get("token", "")
                        response_content += token_content
                        
                        # Yield token event with all required fields
                        yield json.dumps(StreamChatResponse(
                            event="token",
                            token=token_content,
                            provider=chunk.get("provider", provider),
                            model=chunk.get("model", model),
                            chat_id=chat_session.chat_id,
                            conversation_id=conversation_id
                        ).model_dump()) + "\n"
                        
                    elif chunk.get("type") == "complete":
                        final_usage = chunk.get("usage", {})
                        
                        # Add AI response to conversation
                        conversation.add_message(
                            "assistant", 
                            response_content,
                            context_used=context[:500] + "..." if len(context) > 500 else context,
                            metadata=final_usage
                        )
                        
                        # Update conversation metadata
                        if final_usage:
                            conversation.total_tokens_used += final_usage.get("total_tokens", 0)
                        
                        await conversation.save()
                        
                        # Yield complete event with all required fields
                        yield json.dumps(StreamChatResponse(
                            event="complete",
                            provider=chunk.get("provider", provider),
                            model=chunk.get("model", model),
                            usage=final_usage,
                            chat_id=chat_session.chat_id,
                            conversation_id=conversation_id,
                            context_metadata=context_metadata
                        ).model_dump()) + "\n"
                        
                    elif chunk.get("type") == "error":
                        yield json.dumps(StreamChatResponse(
                            event="error",
                            error=chunk.get("error", "Unknown error"),
                            error_type=chunk.get("error_type", "unknown"),
                            provider=chunk.get("provider", provider),
                            model=chunk.get("model", model),
                            chat_id=chat_session.chat_id,
                            conversation_id=conversation_id
                        ).model_dump()) + "\n"
                        break
                        
            else:
                # It's a regular response (error case)
                if not response_generator.get("success", False):
                    yield json.dumps(StreamChatResponse(
                        event="error",
                        error=response_generator.get("error", "Unknown error"),
                        error_type=response_generator.get("error_type", "unknown"),
                        chat_id=chat_session.chat_id,
                        conversation_id=conversation_id
                    ).model_dump()) + "\n"
                    
        except Exception as e:
            # Include chat_id and conversation_id in error response if available
            error_response = StreamChatResponse(
                event="error",
                error=str(e),
                error_type="server_error"
            )
            
            # Try to include IDs if they exist
            try:
                if 'chat_session' in locals():
                    error_response.chat_id = chat_session.chat_id
                if 'conversation_id' in locals():
                    error_response.conversation_id = conversation_id
            except:
                pass
                
            yield json.dumps(error_response.model_dump()) + "\n"
            
    async def list_user_chat_sessions(
        self,
        jwt_token: Annotated[str, Form(description="JWT authentication token")],
        repo_id: Annotated[str, Form(description="Repository ID")]
    ) -> ChatSessionListResponse:
        try:
            user = await get_current_user(jwt_token)
            if not user:
                raise HTTPException(status_code=401, detail="Invalid JWT token")
            
            user_object_id = BeanieObjectId(user.id)
            
            # Get all chat sessions
            chat_sessions = await ChatSession.find(
                ChatSession.user.id == user_object_id,
                ChatSession.is_active == True,
                ChatSession.repository.id == BeanieObjectId(repo_id)
            ).sort(-ChatSession.updated_at).to_list()

            # For each chat session, find the most recent conversation (if any)
            conversation_map = {}
            for session in chat_sessions:
                conversations = await Conversation.find(
                    Conversation.chat_id == session.chat_id,
                    Conversation.user.id == user_object_id
                ).sort(-Conversation.updated_at).limit(1).to_list()
                
                conversation = conversations[0] if conversations else None
                if conversation:
                    conversation_map[session.chat_id] = conversation.conversation_id
            
            # Only include sessions that have conversations (since conversation_id is required)
            sessions = []
            for session in chat_sessions:
                conversation_id = conversation_map.get(session.chat_id)
                if conversation_id:  # Only include if conversation exists
                    sessions.append(ChatSessionListItem(
                        chat_id=session.chat_id,
                        conversation_id=conversation_id,
                        title=session.title
                    ))
            
            return ChatSessionListResponse(
                success=True,
                sessions=sessions
            )
            
        except HTTPException:
            # Re-raise HTTP exceptions as-is
            raise
        except ValueError as e:
            # Handle invalid ObjectId or other value errors
            raise HTTPException(status_code=400, detail=f"Invalid request data: {str(e)}")
        except Exception as e:
            # Log the actual error for debugging
            raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
        
    async def get_conversation_history(
        self,
        token: Annotated[str, Form(description="JWT authentication token")],
        conversation_id: Annotated[str, Form(description="Conversation ID to retrieve")]
    ) -> ConversationHistoryResponse:
        """Get full conversation history"""
        try:
            user = await get_current_user(token)
            if not user:
                raise HTTPException(status_code=401, detail="Invalid JWT token")
            
            conversation = await Conversation.find_one(
                Conversation.conversation_id == conversation_id,
                Conversation.user.id == BeanieObjectId(user.id)
            )
            
            if not conversation:
                raise HTTPException(status_code=404, detail="Conversation not found")
            
            # Convert messages to response format
            messages_response = [
                MessageResponse(
                    role=msg.role,
                    content=msg.content,
                    timestamp=msg.timestamp,
                    context_used=msg.context_used,
                    metadata=msg.metadata
                )
                for msg in conversation.messages
            ]
            
            return ConversationHistoryResponse(
                chat_id=conversation.chat_id,
                conversation_id=conversation.conversation_id,
                title=conversation.title,
                messages=messages_response,
                created_at=conversation.created_at,
                updated_at=conversation.updated_at,
                total_tokens_used=conversation.total_tokens_used,
                model_provider=conversation.model_provider,
                model_name=conversation.model_name
            )
            
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    
    async def get_chat_session(
        self,
        token: Annotated[str, Form(description="JWT authentication token")],
        chat_id: Annotated[str, Form(description="Chat session ID to retrieve")]
    ) -> ChatSessionResponse:
        """Get chat session details with recent conversations"""
        try:
            user = await get_current_user(token)
            if not user:
                raise HTTPException(status_code=401, detail="Invalid JWT token")
            
            # Fetch with linked repository included
            chat_session = await ChatSession.find_one(
                ChatSession.chat_id == chat_id,
                ChatSession.user.id == BeanieObjectId(user.id),
                fetch_links=True  # This will fetch the linked repository
            )
            
            if not chat_session:
                raise HTTPException(status_code=404, detail="Chat session not found")
            
            # Double-check that repository is fully loaded
            if hasattr(chat_session.repository, 'id') and not hasattr(chat_session.repository, 'repo_name'):
                chat_session.repository = await Repository.get(chat_session.repository.id)
            
            # Get conversations
            conversations = await Conversation.find(
                Conversation.chat_id == chat_id,
                Conversation.user.id == BeanieObjectId(user.id),  # Add user filter for security
                sort=(-Conversation.updated_at)
            ).to_list()
            
            # Prepare conversation responses
            recent_conversations = []
            for conv in conversations:
                messages_response = [
                    MessageResponse(
                        role=msg.role,
                        content=msg.content,
                        timestamp=msg.timestamp,
                        context_used=msg.context_used,
                        metadata=msg.metadata
                    )
                    for msg in conv.messages
                ]
                recent_conversations.append(
                    ConversationHistoryResponse(
                        chat_id=conv.chat_id,
                        conversation_id=conv.conversation_id,
                        title=conv.title,
                        messages=messages_response,
                        created_at=conv.created_at,
                        updated_at=conv.updated_at,
                        total_tokens_used=conv.total_tokens_used,
                        model_provider=conv.model_provider,
                        model_name=conv.model_name
                    )
                )
            
            # Determine daily limit
            daily_limit = 50
            if chat_session.use_own_key:
                daily_limit = -1  # Unlimited
            
            return ChatSessionResponse(
                chat_id=chat_session.chat_id,
                title=chat_session.title,
                repository_name=chat_session.repository.repo_name,  # Now this will work
                repository_id=str(chat_session.repository.id),  # Convert to string
                created_at=chat_session.created_at,
                updated_at=chat_session.updated_at,
                is_active=chat_session.is_active,
                default_model_provider=chat_session.default_model_provider,
                default_model_name=chat_session.default_model_name,
                use_own_key=chat_session.use_own_key,
                daily_requests_count=chat_session.daily_requests_count,
                daily_limit=daily_limit,
                recent_conversations=recent_conversations
            )
            
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
        
    
    async def save_user_api_key(
        self,
        token: Annotated[str, Form(description="JWT authentication token")],
        provider: Annotated[str, Form(description="Provider name (openai, anthropic, gemini)")],
        api_key: Annotated[str, Form(description="API key")],
        key_name: Annotated[Optional[str], Form(description="Friendly name for the key")] = None
    ) -> ApiKeyResponse:
        """Save or update user API key"""
        try:
            user = await get_current_user(token)
            if not user:
                raise HTTPException(status_code=401, detail="Invalid JWT token")
            
            # Validate provider
            valid_providers = ["openai", "anthropic", "gemini"]
            if provider not in valid_providers:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid provider. Valid providers: {', '.join(valid_providers)}"
                )
            
            # Save key
            user_key = await llm_service.save_user_api_key(
                user,
                provider,
                api_key,
                key_name
            )
            
            return ApiKeyResponse(
                success=True,
                message="API key saved successfully",
                provider=provider,
                key_name=user_key.key_name,
                created_at=user_key.created_at
            )
            
        except Exception as e:
            return ApiKeyResponse(
                success=False,
                message=str(e),
                provider=provider
            )
    
    async def get_available_models(
        self,
        token: Annotated[str, Form(description="JWT authentication token")]
    ) -> AvailableModelsResponse:
        """Get available models with user's key status"""
        try:
            user = await get_current_user(token)
            if not user:
                raise HTTPException(status_code=401, detail="Invalid JWT token")
            
            # Get user's keys
            user_keys = await UserApiKey.find(
                UserApiKey.user.id == BeanieObjectId(user.id),
                UserApiKey.is_active == True
            ).to_list()
            
            user_has_keys = [key.provider for key in user_keys]
            
            # Get available models
            models = llm_service.get_available_models()
            
            # Get current limits based on user's tier
            # (In a real app, you'd get this from user profile)
            current_limits = {
                "free": 10,
                "premium": 50,
                "unlimited": -1
            }
            
            return AvailableModelsResponse(
                providers=models,
                current_limits=current_limits,
                user_has_keys=user_has_keys
            )
            
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    
    async def update_chat_settings(
        self,
        token: Annotated[str, Form(description="JWT authentication token")],
        chat_id: Annotated[str, Form(description="Chat session ID to update")],
        title: Annotated[Optional[str], Form(description="New chat title")] = None,
        default_provider: Annotated[Optional[str], Form(description="Default LLM provider")] = None,
        default_model: Annotated[Optional[str], Form(description="Default model name")] = None,
        default_temperature: Annotated[Optional[float], Form(description="Default temperature (0.0-2.0)", ge=0.0, le=2.0)] = None
    ) -> ChatSettingsResponse:
        """Update chat session settings"""
        try:
            user = await get_current_user(token)
            if not user:
                raise HTTPException(status_code=401, detail="Invalid JWT token")
            
            chat_session = await ChatSession.find_one(
                ChatSession.chat_id == chat_id,
                ChatSession.user.id == BeanieObjectId(user.id)
            )
            
            if not chat_session:
                raise HTTPException(status_code=404, detail="Chat session not found")
            
            # Update fields
            updated_fields = {}
            if title is not None:
                chat_session.title = title
                updated_fields["title"] = title
                
            if default_provider is not None:
                chat_session.default_model_provider = default_provider
                updated_fields["default_model_provider"] = default_provider
                
            if default_model is not None:
                chat_session.default_model_name = default_model
                updated_fields["default_model_name"] = default_model
                
            if default_temperature is not None:
                chat_session.default_temperature = default_temperature
                updated_fields["default_temperature"] = default_temperature
                
            if updated_fields:
                chat_session.updated_at = datetime.utcnow()
                await chat_session.save()
            
            return ChatSettingsResponse(
                success=True,
                message="Settings updated successfully",
                settings=updated_fields
            )
            
        except Exception as e:
            return ChatSettingsResponse(
                success=False,
                message=str(e)
            )
    
    async def search_context(
        self,
        token: Annotated[str, Form(description="JWT authentication token")],
        repository_id: Annotated[str, Form(description="Repository ID to search")],
        query: Annotated[str, Form(description="Search query")],
        max_results: Annotated[int, Form(description="Maximum number of results (1-20)", ge=1, le=20)] = 5
    ) -> ContextSearchResponse:
        """Search repository context"""
        try:
            user = await get_current_user(token)
            if not user:
                raise HTTPException(status_code=401, detail="Invalid JWT token")
            
            repository = await Repository.find_one(
                Repository.id == BeanieObjectId(repository_id),
                Repository.user.id == user.id
            )
            
            if not repository:
                raise HTTPException(status_code=404, detail="Repository not found")
            
            # Load repository content
            content = await file_manager.load_text_content(repository.file_paths.text)
            if not content:
                return ContextSearchResponse(
                    success=False,
                    results=[],
                    total_found=0,
                    query_used=query
                )
            
            # Simple search implementation
            lines = content.split('\n')
            results = []
            for i, line in enumerate(lines):
                if query.lower() in line.lower():
                    # Capture surrounding context
                    start = max(0, i - 1)
                    end = min(len(lines), i + 2)
                    context = "\n".join(lines[start:end])
                    
                    results.append({
                        "line_number": i + 1,
                        "content": line,
                        "context": context
                    })
                    if len(results) >= max_results:
                        break
            
            return ContextSearchResponse(
                success=True,
                results=results,
                total_found=len(results),
                query_used=query
            )
            
        except Exception as e:
            return ContextSearchResponse(
                success=False,
                results=[],
                total_found=0,
                query_used=query
            )


# Global instance
chat_controller = ChatController()