"""
Example routes demonstrating how to use the new auth middleware.
This shows different authentication patterns you can use in your codebase.
"""

from fastapi import APIRouter, Form, Depends, HTTPException
from typing import Annotated, Optional, Dict, Any, Tuple
from utils.auth_middleware import (
    require_auth, 
    require_auth_form, 
    require_auth_header,
    optional_auth,
    get_current_user_flexible
)
from schemas.response_schemas import ErrorResponse

router = APIRouter(prefix="/example-auth")

# Example 1: Using the flexible auth dependency (supports both form and header)
@router.post(
    "/flexible-auth",
    summary="Example with flexible authentication",
    description="Supports both JWT token in form data and Authorization header",
    responses={
        200: {"description": "Success"},
        401: {"model": ErrorResponse, "description": "Unauthorized"}
    }
)
async def example_flexible_auth(
    auth_result: Tuple[str, Dict[str, Any]] = Depends(require_auth),
    message: str = Form(default="Hello World")
):
    """
    Example endpoint that requires authentication but accepts JWT token from:
    1. Form data: jwt_token field
    2. Authorization header: Bearer <token>
    """
    user_id, user_data = auth_result
    
    return {
        "message": f"{message} from user {user_data.get('username', 'Unknown')}",
        "user_id": user_id,
        "auth_method": user_data.get("auth_method"),
        "user_email": user_data.get("email")
    }

# Example 2: Form-based auth only (existing pattern in your codebase)
@router.post(
    "/form-auth-only",
    summary="Example with form-based authentication only",
    description="Requires JWT token in form data (backward compatible)",
    responses={
        200: {"description": "Success"},
        401: {"model": ErrorResponse, "description": "Unauthorized"}
    }
)
async def example_form_auth_only(
    auth_result: Tuple[str, Dict[str, Any]] = Depends(require_auth_form),
    message: str = Form(default="Hello from form auth")
):
    """
    Example endpoint that requires JWT token only from form data.
    This maintains backward compatibility with your existing routes.
    """
    user_id, user_data = auth_result
    
    return {
        "message": f"{message} from user {user_data.get('username', 'Unknown')}",
        "user_id": user_id,
        "auth_method": "jwt_token_form",
        "user_email": user_data.get("email")
    }

# Example 3: Header-based auth only (new REST API pattern)
@router.get(
    "/header-auth-only",
    summary="Example with header-based authentication only",
    description="Requires JWT token in Authorization header",
    responses={
        200: {"description": "Success"},
        401: {"model": ErrorResponse, "description": "Unauthorized"}
    }
)
async def example_header_auth_only(
    auth_result: Tuple[str, Dict[str, Any]] = Depends(require_auth_header)
):
    """
    Example endpoint that requires JWT token only from Authorization header.
    This follows standard REST API authentication patterns.
    """
    user_id, user_data = auth_result
    
    return {
        "message": f"Hello from header auth, {user_data.get('username', 'Unknown')}",
        "user_id": user_id,
        "auth_method": "jwt_token_header",
        "user_email": user_data.get("email")
    }

# Example 4: Optional authentication
@router.post(
    "/optional-auth",
    summary="Example with optional authentication",
    description="Works with or without authentication",
    responses={
        200: {"description": "Success"}
    }
)
async def example_optional_auth(
    auth_result: Tuple[Optional[str], bool, Optional[Dict[str, Any]]] = Depends(optional_auth),
    message: str = Form(default="Hello World")
):
    """
    Example endpoint that works with or without authentication.
    Provides different responses based on authentication status.
    """
    user_id, is_authenticated, user_data = auth_result
    
    if is_authenticated:
        return {
            "message": f"{message} from authenticated user {user_data.get('username', 'Unknown')}",
            "user_id": user_id,
            "is_authenticated": True,
            "auth_method": user_data.get("auth_method"),
            "user_email": user_data.get("email")
        }
    else:
        return {
            "message": f"{message} from anonymous user",
            "user_id": None,
            "is_authenticated": False,
            "auth_method": None
        }

# Example 5: Manual authentication check (like your current pattern)
@router.post(
    "/manual-auth-check",
    summary="Example with manual authentication check",
    description="Demonstrates manual token validation (similar to your current pattern)",
    responses={
        200: {"description": "Success"},
        401: {"model": ErrorResponse, "description": "Unauthorized"}
    }
)
async def example_manual_auth_check(
    jwt_token: Optional[str] = Form(None, description="JWT authentication token"),
    message: str = Form(default="Hello World")
):
    """
    Example showing how to manually check authentication.
    This is similar to your current pattern but using the new middleware functions.
    """
    user_id, is_authenticated, user_data = await get_current_user_flexible(jwt_token=jwt_token)
    
    if not is_authenticated:
        raise HTTPException(
            status_code=401,
            detail="Authentication required. Please provide a valid JWT token."
        )
    
    return {
        "message": f"{message} from user {user_data.get('username', 'Unknown')}",
        "user_id": user_id,
        "user_email": user_data.get("email"),
        "manual_check": True
    }
