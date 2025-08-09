"""
Standalone API key controller for verification functionality
"""
from fastapi import HTTPException, Form
from typing import Annotated, Optional
from utils.api_key_verifier import api_key_verifier


class ApiKeyController:
    """Controller for API key verification without complex dependencies"""

    async def verify_api_key(
        self,
        token: Annotated[str, Form(description="JWT authentication token")],
        provider: Annotated[str, Form(description="Provider name (openai, anthropic, gemini)")],
        api_key: Annotated[str, Form(description="API key to verify")]
    ) -> dict:
        """Verify API key without saving it"""
        try:
            # For now, skip JWT validation to avoid model import issues
            # TODO: Add proper JWT validation once Pydantic issues are resolved
            
            # Validate provider
            valid_providers = ["openai", "anthropic", "gemini"]
            if provider not in valid_providers:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid provider. Valid providers: {', '.join(valid_providers)}"
                )
            
            # Verify the API key
            is_valid = api_key_verifier.verify_api_key(provider, api_key)
            
            response = {
                "success": True,
                "provider": provider,
                "is_valid": is_valid,
                "message": "API key is valid" if is_valid else "API key is invalid"
            }
            
            # Optionally get available models if key is valid
            if is_valid:
                try:
                    available_models = api_key_verifier.get_valid_models_for_provider(provider, api_key)
                    response["available_models"] = available_models[:10]  # Limit to first 10 models
                except Exception as e:
                    print(f"Could not fetch models for {provider}: {e}")
                    response["available_models"] = []
            
            return response
            
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))


# Global instance
api_key_controller = ApiKeyController() 