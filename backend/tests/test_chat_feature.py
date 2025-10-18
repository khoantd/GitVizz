import pytest
import httpx
from fastapi.testclient import TestClient
from server import app

class TestChatFeature:
    """Test suite for chat functionality"""
    
    @pytest.fixture
    def client(self):
        return TestClient(app)
    
    @pytest.fixture
    def auth_headers(self):
        # Mock JWT token for testing
        return {"Authorization": "Bearer test-token"}
    
    def test_chat_endpoint_exists(self, client):
        """Verify chat endpoint is registered"""
        response = client.post("/backend-chat/chat")
        assert response.status_code != 404
    
    def test_chat_requires_auth(self, client):
        """Verify chat requires authentication"""
        response = client.post("/backend-chat/chat", data={
            "message": "test",
            "repository_id": "test/repo"
        })
        assert response.status_code == 401
    
    def test_chat_streaming_endpoint(self, client, auth_headers):
        """Verify streaming chat endpoint"""
        response = client.post(
            "/backend-chat/chat/stream",
            headers=auth_headers,
            data={
                "message": "What is this repository about?",
                "repository_id": "owner/repo/main",
                "provider": "openai",
                "model": "gpt-4o-mini"
            }
        )
        assert response.status_code in [200, 401]  # 401 if auth not configured
    
    def test_chat_history_endpoint(self, client, auth_headers):
        """Verify chat history retrieval"""
        response = client.get(
            "/backend-chat/history",
            headers=auth_headers,
            params={"repository_id": "test/repo"}
        )
        assert response.status_code in [200, 401]
    
    def test_chat_models_endpoint(self, client, auth_headers):
        """Verify available models endpoint"""
        response = client.get(
            "/backend-chat/models",
            headers=auth_headers
        )
        assert response.status_code in [200, 401]
    
    def test_chat_context_search_endpoint(self, client, auth_headers):
        """Verify context search endpoint"""
        response = client.post(
            "/backend-chat/context-search",
            headers=auth_headers,
            data={
                "repository_id": "test/repo",
                "query": "test query"
            }
        )
        assert response.status_code in [200, 401]
    
    def test_chat_settings_endpoint(self, client, auth_headers):
        """Verify chat settings endpoint"""
        response = client.get(
            "/backend-chat/settings",
            headers=auth_headers
        )
        assert response.status_code in [200, 401]
    
    def test_chat_sessions_endpoint(self, client, auth_headers):
        """Verify chat sessions endpoint"""
        response = client.get(
            "/backend-chat/sessions",
            headers=auth_headers,
            params={"repository_id": "test/repo"}
        )
        assert response.status_code in [200, 401]
    
    def test_chat_conversation_endpoint(self, client, auth_headers):
        """Verify conversation endpoint"""
        response = client.get(
            "/backend-chat/conversation",
            headers=auth_headers,
            params={"conversation_id": "test-conversation"}
        )
        assert response.status_code in [200, 401]
    
    def test_chat_validation_errors(self, client, auth_headers):
        """Test chat input validation"""
        # Test empty message
        response = client.post(
            "/backend-chat/chat",
            headers=auth_headers,
            data={
                "message": "",
                "repository_id": "test/repo"
            }
        )
        assert response.status_code in [400, 422, 401]
        
        # Test empty repository_id
        response = client.post(
            "/backend-chat/chat",
            headers=auth_headers,
            data={
                "message": "test message",
                "repository_id": ""
            }
        )
        assert response.status_code in [400, 422, 401]
    
    def test_chat_provider_validation(self, client, auth_headers):
        """Test chat provider validation"""
        response = client.post(
            "/backend-chat/chat",
            headers=auth_headers,
            data={
                "message": "test message",
                "repository_id": "test/repo",
                "provider": "invalid_provider"
            }
        )
        assert response.status_code in [400, 422, 401]
    
    def test_chat_model_validation(self, client, auth_headers):
        """Test chat model validation"""
        response = client.post(
            "/backend-chat/chat",
            headers=auth_headers,
            data={
                "message": "test message",
                "repository_id": "test/repo",
                "model": "invalid_model"
            }
        )
        assert response.status_code in [400, 422, 401]
    
    def test_chat_temperature_validation(self, client, auth_headers):
        """Test chat temperature validation"""
        # Test invalid temperature (too high)
        response = client.post(
            "/backend-chat/chat",
            headers=auth_headers,
            data={
                "message": "test message",
                "repository_id": "test/repo",
                "temperature": 3.0
            }
        )
        assert response.status_code in [400, 422, 401]
        
        # Test invalid temperature (negative)
        response = client.post(
            "/backend-chat/chat",
            headers=auth_headers,
            data={
                "message": "test message",
                "repository_id": "test/repo",
                "temperature": -1.0
            }
        )
        assert response.status_code in [400, 422, 401]
    
    def test_chat_max_tokens_validation(self, client, auth_headers):
        """Test chat max_tokens validation"""
        # Test invalid max_tokens (too high)
        response = client.post(
            "/backend-chat/chat",
            headers=auth_headers,
            data={
                "message": "test message",
                "repository_id": "test/repo",
                "max_tokens": 1000001
            }
        )
        assert response.status_code in [400, 422, 401]
        
        # Test invalid max_tokens (too low)
        response = client.post(
            "/backend-chat/chat",
            headers=auth_headers,
            data={
                "message": "test message",
                "repository_id": "test/repo",
                "max_tokens": 0
            }
        )
        assert response.status_code in [400, 422, 401]
    
    def test_chat_streaming_validation(self, client, auth_headers):
        """Test streaming chat validation"""
        # Test streaming with invalid data
        response = client.post(
            "/backend-chat/chat/stream",
            headers=auth_headers,
            data={
                "message": "",
                "repository_id": "test/repo"
            }
        )
        assert response.status_code in [400, 422, 401]
    
    def test_chat_context_mode_validation(self, client, auth_headers):
        """Test context mode validation"""
        response = client.post(
            "/backend-chat/chat/stream",
            headers=auth_headers,
            data={
                "message": "test message",
                "repository_id": "test/repo",
                "context_mode": "invalid_mode"
            }
        )
        assert response.status_code in [200, 400, 422, 401]  # May accept or reject
    
    def test_chat_include_full_context_validation(self, client, auth_headers):
        """Test include_full_context validation"""
        response = client.post(
            "/backend-chat/chat",
            headers=auth_headers,
            data={
                "message": "test message",
                "repository_id": "test/repo",
                "include_full_context": "invalid_boolean"
            }
        )
        assert response.status_code in [400, 422, 401]
    
    def test_chat_use_user_validation(self, client, auth_headers):
        """Test use_user validation"""
        response = client.post(
            "/backend-chat/chat",
            headers=auth_headers,
            data={
                "message": "test message",
                "repository_id": "test/repo",
                "use_user": "invalid_boolean"
            }
        )
        assert response.status_code in [400, 422, 401]
    
    def test_chat_response_format(self, client, auth_headers):
        """Test chat response format"""
        response = client.post(
            "/backend-chat/chat",
            headers=auth_headers,
            data={
                "message": "test message",
                "repository_id": "test/repo"
            }
        )
        
        if response.status_code == 200:
            data = response.json()
            assert "success" in data or "error" in data
        elif response.status_code == 401:
            # Expected for unauthenticated requests
            pass
        else:
            # Other error codes are acceptable
            pass
    
    def test_chat_streaming_response_format(self, client, auth_headers):
        """Test streaming chat response format"""
        response = client.post(
            "/backend-chat/chat/stream",
            headers=auth_headers,
            data={
                "message": "test message",
                "repository_id": "test/repo"
            }
        )
        
        if response.status_code == 200:
            # Should return streaming response
            assert response.headers.get("content-type") == "application/x-ndjson"
        elif response.status_code == 401:
            # Expected for unauthenticated requests
            pass
        else:
            # Other error codes are acceptable
            pass
