#!/bin/bash

# GitVizz Environment Setup Script for Docker Compose
# This script helps set up the environment variables for Docker Compose deployment

echo "🚀 Setting up GitVizz environment for Docker Compose..."

# Create frontend environment file
echo "📝 Creating frontend environment configuration..."
cat > frontend/.env.local << 'EOF'
# GitVizz Frontend Environment Configuration
# Backend API URL - Use localhost for development
NEXT_PUBLIC_BACKEND_URL=http://localhost:8003

# NextAuth Configuration
NEXTAUTH_URL=http://localhost:3000
AUTH_SECRET=your-super-secret-auth-key-change-this-in-production

# GitHub OAuth (optional for development)
AUTH_GITHUB_ID=your-github-client-id
AUTH_GITHUB_SECRET=your-github-client-secret

# Development settings
NODE_ENV=development
EOF

# Create backend environment file
echo "📝 Creating backend environment configuration..."
cat > backend/.env << 'EOF'
# GitVizz Backend Environment Configuration
# MongoDB Configuration
MONGO_URI=mongodb://localhost:27017
MONGODB_DB_NAME=gitvizz

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=30

# LLM Provider API Keys
# Add your API keys here for the providers you want to use
OPENAI_API_KEY=your-openai-api-key
ANTHROPIC_API_KEY=your-anthropic-api-key
GEMINI_API_KEY=your-gemini-api-key
GROQ_API_KEY=your-groq-api-key

# Phoenix Observability
PHOENIX_COLLECTOR_ENDPOINT=http://localhost:6006/v1/traces
PHOENIX_PROJECT_NAME=gitvizz-backend

# GitHub OAuth (optional for development)
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret

# Development settings
DEBUG=true
LOG_LEVEL=info
EOF

echo "✅ Environment files created successfully!"
echo ""
echo "📋 Next steps:"
echo "1. Update the API keys in backend/.env with your actual keys"
echo "2. Update the GitHub OAuth credentials in both files"
echo "3. Change the JWT_SECRET and AUTH_SECRET to secure values"
echo "4. Run 'docker-compose up' to start the services"
echo ""
echo "🔧 For Docker deployment, the docker-compose.yaml file has been updated"
echo "   to use the correct backend URL (http://backend:8003) for internal networking."