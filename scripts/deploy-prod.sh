#!/bin/bash

# GitVizz Production Deployment Script
# This script deploys GitVizz to a VPS with domain gitvizz.sutools.app

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DOMAIN="gitvizz.sutools.app"
BACKUP_DIR="/opt/gitvizz-backups"
ENV_TEMPLATES_DIR="$PROJECT_ROOT/scripts/env-templates"

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

# Function to check VPS requirements
check_vps_requirements() {
    print_status "Checking VPS requirements..."
    
    # Check available memory (minimum 2GB)
    local memory_gb=$(free -g | awk '/^Mem:/{print $2}')
    if [ "$memory_gb" -lt 2 ]; then
        print_error "Insufficient memory. Minimum 2GB required, found ${memory_gb}GB"
        exit 1
    fi
    
    # Check available disk space (minimum 20GB)
    local disk_gb=$(df -BG / | awk 'NR==2 {print $4}' | sed 's/G//')
    if [ "$disk_gb" -lt 20 ]; then
        print_error "Insufficient disk space. Minimum 20GB required, found ${disk_gb}GB"
        exit 1
    fi
    
    print_success "VPS requirements met (Memory: ${memory_gb}GB, Disk: ${disk_gb}GB)"
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
    
    if ! command_exists certbot; then
        missing_deps+=("certbot")
    fi
    
    if ! command_exists git; then
        missing_deps+=("git")
    fi
    
    if ! command_exists openssl; then
        missing_deps+=("openssl")
    fi
    
    if [ ${#missing_deps[@]} -ne 0 ]; then
        print_error "Missing required dependencies: ${missing_deps[*]}"
        print_status "Please install the missing dependencies:"
        print_status "  sudo apt-get update"
        print_status "  sudo apt-get install -y docker.io docker-compose certbot python3-certbot-nginx git openssl"
        print_status "  sudo systemctl enable docker"
        print_status "  sudo usermod -aG docker \$USER"
        print_status "  # Logout and login again to apply docker group changes"
        exit 1
    fi
    
    print_success "All prerequisites are installed"
}

# Function to generate secure secrets
generate_secrets() {
    print_status "Generating secure secrets..."
    
    # Generate JWT secret
    JWT_SECRET=$(openssl rand -base64 32)
    
    # Generate AUTH secret
    AUTH_SECRET=$(openssl rand -base64 32)
    
    # Generate encryption keys
    ENCRYPTION_KEY=$(openssl rand -base64 32)
    FERNET_KEY=$(python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())")
    
    # Generate MongoDB passwords
    MONGO_ADMIN_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
    MONGO_APP_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
    
    print_success "Secrets generated successfully"
}

# Function to prompt for user inputs
prompt_user_inputs() {
    print_status "Please provide the following information:"
    echo ""
    
    # GitHub OAuth
    read -p "GitHub Client ID: " GITHUB_CLIENT_ID
    read -p "GitHub Client Secret: " GITHUB_CLIENT_SECRET
    read -p "GitHub App Name: " GITHUB_APP_NAME
    
    # LLM API Keys
    echo ""
    print_status "LLM Provider API Keys (leave empty if not using):"
    read -p "OpenAI API Key: " OPENAI_API_KEY
    read -p "Anthropic API Key: " ANTHROPIC_API_KEY
    read -p "Gemini API Key: " GEMINI_API_KEY
    read -p "Groq API Key: " GROQ_API_KEY
    
    # Optional settings
    echo ""
    read -p "Email for SSL certificate notifications (default: khoa0702@gmail.com): " SSL_EMAIL
    SSL_EMAIL=${SSL_EMAIL:-khoa0702@gmail.com}
    read -p "Backup retention days (default: 30): " BACKUP_RETENTION_DAYS
    BACKUP_RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-30}
}

# Function to create environment files
create_environment_files() {
    print_status "Creating environment files..."
    
    # Create backend environment file
    cat > "$PROJECT_ROOT/backend/.env.production" << EOF
# GitVizz Backend Production Environment
HOST=0.0.0.0
PORT=8003

# MongoDB Configuration
MONGO_URI=mongodb://gitvizz_app:${MONGO_APP_PASSWORD}@mongo:27017/gitvizz_prod?authSource=gitvizz_prod
MONGODB_DB_NAME=gitvizz_prod

# JWT Configuration
JWT_SECRET=${JWT_SECRET}
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=30

# Encryption keys
ENCRYPTION_KEY=${ENCRYPTION_KEY}
FERNET_KEY=${FERNET_KEY}

# GitHub OAuth
GITHUB_CLIENT_ID=${GITHUB_CLIENT_ID}
GITHUB_CLIENT_SECRET=${GITHUB_CLIENT_SECRET}
GITHUB_USER_AGENT=gitvizz-production

# LLM Provider API Keys
OPENAI_API_KEY=${OPENAI_API_KEY}
ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
GEMINI_API_KEY=${GEMINI_API_KEY}
GROQ_API_KEY=${GROQ_API_KEY}

# Phoenix Observability
PHOENIX_COLLECTOR_ENDPOINT=http://phoenix:6006/v1/traces
PHOENIX_PROJECT_NAME=gitvizz-production
IS_DISABLING_OBSERVABILITY=false

# File storage
FILE_STORAGE_BASEPATH=/data/storage

# Production settings
DEBUG=false
LOG_LEVEL=info

# CORS settings
CORS_ORIGINS=https://${DOMAIN},https://www.${DOMAIN}
EOF

    # Create frontend environment file
    cat > "$PROJECT_ROOT/frontend/.env.production" << EOF
# GitVizz Frontend Production Environment
NEXT_PUBLIC_BACKEND_URL=https://${DOMAIN}

# NextAuth Configuration
NEXTAUTH_URL=https://${DOMAIN}
AUTH_SECRET=${AUTH_SECRET}

# GitHub OAuth
AUTH_GITHUB_ID=${GITHUB_CLIENT_ID}
AUTH_GITHUB_SECRET=${GITHUB_CLIENT_SECRET}
NEXT_PUBLIC_GITHUB_APP_NAME=${GITHUB_APP_NAME}

# Production settings
NODE_ENV=production
NEXT_TELEMETRY_DISABLED=1
EOF

    # Set proper permissions
    chmod 600 "$PROJECT_ROOT/backend/.env.production"
    chmod 600 "$PROJECT_ROOT/frontend/.env.production"
    
    print_success "Environment files created"
}

# Function to update docker-compose with passwords
update_docker_compose() {
    print_status "Updating Docker Compose configuration..."
    
    # Create a temporary file with replaced values
    sed "s/{{MONGO_ADMIN_PASSWORD}}/${MONGO_ADMIN_PASSWORD}/g" "$PROJECT_ROOT/docker-compose.prod.yaml" > "$PROJECT_ROOT/docker-compose.prod.tmp"
    mv "$PROJECT_ROOT/docker-compose.prod.tmp" "$PROJECT_ROOT/docker-compose.prod.yaml"
    
    print_success "Docker Compose configuration updated"
}

# Function to setup SSL certificates
setup_ssl() {
    print_status "Setting up SSL certificates..."
    
    # Create nginx directories
    mkdir -p "$PROJECT_ROOT/nginx/ssl"
    mkdir -p "$PROJECT_ROOT/nginx/logs"
    
    # Check if certificates already exist
    if [ -f "$PROJECT_ROOT/nginx/ssl/fullchain.pem" ] && [ -f "$PROJECT_ROOT/nginx/ssl/privkey.pem" ]; then
        print_warning "SSL certificates already exist. Skipping certificate generation."
        return 0
    fi
    
    # Stop nginx if running
    docker-compose -f "$PROJECT_ROOT/docker-compose.prod.yaml" stop nginx 2>/dev/null || true
    
    # Try Let's Encrypt first (if email provided)
    if [ -n "$SSL_EMAIL" ]; then
        print_status "Attempting to obtain Let's Encrypt certificate..."
        if certbot certonly --standalone --non-interactive --agree-tos --email "$SSL_EMAIL" -d "$DOMAIN" -d "www.$DOMAIN" 2>/dev/null; then
            # Copy certificates to nginx directory
            sudo cp "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" "$PROJECT_ROOT/nginx/ssl/"
            sudo cp "/etc/letsencrypt/live/$DOMAIN/privkey.pem" "$PROJECT_ROOT/nginx/ssl/"
            sudo chown -R $(whoami):$(whoami) "$PROJECT_ROOT/nginx/ssl"
            
            # Set up auto-renewal
            (crontab -l 2>/dev/null; echo "0 12 * * * /usr/bin/certbot renew --quiet") | crontab -
            
            print_success "Let's Encrypt SSL certificates configured"
            return 0
        else
            print_warning "Let's Encrypt certificate generation failed. Falling back to self-signed certificates."
        fi
    fi
    
    # Fallback to self-signed certificates
    print_status "Generating self-signed SSL certificates..."
    
    # Run the SSL certificate generation script
    if [ -f "$PROJECT_ROOT/scripts/generate-ssl-certs.sh" ]; then
        cd "$PROJECT_ROOT"
        chmod +x "$PROJECT_ROOT/scripts/generate-ssl-certs.sh"
        "$PROJECT_ROOT/scripts/generate-ssl-certs.sh"
        print_success "Self-signed SSL certificates generated"
    else
        print_error "SSL certificate generation script not found at $PROJECT_ROOT/scripts/generate-ssl-certs.sh"
        print_status "Creating self-signed certificates manually..."
        
        # Generate private key
        openssl genrsa -out "$PROJECT_ROOT/nginx/ssl/privkey.pem" 2048
        
        # Generate certificate signing request
        openssl req -new -key "$PROJECT_ROOT/nginx/ssl/privkey.pem" -out "$PROJECT_ROOT/nginx/ssl/cert.csr" -subj "/C=US/ST=State/L=City/O=Organization/OU=OrgUnit/CN=$DOMAIN"
        
        # Generate self-signed certificate
        openssl x509 -req -days 365 -in "$PROJECT_ROOT/nginx/ssl/cert.csr" -signkey "$PROJECT_ROOT/nginx/ssl/privkey.pem" -out "$PROJECT_ROOT/nginx/ssl/cert.pem"
        
        # Create fullchain.pem (same as cert.pem for self-signed)
        cp "$PROJECT_ROOT/nginx/ssl/cert.pem" "$PROJECT_ROOT/nginx/ssl/fullchain.pem"
        
        # Set proper permissions
        chmod 600 "$PROJECT_ROOT/nginx/ssl/privkey.pem"
        chmod 644 "$PROJECT_ROOT/nginx/ssl/cert.pem"
        chmod 644 "$PROJECT_ROOT/nginx/ssl/fullchain.pem"
        
        # Clean up CSR file
        rm "$PROJECT_ROOT/nginx/ssl/cert.csr"
        
        print_success "Self-signed SSL certificates created manually"
    fi
    
    print_warning "⚠️  Using self-signed certificates. Browsers will show security warnings."
    print_status "For production, consider using Let's Encrypt or commercial certificates."
}

# Function to create backup directory
create_backup_directory() {
    print_status "Creating backup directory..."
    
    sudo mkdir -p "$BACKUP_DIR"
    sudo chown -R $(whoami):$(whoami) "$BACKUP_DIR"
    
    print_success "Backup directory created at $BACKUP_DIR"
}

# Function to deploy services
deploy_services() {
    print_status "Deploying GitVizz services..."
    
    cd "$PROJECT_ROOT"
    
    # Build and start services
    docker-compose -f docker-compose.prod.yaml down 2>/dev/null || true
    docker-compose -f docker-compose.prod.yaml build
    docker-compose -f docker-compose.prod.yaml up -d
    
    print_success "Services deployed"
}

# Function to wait for services
wait_for_services() {
    print_status "Waiting for services to be ready..."
    
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if docker-compose -f "$PROJECT_ROOT/docker-compose.prod.yaml" ps | grep -q "Up"; then
            print_success "Services are running"
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
        use gitvizz_prod;
        db.createUser({
            user: 'gitvizz_app',
            pwd: '${MONGO_APP_PASSWORD}',
            roles: [{role: 'readWrite', db: 'gitvizz_prod'}]
        });
    "
    
    print_success "MongoDB initialized"
}

# Function to run health checks
run_health_checks() {
    print_status "Running health checks..."
    
    # Check if backend is responding
    if curl -f "http://localhost:8003/health" >/dev/null 2>&1; then
        print_success "Backend health check passed"
    else
        print_error "Backend health check failed"
        return 1
    fi
    
    # Check if frontend is responding
    if curl -f "http://localhost:3000" >/dev/null 2>&1; then
        print_success "Frontend health check passed"
    else
        print_error "Frontend health check failed"
        return 1
    fi
    
    # Check if nginx is responding
    if curl -f "http://localhost" >/dev/null 2>&1; then
        print_success "Nginx health check passed"
    else
        print_error "Nginx health check failed"
        return 1
    fi
    
    print_success "All health checks passed"
}

# Function to show deployment summary
show_deployment_summary() {
    print_success "GitVizz production deployment completed!"
    echo ""
    echo "🌐 Service URLs:"
    echo "  Main Site:     https://$DOMAIN"
    echo "  API Docs:      https://$DOMAIN/docs"
    echo "  Health Check:  https://$DOMAIN/health"
    echo "  Phoenix:       http://localhost:6006"
    echo ""
    echo "📊 Service Status:"
    docker-compose -f "$PROJECT_ROOT/docker-compose.prod.yaml" ps
    echo ""
    echo "🔧 Management Commands:"
    echo "  View logs:     docker-compose -f $PROJECT_ROOT/docker-compose.prod.yaml logs -f"
    echo "  Stop services: docker-compose -f $PROJECT_ROOT/docker-compose.prod.yaml down"
    echo "  Restart:       docker-compose -f $PROJECT_ROOT/docker-compose.prod.yaml restart"
    echo "  Health check:  $PROJECT_ROOT/scripts/health-check.sh"
    echo "  Backup:        $PROJECT_ROOT/scripts/backup-prod.sh"
    echo "  Update:        $PROJECT_ROOT/scripts/update-prod.sh"
    echo ""
    echo "🔐 Security Notes:"
    echo "  - Environment files are secured with 600 permissions"
    echo "  - SSL certificates auto-renew via cron"
    echo "  - MongoDB is configured with authentication"
    echo "  - Firewall should be configured (run security-setup.sh)"
    echo ""
    echo "📝 Next Steps:"
    echo "  1. Configure DNS: Point A record for $DOMAIN to this server's IP"
    echo "  2. Run security setup: $PROJECT_ROOT/scripts/security-setup.sh"
    echo "  3. Set up monitoring: $PROJECT_ROOT/scripts/setup-monitoring.sh (optional)"
    echo "  4. Test the application: https://$DOMAIN"
}

# Function to cleanup on error
cleanup() {
    print_error "Deployment failed. Cleaning up..."
    docker-compose -f "$PROJECT_ROOT/docker-compose.prod.yaml" down 2>/dev/null || true
    exit 1
}

# Main function
main() {
    print_status "GitVizz Production Deployment"
    print_status "============================="
    print_status "Domain: $DOMAIN"
    print_status "Project Root: $PROJECT_ROOT"
    echo ""
    
    # Set up error handling
    trap cleanup ERR
    
    # Check if running as root
    if [ "$EUID" -eq 0 ]; then
        print_error "Please do not run this script as root. Run as a regular user with sudo privileges."
        exit 1
    fi
    
    # Check VPS requirements
    check_vps_requirements
    
    # Check prerequisites
    check_prerequisites
    
    # Generate secrets
    generate_secrets
    
    # Prompt for user inputs
    prompt_user_inputs
    
    # Create environment files
    create_environment_files
    
    # Update docker-compose
    update_docker_compose
    
    # Create backup directory
    create_backup_directory
    
    # Setup SSL certificates
    setup_ssl
    
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
