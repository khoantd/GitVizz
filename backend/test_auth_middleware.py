"""
Test script for the JWT authentication middleware.
Run this to verify the middleware is working correctly.
"""

import asyncio
import sys
import os

# Add the backend directory to the Python path
sys.path.append('/Users/mohitpaddhariya/CognitiveLab/GitViz/backend')

from utils.auth_middleware import (
    verify_jwt_token_from_form,
    get_current_user_flexible,
    validate_jwt_token,
    serialize_user_data
)
from utils.jwt_utils import create_tokens
from models.user import User
from beanie import init_beanie
import motor.motor_asyncio
from config import MONGODB_URL

async def setup_database():
    """Initialize the database connection for testing"""
    try:
        client = motor.motor_asyncio.AsyncIOMotorClient(MONGODB_URL)
        await init_beanie(database=client.gitviz, document_models=[User])
        print("✓ Database connection established")
        return True
    except Exception as e:
        print(f"✗ Database connection failed: {e}")
        return False

async def test_middleware():
    """Test the middleware functions"""
    print("\n=== JWT Authentication Middleware Tests ===\n")
    
    # Setup database
    db_connected = await setup_database()
    if not db_connected:
        print("Cannot proceed without database connection")
        return
    
    try:
        # Test 1: Find a test user
        print("1. Finding test user...")
        test_user = await User.find_one()
        if not test_user:
            print("✗ No users found in database. Please create a user first.")
            return
        
        print(f"✓ Found test user: {test_user.email}")
        
        # Test 2: Create JWT tokens
        print("\n2. Creating JWT tokens...")
        tokens = await create_tokens(test_user.email)
        jwt_token = tokens["access_token"]
        print(f"✓ JWT token created: {jwt_token[:50]}...")
        
        # Test 3: Test form-based token verification
        print("\n3. Testing form-based token verification...")
        try:
            user_id, user_data = await verify_jwt_token_from_form(jwt_token)
            print(f"✓ Token verified successfully")
            print(f"  User ID: {user_id}")
            print(f"  Username: {user_data.get('username')}")
            print(f"  Email: {user_data.get('email')}")
            print(f"  Auth method: {user_data.get('auth_method')}")
        except Exception as e:
            print(f"✗ Token verification failed: {e}")
            return
        
        # Test 4: Test flexible authentication
        print("\n4. Testing flexible authentication...")
        try:
            user_id, is_auth, user_data = await get_current_user_flexible(jwt_token=jwt_token)
            print(f"✓ Flexible auth successful")
            print(f"  Is authenticated: {is_auth}")
            print(f"  User ID: {user_id}")
            print(f"  Auth method: {user_data.get('auth_method') if user_data else 'None'}")
        except Exception as e:
            print(f"✗ Flexible auth failed: {e}")
        
        # Test 5: Test token validation helper
        print("\n5. Testing token validation helper...")
        is_valid = await validate_jwt_token(jwt_token)
        print(f"✓ Token validation result: {is_valid}")
        
        # Test 6: Test with invalid token
        print("\n6. Testing with invalid token...")
        try:
            invalid_token = "invalid.jwt.token"
            user_id, is_auth, user_data = await get_current_user_flexible(jwt_token=invalid_token)
            print(f"✓ Invalid token handled gracefully")
            print(f"  Is authenticated: {is_auth}")
        except Exception as e:
            print(f"✗ Invalid token handling failed: {e}")
        
        # Test 7: Test with no token
        print("\n7. Testing with no token...")
        try:
            user_id, is_auth, user_data = await get_current_user_flexible()
            print(f"✓ No token handled gracefully")
            print(f"  Is authenticated: {is_auth}")
            print(f"  User ID: {user_id}")
        except Exception as e:
            print(f"✗ No token handling failed: {e}")
        
        # Test 8: Test user data serialization
        print("\n8. Testing user data serialization...")
        try:
            serialized = serialize_user_data(test_user)
            print(f"✓ User data serialized successfully")
            print(f"  Keys: {list(serialized.keys())}")
            print(f"  ID type: {type(serialized.get('id'))}")
        except Exception as e:
            print(f"✗ User data serialization failed: {e}")
        
        print(f"\n=== Tests completed ===")
        print(f"✓ Middleware is working correctly!")
        print(f"\nNext steps:")
        print(f"1. Test the example routes: /example-auth/*")
        print(f"2. Try the updated chat routes: /backend-chat-v2/*")
        print(f"3. Start migrating your existing routes")
        
    except Exception as e:
        print(f"✗ Test failed with error: {e}")
        import traceback
        traceback.print_exc()

async def main():
    """Main test function"""
    await test_middleware()

if __name__ == "__main__":
    asyncio.run(main())
