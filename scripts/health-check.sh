#!/bin/bash

# GitVizz Production Health Check Script
# This script monitors the health of all GitVizz services

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
TIMEOUT=10
EXIT_CODE=0

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

# Function to check container status
check_container_status() {
    local container_name=$1
    local service_name=$2
    
    if docker ps --format "table {{.Names}}\t{{.Status}}" | grep -q "$container_name.*Up"; then
        print_success "$service_name container is running"
        return 0
    else
        print_error "$service_name container is not running"
        EXIT_CODE=1
        return 1
    fi
}

# Function to check HTTP endpoint
check_http_endpoint() {
    local url=$1
    local service_name=$2
    local expected_status=${3:-200}
    
    local response_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time $TIMEOUT "$url" 2>/dev/null || echo "000")
    
    if [ "$response_code" = "$expected_status" ]; then
        print_success "$service_name HTTP check passed ($response_code)"
        return 0
    else
        print_error "$service_name HTTP check failed (got $response_code, expected $expected_status)"
        EXIT_CODE=1
        return 1
    fi
}

# Function to check HTTPS endpoint
check_https_endpoint() {
    local url=$1
    local service_name=$2
    local expected_status=${3:-200}
    
    local response_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time $TIMEOUT -k "$url" 2>/dev/null || echo "000")
    
    if [ "$response_code" = "$expected_status" ]; then
        print_success "$service_name HTTPS check passed ($response_code)"
        return 0
    else
        print_error "$service_name HTTPS check failed (got $response_code, expected $expected_status)"
        EXIT_CODE=1
        return 1
    fi
}

# Function to check MongoDB connection
check_mongodb() {
    print_status "Checking MongoDB connection..."
    
    local container_name="gitvizz-mongo"
    
    if ! docker ps | grep -q "$container_name.*Up"; then
        print_error "MongoDB container is not running"
        EXIT_CODE=1
        return 1
    fi
    
    if docker exec "$container_name" mongosh --eval "db.adminCommand('ping')" >/dev/null 2>&1; then
        print_success "MongoDB connection successful"
        return 0
    else
        print_error "MongoDB connection failed"
        EXIT_CODE=1
        return 1
    fi
}

# Function to check backend API
check_backend_api() {
    print_status "Checking backend API..."
    
    # Check container
    check_container_status "gitvizz-backend" "Backend"
    
    # Check health endpoint
    check_http_endpoint "http://localhost:8003/health" "Backend Health"
    
    # Check API documentation
    check_http_endpoint "http://localhost:8003/docs" "Backend API Docs"
    
    # Check specific API endpoints
    check_http_endpoint "http://localhost:8003/api" "Backend API Root"
}

# Function to check frontend
check_frontend() {
    print_status "Checking frontend..."
    
    # Check container
    check_container_status "gitvizz-frontend" "Frontend"
    
    # Check HTTP endpoint
    check_http_endpoint "http://localhost:3000" "Frontend"
}

# Function to check nginx
check_nginx() {
    print_status "Checking nginx..."
    
    # Check container
    check_container_status "gitvizz-nginx" "Nginx"
    
    # Check HTTP redirect
    local redirect_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time $TIMEOUT "http://$DOMAIN" 2>/dev/null || echo "000")
    if [ "$redirect_code" = "301" ] || [ "$redirect_code" = "302" ]; then
        print_success "Nginx HTTP redirect working ($redirect_code)"
    else
        print_error "Nginx HTTP redirect failed (got $redirect_code)"
        EXIT_CODE=1
    fi
    
    # Check HTTPS
    check_https_endpoint "https://$DOMAIN" "Nginx HTTPS"
}

# Function to check Phoenix
check_phoenix() {
    print_status "Checking Phoenix observability..."
    
    # Check container
    check_container_status "gitvizz-phoenix" "Phoenix"
    
    # Check HTTP endpoint
    check_http_endpoint "http://localhost:6006" "Phoenix"
}

# Function to check disk space
check_disk_space() {
    print_status "Checking disk space..."
    
    local usage=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
    
    if [ "$usage" -lt 80 ]; then
        print_success "Disk usage is healthy ($usage%)"
    elif [ "$usage" -lt 90 ]; then
        print_warning "Disk usage is high ($usage%)"
    else
        print_error "Disk usage is critical ($usage%)"
        EXIT_CODE=1
    fi
}

# Function to check memory usage
check_memory_usage() {
    print_status "Checking memory usage..."
    
    local usage=$(free | awk 'NR==2{printf "%.0f", $3*100/$2}')
    
    if [ "$usage" -lt 80 ]; then
        print_success "Memory usage is healthy ($usage%)"
    elif [ "$usage" -lt 90 ]; then
        print_warning "Memory usage is high ($usage%)"
    else
        print_error "Memory usage is critical ($usage%)"
        EXIT_CODE=1
    fi
}

# Function to check SSL certificate
check_ssl_certificate() {
    print_status "Checking SSL certificate..."
    
    local cert_file="$PROJECT_ROOT/nginx/ssl/fullchain.pem"
    
    if [ ! -f "$cert_file" ]; then
        print_error "SSL certificate file not found: $cert_file"
        EXIT_CODE=1
        return 1
    fi
    
    local cert_expiry=$(openssl x509 -in "$cert_file" -noout -dates | grep "notAfter" | cut -d= -f2)
    local days_until_expiry=$(( ($(date -d "$cert_expiry" +%s) - $(date +%s)) / 86400 ))
    
    if [ "$days_until_expiry" -gt 30 ]; then
        print_success "SSL certificate is valid for $days_until_expiry days"
    elif [ "$days_until_expiry" -gt 7 ]; then
        print_warning "SSL certificate expires in $days_until_expiry days"
    else
        print_error "SSL certificate expires in $days_until_expiry days"
        EXIT_CODE=1
    fi
}

# Function to check Docker daemon
check_docker_daemon() {
    print_status "Checking Docker daemon..."
    
    if docker info >/dev/null 2>&1; then
        print_success "Docker daemon is running"
        return 0
    else
        print_error "Docker daemon is not running"
        EXIT_CODE=1
        return 1
    fi
}

# Function to check Docker Compose
check_docker_compose() {
    print_status "Checking Docker Compose services..."
    
    cd "$PROJECT_ROOT"
    
    if docker-compose -f docker-compose.prod.yaml ps | grep -q "Up"; then
        print_success "Docker Compose services are running"
        docker-compose -f docker-compose.prod.yaml ps
    else
        print_error "Docker Compose services are not running"
        EXIT_CODE=1
    fi
}

# Function to check logs for errors
check_recent_logs() {
    print_status "Checking recent logs for errors..."
    
    local error_count=0
    
    # Check backend logs
    local backend_errors=$(docker logs gitvizz-backend --since 1h 2>&1 | grep -i error | wc -l)
    if [ "$backend_errors" -gt 0 ]; then
        print_warning "Backend has $backend_errors errors in the last hour"
        error_count=$((error_count + backend_errors))
    fi
    
    # Check frontend logs
    local frontend_errors=$(docker logs gitvizz-frontend --since 1h 2>&1 | grep -i error | wc -l)
    if [ "$frontend_errors" -gt 0 ]; then
        print_warning "Frontend has $frontend_errors errors in the last hour"
        error_count=$((error_count + frontend_errors))
    fi
    
    # Check nginx logs
    local nginx_errors=$(docker logs gitvizz-nginx --since 1h 2>&1 | grep -i error | wc -l)
    if [ "$nginx_errors" -gt 0 ]; then
        print_warning "Nginx has $nginx_errors errors in the last hour"
        error_count=$((error_count + nginx_errors))
    fi
    
    if [ "$error_count" -eq 0 ]; then
        print_success "No recent errors found in logs"
    else
        print_warning "Total errors in logs: $error_count"
    fi
}

# Function to show service URLs
show_service_urls() {
    print_status "Service URLs:"
    echo ""
    echo "🌐 Public URLs:"
    echo "  Main Site:     https://$DOMAIN"
    echo "  API Docs:      https://$DOMAIN/docs"
    echo "  Health Check:  https://$DOMAIN/health"
    echo ""
    echo "🔧 Internal URLs:"
    echo "  Backend:       http://localhost:8003"
    echo "  Frontend:      http://localhost:3000"
    echo "  Phoenix:       http://localhost:6006"
    echo "  MongoDB:       mongodb://localhost:27017"
    echo ""
}

# Function to show system information
show_system_info() {
    print_status "System Information:"
    echo ""
    echo "💻 System:"
    echo "  OS: $(uname -s) $(uname -r)"
    echo "  Hostname: $(hostname)"
    echo "  Uptime: $(uptime -p)"
    echo ""
    echo "💾 Resources:"
    echo "  Memory: $(free -h | awk 'NR==2{print $3 "/" $2}')"
    echo "  Disk: $(df -h / | awk 'NR==2{print $3 "/" $2 " (" $5 ")"}')"
    echo "  Load: $(uptime | awk -F'load average:' '{print $2}')"
    echo ""
    echo "🐳 Docker:"
    echo "  Version: $(docker --version)"
    echo "  Compose: $(docker-compose --version)"
    echo "  Images: $(docker images | wc -l) total"
    echo "  Containers: $(docker ps | wc -l) running"
    echo ""
}

# Function to show health summary
show_health_summary() {
    echo ""
    print_status "Health Check Summary"
    print_status "===================="
    
    if [ $EXIT_CODE -eq 0 ]; then
        print_success "All health checks passed! ✅"
        echo ""
        echo "🎉 GitVizz is running smoothly"
        echo "   All services are operational"
        echo "   System resources are healthy"
        echo "   SSL certificate is valid"
    else
        print_error "Some health checks failed! ❌"
        echo ""
        echo "⚠️  Please review the failed checks above"
        echo "   Check service logs for more details"
        echo "   Consider restarting failed services"
    fi
    
    echo ""
    echo "🔧 Troubleshooting Commands:"
    echo "  View logs: docker-compose -f $PROJECT_ROOT/docker-compose.prod.yaml logs -f"
    echo "  Restart: docker-compose -f $PROJECT_ROOT/docker-compose.prod.yaml restart"
    echo "  Update: $PROJECT_ROOT/scripts/update-prod.sh"
    echo "  Backup: $PROJECT_ROOT/scripts/backup-prod.sh"
    echo ""
}

# Function to cleanup on error
cleanup() {
    print_error "Health check failed. Exiting with code $EXIT_CODE"
    exit $EXIT_CODE
}

# Main function
main() {
    print_status "GitVizz Production Health Check"
    print_status "==============================="
    print_status "Domain: $DOMAIN"
    print_status "Project Root: $PROJECT_ROOT"
    print_status "Timeout: ${TIMEOUT}s"
    echo ""
    
    # Set up error handling
    trap cleanup ERR
    
    # Check Docker daemon
    check_docker_daemon
    
    # Check Docker Compose services
    check_docker_compose
    
    # Check individual containers
    check_container_status "gitvizz-mongo" "MongoDB"
    check_container_status "gitvizz-backend" "Backend"
    check_container_status "gitvizz-frontend" "Frontend"
    check_container_status "gitvizz-nginx" "Nginx"
    check_container_status "gitvizz-phoenix" "Phoenix"
    
    # Check service endpoints
    check_mongodb
    check_backend_api
    check_frontend
    check_nginx
    check_phoenix
    
    # Check system resources
    check_disk_space
    check_memory_usage
    
    # Check SSL certificate
    check_ssl_certificate
    
    # Check recent logs
    check_recent_logs
    
    # Show service URLs
    show_service_urls
    
    # Show system information
    show_system_info
    
    # Show health summary
    show_health_summary
    
    # Exit with appropriate code
    exit $EXIT_CODE
}

# Run main function with all arguments
main "$@"
