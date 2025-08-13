# JWT Authentication Middleware Documentation

## Overview

This middleware provides a flexible JWT authentication system that supports both your existing pattern (JWT tokens in form data) and standard REST API authentication (JWT tokens in Authorization headers).

## Key Features

1. **Backward Compatibility**: Maintains compatibility with your existing routes that use `jwt_token` in form data
2. **Standard REST Support**: Adds support for Authorization header authentication
3. **Flexible Authentication**: Single middleware that supports both patterns
4. **Clean Dependencies**: Provides FastAPI dependencies for different authentication requirements
5. **Type Safety**: Full type annotations for better IDE support and error catching

## Understanding Your Current Pattern

Your current codebase follows this pattern:

```python
async def some_endpoint(
    jwt_token: str = Form(..., description="JWT authentication token"),
    other_param: str = Form(...)
):
    user = await get_current_user(jwt_token)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    # ... rest of logic
```

## What the New Middleware Returns

The middleware provides three pieces of information:

1. **user_id**: String ID of the authenticated user
2. **is_authenticated**: Boolean indicating if user is authenticated
3. **user_data**: Dictionary containing user information

```python
user_data = {
    "_id": "user_object_id",
    "id": "user_object_id", 
    "email": "user@example.com",
    "username": "username",
    "fullname": "User Full Name",
    "profile_picture": "avatar_url",
    "auth_method": "jwt_token"  # or "jwt_token_form" or "jwt_token_header"
    # ... other user fields
}
```

## Usage Patterns

### 1. Flexible Authentication (Recommended for new routes)

Supports both form data and Authorization header:

```python
from utils.auth_middleware import require_auth

@router.post("/api/endpoint")
async def my_endpoint(
    auth_result: Tuple[str, Dict[str, Any]] = Depends(require_auth),
    message: str = Form(...)
):
    user_id, user_data = auth_result
    # User is guaranteed to be authenticated
    return {"user_id": user_id, "email": user_data["email"]}
```

**Client can send JWT token either way:**
- Form data: `{"jwt_token": "eyJ...", "message": "hello"}`
- Authorization header: `Authorization: Bearer eyJ...` + form data: `{"message": "hello"}`

### 2. Form-Only Authentication (Backward Compatible)

Maintains exact compatibility with your existing pattern:

```python
from utils.auth_middleware import require_auth_form

@router.post("/api/endpoint")
async def my_endpoint(
    auth_result: Tuple[str, Dict[str, Any]] = Depends(require_auth_form),
    message: str = Form(...)
):
    user_id, user_data = auth_result
    # User is guaranteed to be authenticated via form data only
    return {"user_id": user_id}
```

**Client must send:** `{"jwt_token": "eyJ...", "message": "hello"}`

### 3. Header-Only Authentication (REST API Standard)

For new REST API endpoints:

```python
from utils.auth_middleware import require_auth_header

@router.get("/api/endpoint")
async def my_endpoint(
    auth_result: Tuple[str, Dict[str, Any]] = Depends(require_auth_header)
):
    user_id, user_data = auth_result
    # User is guaranteed to be authenticated via header only
    return {"user_id": user_id}
```

**Client must send:** `Authorization: Bearer eyJ...`

### 4. Optional Authentication

For endpoints that work with or without authentication:

```python
from utils.auth_middleware import optional_auth

@router.post("/api/endpoint")
async def my_endpoint(
    auth_result: Tuple[Optional[str], bool, Optional[Dict[str, Any]]] = Depends(optional_auth),
    message: str = Form(...)
):
    user_id, is_authenticated, user_data = auth_result
    
    if is_authenticated:
        return {"message": f"Hello {user_data['username']}!"}
    else:
        return {"message": "Hello anonymous user!"}
```

### 5. Manual Authentication Check (Like Your Current Pattern)

For gradual migration or special cases:

```python
from utils.auth_middleware import get_current_user_flexible

@router.post("/api/endpoint")
async def my_endpoint(
    jwt_token: Optional[str] = Form(None),
    message: str = Form(...)
):
    user_id, is_authenticated, user_data = await get_current_user_flexible(jwt_token=jwt_token)
    
    if not is_authenticated:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    # Continue with logic...
```

## Migration Strategy

### Phase 1: Add Middleware (No Breaking Changes)
1. Add the middleware file (`utils/auth_middleware.py`)
2. Keep all existing routes unchanged
3. Test the middleware with new routes

### Phase 2: Gradual Migration
1. Start with non-critical routes
2. Update route by route to use new middleware
3. Test each route thoroughly

### Phase 3: Controller Updates (Optional)
1. Update controllers to accept `user_id` instead of `jwt_token`
2. Remove redundant JWT validation from controllers
3. Simplify controller logic

## Example Migration

**Before (your current pattern):**
```python
@router.post("/chat")
async def process_chat_message(
    jwt_token: str = Form(...),
    message: str = Form(...),
    repository_id: str = Form(...)
):
    return await chat_controller.process_chat_message(
        token=jwt_token,
        message=message,
        repository_id=repository_id
    )
```

**After (with middleware):**
```python
@router.post("/chat")
async def process_chat_message(
    message: str = Form(...),
    repository_id: str = Form(...),
    auth_result: Tuple[str, Dict[str, Any]] = Depends(require_auth)
):
    user_id, user_data = auth_result
    return await chat_controller.process_chat_message(
        user_id=user_id,  # Pass user_id instead of token
        message=message,
        repository_id=repository_id
    )
```

## Error Handling

The middleware provides consistent error responses:

```json
{
    "detail": "Authentication required. Please provide a valid JWT token.",
    "status_code": 401
}
```

Common error scenarios:
- No token provided: "Authentication required"
- Invalid token: "JWT token validation failed"
- Expired token: "Token has expired"
- User not found: "User not found"

## Testing the Middleware

You can test the middleware with curl:

**Form-based authentication:**
```bash
curl -X POST "http://localhost:8000/example-auth/flexible-auth" \
  -F "jwt_token=YOUR_JWT_TOKEN" \
  -F "message=Hello World"
```

**Header-based authentication:**
```bash
curl -X POST "http://localhost:8000/example-auth/flexible-auth" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "message=Hello World"
```

## Best Practices

1. **Use `require_auth` for new routes** - provides maximum flexibility
2. **Use `require_auth_form` for existing routes** - maintains compatibility
3. **Use `require_auth_header` for REST APIs** - follows standards
4. **Use `optional_auth` for public endpoints** - graceful degradation
5. **Always handle user_data safely** - check for None values
6. **Update controllers gradually** - avoid breaking changes

## Benefits

1. **Security**: Centralized JWT validation logic
2. **Consistency**: Same authentication logic across all routes
3. **Flexibility**: Support for multiple authentication methods
4. **Maintainability**: Single place to update authentication logic
5. **Type Safety**: Full type annotations for better development experience
6. **Backward Compatibility**: No breaking changes to existing APIs
