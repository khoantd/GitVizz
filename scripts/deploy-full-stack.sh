#!/bin/bash

# GitVizz Full-Stack Deployment Script
# This script deploys both frontend and backend services together

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
ENV_TEMPLATES_DIR="$PROJECT_ROOT/scripts/env-templates"
BACKUP_DIR="/opt/gitvizz-full-stack-backups"

# Default values
BACKEND_PORT="8003"
FRONTEND_PORT="3000"
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
    echo "GitVizz Full-Stack Deployment Script"
    echo "===================================="
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -p, --backend-port PORT    Backend port (default: 8003)"
    echo "  -f, --frontend-port PORT   Frontend port (default: 3000)"
    echo "  -d, --domain DOMAIN        Domain for CORS (default: localhost)"
    echo "  -b, --backup               Create backup before deployment"
    echo "  -u, --update               Update existing deployment"
    echo "  -s, --stop                 Stop all services"
    echo "  -r, --restart              Restart all services"
    echo "  -l, --logs                 Show logs for all services"
    echo "  -h, --health               Run health check"
    echo "  --no-mongo                 Deploy without MongoDB (external DB)"
    echo "  --help                     Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                         # Deploy full stack with MongoDB"
    echo "  $0 --no-mongo             # Deploy without MongoDB"
    echo "  $0 --backend-port 8004    # Deploy on custom backend port"
    echo "  $0 --stop                 # Stop all services"
    echo "  $0 --health               # Check health of all services"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    local missing_deps=()
    
    if ! command_exists docker; then
        missing_deps+=("docker")
    fi
    
    if ! command_exists docker-compose; then
        missing_deps+=("docker-compose")
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
        print_status "  sudo apt-get install -y docker.io docker-compose curl git"
        exit 1
    fi
    
    print_success "All prerequisites are installed"
}

# Function to generate secure secrets
generate_secrets() {
    print_status "Generating secure secrets..."
    
    # Generate JWT secret
    JWT_SECRET=$(openssl rand -base64 32 2>/dev/null || python3 -c "import secrets; print(secrets.token_urlsafe(32))")
    
    # Generate AUTH secret
    AUTH_SECRET=$(openssl rand -base64 32 2>/dev/null || python3 -c "import secrets; print(secrets.token_urlsafe(32))")
    
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

# Function to create backend environment file
create_backend_environment() {
    print_status "Creating backend environment file..."
    
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
GITHUB_USER_AGENT=gitvizz-full-stack

# LLM Provider API Keys
OPENAI_API_KEY=$OPENAI_API_KEY
ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY
GEMINI_API_KEY=$GEMINI_API_KEY
GROQ_API_KEY=$GROQ_API_KEY

# Phoenix Observability
PHOENIX_COLLECTOR_ENDPOINT=http://phoenix:$PHOENIX_PORT/v1/traces
PHOENIX_PROJECT_NAME=gitvizz-full-stack
IS_DISABLING_OBSERVABILITY=false

# File storage
FILE_STORAGE_BASEPATH=/app/storage

# Development settings
DEBUG=false
LOG_LEVEL=info

# CORS settings
CORS_ORIGINS=http://$DOMAIN:$FRONTEND_PORT,https://$DOMAIN:$FRONTEND_PORT,http://localhost:$FRONTEND_PORT,https://localhost:$FRONTEND_PORT
EOF

    # Set proper permissions
    chmod 600 "$env_file"
    
    print_success "Backend environment file created at $env_file"
}

# Function to create frontend environment file
create_frontend_environment() {
    print_status "Creating frontend environment file..."
    
    local env_file="$FRONTEND_DIR/.env.local"
    
    cat > "$env_file" << EOF
# GitVizz Frontend Environment Configuration
# Generated on $(date)

# Backend API URL
NEXT_PUBLIC_BACKEND_URL=http://backend:$BACKEND_PORT

# NextAuth Configuration
NEXTAUTH_URL=http://$DOMAIN:$FRONTEND_PORT
AUTH_SECRET=$AUTH_SECRET

# GitHub OAuth
AUTH_GITHUB_ID=$GITHUB_CLIENT_ID
AUTH_GITHUB_SECRET=$GITHUB_CLIENT_SECRET
NEXT_PUBLIC_GITHUB_APP_NAME=$GITHUB_APP_NAME

# Production settings
NODE_ENV=production
NEXT_TELEMETRY_DISABLED=1
EOF

    # Set proper permissions
    chmod 600 "$env_file"
    
    print_success "Frontend environment file created at $env_file"
}

# Function to create Docker Compose file
create_docker_compose() {
    print_status "Creating Docker Compose configuration for full-stack..."
    
    local compose_file
    if [ "$INCLUDE_MONGO" = "true" ]; then
        compose_file="$PROJECT_ROOT/docker-compose.full-stack.yaml"
    else
        compose_file="$PROJECT_ROOT/docker-compose.full-stack-no-mongo.yaml"
    fi
    
    print_success "Using Docker Compose file: $compose_file"
}

# Function to create backup
create_backup() {
    if [ "$CREATE_BACKUP" = "true" ]; then
        print_status "Creating backup..."
        
        sudo mkdir -p "$BACKUP_DIR"
        sudo chown -R $(whoami):$(whoami) "$BACKUP_DIR"
        
        local backup_file="$BACKUP_DIR/full-stack-backup-$(date +%Y%m%d-%H%M%S).tar.gz"
        
        # Backup Docker volumes
        if [ "$INCLUDE_MONGO" = "true" ]; then
            docker run --rm -v gitvizz-mongo-data:/data -v "$BACKUP_DIR":/backup alpine tar czf "/backup/mongo-backup-$(date +%Y%m%d-%H%M%S).tar.gz" -C /data .
        fi
        
        docker run --rm -v gitvizz-backend-storage:/data -v "$BACKUP_DIR":/backup alpine tar czf "/backup/storage-backup-$(date +%Y%m%d-%H%M%S).tar.gz" -C /data .
        
        # Backup configuration files
        tar czf "$backup_file" -C "$PROJECT_ROOT" backend/.env frontend/.env.local 2>/dev/null || true
        
        print_success "Backup created at $backup_file"
    fi
}

# Function to deploy services
deploy_services() {
    print_status "Deploying GitVizz full-stack services..."
    
    cd "$PROJECT_ROOT"
    
    local compose_file
    if [ "$INCLUDE_MONGO" = "true" ]; then
        compose_file="docker-compose.full-stack.yaml"
    else
        compose_file="docker-compose.full-stack-no-mongo.yaml"
    fi
    
    # Stop existing services
    docker-compose -f "$compose_file" down 2>/dev/null || true
    
    # Build and start services
    docker-compose -f "$compose_file" build
    docker-compose -f "$compose_file" up -d
    
    print_success "Full-stack services deployed"
}

# Function to wait for services
wait_for_services() {
    print_status "Waiting for services to be ready..."
    
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f "http://localhost:$BACKEND_PORT/health" >/dev/null 2>&1 && \
           curl -f "http://localhost:$FRONTEND_PORT" >/dev/null 2>&1; then
            print_success "All services are ready"
            return 0
        fi
        echo -n "."
        sleep 5
        attempt=$((attempt + 1))
    done
    
    print_error "Services failed to start within expected time"
    return 1
}

# Function to initialize MongoDB
init_mongodb() {
    if [ "$INCLUDE_MONGO" = "true" ]; then
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
    else
        print_status "MongoDB not included - using external database"
    fi
}

# Function to run health checks
run_health_checks() {
    print_status "Running health checks..."
    
    # Check backend health
    if curl -f "http://localhost:$BACKEND_PORT/health" >/dev/null 2>&1; then
        print_success "Backend health check passed"
    else
        print_error "Backend health check failed"
        return 1
    fi
    
    # Check frontend health
    if curl -f "http://localhost:$FRONTEND_PORT" >/dev/null 2>&1; then
        print_success "Frontend health check passed"
    else
        print_error "Frontend health check failed"
        return 1
    fi
    
    # Check Phoenix if included
    if curl -f "http://localhost:$PHOENIX_PORT" >/dev/null 2>&1; then
        print_success "Phoenix observability check passed"
    else
        print_warning "Phoenix observability check failed"
    fi
    
    print_success "All health checks passed"
}

# Function to show logs
show_logs() {
    print_status "Showing full-stack logs..."
    
    local compose_file
    if [ "$INCLUDE_MONGO" = "true" ]; then
        compose_file="docker-compose.full-stack.yaml"
    else
        compose_file="docker-compose.full-stack-no-mongo.yaml"
    fi
    
    docker-compose -f "$PROJECT_ROOT/$compose_file" logs -f
}

# Function to stop services
stop_services() {
    print_status "Stopping full-stack services..."
    
    local compose_file
    if [ "$INCLUDE_MONGO" = "true" ]; then
        compose_file="docker-compose.full-stack.yaml"
    else
        compose_file="docker-compose.full-stack-no-mongo.yaml"
    fi
    
    cd "$PROJECT_ROOT"
    docker-compose -f "$compose_file" down
    
    print_success "Full-stack services stopped"
}

# Function to restart services
restart_services() {
    print_status "Restarting full-stack services..."
    stop_services
    sleep 2
    deploy_services
}

# Function to show deployment summary
show_deployment_summary() {
    print_success "GitVizz Full-Stack deployment completed!"
    echo ""
    echo "🌐 Service URLs:"
    echo "  Frontend:     http://localhost:$FRONTEND_PORT"
    echo "  Backend API:  http://localhost:$BACKEND_PORT"
    echo "  API Docs:     http://localhost:$BACKEND_PORT/docs"
    echo "  Health Check: http://localhost:$BACKEND_PORT/health"
    if [ "$INCLUDE_MONGO" = "true" ]; then
        echo "  MongoDB:      localhost:$MONGO_PORT"
    fi
    echo "  Phoenix:      http://localhost:$PHOENIX_PORT"
    echo ""
    echo "📊 Service Status:"
    local compose_file
    if [ "$INCLUDE_MONGO" = "true" ]; then
        compose_file="docker-compose.full-stack.yaml"
    else
        compose_file="docker-compose.full-stack-no-mongo.yaml"
    fi
    docker-compose -f "$PROJECT_ROOT/$compose_file" ps
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
    stop_services
    exit 1
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -p|--backend-port)
            BACKEND_PORT="$2"
            shift 2
            ;;
        -f|--frontend-port)
            FRONTEND_PORT="$2"
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
            run_health_checks
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
    print_status "GitVizz Full-Stack Deployment"
    print_status "============================="
    print_status "Backend Port: $BACKEND_PORT"
    print_status "Frontend Port: $FRONTEND_PORT"
    print_status "Domain: $DOMAIN"
    print_status "Include MongoDB: $INCLUDE_MONGO"
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
    
    # Create environment files
    create_backend_environment
    create_frontend_environment
    
    # Create Docker Compose file
    create_docker_compose
    
    # Deploy services
    deploy_services
    
    # Wait for services
    wait_for_services
    
    # Initialize MongoDB
    init_mongodb
    
    # Run health checks
    run_health_checks
    
    # Show deployment summary
    show_deployment_summary
}

# Run main function with all arguments
main "$@"
