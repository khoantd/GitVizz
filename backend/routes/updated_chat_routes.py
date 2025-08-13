"""
Updated chat routes showing how to use the new auth middleware.
This demonstrates migration from the existing pattern to the new middleware.
"""

from fastapi import APIRouter, Form, Depends
from fastapi.responses import StreamingResponse
from typing import Optional, Annotated, Dict, Any, Tuple
from schemas.chat_schemas import (
    ChatResponse, ConversationHistoryResponse, 
    ChatSessionResponse, ApiKeyResponse,
    AvailableModelsResponse, ChatSettingsResponse,
    ContextSearchResponse, ChatSessionListResponse
)
from controllers.chat_controller import chat_controller
from schemas.response_schemas import ErrorResponse
from utils.auth_middleware import require_auth, require_auth_form

router = APIRouter(prefix="/backend-chat-v2")

# Updated chat endpoint using new middleware (flexible auth)
@router.post(
    "/chat",
    response_model=ChatResponse,
    summary="Process chat message (Updated with new auth middleware)",
    description="Process a user's chat message and return an AI-generated response. Supports both form and header authentication.",
    response_description="AI response and conversation metadata",
    responses={
        200: {
            "model": ChatResponse,
            "description": "Successful response with AI-generated content"
        },
        401: {
            "model": ErrorResponse,
            "description": "Unauthorized - Invalid JWT token"
        },
        404: {
            "model": ErrorResponse,
            "description": "Repository or chat session not found"
        },
        429: {
            "model": ErrorResponse,
            "description": "Rate limit exceeded"
        },
        500: {
            "model": ErrorResponse,
            "description": "Internal server error"
        }
    }
)
async def process_chat_message_v2(
    # Required parameters first
    message: Annotated[str, Form(description="User's message/question")],
    repository_id: Annotated[str, Form(description="Repository ID to chat about")],
    # Auth middleware handles JWT validation and returns user info
    auth_result: Tuple[str, Dict[str, Any]] = Depends(require_auth),
    # Optional parameters with defaults
    use_user: Annotated[bool, Form(description="Whether to use the user's saved API key")] = False,
    chat_id: Annotated[Optional[str], Form(description="Chat session ID (auto-generated if not provided)")] = None,
    conversation_id: Annotated[Optional[str], Form(description="Conversation thread ID (auto-generated if not provided)")] = None,
    provider: Annotated[str, Form(description="LLM provider (openai, anthropic, gemini)")] = "openai",
    model: Annotated[str, Form(description="Model name")] = "gpt-3.5-turbo",
    temperature: Annotated[float, Form(description="Response randomness (0.0-2.0)", ge=0.0, le=2.0)] = 0.7,
    max_tokens: Annotated[Optional[int], Form(description="Maximum tokens in response (1-4000)", ge=1, le=4000)] = None,
    include_full_context: Annotated[bool, Form(description="Include full repository content as context")] = False,
    context_search_query: Annotated[Optional[str], Form(description="Specific search query for context retrieval")] = None
):
    """
    Updated version using the new auth middleware.
    
    Key changes:
    1. Removed jwt_token parameter from function signature
    2. Added auth_result dependency that handles JWT validation
    3. The middleware provides user_id and user_data directly
    """
    user_id, user_data = auth_result
    
    # You can access user information directly from user_data
    # user_data contains: id, email, username, fullname, etc.
    
    # For backward compatibility with existing controller, we can create a token
    # Or better yet, update the controller to accept user_id instead of token
    # For now, let's show both approaches:
    
    # Approach 1: Create a minimal token representation for backward compatibility
    # This allows gradual migration without changing all controllers at once
    pseudo_token = f"user_id:{user_id}"  # Temporary solution
    
    return await chat_controller.process_chat_message(
        token=pseudo_token,  # TODO: Update controller to accept user_id directly
        message=message,
        repository_id=repository_id,
        use_user=use_user,
        chat_id=chat_id,
        conversation_id=conversation_id,
        provider=provider,
        model=model,
        temperature=temperature,
        max_tokens=max_tokens,
        include_full_context=include_full_context,
        context_search_query=context_search_query
    )

# Alternative: Backward compatible version using form-only auth
@router.post(
    "/chat/legacy",
    response_model=ChatResponse,
    summary="Process chat message (Legacy form auth only)",
    description="Process a user's chat message using legacy form-based authentication only",
    response_description="AI response and conversation metadata",
    responses={
        200: {
            "model": ChatResponse,
            "description": "Successful response with AI-generated content"
        },
        401: {
            "model": ErrorResponse,
            "description": "Unauthorized - Invalid JWT token"
        },
        500: {
            "model": ErrorResponse,
            "description": "Internal server error"
        }
    }
)
async def process_chat_message_legacy(
    # Required parameters first
    message: Annotated[str, Form(description="User's message/question")],
    repository_id: Annotated[str, Form(description="Repository ID to chat about")],
    # This maintains exact backward compatibility with existing routes
    auth_result: Tuple[str, Dict[str, Any]] = Depends(require_auth_form),
    # Optional parameters with defaults
    use_user: Annotated[bool, Form(description="Whether to use the user's saved API key")] = False,
    chat_id: Annotated[Optional[str], Form(description="Chat session ID")] = None,
    provider: Annotated[str, Form(description="LLM provider")] = "openai",
    model: Annotated[str, Form(description="Model name")] = "gpt-3.5-turbo",
    temperature: Annotated[float, Form(description="Response randomness", ge=0.0, le=2.0)] = 0.7
):
    """
    Legacy version that maintains exact backward compatibility.
    Uses form-only authentication like your existing routes.
    """
    user_id, user_data = auth_result
    
    # This version shows how you can gradually migrate
    # while maintaining the exact same API contract
    
    # For complete backward compatibility, we could reconstruct a JWT token
    # But it's better to update controllers to accept user information directly
    
    return await chat_controller.process_chat_message(
        token=f"validated_user:{user_id}",  # Indicator that user is pre-validated
        message=message,
        repository_id=repository_id,
        use_user=use_user,
        chat_id=chat_id,
        conversation_id=None,
        provider=provider,
        model=model,
        temperature=temperature,
        max_tokens=None,
        include_full_context=False,
        context_search_query=None
    )
