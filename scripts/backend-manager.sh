#!/bin/bash

# GitVizz Backend Manager
# Simplified interface for managing the GitVizz backend service

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEPLOY_SCRIPT="$PROJECT_ROOT/scripts/deploy-backend.sh"

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
    echo "GitVizz Backend Manager"
    echo "======================="
    echo ""
    echo "Usage: $0 COMMAND [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  deploy [OPTIONS]    Deploy the backend service"
    echo "  start               Start the backend service"
    echo "  stop                Stop the backend service"
    echo "  restart             Restart the backend service"
    echo "  status              Show backend service status"
    echo "  logs                Show backend logs"
    echo "  health              Check backend health"
    echo "  update              Update backend deployment"
    echo "  backup              Create backup of backend data"
    echo "  clean               Clean up backend resources"
    echo "  help                Show this help message"
    echo ""
    echo "Deploy Options:"
    echo "  --mode docker       Deploy with Docker (default)"
    echo "  --mode native        Deploy natively with Python"
    echo "  --port PORT          Backend port (default: 8003)"
    echo "  --domain DOMAIN      Domain for CORS (default: localhost)"
    echo "  --backup             Create backup before deployment"
    echo ""
    echo "Examples:"
    echo "  $0 deploy                    # Deploy with Docker"
    echo "  $0 deploy --mode native     # Deploy natively"
    echo "  $0 deploy --port 8004       # Deploy on port 8004"
    echo "  $0 start                    # Start service"
    echo "  $0 status                   # Check status"
    echo "  $0 logs                     # View logs"
}

# Function to check if backend is running
is_backend_running() {
    # Check Docker containers
    if docker ps --format "table {{.Names}}" | grep -q "gitvizz-backend"; then
        return 0
    fi
    
    # Check native process
    if [ -f "$PROJECT_ROOT/backend/backend.pid" ]; then
        local pid=$(cat "$PROJECT_ROOT/backend/backend.pid")
        if kill -0 "$pid" 2>/dev/null; then
            return 0
        fi
    fi
    
    return 1
}

# Function to get backend status
get_backend_status() {
    if is_backend_running; then
        echo "Running"
    else
        echo "Stopped"
    fi
}

# Function to show status
show_status() {
    print_status "Backend Service Status"
    echo "========================"
    echo ""
    
    local status=$(get_backend_status)
    if [ "$status" = "Running" ]; then
        print_success "Status: $status"
        
        # Check health
        if curl -f "http://localhost:8003/health" >/dev/null 2>&1; then
            print_success "Health: Healthy"
        else
            print_warning "Health: Unhealthy"
        fi
        
        # Show Docker containers if using Docker
        if docker ps --format "table {{.Names}}" | grep -q "gitvizz"; then
            echo ""
            print_status "Docker Containers:"
            docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep gitvizz
        fi
        
        # Show native process if using native
        if [ -f "$PROJECT_ROOT/backend/backend.pid" ]; then
            local pid=$(cat "$PROJECT_ROOT/backend/backend.pid")
            if kill -0 "$pid" 2>/dev/null; then
                echo ""
                print_status "Native Process:"
                echo "  PID: $pid"
                echo "  Log: $PROJECT_ROOT/backend/backend.log"
            fi
        fi
    else
        print_error "Status: $status"
    fi
}

# Function to start backend
start_backend() {
    if is_backend_running; then
        print_warning "Backend is already running"
        return 0
    fi
    
    print_status "Starting backend service..."
    
    # Check if Docker Compose file exists
    if [ -f "$PROJECT_ROOT/docker-compose.backend.yaml" ]; then
        cd "$PROJECT_ROOT"
        docker-compose -f docker-compose.backend.yaml up -d
        print_success "Backend started with Docker"
    else
        print_error "No deployment found. Please run 'deploy' first."
        exit 1
    fi
}

# Function to stop backend
stop_backend() {
    if ! is_backend_running; then
        print_warning "Backend is not running"
        return 0
    fi
    
    print_status "Stopping backend service..."
    
    # Stop Docker containers
    if docker ps --format "table {{.Names}}" | grep -q "gitvizz-backend"; then
        cd "$PROJECT_ROOT"
        docker-compose -f docker-compose.backend.yaml down
        print_success "Backend stopped (Docker)"
    fi
    
    # Stop native process
    if [ -f "$PROJECT_ROOT/backend/backend.pid" ]; then
        local pid=$(cat "$PROJECT_ROOT/backend/backend.pid")
        if kill -0 "$pid" 2>/dev/null; then
            kill "$pid"
            rm "$PROJECT_ROOT/backend/backend.pid"
            print_success "Backend stopped (Native, PID: $pid)"
        fi
    fi
}

# Function to restart backend
restart_backend() {
    print_status "Restarting backend service..."
    stop_backend
    sleep 2
    start_backend
}

# Function to show logs
show_logs() {
    if ! is_backend_running; then
        print_error "Backend is not running"
        exit 1
    fi
    
    print_status "Showing backend logs..."
    
    # Show Docker logs
    if docker ps --format "table {{.Names}}" | grep -q "gitvizz-backend"; then
        docker-compose -f "$PROJECT_ROOT/docker-compose.backend.yaml" logs -f backend
    # Show native logs
    elif [ -f "$PROJECT_ROOT/backend/backend.log" ]; then
        tail -f "$PROJECT_ROOT/backend/backend.log"
    else
        print_error "No logs found"
    fi
}

# Function to check health
check_health() {
    print_status "Checking backend health..."
    
    if curl -f "http://localhost:8003/health" >/dev/null 2>&1; then
        print_success "Backend is healthy"
        return 0
    else
        print_error "Backend is unhealthy"
        return 1
    fi
}

# Function to create backup
create_backup() {
    print_status "Creating backend backup..."
    
    local backup_dir="/opt/gitvizz-backend-backups"
    sudo mkdir -p "$backup_dir"
    sudo chown -R $(whoami):$(whoami) "$backup_dir"
    
    local timestamp=$(date +%Y%m%d-%H%M%S)
    
    # Backup Docker volumes
    if docker ps --format "table {{.Names}}" | grep -q "gitvizz-mongo"; then
        docker run --rm -v gitvizz-mongo-data:/data -v "$backup_dir":/backup alpine tar czf "/backup/mongo-backup-$timestamp.tar.gz" -C /data .
        print_success "MongoDB backup created"
    fi
    
    if docker ps --format "table {{.Names}}" | grep -q "gitvizz-backend"; then
        docker run --rm -v gitvizz-backend-storage:/data -v "$backup_dir":/backup alpine tar czf "/backup/storage-backup-$timestamp.tar.gz" -C /data .
        print_success "Storage backup created"
    fi
    
    # Backup native files
    if [ -d "$PROJECT_ROOT/backend" ]; then
        tar czf "$backup_dir/backend-files-$timestamp.tar.gz" -C "$PROJECT_ROOT/backend" .
        print_success "Backend files backup created"
    fi
    
    print_success "Backup completed at $backup_dir"
}

# Function to clean up
clean_up() {
    print_status "Cleaning up backend resources..."
    
    # Stop and remove Docker containers
    if [ -f "$PROJECT_ROOT/docker-compose.backend.yaml" ]; then
        cd "$PROJECT_ROOT"
        docker-compose -f docker-compose.backend.yaml down -v
        print_success "Docker resources cleaned"
    fi
    
    # Remove native files
    if [ -f "$PROJECT_ROOT/backend/backend.pid" ]; then
        rm "$PROJECT_ROOT/backend/backend.pid"
    fi
    
    if [ -f "$PROJECT_ROOT/backend/backend.log" ]; then
        rm "$PROJECT_ROOT/backend/backend.log"
    fi
    
    # Remove Docker Compose file
    if [ -f "$PROJECT_ROOT/docker-compose.backend.yaml" ]; then
        rm "$PROJECT_ROOT/docker-compose.backend.yaml"
        print_success "Docker Compose file removed"
    fi
    
    print_success "Cleanup completed"
}

# Function to update backend
update_backend() {
    print_status "Updating backend deployment..."
    
    # Create backup before update
    create_backup
    
    # Stop current service
    stop_backend
    
    # Run deployment script with update flag
    "$DEPLOY_SCRIPT" --update
    
    print_success "Backend updated"
}

# Main function
main() {
    case "${1:-help}" in
        deploy)
            shift
            "$DEPLOY_SCRIPT" "$@"
            ;;
        start)
            start_backend
            ;;
        stop)
            stop_backend
            ;;
        restart)
            restart_backend
            ;;
        status)
            show_status
            ;;
        logs)
            show_logs
            ;;
        health)
            check_health
            ;;
        update)
            update_backend
            ;;
        backup)
            create_backup
            ;;
        clean)
            clean_up
            ;;
        help|--help|-h)
            show_usage
            ;;
        *)
            print_error "Unknown command: $1"
            show_usage
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"
