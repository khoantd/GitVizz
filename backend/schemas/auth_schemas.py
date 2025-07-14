from pydantic import BaseModel
import os
from dotenv import load_dotenv

class LoginRequest(BaseModel):
    access_token: str
    
load_dotenv()

class LoginResponse(BaseModel):
    jwt_token: str
    expires_in: int
    user_id: str
    token_type: str = "bearer"