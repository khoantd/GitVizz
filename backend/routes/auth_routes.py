from fastapi import APIRouter
from schemas.auth_schemas import LoginResponse
from schemas.response_schemas import ErrorResponse
from controllers.auth_controller import login_user


router = APIRouter(prefix="/backend-auth")

router.post(
    "/login",
    response_model=LoginResponse,
    summary="Authenticate via GitHub access token",
    description="Accepts a GitHub access token, fetches user profile from GitHub, creates a new user if not existing, and returns a JWT access token.",
    response_description="A valid JWT token along with user metadata.",
    responses={
        200: {
            "model": LoginResponse,
            "description": "Login successful. Returns JWT and user ID."
        },
        400: {
            "model": ErrorResponse,
            "description": "Bad request. GitHub token is invalid or does not return required user data (email/username)."
        },
        401: {
            "model": ErrorResponse,
            "description": "Unauthorized. GitHub token is invalid or expired."
        },
        500: {
            "model": ErrorResponse,
            "description": "Internal server error."
        },
    },
)(login_user)