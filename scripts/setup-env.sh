#!/bin/bash

# GitVizz Environment Setup Script
# This script sets up environment files from templates

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEMPLATES_DIR="$PROJECT_ROOT/scripts/env-templates"

echo -e "${BLUE}🔧 GitVizz Environment Setup${NC}"
echo "=============================="

# Function to copy environment file
copy_env_file() {
    local template_file=$1
    local target_file=$2
    local service_name=$3
    
    if [ -f "$target_file" ]; then
        echo -e "${YELLOW}⚠️  $service_name environment file already exists: $target_file${NC}"
        echo "   Skipping to avoid overwriting existing configuration."
    else
        if [ -f "$template_file" ]; then
            cp "$template_file" "$target_file"
            echo -e "${GREEN}✅ Created $service_name environment file: $target_file${NC}"
        else
            echo -e "${YELLOW}⚠️  Template file not found: $template_file${NC}"
        fi
    fi
}

# Create backend environment file
echo -e "${BLUE}📝 Setting up backend environment...${NC}"
copy_env_file "$TEMPLATES_DIR/backend.env.example" "$PROJECT_ROOT/backend/.env" "Backend"

# Create frontend environment file
echo -e "${BLUE}📝 Setting up frontend environment...${NC}"
copy_env_file "$TEMPLATES_DIR/frontend.env.example" "$PROJECT_ROOT/frontend/.env.local" "Frontend"

echo ""
echo -e "${GREEN}🎉 Environment setup completed!${NC}"
echo ""
echo "📝 Next steps:"
echo "  1. Edit backend/.env and add your API keys"
echo "  2. Edit frontend/.env.local and configure authentication"
echo "  3. Run ./scripts/quick-start.sh to start the development environment"
echo ""
echo "🔑 Required API Keys (add to backend/.env):"
echo "  - OPENAI_API_KEY (for OpenAI models)"
echo "  - ANTHROPIC_API_KEY (for Claude models)"
echo "  - GEMINI_API_KEY (for Google Gemini models)"
echo "  - GROQ_API_KEY (for Groq models)"
echo ""
echo "🔐 Optional GitHub OAuth (for authentication):"
echo "  - AUTH_GITHUB_ID and AUTH_GITHUB_SECRET"
echo "  - See docs/create_github_app.md for setup instructions"
echo ""
