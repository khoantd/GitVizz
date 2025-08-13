"""
Enhanced API key routes with full user API key management
Integrated with LLM service for comprehensive functionality
"""
from fastapi import APIRouter, Form
from typing import Optional, Annotated
from controllers.api_key_controller import api_key_controller

router = APIRouter(prefix="/backend-chat")

# API key verification endpoint
@router.post(
    "/keys/verify",
    summary="Verify API key",
    description="Verify if an API key is valid for a specific provider without saving it",
    operation_id="verify_api_key_backend_enhanced"
)
async def verify_user_api_key_enhanced(
    token: Annotated[str, Form(description="JWT authentication token")],
    provider: Annotated[str, Form(description="Provider name (openai, anthropic, gemini, groq)")],
    api_key: Annotated[str, Form(description="API key to verify")]
):
    """Verify API key without saving it"""
    return await api_key_controller.verify_api_key(
        token=token,
        provider=provider,
        api_key=api_key
    )

# Save user API key endpoint
@router.post(
    "/keys/save",
    summary="Save user API key",
    description="Save an encrypted API key for the authenticated user",
    operation_id="save_api_key_backend_enhanced"
)
async def save_user_api_key_enhanced(
    token: Annotated[str, Form(description="JWT authentication token")],
    provider: Annotated[str, Form(description="Provider name (openai, anthropic, gemini, groq)")],
    api_key: Annotated[str, Form(description="API key to save")],
    key_name: Annotated[Optional[str], Form(description="Optional friendly name for the key")] = None,
    verify_key: Annotated[bool, Form(description="Whether to verify key before saving")] = True
):
    """Save encrypted user API key with optional verification"""
    return await api_key_controller.save_user_api_key(
        token=token,
        provider=provider,
        api_key=api_key,
        key_name=key_name,
        verify_key=verify_key
    )

# Get user API keys endpoint
@router.post(
    "/keys/list",
    summary="Get user API keys",
    description="Get list of user's saved API keys (without exposing actual keys)",
    operation_id="get_user_api_keys_backend_enhanced"
)
async def get_user_api_keys_enhanced(
    token: Annotated[str, Form(description="JWT authentication token")]
):
    """Get list of user's saved API keys"""
    return await api_key_controller.get_user_api_keys(token=token)

# Delete user API key endpoint
@router.post(
    "/keys/delete",
    summary="Delete user API key",
    description="Delete user's API key for a specific provider",
    operation_id="delete_user_api_key_backend_enhanced"
)
async def delete_user_api_key_enhanced(
    token: Annotated[str, Form(description="JWT authentication token")],
    provider: Annotated[str, Form(description="Provider name to delete key for")],
    key_id: Annotated[Optional[str], Form(description="Specific key ID to delete")] = None
):
    """Delete user's API key for a specific provider"""
    return await api_key_controller.delete_user_api_key(
        token=token,
        provider=provider,
        key_id=key_id
    )

# Get available models endpoint
@router.post(
    "/models/available",
    summary="Get available models",
    description="Get available models for all providers or a specific provider",
    operation_id="get_available_models_backend_enhanced"
)
async def get_available_models_enhanced(
    token: Annotated[str, Form(description="JWT authentication token")],
    provider: Annotated[Optional[str], Form(description="Specific provider to get models for")] = None
):
    """Get available models with detailed configurations"""
    return await api_key_controller.get_available_models(
        token=token,
        provider=provider
    )

# Get available models (GET endpoint for easier access)
@router.get(
    "/models/available",
    summary="Get available models (GET)",
    description="Get available models for all providers (GET method for easier frontend integration)",
    operation_id="get_available_models_get_backend_enhanced"
)
async def get_available_models_get_enhanced(
    token: Optional[str] = None,
    provider: Optional[str] = None
):
    """Get available models with detailed configurations (GET method)"""
    # For GET requests, use a dummy token if none provided (for anonymous access)
    if not token:
        token = "anonymous"
    
    return await api_key_controller.get_available_models(
        token=token,
        provider=provider
    )

# Get model configuration endpoint
@router.get(
    "/models/{provider}/{model}/config",
    summary="Get model configuration",
    description="Get detailed configuration for a specific model including max tokens, capabilities, and pricing",
    operation_id="get_model_config_backend_enhanced"
)
async def get_model_config_enhanced(
    provider: str,
    model: str
):
    """Get detailed configuration for a specific model"""
    return await api_key_controller.get_model_config(
        provider=provider,
        model=model
    )

# Health check endpoint
@router.get(
    "/health",
    summary="Health check",
    description="Simple health check for API key service",
    operation_id="health_check_backend_enhanced"
)
async def health_check_enhanced():
    """Health check endpoint"""
    return {
        "status": "ok", 
        "message": "Enhanced API key service is running",
        "features": [
            "API key verification",
            "User API key management", 
            "Encrypted key storage",
            "Multi-provider support",
            "Model information"
        ],
        "supported_providers": ["openai", "anthropic", "gemini", "groq"]
    }

# Service info endpoint
@router.get(
    "/info",
    summary="Service information",
    description="Get information about the API key service capabilities",
    operation_id="service_info_backend_enhanced"
)
async def service_info_enhanced():
    """Get service information and capabilities"""
    from utils.llm_utils import llm_service
    
    available_models = llm_service.get_available_models()
    
    return {
        "service_name": "Enhanced API Key Management Service",
        "version": "2.0.0",
        "capabilities": {
            "api_key_verification": True,
            "encrypted_storage": True,
            "multi_provider_support": True,
            "model_information": True,
            "user_key_management": True
        },
        "supported_providers": list(available_models.keys()),
        "total_models": sum(len(models) for models in available_models.values()),
        "models_per_provider": {
            provider: len(models) 
            for provider, models in available_models.items()
        }
    } 