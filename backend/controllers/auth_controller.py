import datetime
from schemas.auth_schemas import (LoginRequest, LoginResponse)
from fastapi import HTTPException, status
import httpx


from models.user import User
from utils.jwt_utils import create_jwt_token

from beanie.operators import Or

# Helper function to handle user login

async def get_github_user(access_token: str) -> dict:
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Accept": "application/vnd.github+json"
    }

    async with httpx.AsyncClient() as client:
        # Step 1: Get basic user info
        user_res = await client.get("https://api.github.com/user", headers=headers)
        if user_res.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid GitHub token")

        user_data = user_res.json()

        # Step 2: Try to get verified, primary email
        email_res = await client.get("https://api.github.com/user/emails", headers=headers)
        if email_res.status_code == 200:
            emails = email_res.json()
            for e in emails:
                if e.get("primary") and e.get("verified"):
                    user_data["email"] = e["email"]
                    break

        return {
            "fullname": user_data.get("name"),
            "username": user_data["login"],
            "email": user_data.get("email"),  # May be None if private
            "avatar_url": user_data["avatar_url"]
        }
        
async def login_user(request: LoginRequest) -> LoginResponse:
    
    # Step 1: Validate GitHub token and fetch user info
    github_user = await get_github_user(request.access_token)
    
    github_fullname = github_user.get("fullname")
    github_email = github_user.get("email")
    github_username = github_user.get("username")
    github_profile_picture = github_user.get("avatar_url")
        
    if not github_email or not github_username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="GitHub token does not provide valid email or username"
        )

    
    # Step 2: Try to find the user by email or username
    user = await User.find_one(
        Or(
            User.email == github_email,
            User.username == github_username
        )
    )
    
    # Step 3: If user doesn't exist, create a new one
    if not user:
        user = User(
            fullname=github_fullname,
            username=github_username,
            email=github_email,
            profile_picture=github_profile_picture,
            github_access_token=request.access_token
        )
        
        await user.insert()  # Save the new user to the database
        
    # Step 4: Create a JWT token for the user
    token, expires_at = await create_jwt_token(user.email)
        
    # Step 4: Return the login response with the token and user ID
    return LoginResponse(
        jwt_token=token,
        expires_in=expires_at,
        user_id=str(user.id),
    )