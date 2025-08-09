"""
Simplified API key routes that avoid problematic imports
"""
from fastapi import APIRouter, Form
from typing import Optional, Annotated
from controllers.api_key_controller import api_key_controller

router = APIRouter(prefix="/backend-chat")

# API key verification endpoint
@router.post(
    "/keys/verify",
    summary="Verify API key",
    description="Verify if an API key is valid for a specific provider without saving it"
)
async def verify_user_api_key(
    token: Annotated[str, Form(description="JWT authentication token")],
    provider: Annotated[str, Form(description="Provider name (openai, anthropic, gemini)")],
    api_key: Annotated[str, Form(description="API key to verify")]
):
    return await api_key_controller.verify_api_key(
        token=token,
        provider=provider,
        api_key=api_key
    )

# Simple health check endpoint
@router.get("/health")
async def health_check():
    return {"status": "ok", "message": "API key service is running"} 