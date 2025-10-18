#!/bin/bash

# GitVizz Full-Stack Manager
# Simplified interface for managing the full-stack GitVizz application

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEPLOY_SCRIPT="$PROJECT_ROOT/scripts/deploy-full-stack.sh"

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
    echo "GitVizz Full-Stack Manager"
    echo "========================="
    echo ""
    echo "Usage: $0 COMMAND [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  deploy [OPTIONS]    Deploy the full-stack application"
    echo "  start               Start all services"
    echo "  stop                Stop all services"
    echo "  restart             Restart all services"
    echo "  status              Show service status"
    echo "  logs                Show logs for all services"
    echo "  health              Check health of all services"
    echo "  update              Update full-stack deployment"
    echo "  backup              Create backup of all data"
    echo "  clean               Clean up all resources"
    echo "  help                Show this help message"
    echo ""
    echo "Deploy Options:"
    echo "  --backend-port PORT    Backend port (default: 8003)"
    echo "  --frontend-port PORT    Frontend port (default: 3000)"
    echo "  --domain DOMAIN        Domain for CORS (default: localhost)"
    echo "  --no-mongo             Deploy without MongoDB (external DB)"
    echo "  --backup               Create backup before deployment"
    echo ""
    echo "Examples:"
    echo "  $0 deploy                    # Deploy full stack with MongoDB"
    echo "  $0 deploy --no-mongo         # Deploy without MongoDB"
    echo "  $0 deploy --backend-port 8004 # Deploy on custom backend port"
    echo "  $0 start                     # Start all services"
    echo "  $0 status                    # Check status"
    echo "  $0 logs                      # View logs"
}

# Function to check if services are running
are_services_running() {
    # Check if any GitVizz containers are running
    if docker ps --format "table {{.Names}}" | grep -q "gitvizz"; then
        return 0
    fi
    return 1
}

# Function to get service status
get_service_status() {
    if are_services_running; then
        echo "Running"
    else
        echo "Stopped"
    fi
}

# Function to show status
show_status() {
    print_status "Full-Stack Service Status"
    echo "=============================="
    echo ""
    
    local status=$(get_service_status)
    if [ "$status" = "Running" ]; then
        print_success "Status: $status"
        
        # Check individual service health
        echo ""
        print_status "Service Health:"
        
        # Check backend
        if curl -f "http://localhost:8003/health" >/dev/null 2>&1; then
            print_success "  Backend: Healthy"
        else
            print_warning "  Backend: Unhealthy"
        fi
        
        # Check frontend
        if curl -f "http://localhost:3000" >/dev/null 2>&1; then
            print_success "  Frontend: Healthy"
        else
            print_warning "  Frontend: Unhealthy"
        fi
        
        # Check Phoenix
        if curl -f "http://localhost:6006" >/dev/null 2>&1; then
            print_success "  Phoenix: Healthy"
        else
            print_warning "  Phoenix: Unhealthy"
        fi
        
        # Show Docker containers
        echo ""
        print_status "Docker Containers:"
        docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep gitvizz
    else
        print_error "Status: $status"
    fi
}

# Function to start services
start_services() {
    if are_services_running; then
        print_warning "Services are already running"
        return 0
    fi
    
    print_status "Starting full-stack services..."
    
    # Check which compose file exists
    local compose_file
    if [ -f "$PROJECT_ROOT/docker-compose.full-stack.yaml" ]; then
        compose_file="docker-compose.full-stack.yaml"
    elif [ -f "$PROJECT_ROOT/docker-compose.full-stack-no-mongo.yaml" ]; then
        compose_file="docker-compose.full-stack-no-mongo.yaml"
    else
        print_error "No deployment found. Please run 'deploy' first."
        exit 1
    fi
    
    cd "$PROJECT_ROOT"
    docker-compose -f "$compose_file" up -d
    print_success "Full-stack services started"
}

# Function to stop services
stop_services() {
    if ! are_services_running; then
        print_warning "Services are not running"
        return 0
    fi
    
    print_status "Stopping full-stack services..."
    
    # Stop Docker containers
    cd "$PROJECT_ROOT"
    local compose_file
    if [ -f "docker-compose.full-stack.yaml" ]; then
        compose_file="docker-compose.full-stack.yaml"
    elif [ -f "docker-compose.full-stack-no-mongo.yaml" ]; then
        compose_file="docker-compose.full-stack-no-mongo.yaml"
    fi
    
    if [ -n "$compose_file" ]; then
        docker-compose -f "$compose_file" down
        print_success "Full-stack services stopped"
    fi
}

# Function to restart services
restart_services() {
    print_status "Restarting full-stack services..."
    stop_services
    sleep 2
    start_services
}

# Function to show logs
show_logs() {
    if ! are_services_running; then
        print_error "Services are not running"
        exit 1
    fi
    
    print_status "Showing full-stack logs..."
    
    # Show Docker logs
    cd "$PROJECT_ROOT"
    local compose_file
    if [ -f "docker-compose.full-stack.yaml" ]; then
        compose_file="docker-compose.full-stack.yaml"
    elif [ -f "docker-compose.full-stack-no-mongo.yaml" ]; then
        compose_file="docker-compose.full-stack-no-mongo.yaml"
    fi
    
    if [ -n "$compose_file" ]; then
        docker-compose -f "$compose_file" logs -f
    else
        print_error "No Docker Compose file found"
    fi
}

# Function to check health
check_health() {
    print_status "Checking full-stack health..."
    
    local all_healthy=true
    
    # Check backend
    if curl -f "http://localhost:8003/health" >/dev/null 2>&1; then
        print_success "Backend: Healthy"
    else
        print_error "Backend: Unhealthy"
        all_healthy=false
    fi
    
    # Check frontend
    if curl -f "http://localhost:3000" >/dev/null 2>&1; then
        print_success "Frontend: Healthy"
    else
        print_error "Frontend: Unhealthy"
        all_healthy=false
    fi
    
    # Check Phoenix
    if curl -f "http://localhost:6006" >/dev/null 2>&1; then
        print_success "Phoenix: Healthy"
    else
        print_warning "Phoenix: Unhealthy (optional)"
    fi
    
    if [ "$all_healthy" = true ]; then
        print_success "All core services are healthy"
        return 0
    else
        print_error "Some services are unhealthy"
        return 1
    fi
}

# Function to create backup
create_backup() {
    print_status "Creating full-stack backup..."
    
    local backup_dir="/opt/gitvizz-full-stack-backups"
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
        print_success "Backend storage backup created"
    fi
    
    # Backup configuration files
    if [ -f "$PROJECT_ROOT/backend/.env" ] || [ -f "$PROJECT_ROOT/frontend/.env.local" ]; then
        tar czf "$backup_dir/config-backup-$timestamp.tar.gz" -C "$PROJECT_ROOT" backend/.env frontend/.env.local 2>/dev/null || true
        print_success "Configuration backup created"
    fi
    
    print_success "Full-stack backup completed at $backup_dir"
}

# Function to clean up
clean_up() {
    print_status "Cleaning up full-stack resources..."
    
    # Stop and remove Docker containers
    cd "$PROJECT_ROOT"
    if [ -f "docker-compose.full-stack.yaml" ]; then
        docker-compose -f docker-compose.full-stack.yaml down -v
        print_success "Docker resources cleaned (with MongoDB)"
    fi
    
    if [ -f "docker-compose.full-stack-no-mongo.yaml" ]; then
        docker-compose -f docker-compose.full-stack-no-mongo.yaml down -v
        print_success "Docker resources cleaned (no MongoDB)"
    fi
    
    # Remove Docker Compose files
    if [ -f "$PROJECT_ROOT/docker-compose.full-stack.yaml" ]; then
        rm "$PROJECT_ROOT/docker-compose.full-stack.yaml"
        print_success "Docker Compose file removed (with MongoDB)"
    fi
    
    if [ -f "$PROJECT_ROOT/docker-compose.full-stack-no-mongo.yaml" ]; then
        rm "$PROJECT_ROOT/docker-compose.full-stack-no-mongo.yaml"
        print_success "Docker Compose file removed (no MongoDB)"
    fi
    
    # Remove environment files
    if [ -f "$PROJECT_ROOT/backend/.env" ]; then
        rm "$PROJECT_ROOT/backend/.env"
        print_success "Backend environment file removed"
    fi
    
    if [ -f "$PROJECT_ROOT/frontend/.env.local" ]; then
        rm "$PROJECT_ROOT/frontend/.env.local"
        print_success "Frontend environment file removed"
    fi
    
    print_success "Full-stack cleanup completed"
}

# Function to update services
update_services() {
    print_status "Updating full-stack deployment..."
    
    # Create backup before update
    create_backup
    
    # Stop current services
    stop_services
    
    # Run deployment script with update flag
    "$DEPLOY_SCRIPT" --update
    
    print_success "Full-stack updated"
}

# Main function
main() {
    case "${1:-help}" in
        deploy)
            shift
            "$DEPLOY_SCRIPT" "$@"
            ;;
        start)
            start_services
            ;;
        stop)
            stop_services
            ;;
        restart)
            restart_services
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
            update_services
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
