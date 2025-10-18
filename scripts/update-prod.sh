#!/bin/bash

# GitVizz Production Update Script
# This script performs rolling updates with zero-downtime deployment

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DOMAIN="gitviz.sutools.app"
BACKUP_DIR="/opt/gitvizz-backups"
HEALTH_CHECK_SCRIPT="$PROJECT_ROOT/scripts/health-check.sh"
BACKUP_SCRIPT="$PROJECT_ROOT/scripts/backup-prod.sh"

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

# Function to check if running as root
check_root() {
    if [ "$EUID" -eq 0 ]; then
        print_error "This script should not be run as root. Please run as a regular user with sudo privileges."
        exit 1
    fi
}

# Function to check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    if ! command_exists docker; then
        print_error "Docker is not installed"
        exit 1
    fi
    
    if ! command_exists docker-compose; then
        print_error "Docker Compose is not installed"
        exit 1
    fi
    
    if ! command_exists git; then
        print_error "Git is not installed"
        exit 1
    fi
    
    print_success "Prerequisites check passed"
}

# Function to create pre-update backup
create_pre_update_backup() {
    print_status "Creating pre-update backup..."
    
    if [ -f "$BACKUP_SCRIPT" ]; then
        "$BACKUP_SCRIPT"
        print_success "Pre-update backup completed"
    else
        print_warning "Backup script not found. Skipping backup."
    fi
}

# Function to check current deployment status
check_current_status() {
    print_status "Checking current deployment status..."
    
    cd "$PROJECT_ROOT"
    
    if ! docker-compose -f docker-compose.prod.yaml ps | grep -q "Up"; then
        print_error "GitVizz services are not running"
        print_status "Please start the services first:"
        print_status "  docker-compose -f docker-compose.prod.yaml up -d"
        exit 1
    fi
    
    print_success "Current deployment is running"
}

# Function to pull latest code
pull_latest_code() {
    print_status "Pulling latest code from Git..."
    
    cd "$PROJECT_ROOT"
    
    # Check if we're in a git repository
    if [ ! -d ".git" ]; then
        print_error "Not a git repository. Cannot pull latest code."
        exit 1
    fi
    
    # Stash any local changes
    if ! git diff --quiet; then
        print_warning "Local changes detected. Stashing changes..."
        git stash push -m "Auto-stash before update $(date)"
    fi
    
    # Pull latest changes
    git fetch origin
    git pull origin main
    
    print_success "Latest code pulled successfully"
}

# Function to update environment files
update_environment_files() {
    print_status "Updating environment files..."
    
    # Check if environment files exist
    if [ ! -f "$PROJECT_ROOT/backend/.env.production" ]; then
        print_error "Backend environment file not found: $PROJECT_ROOT/backend/.env.production"
        exit 1
    fi
    
    if [ ! -f "$PROJECT_ROOT/frontend/.env.production" ]; then
        print_error "Frontend environment file not found: $PROJECT_ROOT/frontend/.env.production"
        exit 1
    fi
    
    print_success "Environment files are present"
}

# Function to rebuild Docker images
rebuild_images() {
    print_status "Rebuilding Docker images..."
    
    cd "$PROJECT_ROOT"
    
    # Build images without cache to ensure latest changes
    docker-compose -f docker-compose.prod.yaml build --no-cache
    
    print_success "Docker images rebuilt"
}

# Function to perform rolling update
perform_rolling_update() {
    print_status "Performing rolling update..."
    
    cd "$PROJECT_ROOT"
    
    # Update services one by one to minimize downtime
    print_status "Updating backend service..."
    docker-compose -f docker-compose.prod.yaml up -d --no-deps backend
    
    # Wait for backend to be ready
    print_status "Waiting for backend to be ready..."
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f "http://localhost:8003/health" >/dev/null 2>&1; then
            print_success "Backend is ready"
            break
        fi
        echo -n "."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    if [ $attempt -gt $max_attempts ]; then
        print_error "Backend failed to start within expected time"
        return 1
    fi
    
    # Update frontend service
    print_status "Updating frontend service..."
    docker-compose -f docker-compose.prod.yaml up -d --no-deps frontend
    
    # Wait for frontend to be ready
    print_status "Waiting for frontend to be ready..."
    attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f "http://localhost:3000" >/dev/null 2>&1; then
            print_success "Frontend is ready"
            break
        fi
        echo -n "."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    if [ $attempt -gt $max_attempts ]; then
        print_error "Frontend failed to start within expected time"
        return 1
    fi
    
    # Update nginx service
    print_status "Updating nginx service..."
    docker-compose -f docker-compose.prod.yaml up -d --no-deps nginx
    
    # Wait for nginx to be ready
    print_status "Waiting for nginx to be ready..."
    attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f "http://localhost" >/dev/null 2>&1; then
            print_success "Nginx is ready"
            break
        fi
        echo -n "."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    if [ $attempt -gt $max_attempts ]; then
        print_error "Nginx failed to start within expected time"
        return 1
    fi
    
    print_success "Rolling update completed"
}

# Function to run health checks
run_health_checks() {
    print_status "Running health checks..."
    
    if [ -f "$HEALTH_CHECK_SCRIPT" ]; then
        if "$HEALTH_CHECK_SCRIPT"; then
            print_success "Health checks passed"
            return 0
        else
            print_error "Health checks failed"
            return 1
        fi
    else
        print_warning "Health check script not found. Running basic checks..."
        
        # Basic health checks
        if curl -f "http://localhost:8003/health" >/dev/null 2>&1; then
            print_success "Backend health check passed"
        else
            print_error "Backend health check failed"
            return 1
        fi
        
        if curl -f "http://localhost:3000" >/dev/null 2>&1; then
            print_success "Frontend health check passed"
        else
            print_error "Frontend health check failed"
            return 1
        fi
        
        if curl -f "https://$DOMAIN" >/dev/null 2>&1; then
            print_success "HTTPS health check passed"
        else
            print_error "HTTPS health check failed"
            return 1
        fi
    fi
}

# Function to rollback on failure
rollback() {
    print_error "Update failed. Rolling back..."
    
    cd "$PROJECT_ROOT"
    
    # Stop current services
    docker-compose -f docker-compose.prod.yaml down
    
    # Restore from backup if available
    local latest_backup=$(find "$BACKUP_DIR" -name "gitvizz_backup_*.tar.gz" -type f -printf '%T@ %p\n' | sort -n | tail -1 | cut -d' ' -f2)
    
    if [ -n "$latest_backup" ] && [ -f "$latest_backup" ]; then
        print_status "Restoring from backup: $latest_backup"
        # Note: This would require a restore script to be implemented
        print_warning "Backup restore not implemented. Manual intervention required."
    fi
    
    # Start services with previous configuration
    docker-compose -f docker-compose.prod.yaml up -d
    
    print_error "Rollback completed. Please check the deployment manually."
    exit 1
}

# Function to cleanup old images
cleanup_old_images() {
    print_status "Cleaning up old Docker images..."
    
    # Remove unused images
    docker image prune -f
    
    # Remove dangling images
    docker images -f "dangling=true" -q | xargs -r docker rmi
    
    print_success "Old images cleaned up"
}

# Function to show update summary
show_update_summary() {
    print_success "GitVizz update completed successfully!"
    echo ""
    echo "📊 Update Summary:"
    echo "  Domain: $DOMAIN"
    echo "  Project Root: $PROJECT_ROOT"
    echo "  Update Time: $(date)"
    echo ""
    echo "🌐 Service URLs:"
    echo "  Main Site:     https://$DOMAIN"
    echo "  API Docs:      https://$DOMAIN/docs"
    echo "  Health Check:  https://$DOMAIN/health"
    echo ""
    echo "🔧 Management Commands:"
    echo "  View logs:     docker-compose -f $PROJECT_ROOT/docker-compose.prod.yaml logs -f"
    echo "  Health check:  $HEALTH_CHECK_SCRIPT"
    echo "  Backup:        $BACKUP_SCRIPT"
    echo "  Restart:       docker-compose -f $PROJECT_ROOT/docker-compose.prod.yaml restart"
    echo ""
    echo "📈 Service Status:"
    docker-compose -f "$PROJECT_ROOT/docker-compose.prod.yaml" ps
    echo ""
    echo "✅ All services are running and healthy"
}

# Function to cleanup on error
cleanup() {
    print_error "Update failed. Cleaning up..."
    rollback
}

# Main function
main() {
    print_status "GitVizz Production Update"
    print_status "=========================="
    print_status "Domain: $DOMAIN"
    print_status "Project Root: $PROJECT_ROOT"
    echo ""
    
    # Set up error handling
    trap cleanup ERR
    
    # Check if running as root
    check_root
    
    # Check prerequisites
    check_prerequisites
    
    # Check current status
    check_current_status
    
    # Create pre-update backup
    create_pre_update_backup
    
    # Pull latest code
    pull_latest_code
    
    # Update environment files
    update_environment_files
    
    # Rebuild Docker images
    rebuild_images
    
    # Perform rolling update
    perform_rolling_update
    
    # Run health checks
    if ! run_health_checks; then
        print_error "Health checks failed after update"
        rollback
    fi
    
    # Cleanup old images
    cleanup_old_images
    
    # Show update summary
    show_update_summary
}

# Run main function with all arguments
main "$@"
