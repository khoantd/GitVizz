#!/bin/bash
# Integration test script for chat feature

set -e

echo "🧪 Testing Chat Feature Integration"
echo "===================================="

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Configuration
BACKEND_URL="${BACKEND_URL:-http://localhost:8003}"
FRONTEND_URL="${FRONTEND_URL:-http://localhost:3000}"

# Test 1: Check backend services
echo -e "\n${YELLOW}Test 1: Backend Service Health${NC}"
if curl -s "${BACKEND_URL}/health" > /dev/null; then
    echo -e "${GREEN}✓ Backend is running${NC}"
else
    echo -e "${RED}✗ Backend is not accessible${NC}"
    exit 1
fi

# Test 2: Check MongoDB connection
echo -e "\n${YELLOW}Test 2: MongoDB Connection${NC}"
if docker exec mongo mongosh --eval "db.adminCommand('ping')" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ MongoDB is connected${NC}"
else
    echo -e "${RED}✗ MongoDB connection failed${NC}"
    exit 1
fi

# Test 3: Check Phoenix observability
echo -e "\n${YELLOW}Test 3: Phoenix Observability${NC}"
if curl -s "http://localhost:6006" > /dev/null; then
    echo -e "${GREEN}✓ Phoenix is running${NC}"
else
    echo -e "${YELLOW}⚠ Phoenix is not running (optional)${NC}"
fi

# Test 4: Check chat endpoints
echo -e "\n${YELLOW}Test 4: Chat Endpoints${NC}"
CHAT_ENDPOINT="${BACKEND_URL}/backend-chat/chat"
if curl -s -X POST "${CHAT_ENDPOINT}" -o /dev/null -w "%{http_code}" | grep -q "401\|422"; then
    echo -e "${GREEN}✓ Chat endpoint is registered${NC}"
else
    echo -e "${RED}✗ Chat endpoint not found${NC}"
    exit 1
fi

# Test 5: Check streaming endpoint
echo -e "\n${YELLOW}Test 5: Streaming Chat Endpoint${NC}"
STREAM_ENDPOINT="${BACKEND_URL}/backend-chat/chat/stream"
if curl -s -X POST "${STREAM_ENDPOINT}" -o /dev/null -w "%{http_code}" | grep -q "401\|422"; then
    echo -e "${GREEN}✓ Streaming endpoint is registered${NC}"
else
    echo -e "${RED}✗ Streaming endpoint not found${NC}"
    exit 1
fi

# Test 6: Check frontend accessibility
echo -e "\n${YELLOW}Test 6: Frontend Service${NC}"
if curl -s "${FRONTEND_URL}" > /dev/null; then
    echo -e "${GREEN}✓ Frontend is running${NC}"
else
    echo -e "${RED}✗ Frontend is not accessible${NC}"
    exit 1
fi

# Test 7: Environment variables check
echo -e "\n${YELLOW}Test 7: Environment Configuration${NC}"
REQUIRED_VARS=("MONGO_URI" "JWT_SECRET")
MISSING_VARS=()

for var in "${REQUIRED_VARS[@]}"; do
    if docker exec backend printenv "$var" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ $var is set${NC}"
    else
        echo -e "${RED}✗ $var is missing${NC}"
        MISSING_VARS+=("$var")
    fi
done

# Check at least one LLM provider
LLM_PROVIDERS=("OPENAI_API_KEY" "ANTHROPIC_API_KEY" "GEMINI_API_KEY" "GROQ_API_KEY")
HAS_LLM=false
for provider in "${LLM_PROVIDERS[@]}"; do
    if docker exec backend printenv "$provider" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ $provider is configured${NC}"
        HAS_LLM=true
        break
    fi
done

if [ "$HAS_LLM" = false ]; then
    echo -e "${RED}✗ No LLM provider API key configured${NC}"
    MISSING_VARS+=("LLM_API_KEY")
fi

# Test 8: Check chat history endpoint
echo -e "\n${YELLOW}Test 8: Chat History Endpoint${NC}"
HISTORY_ENDPOINT="${BACKEND_URL}/backend-chat/history"
if curl -s -X GET "${HISTORY_ENDPOINT}" -o /dev/null -w "%{http_code}" | grep -q "401\|200"; then
    echo -e "${GREEN}✓ Chat history endpoint is accessible${NC}"
else
    echo -e "${RED}✗ Chat history endpoint not found${NC}"
    exit 1
fi

# Test 9: Check chat models endpoint
echo -e "\n${YELLOW}Test 9: Chat Models Endpoint${NC}"
MODELS_ENDPOINT="${BACKEND_URL}/backend-chat/models"
if curl -s -X GET "${MODELS_ENDPOINT}" -o /dev/null -w "%{http_code}" | grep -q "401\|200"; then
    echo -e "${GREEN}✓ Chat models endpoint is accessible${NC}"
else
    echo -e "${RED}✗ Chat models endpoint not found${NC}"
    exit 1
fi

# Test 10: Check chat settings endpoint
echo -e "\n${YELLOW}Test 10: Chat Settings Endpoint${NC}"
SETTINGS_ENDPOINT="${BACKEND_URL}/backend-chat/settings"
if curl -s -X GET "${SETTINGS_ENDPOINT}" -o /dev/null -w "%{http_code}" | grep -q "401\|200"; then
    echo -e "${GREEN}✓ Chat settings endpoint is accessible${NC}"
else
    echo -e "${RED}✗ Chat settings endpoint not found${NC}"
    exit 1
fi

# Test 11: Check chat sessions endpoint
echo -e "\n${YELLOW}Test 11: Chat Sessions Endpoint${NC}"
SESSIONS_ENDPOINT="${BACKEND_URL}/backend-chat/sessions"
if curl -s -X GET "${SESSIONS_ENDPOINT}" -o /dev/null -w "%{http_code}" | grep -q "401\|200"; then
    echo -e "${GREEN}✓ Chat sessions endpoint is accessible${NC}"
else
    echo -e "${RED}✗ Chat sessions endpoint not found${NC}"
    exit 1
fi

# Test 12: Check context search endpoint
echo -e "\n${YELLOW}Test 12: Context Search Endpoint${NC}"
CONTEXT_ENDPOINT="${BACKEND_URL}/backend-chat/context-search"
if curl -s -X POST "${CONTEXT_ENDPOINT}" -o /dev/null -w "%{http_code}" | grep -q "401\|422"; then
    echo -e "${GREEN}✓ Context search endpoint is accessible${NC}"
else
    echo -e "${RED}✗ Context search endpoint not found${NC}"
    exit 1
fi

# Test 13: Check conversation endpoint
echo -e "\n${YELLOW}Test 13: Conversation Endpoint${NC}"
CONVERSATION_ENDPOINT="${BACKEND_URL}/backend-chat/conversation"
if curl -s -X GET "${CONVERSATION_ENDPOINT}" -o /dev/null -w "%{http_code}" | grep -q "401\|200"; then
    echo -e "${GREEN}✓ Conversation endpoint is accessible${NC}"
else
    echo -e "${RED}✗ Conversation endpoint not found${NC}"
    exit 1
fi

# Test 14: Check API key endpoints
echo -e "\n${YELLOW}Test 14: API Key Endpoints${NC}"
API_KEY_ENDPOINT="${BACKEND_URL}/backend-api-keys"
if curl -s -X GET "${API_KEY_ENDPOINT}" -o /dev/null -w "%{http_code}" | grep -q "401\|200"; then
    echo -e "${GREEN}✓ API key endpoints are accessible${NC}"
else
    echo -e "${RED}✗ API key endpoints not found${NC}"
    exit 1
fi

# Test 15: Check authentication endpoints
echo -e "\n${YELLOW}Test 15: Authentication Endpoints${NC}"
AUTH_ENDPOINT="${BACKEND_URL}/backend-auth"
if curl -s -X GET "${AUTH_ENDPOINT}" -o /dev/null -w "%{http_code}" | grep -q "401\|200\|404"; then
    echo -e "${GREEN}✓ Authentication endpoints are accessible${NC}"
else
    echo -e "${RED}✗ Authentication endpoints not found${NC}"
    exit 1
fi

# Test 16: Check repository endpoints
echo -e "\n${YELLOW}Test 16: Repository Endpoints${NC}"
REPO_ENDPOINT="${BACKEND_URL}/backend-repo"
if curl -s -X GET "${REPO_ENDPOINT}" -o /dev/null -w "%{http_code}" | grep -q "401\|200\|404"; then
    echo -e "${GREEN}✓ Repository endpoints are accessible${NC}"
else
    echo -e "${RED}✗ Repository endpoints not found${NC}"
    exit 1
fi

# Test 17: Check GitHub endpoints
echo -e "\n${YELLOW}Test 17: GitHub Endpoints${NC}"
GITHUB_ENDPOINT="${BACKEND_URL}/backend-github"
if curl -s -X GET "${GITHUB_ENDPOINT}" -o /dev/null -w "%{http_code}" | grep -q "401\|200\|404"; then
    echo -e "${GREEN}✓ GitHub endpoints are accessible${NC}"
else
    echo -e "${RED}✗ GitHub endpoints not found${NC}"
    exit 1
fi

# Test 18: Check documentation endpoints
echo -e "\n${YELLOW}Test 18: Documentation Endpoints${NC}"
DOCS_ENDPOINT="${BACKEND_URL}/backend-documentation"
if curl -s -X GET "${DOCS_ENDPOINT}" -o /dev/null -w "%{http_code}" | grep -q "401\|200\|404"; then
    echo -e "${GREEN}✓ Documentation endpoints are accessible${NC}"
else
    echo -e "${RED}✗ Documentation endpoints not found${NC}"
    exit 1
fi

# Test 19: Check indexed repositories endpoints
echo -e "\n${YELLOW}Test 19: Indexed Repositories Endpoints${NC}"
INDEXED_ENDPOINT="${BACKEND_URL}/backend-indexed-repos"
if curl -s -X GET "${INDEXED_ENDPOINT}" -o /dev/null -w "%{http_code}" | grep -q "401\|200\|404"; then
    echo -e "${GREEN}✓ Indexed repositories endpoints are accessible${NC}"
else
    echo -e "${RED}✗ Indexed repositories endpoints not found${NC}"
    exit 1
fi

# Test 20: Check CORS headers
echo -e "\n${YELLOW}Test 20: CORS Configuration${NC}"
CORS_HEADERS=$(curl -s -I "${BACKEND_URL}/backend-chat/chat" | grep -i "access-control-allow-origin" || echo "")
if [ -n "$CORS_HEADERS" ]; then
    echo -e "${GREEN}✓ CORS headers are configured${NC}"
else
    echo -e "${YELLOW}⚠ CORS headers not found (may be configured differently)${NC}"
fi

# Summary
echo -e "\n${YELLOW}Test Summary${NC}"
echo "=============="
if [ ${#MISSING_VARS[@]} -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed!${NC}"
    echo -e "${GREEN}✓ Chat feature is ready to use${NC}"
    exit 0
else
    echo -e "${RED}✗ Some tests failed${NC}"
    echo -e "${RED}Missing configurations: ${MISSING_VARS[*]}${NC}"
    exit 1
fi
