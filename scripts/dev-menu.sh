#!/bin/bash

# GitVizz Development Menu
# Interactive menu for managing the development environment

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Function to print colored output
print_header() {
    echo -e "${PURPLE}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${PURPLE}║${NC}                    ${CYAN}GitVizz Development Menu${NC}                    ${PURPLE}║${NC}"
    echo -e "${PURPLE}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

print_menu() {
    echo -e "${BLUE}Available Commands:${NC}"
    echo ""
    echo -e "${GREEN}🚀 Quick Start${NC}"
    echo "  1) Start development environment (Docker)"
    echo "  2) Start development environment (Local)"
    echo ""
    echo -e "${YELLOW}🔧 Setup & Configuration${NC}"
    echo "  3) Setup environment files"
    echo "  4) Install dependencies"
    echo "  5) Generate API client"
    echo ""
    echo -e "${BLUE}📊 Service Management${NC}"
    echo "  6) View service status"
    echo "  7) View service logs"
    echo "  8) Restart services"
    echo "  9) Stop all services"
    echo ""
    echo -e "${RED}🧹 Cleanup${NC}"
    echo "  10) Cleanup and stop all services"
    echo "  11) Reset environment files"
    echo ""
    echo -e "${CYAN}📚 Information${NC}"
    echo "  12) Show service URLs"
    echo "  13) Show help"
    echo "  14) Exit"
    echo ""
}

# Function to check if services are running
check_services() {
    local services_running=0
    
    if curl -s http://localhost:3000 >/dev/null 2>&1; then
        echo -e "  ${GREEN}✅ Frontend (3000)${NC}"
        services_running=$((services_running + 1))
    else
        echo -e "  ${RED}❌ Frontend (3000)${NC}"
    fi
    
    if curl -s http://localhost:8003 >/dev/null 2>&1; then
        echo -e "  ${GREEN}✅ Backend (8003)${NC}"
        services_running=$((services_running + 1))
    else
        echo -e "  ${RED}❌ Backend (8003)${NC}"
    fi
    
    if curl -s http://localhost:6006 >/dev/null 2>&1; then
        echo -e "  ${GREEN}✅ Phoenix (6006)${NC}"
        services_running=$((services_running + 1))
    else
        echo -e "  ${RED}❌ Phoenix (6006)${NC}"
    fi
    
    if docker ps | grep -q mongo; then
        echo -e "  ${GREEN}✅ MongoDB (27017)${NC}"
        services_running=$((services_running + 1))
    else
        echo -e "  ${RED}❌ MongoDB (27017)${NC}"
    fi
    
    return $services_running
}

# Function to show service URLs
show_urls() {
    echo -e "${CYAN}🌐 Service URLs:${NC}"
    echo ""
    echo -e "  ${BLUE}Frontend:${NC}     http://localhost:3000"
    echo -e "  ${BLUE}Backend API:${NC}  http://localhost:8003"
    echo -e "  ${BLUE}API Docs:${NC}     http://localhost:8003/docs"
    echo -e "  ${BLUE}Phoenix:${NC}      http://localhost:6006"
    echo -e "  ${BLUE}MongoDB:${NC}      mongodb://localhost:27017"
    echo ""
}

# Function to show help
show_help() {
    echo -e "${CYAN}📚 GitVizz Development Help${NC}"
    echo "================================"
    echo ""
    echo -e "${BLUE}Quick Start:${NC}"
    echo "  1. Run option 3 (Setup environment files)"
    echo "  2. Edit backend/.env with your API keys"
    echo "  3. Run option 1 (Start development environment)"
    echo "  4. Open http://localhost:3000 in your browser"
    echo ""
    echo -e "${BLUE}Required API Keys:${NC}"
    echo "  - OPENAI_API_KEY (for OpenAI models)"
    echo "  - ANTHROPIC_API_KEY (for Claude models)"
    echo "  - GEMINI_API_KEY (for Google Gemini models)"
    echo "  - GROQ_API_KEY (for Groq models)"
    echo ""
    echo -e "${BLUE}Troubleshooting:${NC}"
    echo "  - Check Docker is running: docker info"
    echo "  - View logs: docker-compose logs -f"
    echo "  - Restart services: docker-compose restart"
    echo "  - Full cleanup: docker-compose down && docker system prune"
    echo ""
    echo -e "${BLUE}Documentation:${NC}"
    echo "  - See scripts/README.md for detailed information"
    echo "  - Check docs/ directory for setup guides"
    echo ""
}

# Main menu loop
main() {
    while true; do
        clear
        print_header
        print_menu
        
        echo -e "${YELLOW}Current Status:${NC}"
        check_services
        echo ""
        
        echo -n -e "${BLUE}Enter your choice (1-14): ${NC}"
        read -r choice
        
        case $choice in
            1)
                echo -e "${BLUE}🚀 Starting development environment with Docker...${NC}"
                cd "$PROJECT_ROOT"
                ./scripts/quick-start.sh
                echo -e "${GREEN}Press Enter to continue...${NC}"
                read -r
                ;;
            2)
                echo -e "${BLUE}🚀 Starting development environment locally...${NC}"
                cd "$PROJECT_ROOT"
                ./scripts/dev-env.sh --local
                echo -e "${GREEN}Press Enter to continue...${NC}"
                read -r
                ;;
            3)
                echo -e "${BLUE}🔧 Setting up environment files...${NC}"
                cd "$PROJECT_ROOT"
                ./scripts/setup-env.sh
                echo -e "${GREEN}Press Enter to continue...${NC}"
                read -r
                ;;
            4)
                echo -e "${BLUE}📦 Installing dependencies...${NC}"
                cd "$PROJECT_ROOT"
                ./scripts/dev-env.sh --setup
                echo -e "${GREEN}Press Enter to continue...${NC}"
                read -r
                ;;
            5)
                echo -e "${BLUE}🔧 Generating API client...${NC}"
                cd "$PROJECT_ROOT/frontend"
                pnpm run generate:api
                echo -e "${GREEN}Press Enter to continue...${NC}"
                read -r
                ;;
            6)
                echo -e "${BLUE}📊 Service Status:${NC}"
                echo ""
                check_services
                echo ""
                echo -e "${GREEN}Press Enter to continue...${NC}"
                read -r
                ;;
            7)
                echo -e "${BLUE}📋 Viewing service logs...${NC}"
                cd "$PROJECT_ROOT"
                docker-compose logs -f --tail=50
                ;;
            8)
                echo -e "${BLUE}🔄 Restarting services...${NC}"
                cd "$PROJECT_ROOT"
                docker-compose restart
                echo -e "${GREEN}Services restarted!${NC}"
                echo -e "${GREEN}Press Enter to continue...${NC}"
                read -r
                ;;
            9)
                echo -e "${BLUE}⏹️  Stopping all services...${NC}"
                cd "$PROJECT_ROOT"
                docker-compose down
                echo -e "${GREEN}Services stopped!${NC}"
                echo -e "${GREEN}Press Enter to continue...${NC}"
                read -r
                ;;
            10)
                echo -e "${BLUE}🧹 Cleaning up and stopping all services...${NC}"
                cd "$PROJECT_ROOT"
                ./scripts/dev-env.sh --cleanup
                echo -e "${GREEN}Cleanup completed!${NC}"
                echo -e "${GREEN}Press Enter to continue...${NC}"
                read -r
                ;;
            11)
                echo -e "${BLUE}🔄 Resetting environment files...${NC}"
                cd "$PROJECT_ROOT"
                rm -f backend/.env frontend/.env.local
                ./scripts/setup-env.sh
                echo -e "${GREEN}Environment files reset!${NC}"
                echo -e "${GREEN}Press Enter to continue...${NC}"
                read -r
                ;;
            12)
                show_urls
                echo -e "${GREEN}Press Enter to continue...${NC}"
                read -r
                ;;
            13)
                show_help
                echo -e "${GREEN}Press Enter to continue...${NC}"
                read -r
                ;;
            14)
                echo -e "${GREEN}👋 Goodbye!${NC}"
                exit 0
                ;;
            *)
                echo -e "${RED}Invalid option. Please try again.${NC}"
                sleep 2
                ;;
        esac
    done
}

# Run main function
main
