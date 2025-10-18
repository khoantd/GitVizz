#!/bin/bash

# GitVizz Backend Deployment Script
# This script deploys only the GitVizz backend service separately
# Supports both Docker and native Python deployment modes

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
ENV_TEMPLATES_DIR="$PROJECT_ROOT/scripts/env-templates"
BACKUP_DIR="/opt/gitvizz-backend-backups"

# Default values
DEPLOYMENT_MODE="docker"  # docker or native
BACKEND_PORT="8003"
MONGO_PORT="27017"
PHOENIX_PORT="6006"
DOMAIN="localhost"
INCLUDE_MONGO="true"  # true or false

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

# Function to show usage
show_usage() {
    echo "GitVizz Backend Deployment Script"
    echo "=================================="
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -m, --mode MODE        Deployment mode: docker (default) or native"
    echo "  -p, --port PORT        Backend port (default: 8003)"
    echo "  -d, --domain DOMAIN    Domain for CORS (default: localhost)"
    echo "  -b, --backup           Create backup before deployment"
    echo "  -u, --update           Update existing deployment"
    echo "  -s, --stop             Stop backend service"
    echo "  -r, --restart          Restart backend service"
    echo "  -l, --logs             Show backend logs"
    echo "  -h, --health           Run health check"
    echo "  --no-mongo             Deploy without MongoDB (external DB)"
    echo "  --help                 Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                     # Deploy with Docker (default)"
    echo "  $0 --mode native       # Deploy natively with Python"
    echo "  $0 --port 8004         # Deploy on port 8004"
    echo "  $0 --no-mongo           # Deploy without MongoDB"
    echo "  $0 --update            # Update existing deployment"
    echo "  $0 --stop              # Stop backend service"
    echo "  $0 --health            # Check backend health"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    local missing_deps=()
    
    if [ "$DEPLOYMENT_MODE" = "docker" ]; then
        if ! command_exists docker; then
            missing_deps+=("docker")
        fi
        
        if ! command_exists docker-compose; then
            missing_deps+=("docker-compose")
        fi
    else
        if ! command_exists python3; then
            missing_deps+=("python3")
        fi
        
        if ! command_exists pip; then
            missing_deps+=("pip")
        fi
        
        if ! command_exists uv; then
            missing_deps+=("uv")
        fi
    fi
    
    if ! command_exists curl; then
        missing_deps+=("curl")
    fi
    
    if ! command_exists git; then
        missing_deps+=("git")
    fi
    
    if [ ${#missing_deps[@]} -ne 0 ]; then
        print_error "Missing required dependencies: ${missing_deps[*]}"
        print_status "Please install the missing dependencies:"
        if [ "$DEPLOYMENT_MODE" = "docker" ]; then
            print_status "  sudo apt-get install -y docker.io docker-compose curl git"
        else
            print_status "  sudo apt-get install -y python3 python3-pip curl git"
            print_status "  pip install uv"
        fi
        exit 1
    fi
    
    print_success "All prerequisites are installed"
}

# Function to generate secure secrets
generate_secrets() {
    print_status "Generating secure secrets..."
    
    # Generate JWT secret
    JWT_SECRET=$(openssl rand -base64 32 2>/dev/null || python3 -c "import secrets; print(secrets.token_urlsafe(32))")
    
    # Generate encryption keys
    ENCRYPTION_KEY=$(openssl rand -base64 32 2>/dev/null || python3 -c "import secrets; print(secrets.token_urlsafe(32))")
    FERNET_KEY=$(python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())" 2>/dev/null || openssl rand -base64 32)
    
    # Generate MongoDB passwords
    MONGO_ADMIN_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25 2>/dev/null || python3 -c "import secrets; print(secrets.token_urlsafe(20))")
    MONGO_APP_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25 2>/dev/null || python3 -c "import secrets; print(secrets.token_urlsafe(20))")
    
    print_success "Secrets generated successfully"
}

# Function to prompt for user inputs
prompt_user_inputs() {
    print_status "Please provide the following information:"
    echo ""
    
    # GitHub OAuth
    read -p "GitHub Client ID (optional): " GITHUB_CLIENT_ID
    read -p "GitHub Client Secret (optional): " GITHUB_CLIENT_SECRET
    read -p "GitHub App Name (optional): " GITHUB_APP_NAME
    
    # LLM API Keys
    echo ""
    print_status "LLM Provider API Keys (leave empty if not using):"
    read -p "OpenAI API Key: " OPENAI_API_KEY
    read -p "Anthropic API Key: " ANTHROPIC_API_KEY
    read -p "Gemini API Key: " GEMINI_API_KEY
    read -p "Groq API Key: " GROQ_API_KEY
    
    # Optional settings
    echo ""
    read -p "MongoDB URI (default: mongodb://localhost:27017): " MONGO_URI
    MONGO_URI=${MONGO_URI:-mongodb://localhost:27017}
    
    read -p "Database name (default: gitvizz): " MONGODB_DB_NAME
    MONGODB_DB_NAME=${MONGODB_DB_NAME:-gitvizz}
}

# Function to create environment file
create_environment_file() {
    print_status "Creating environment file..."
    
    local env_file="$BACKEND_DIR/.env"
    
    cat > "$env_file" << EOF
# GitVizz Backend Environment Configuration
# Generated on $(date)

# Server Configuration
HOST=0.0.0.0
PORT=$BACKEND_PORT

# MongoDB Configuration
MONGO_URI=$MONGO_URI
MONGODB_DB_NAME=$MONGODB_DB_NAME

# JWT Configuration
JWT_SECRET=$JWT_SECRET
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=30

# Encryption keys
ENCRYPTION_KEY=$ENCRYPTION_KEY
FERNET_KEY=$FERNET_KEY

# GitHub OAuth
GITHUB_CLIENT_ID=$GITHUB_CLIENT_ID
GITHUB_CLIENT_SECRET=$GITHUB_CLIENT_SECRET
GITHUB_USER_AGENT=gitvizz-backend

# LLM Provider API Keys
OPENAI_API_KEY=$OPENAI_API_KEY
ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY
GEMINI_API_KEY=$GEMINI_API_KEY
GROQ_API_KEY=$GROQ_API_KEY

# Phoenix Observability
PHOENIX_COLLECTOR_ENDPOINT=http://localhost:$PHOENIX_PORT/v1/traces
PHOENIX_PROJECT_NAME=gitvizz-backend
IS_DISABLING_OBSERVABILITY=false

# File storage
FILE_STORAGE_BASEPATH=/app/storage

# Development settings
DEBUG=false
LOG_LEVEL=info

# CORS settings
CORS_ORIGINS=http://$DOMAIN,https://$DOMAIN,http://localhost:3000,https://localhost:3000
EOF

    # Set proper permissions
    chmod 600 "$env_file"
    
    print_success "Environment file created at $env_file"
}

# Function to create Docker Compose file for backend only
create_docker_compose() {
    print_status "Creating Docker Compose configuration for backend..."
    
    local compose_file
    if [ "$INCLUDE_MONGO" = "true" ]; then
        compose_file="$PROJECT_ROOT/docker-compose.backend.yaml"
    else
        compose_file="$PROJECT_ROOT/docker-compose.backend-no-mongo.yaml"
    fi
    
    if [ "$INCLUDE_MONGO" = "true" ]; then
        cat > "$compose_file" << EOF
version: '3.8'

services:
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: gitvizz-backend
    ports:
      - "$BACKEND_PORT:$BACKEND_PORT"
    env_file:
      - ./backend/.env
    environment:
      - PHOENIX_COLLECTOR_ENDPOINT=http://phoenix:$PHOENIX_PORT/v1/traces
    volumes:
      - backend-storage:/app/storage
    depends_on:
      mongo:
        condition: service_healthy
      phoenix:
        condition: service_started
    networks:
      - gitvizz-backend-network
    restart: always
    healthcheck:
      test: ["CMD-SHELL", "curl -f http://localhost:$BACKEND_PORT/health || python -c \"import urllib.request; urllib.request.urlopen('http://localhost:$BACKEND_PORT/health')\" || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 5
      start_period: 60s

  mongo:
    image: mongo:7.0
    container_name: gitvizz-mongo
    ports:
      - "$MONGO_PORT:$MONGO_PORT"
    environment:
      MONGO_INITDB_ROOT_USERNAME: admin
      MONGO_INITDB_ROOT_PASSWORD: $MONGO_ADMIN_PASSWORD
      MONGO_INITDB_DATABASE: $MONGODB_DB_NAME
    volumes:
      - mongo-data:/data/db
    networks:
      - gitvizz-backend-network
    restart: always
    healthcheck:
      test: ["CMD", "mongosh", "--eval", "db.runCommand('ping')"]
      interval: 30s
      timeout: 10s
      retries: 5
      start_period: 60s

  phoenix:
    image: arizephoenix/phoenix:latest
    container_name: gitvizz-phoenix
    ports:
      - "$PHOENIX_PORT:$PHOENIX_PORT"
    environment:
      - PHOENIX_WORKING_DIR=/mnt/data
    volumes:
      - phoenix-data:/mnt/data
    networks:
      - gitvizz-backend-network
    restart: always
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:$PHOENIX_PORT"]
      interval: 30s
      timeout: 10s
      retries: 3

networks:
  gitvizz-backend-network:
    name: gitvizz-backend-network
    driver: bridge

volumes:
  mongo-data:
    name: gitvizz-mongo-data
  phoenix-data:
    name: gitvizz-phoenix-data
  backend-storage:
    name: gitvizz-backend-storage
EOF
    else
        cat > "$compose_file" << EOF
version: '3.8'

services:
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: gitvizz-backend
    ports:
      - "$BACKEND_PORT:$BACKEND_PORT"
    env_file:
      - ./backend/.env
    environment:
      - PHOENIX_COLLECTOR_ENDPOINT=http://phoenix:$PHOENIX_PORT/v1/traces
    volumes:
      - backend-storage:/app/storage
    depends_on:
      phoenix:
        condition: service_started
    networks:
      - gitvizz-backend-network
    restart: always
    healthcheck:
      test: ["CMD-SHELL", "curl -f http://localhost:$BACKEND_PORT/health || python -c \"import urllib.request; urllib.request.urlopen('http://localhost:$BACKEND_PORT/health')\" || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 5
      start_period: 60s

  phoenix:
    image: arizephoenix/phoenix:latest
    container_name: gitvizz-phoenix
    ports:
      - "$PHOENIX_PORT:$PHOENIX_PORT"
    environment:
      - PHOENIX_WORKING_DIR=/mnt/data
    volumes:
      - phoenix-data:/mnt/data
    networks:
      - gitvizz-backend-network
    restart: always
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:$PHOENIX_PORT"]
      interval: 30s
      timeout: 10s
      retries: 3

networks:
  gitvizz-backend-network:
    name: gitvizz-backend-network
    driver: bridge

volumes:
  phoenix-data:
    name: gitvizz-phoenix-data
  backend-storage:
    name: gitvizz-backend-storage
EOF
    fi

    print_success "Docker Compose file created at $compose_file"
}

# Function to setup native Python environment
setup_native_environment() {
    print_status "Setting up native Python environment..."
    
    cd "$BACKEND_DIR"
    
    # Create virtual environment if it doesn't exist
    if [ ! -d "venv" ]; then
        print_status "Creating Python virtual environment..."
        python3 -m venv venv
    fi
    
    # Activate virtual environment
    source venv/bin/activate
    
    # Install dependencies
    print_status "Installing Python dependencies..."
    if command_exists uv; then
        uv pip install -r pyproject.toml
    else
        pip install -r requirements.txt 2>/dev/null || pip install -e .
    fi
    
    print_success "Native Python environment setup complete"
}

# Function to create backup
create_backup() {
    if [ "$CREATE_BACKUP" = "true" ]; then
        print_status "Creating backup..."
        
        sudo mkdir -p "$BACKUP_DIR"
        sudo chown -R $(whoami):$(whoami) "$BACKUP_DIR"
        
        local backup_file="$BACKUP_DIR/backend-backup-$(date +%Y%m%d-%H%M%S).tar.gz"
        
        if [ "$DEPLOYMENT_MODE" = "docker" ]; then
            # Backup Docker volumes
            docker run --rm -v gitvizz-mongo-data:/data -v gitvizz-backend-storage:/storage -v "$BACKUP_DIR":/backup alpine tar czf /backup/mongo-backup-$(date +%Y%m%d-%H%M%S).tar.gz -C /data .
            docker run --rm -v gitvizz-backend-storage:/data -v "$BACKUP_DIR":/backup alpine tar czf /backup/storage-backup-$(date +%Y%m%d-%H%M%S).tar.gz -C /data .
        else
            # Backup native files
            tar czf "$backup_file" -C "$BACKEND_DIR" . 2>/dev/null || true
        fi
        
        print_success "Backup created at $backup_file"
    fi
}

# Function to deploy with Docker
deploy_docker() {
    print_status "Deploying backend with Docker..."
    
    cd "$PROJECT_ROOT"
    
    local compose_file
    if [ "$INCLUDE_MONGO" = "true" ]; then
        compose_file="docker-compose.backend.yaml"
    else
        compose_file="docker-compose.backend-no-mongo.yaml"
    fi
    
    # Stop existing services
    docker-compose -f "$compose_file" down 2>/dev/null || true
    
    # Build and start services
    docker-compose -f "$compose_file" build
    docker-compose -f "$compose_file" up -d
    
    print_success "Backend deployed with Docker"
}

# Function to deploy natively
deploy_native() {
    print_status "Deploying backend natively..."
    
    cd "$BACKEND_DIR"
    
    # Activate virtual environment
    source venv/bin/activate
    
    # Start the server
    print_status "Starting backend server..."
    nohup python server.py > backend.log 2>&1 &
    echo $! > backend.pid
    
    print_success "Backend deployed natively (PID: $(cat backend.pid))"
}

# Function to wait for services
wait_for_services() {
    print_status "Waiting for backend to be ready..."
    
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f "http://localhost:$BACKEND_PORT/health" >/dev/null 2>&1; then
            print_success "Backend is ready"
            return 0
        fi
        echo -n "."
        sleep 5
        attempt=$((attempt + 1))
    done
    
    print_error "Backend failed to start within expected time"
    return 1
}

# Function to initialize MongoDB
init_mongodb() {
    if [ "$DEPLOYMENT_MODE" = "docker" ] && [ "$INCLUDE_MONGO" = "true" ]; then
        print_status "Initializing MongoDB..."
        
        # Wait for MongoDB to be ready
        local max_attempts=20
        local attempt=1
        
        while [ $attempt -le $max_attempts ]; do
            if docker exec gitvizz-mongo mongosh --eval "db.adminCommand('ping')" >/dev/null 2>&1; then
                break
            fi
            sleep 3
            attempt=$((attempt + 1))
        done
        
        if [ $attempt -gt $max_attempts ]; then
            print_error "MongoDB failed to start"
            return 1
        fi
        
        # Create application database and user
        docker exec gitvizz-mongo mongosh --eval "
            use $MONGODB_DB_NAME;
            db.createUser({
                user: 'gitvizz_app',
                pwd: '$MONGO_APP_PASSWORD',
                roles: [{role: 'readWrite', db: '$MONGODB_DB_NAME'}]
            });
        " 2>/dev/null || print_warning "MongoDB user creation failed (may already exist)"
        
        print_success "MongoDB initialized"
    elif [ "$INCLUDE_MONGO" = "false" ]; then
        print_status "MongoDB not included - using external database"
    fi
}

# Function to run health check
run_health_check() {
    print_status "Running health check..."
    
    if curl -f "http://localhost:$BACKEND_PORT/health" >/dev/null 2>&1; then
        print_success "Backend health check passed"
        return 0
    else
        print_error "Backend health check failed"
        return 1
    fi
}

# Function to show logs
show_logs() {
    print_status "Showing backend logs..."
    
    if [ "$DEPLOYMENT_MODE" = "docker" ]; then
        docker-compose -f "$PROJECT_ROOT/docker-compose.backend.yaml" logs -f backend
    else
        if [ -f "$BACKEND_DIR/backend.log" ]; then
            tail -f "$BACKEND_DIR/backend.log"
        else
            print_error "Log file not found"
        fi
    fi
}

# Function to stop services
stop_services() {
    print_status "Stopping backend services..."
    
    if [ "$DEPLOYMENT_MODE" = "docker" ]; then
        docker-compose -f "$PROJECT_ROOT/docker-compose.backend.yaml" down
    else
        if [ -f "$BACKEND_DIR/backend.pid" ]; then
            local pid=$(cat "$BACKEND_DIR/backend.pid")
            if kill -0 "$pid" 2>/dev/null; then
                kill "$pid"
                rm "$BACKEND_DIR/backend.pid"
                print_success "Backend stopped (PID: $pid)"
            else
                print_warning "Backend process not running"
            fi
        else
            print_warning "No PID file found"
        fi
    fi
}

# Function to restart services
restart_services() {
    print_status "Restarting backend services..."
    stop_services
    sleep 2
    
    if [ "$DEPLOYMENT_MODE" = "docker" ]; then
        deploy_docker
    else
        deploy_native
    fi
}

# Function to show deployment summary
show_deployment_summary() {
    print_success "GitVizz Backend deployment completed!"
    echo ""
    echo "🌐 Service URLs:"
    echo "  Backend API:   http://localhost:$BACKEND_PORT"
    echo "  Health Check: http://localhost:$BACKEND_PORT/health"
    echo "  API Docs:     http://localhost:$BACKEND_PORT/docs"
    if [ "$DEPLOYMENT_MODE" = "docker" ]; then
        echo "  Phoenix:      http://localhost:$PHOENIX_PORT"
        echo "  MongoDB:      localhost:$MONGO_PORT"
    fi
    echo ""
    echo "📊 Service Status:"
    if [ "$DEPLOYMENT_MODE" = "docker" ]; then
        docker-compose -f "$PROJECT_ROOT/docker-compose.backend.yaml" ps
    else
        if [ -f "$BACKEND_DIR/backend.pid" ]; then
            local pid=$(cat "$BACKEND_DIR/backend.pid")
            if kill -0 "$pid" 2>/dev/null; then
                echo "  Backend: Running (PID: $pid)"
            else
                echo "  Backend: Not running"
            fi
        else
            echo "  Backend: Not running"
        fi
    fi
    echo ""
    echo "🔧 Management Commands:"
    echo "  Health check: $0 --health"
    echo "  View logs:    $0 --logs"
    echo "  Stop:         $0 --stop"
    echo "  Restart:      $0 --restart"
    echo "  Update:       $0 --update"
}

# Function to cleanup on error
cleanup() {
    print_error "Deployment failed. Cleaning up..."
    if [ "$DEPLOYMENT_MODE" = "docker" ]; then
        docker-compose -f "$PROJECT_ROOT/docker-compose.backend.yaml" down 2>/dev/null || true
    else
        stop_services
    fi
    exit 1
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -m|--mode)
            DEPLOYMENT_MODE="$2"
            shift 2
            ;;
        -p|--port)
            BACKEND_PORT="$2"
            shift 2
            ;;
        -d|--domain)
            DOMAIN="$2"
            shift 2
            ;;
        -b|--backup)
            CREATE_BACKUP="true"
            shift
            ;;
        -u|--update)
            UPDATE_MODE="true"
            shift
            ;;
        -s|--stop)
            stop_services
            exit 0
            ;;
        -r|--restart)
            restart_services
            exit 0
            ;;
        -l|--logs)
            show_logs
            exit 0
            ;;
        -h|--health)
            run_health_check
            exit $?
            ;;
        --no-mongo)
            INCLUDE_MONGO="false"
            shift
            ;;
        --help)
            show_usage
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Main function
main() {
    print_status "GitVizz Backend Deployment"
    print_status "=========================="
    print_status "Mode: $DEPLOYMENT_MODE"
    print_status "Port: $BACKEND_PORT"
    print_status "Domain: $DOMAIN"
    echo ""
    
    # Set up error handling
    trap cleanup ERR
    
    # Check if running as root
    # if [ "$EUID" -eq 0 ]; then
    #     print_error "Please do not run this script as root. Run as a regular user with sudo privileges."
    #     exit 1
    # fi
    
    # Check prerequisites
    check_prerequisites
    
    # Generate secrets
    generate_secrets
    
    # Prompt for user inputs
    prompt_user_inputs
    
    # Create backup if requested
    create_backup
    
    # Create environment file
    create_environment_file
    
    if [ "$DEPLOYMENT_MODE" = "docker" ]; then
        # Create Docker Compose file
        create_docker_compose
        
        # Deploy with Docker
        deploy_docker
        
        # Initialize MongoDB
        init_mongodb
    else
        # Setup native environment
        setup_native_environment
        
        # Deploy natively
        deploy_native
    fi
    
    # Wait for services
    wait_for_services
    
    # Run health check
    run_health_check
    
    # Show deployment summary
    show_deployment_summary
}

# Run main function with all arguments
main "$@"
