from beanie import Document
from pydantic import EmailStr
from typing import Optional
from datetime import datetime


class User(Document):
    fullname: str
    username: str
    email: EmailStr
    github_access_token: str
    profile_picture: Optional[str] = None
    created_at: datetime = datetime.utcnow()
    updated_at: datetime = datetime.utcnow()

    class Settings:
        name = "users"  # MongoDB collection name