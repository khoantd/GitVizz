#!/bin/bash

# GitVizz Development Environment Script
# This script sets up and runs the complete GitVizz development environment

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"
FRONTEND_DIR="$PROJECT_ROOT/frontend"
SCRIPTS_DIR="$PROJECT_ROOT/scripts"

# Default ports
MONGO_PORT=27017
BACKEND_PORT=8003
FRONTEND_PORT=3000
PHOENIX_PORT=6006

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check if port is in use
port_in_use() {
    lsof -i :$1 >/dev/null 2>&1
}

# Function to wait for service to be ready
wait_for_service() {
    local host=$1
    local port=$2
    local service_name=$3
    local max_attempts=30
    local attempt=1

    print_status "Waiting for $service_name to be ready on $host:$port..."
    
    while [ $attempt -le $max_attempts ]; do
        if nc -z $host $port 2>/dev/null; then
            print_success "$service_name is ready!"
            return 0
        fi
        echo -n "."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    print_error "$service_name failed to start within expected time"
    return 1
}

# Function to create environment files
setup_environment_files() {
    print_status "Setting up environment files..."
    
    # Backend environment file
    if [ ! -f "$BACKEND_DIR/.env" ]; then
        cat > "$BACKEND_DIR/.env" << 'EOF'
# MongoDB Configuration
MONGO_URI=mongodb://localhost:27017
MONGODB_DB_NAME=gitvizz

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=30

# LLM Provider API Keys (add your keys here)
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
        print_success "Created backend/.env file"
    else
        print_warning "Backend .env file already exists"
    fi
    
    # Frontend environment file
    if [ ! -f "$FRONTEND_DIR/.env.local" ]; then
        cat > "$FRONTEND_DIR/.env.local" << 'EOF'
# Backend API URL
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
        print_success "Created frontend/.env.local file"
    else
        print_warning "Frontend .env.local file already exists"
    fi
}

# Function to check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    local missing_deps=()
    
    # Check for required commands
    if ! command_exists docker; then
        missing_deps+=("docker")
    fi
    
    if ! command_exists docker-compose; then
        missing_deps+=("docker-compose")
    fi
    
    if ! command_exists pnpm; then
        missing_deps+=("pnpm")
    fi
    
    if ! command_exists python3; then
        missing_deps+=("python3")
    fi
    
    if ! command_exists uv; then
        missing_deps+=("uv")
    fi
    
    if [ ${#missing_deps[@]} -ne 0 ]; then
        print_error "Missing required dependencies: ${missing_deps[*]}"
        print_status "Please install the missing dependencies and run this script again."
        print_status "Installation guides:"
        print_status "  - Docker: https://docs.docker.com/get-docker/"
        print_status "  - pnpm: npm install -g pnpm"
        print_status "  - uv: curl -LsSf https://astral.sh/uv/install.sh | sh"
        exit 1
    fi
    
    print_success "All prerequisites are installed"
}

# Function to setup Python environment
setup_python_environment() {
    print_status "Setting up Python environment..."
    
    cd "$BACKEND_DIR"
    
    # Install dependencies with uv
    if [ -f "pyproject.toml" ]; then
        print_status "Installing Python dependencies with uv..."
        uv sync
        print_success "Python dependencies installed"
    else
        print_error "pyproject.toml not found in backend directory"
        exit 1
    fi
}

# Function to setup Node.js environment
setup_node_environment() {
    print_status "Setting up Node.js environment..."
    
    cd "$FRONTEND_DIR"
    
    # Install dependencies with pnpm
    if [ -f "package.json" ]; then
        print_status "Installing Node.js dependencies with pnpm..."
        pnpm install
        print_success "Node.js dependencies installed"
    else
        print_error "package.json not found in frontend directory"
        exit 1
    fi
}

# Function to start services with Docker
start_docker_services() {
    print_status "Starting Docker services..."
    
    cd "$PROJECT_ROOT"
    
    # Check if docker-compose.yaml exists
    if [ ! -f "docker-compose.yaml" ]; then
        print_error "docker-compose.yaml not found in project root"
        exit 1
    fi
    
    # Start services
    print_status "Starting MongoDB, Phoenix, Backend, and Frontend services..."
    docker-compose up -d
    
    # Wait for services to be ready
    wait_for_service localhost $MONGO_PORT "MongoDB"
    wait_for_service localhost $PHOENIX_PORT "Phoenix"
    wait_for_service localhost $BACKEND_PORT "Backend API"
    wait_for_service localhost $FRONTEND_PORT "Frontend"
    
    print_success "All Docker services are running!"
}

# Function to start services locally (without Docker)
start_local_services() {
    print_status "Starting services locally..."
    
    # Start MongoDB if not running
    if ! port_in_use $MONGO_PORT; then
        print_status "Starting MongoDB..."
        if command_exists brew; then
            brew services start mongodb-community
        else
            print_warning "MongoDB not running. Please start MongoDB manually."
        fi
    fi
    
    # Start Phoenix if not running
    if ! port_in_use $PHOENIX_PORT; then
        print_status "Starting Phoenix observability..."
        docker run -d --name gitvizz-phoenix -p $PHOENIX_PORT:6006 -p 4317:4317 arizephoenix/phoenix:latest
    fi
    
    # Start Backend
    print_status "Starting Backend API..."
    cd "$BACKEND_DIR"
    uv run uvicorn server:app --host 0.0.0.0 --port $BACKEND_PORT --reload &
    BACKEND_PID=$!
    
    # Start Frontend
    print_status "Starting Frontend..."
    cd "$FRONTEND_DIR"
    pnpm dev &
    FRONTEND_PID=$!
    
    # Wait for services
    wait_for_service localhost $BACKEND_PORT "Backend API"
    wait_for_service localhost $FRONTEND_PORT "Frontend"
    
    print_success "All local services are running!"
    print_status "Backend PID: $BACKEND_PID"
    print_status "Frontend PID: $FRONTEND_PID"
}

# Function to show service URLs
show_service_urls() {
    print_success "Development environment is ready!"
    echo ""
    echo "🌐 Service URLs:"
    echo "  Frontend:     http://localhost:$FRONTEND_PORT"
    echo "  Backend API:  http://localhost:$BACKEND_PORT"
    echo "  API Docs:     http://localhost:$BACKEND_PORT/docs"
    echo "  Phoenix:      http://localhost:$PHOENIX_PORT"
    echo "  MongoDB:      mongodb://localhost:$MONGO_PORT"
    echo ""
    echo "📚 Quick Start:"
    echo "  1. Open http://localhost:$FRONTEND_PORT in your browser"
    echo "  2. Check API documentation at http://localhost:$BACKEND_PORT/docs"
    echo "  3. Monitor observability at http://localhost:$PHOENIX_PORT"
    echo ""
    echo "🛠️  Development Commands:"
    echo "  Backend logs:  cd $BACKEND_DIR && uv run uvicorn server:app --reload"
    echo "  Frontend logs: cd $FRONTEND_DIR && pnpm dev"
    echo "  Stop services: docker-compose down (if using Docker)"
    echo ""
}

# Function to cleanup
cleanup() {
    print_status "Cleaning up..."
    
    # Kill background processes
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null || true
    fi
    
    if [ ! -z "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null || true
    fi
    
    # Stop Docker services if running
    cd "$PROJECT_ROOT"
    docker-compose down 2>/dev/null || true
    
    print_success "Cleanup completed"
}

# Function to show help
show_help() {
    echo "GitVizz Development Environment Script"
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -d, --docker     Use Docker for all services (default)"
    echo "  -l, --local      Run services locally (requires local MongoDB)"
    echo "  -s, --setup      Only setup environment files and dependencies"
    echo "  -c, --cleanup    Stop all services and cleanup"
    echo "  -h, --help       Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                    # Start with Docker (default)"
    echo "  $0 --local           # Start locally"
    echo "  $0 --setup           # Setup only"
    echo "  $0 --cleanup          # Cleanup and stop"
}

# Main function
main() {
    local use_docker=true
    local setup_only=false
    local cleanup_only=false
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -d|--docker)
                use_docker=true
                shift
                ;;
            -l|--local)
                use_docker=false
                shift
                ;;
            -s|--setup)
                setup_only=true
                shift
                ;;
            -c|--cleanup)
                cleanup_only=true
                shift
                ;;
            -h|--help)
                show_help
                exit 0
                ;;
            *)
                print_error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    # Set up trap for cleanup on exit
    trap cleanup EXIT
    
    print_status "GitVizz Development Environment Setup"
    print_status "======================================"
    
    if [ "$cleanup_only" = true ]; then
        cleanup
        exit 0
    fi
    
    # Check prerequisites
    check_prerequisites
    
    # Setup environment files
    setup_environment_files
    
    if [ "$setup_only" = true ]; then
        print_success "Environment setup completed!"
        print_status "You can now run: $0 to start the development environment"
        exit 0
    fi
    
    # Setup dependencies
    setup_python_environment
    setup_node_environment
    
    # Start services
    if [ "$use_docker" = true ]; then
        start_docker_services
    else
        start_local_services
    fi
    
    # Show service URLs
    show_service_urls
    
    # Keep script running if using local services
    if [ "$use_docker" = false ]; then
        print_status "Press Ctrl+C to stop all services"
        wait
    fi
}

# Run main function with all arguments
main "$@"
