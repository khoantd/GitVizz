"""
Authentication middleware for JWT token validation.
This middleware follows the existing codebase pattern where JWT tokens are received
in the request body/form data instead of Authorization headers.
"""

from fastapi import HTTPException, Request, Depends, Form
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional, Dict, Any, Tuple, Union
from models.user import User
from utils.jwt_utils import get_current_user
from datetime import datetime
from beanie import PydanticObjectId
import json


class OptionalHTTPBearer(HTTPBearer):
    """
    HTTPBearer security scheme that makes the Authorization header optional.
    This allows endpoints to accept both authenticated and unauthenticated requests.
    """
    def __init__(self, auto_error: bool = False):
        super().__init__(auto_error=auto_error)

    async def __call__(self, request: Request):
        try:
            return await super().__call__(request)
        except HTTPException:
            # Return None if no valid Authorization header is present
            return None


# Create instances of security schemes
security = HTTPBearer()
optional_security = OptionalHTTPBearer()


def serialize_user_data(user: User) -> Dict[str, Any]:
    """
    Convert User model to JSON serializable format.
    Handles ObjectId conversion and other non-serializable types.
    """
    if user is None:
        return None
        
    user_dict = user.dict()
    
    # Convert ObjectId to string
    if "_id" in user_dict and isinstance(user_dict["_id"], PydanticObjectId):
        user_dict["_id"] = str(user_dict["_id"])
    if "id" in user_dict and isinstance(user_dict["id"], PydanticObjectId):
        user_dict["id"] = str(user_dict["id"])
    
    # Convert datetime objects to ISO format
    for key, value in user_dict.items():
        if isinstance(value, datetime):
            user_dict[key] = value.isoformat()
    
    return user_dict


async def verify_jwt_token_from_form(jwt_token: str) -> Tuple[str, Dict[str, Any]]:
    """
    Verify JWT token from form data and return user information.
    This follows the existing pattern in the codebase.
    
    Args:
        jwt_token: The JWT token from form data
        
    Returns:
        Tuple of (user_id, user_data)
        
    Raises:
        HTTPException: If token is invalid or user is not found
    """
    try:
        # Use existing JWT validation function
        user = await get_current_user(jwt_token)
        
        if not user:
            raise HTTPException(
                status_code=401,
                detail="Invalid or expired JWT token"
            )
        
        # Serialize user data
        user_data = serialize_user_data(user)
        user_data["auth_method"] = "jwt_token"
        
        return str(user.id), user_data
        
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        raise HTTPException(
            status_code=401,
            detail=f"JWT token validation failed: {str(e)}"
        )


async def verify_jwt_token_from_header(
    credentials: HTTPAuthorizationCredentials
) -> Tuple[str, Dict[str, Any]]:
    """
    Verify JWT token from Authorization header.
    This provides compatibility with standard JWT header authentication.
    
    Args:
        credentials: HTTPAuthorizationCredentials from FastAPI security
        
    Returns:
        Tuple of (user_id, user_data)
        
    Raises:
        HTTPException: If token is invalid or user is not found
    """
    token = credentials.credentials
    return await verify_jwt_token_from_form(token)


async def get_current_user_flexible(
    # For form-based authentication (existing pattern)
    jwt_token: Optional[str] = None,
    # For header-based authentication (new pattern)
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(optional_security)
) -> Tuple[Optional[str], bool, Optional[Dict[str, Any]]]:
    """
    Flexible authentication middleware that supports both form-based and header-based JWT tokens.
    
    Priority:
    1. JWT token from form data (existing pattern)
    2. JWT token from Authorization header (new pattern)
    
    Returns:
        Tuple of (user_id, is_authenticated, user_data)
        - user_id: The authenticated user's ID, or None if not authenticated
        - is_authenticated: True if the user is authenticated, False otherwise
        - user_data: User information if authenticated, or None
    """
    user_id = None
    is_authenticated = False
    user_data = None
    
    # Try form-based authentication first (existing pattern)
    if jwt_token:
        try:
            user_id, user_data = await verify_jwt_token_from_form(jwt_token)
            is_authenticated = True
            return user_id, is_authenticated, user_data
        except HTTPException:
            # If form token authentication fails, continue to header auth
            pass
    
    # Try header-based authentication (new pattern)
    if credentials:
        try:
            user_id, user_data = await verify_jwt_token_from_header(credentials)
            is_authenticated = True
            return user_id, is_authenticated, user_data
        except HTTPException:
            # If header authentication fails, return unauthenticated
            pass
    
    # If no authentication method succeeds, return unauthenticated
    return None, False, None


class AuthDependency:
    """
    Dependency class to create various authentication requirements for FastAPI routes.
    This provides a clean interface similar to the reference middleware you provided.
    """
    
    @staticmethod
    async def require_auth(
        auth_result: Tuple[Optional[str], bool, Optional[Dict[str, Any]]] = Depends(get_current_user_flexible)
    ) -> Tuple[str, Dict[str, Any]]:
        """
        Requires authentication for a route. Raises HTTPException if not authenticated.
        
        Returns:
            Tuple[str, Dict[str, Any]]: (user_id, user_data)
        """
        user_id, is_authenticated, user_data = auth_result
        
        if not is_authenticated or not user_id:
            raise HTTPException(
                status_code=401,
                detail="Authentication required. Please provide a valid JWT token.",
                headers={"WWW-Authenticate": "Bearer"}
            )
        
        return user_id, user_data
    
    @staticmethod
    async def require_auth_form(
        jwt_token: str = Form(..., description="JWT authentication token")
    ) -> Tuple[str, Dict[str, Any]]:
        """
        Requires authentication via form data (existing pattern in your codebase).
        Use this for routes that need to maintain backward compatibility.
        
        Returns:
            Tuple[str, Dict[str, Any]]: (user_id, user_data)
        """
        try:
            return await verify_jwt_token_from_form(jwt_token)
        except HTTPException:
            raise
    
    @staticmethod
    async def require_auth_header(
        credentials: HTTPAuthorizationCredentials = Depends(security)
    ) -> Tuple[str, Dict[str, Any]]:
        """
        Requires authentication via Authorization header (new pattern).
        Use this for new routes that follow REST API standards.
        
        Returns:
            Tuple[str, Dict[str, Any]]: (user_id, user_data)
        """
        try:
            return await verify_jwt_token_from_header(credentials)
        except HTTPException:
            raise
    
    @staticmethod
    async def optional_auth(
        auth_result: Tuple[Optional[str], bool, Optional[Dict[str, Any]]] = Depends(get_current_user_flexible)
    ) -> Tuple[Optional[str], bool, Optional[Dict[str, Any]]]:
        """
        Optional authentication for a route. Does not raise exceptions if not authenticated.
        
        Returns:
            The original auth_result tuple: (user_id, is_authenticated, user_data)
        """
        return auth_result


# Create auth dependency instances for convenience
require_auth = AuthDependency.require_auth
require_auth_form = AuthDependency.require_auth_form
require_auth_header = AuthDependency.require_auth_header
optional_auth = AuthDependency.optional_auth


# Legacy compatibility functions to match your existing pattern
async def get_user_from_jwt_token(jwt_token: str) -> User:
    """
    Legacy compatibility function that matches your existing pattern.
    Use the new middleware dependencies instead for new code.
    """
    user_id, user_data = await verify_jwt_token_from_form(jwt_token)
    return await User.get(user_id)


async def validate_jwt_token(jwt_token: str) -> bool:
    """
    Simple validation function that returns True if token is valid, False otherwise.
    """
    try:
        await verify_jwt_token_from_form(jwt_token)
        return True
    except:
        return False
