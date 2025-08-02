from jose import jwt, JWTError, ExpiredSignatureError
from datetime import datetime, timedelta
from models.user import User
from beanie.operators import Or
from fastapi import HTTPException, Header
import os

from typing import Optional

JWT_SECRET = os.getenv("JWT_SECRET", "your-super-secret")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
JWT_EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", 120))  # Default to 120 minutes


async def create_jwt_token(identifier: str):
    # Fetch user from DB using either email or username
    user = await User.find_one(
        Or(User.email == identifier, User.username == identifier)
    )
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Set expiry
    expire = datetime.utcnow() + timedelta(minutes=JWT_EXPIRE_MINUTES)

    # JWT payload with custom claims
    jwt_payload = {
        "_id": str(user.id),
        "email": user.email,
        "username": user.username,
        "exp": expire
    }
    
    token = jwt.encode(jwt_payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
    return token, int(expire.timestamp())

#middleware to decode JWT token from request headers
async def get_current_user(authorization: Optional[str] = Header(None)) -> Optional[User]:
    if not authorization or not authorization.startswith("Bearer "):
        return None  # No token → allow anonymous access

    token = authorization.split(" ")[1]

    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token payload")
        
        user = await User.get(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        return user

    except ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")