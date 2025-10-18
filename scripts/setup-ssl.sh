#!/bin/bash

# GitVizz SSL Certificate Setup Script
# This script sets up Let's Encrypt SSL certificates for gitviz.sutools.app

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
NGINX_SSL_DIR="$PROJECT_ROOT/nginx/ssl"

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

# Function to install certbot if not present
install_certbot() {
    if ! command_exists certbot; then
        print_status "Installing Certbot..."
        sudo apt-get update
        sudo apt-get install -y certbot python3-certbot-nginx
        print_success "Certbot installed"
    else
        print_success "Certbot is already installed"
    fi
}

# Function to check domain resolution
check_domain_resolution() {
    print_status "Checking domain resolution for $DOMAIN..."
    
    local domain_ip=$(dig +short $DOMAIN | head -n1)
    local server_ip=$(curl -s ifconfig.me)
    
    if [ -z "$domain_ip" ]; then
        print_error "Domain $DOMAIN does not resolve to any IP address"
        print_status "Please configure DNS A record for $DOMAIN to point to this server's IP: $server_ip"
        exit 1
    fi
    
    if [ "$domain_ip" != "$server_ip" ]; then
        print_warning "Domain $DOMAIN resolves to $domain_ip but this server's IP is $server_ip"
        print_status "Please update DNS A record for $DOMAIN to point to $server_ip"
        read -p "Continue anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
    
    print_success "Domain resolution verified"
}

# Function to stop nginx temporarily
stop_nginx() {
    print_status "Stopping nginx for certificate generation..."
    docker-compose -f "$PROJECT_ROOT/docker-compose.prod.yaml" stop nginx 2>/dev/null || true
    sudo systemctl stop nginx 2>/dev/null || true
    print_success "Nginx stopped"
}

# Function to start nginx
start_nginx() {
    print_status "Starting nginx..."
    docker-compose -f "$PROJECT_ROOT/docker-compose.prod.yaml" start nginx 2>/dev/null || true
    print_success "Nginx started"
}

# Function to obtain SSL certificate
obtain_certificate() {
    print_status "Obtaining SSL certificate for $DOMAIN..."
    
    # Check if certificates already exist
    if [ -f "$NGINX_SSL_DIR/fullchain.pem" ] && [ -f "$NGINX_SSL_DIR/privkey.pem" ]; then
        print_warning "SSL certificates already exist at $NGINX_SSL_DIR"
        read -p "Do you want to renew them? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_status "Skipping certificate generation"
            return 0
        fi
    fi
    
    # Create nginx ssl directory
    mkdir -p "$NGINX_SSL_DIR"
    
    # Stop nginx
    stop_nginx
    
    # Obtain certificate using standalone mode
    local certbot_cmd="certbot certonly --standalone --non-interactive --agree-tos"
    
    # Add email if provided
    if [ -n "$SSL_EMAIL" ]; then
        certbot_cmd="$certbot_cmd --email $SSL_EMAIL"
    else
        certbot_cmd="$certbot_cmd --register-unsafely-without-email"
    fi
    
    # Add domains
    certbot_cmd="$certbot_cmd -d $DOMAIN -d www.$DOMAIN"
    
    print_status "Running: $certbot_cmd"
    sudo $certbot_cmd
    
    # Copy certificates to nginx directory
    print_status "Copying certificates to nginx directory..."
    sudo cp "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" "$NGINX_SSL_DIR/"
    sudo cp "/etc/letsencrypt/live/$DOMAIN/privkey.pem" "$NGINX_SSL_DIR/"
    sudo chown -R $(whoami):$(whoami) "$NGINX_SSL_DIR"
    sudo chmod 644 "$NGINX_SSL_DIR/fullchain.pem"
    sudo chmod 600 "$NGINX_SSL_DIR/privkey.pem"
    
    print_success "SSL certificates obtained and configured"
}

# Function to set up auto-renewal
setup_auto_renewal() {
    print_status "Setting up automatic certificate renewal..."
    
    # Check if cron job already exists
    if crontab -l 2>/dev/null | grep -q "certbot renew"; then
        print_warning "Certificate renewal cron job already exists"
    else
        # Add renewal cron job (run twice daily)
        (crontab -l 2>/dev/null; echo "0 12 * * * /usr/bin/certbot renew --quiet --post-hook 'docker-compose -f $PROJECT_ROOT/docker-compose.prod.yaml restart nginx'") | crontab -
        print_success "Certificate auto-renewal configured"
    fi
    
    # Test renewal
    print_status "Testing certificate renewal..."
    sudo certbot renew --dry-run
    print_success "Certificate renewal test passed"
}

# Function to verify certificate
verify_certificate() {
    print_status "Verifying SSL certificate..."
    
    # Wait a moment for nginx to start
    sleep 5
    
    # Check if HTTPS is working
    if curl -f "https://$DOMAIN" >/dev/null 2>&1; then
        print_success "HTTPS is working correctly"
    else
        print_warning "HTTPS verification failed. This might be normal if nginx is not running yet."
    fi
    
    # Check certificate details
    print_status "Certificate details:"
    echo | openssl s_client -servername $DOMAIN -connect $DOMAIN:443 2>/dev/null | openssl x509 -noout -dates
}

# Function to show certificate status
show_certificate_status() {
    print_status "SSL Certificate Status:"
    echo ""
    echo "📜 Certificate Files:"
    echo "  Full Chain: $NGINX_SSL_DIR/fullchain.pem"
    echo "  Private Key: $NGINX_SSL_DIR/privkey.pem"
    echo ""
    echo "🔄 Auto-Renewal:"
    echo "  Cron Job: $(crontab -l 2>/dev/null | grep certbot || echo 'Not configured')"
    echo "  Next Renewal: $(sudo certbot certificates 2>/dev/null | grep -A 2 $DOMAIN | grep 'Expiry Date' || echo 'Unknown')"
    echo ""
    echo "🌐 Test URLs:"
    echo "  HTTPS: https://$DOMAIN"
    echo "  HTTP Redirect: http://$DOMAIN (should redirect to HTTPS)"
    echo ""
    echo "🔧 Management Commands:"
    echo "  Renew manually: sudo certbot renew"
    echo "  Check status: sudo certbot certificates"
    echo "  Test renewal: sudo certbot renew --dry-run"
}

# Function to cleanup on error
cleanup() {
    print_error "SSL setup failed. Cleaning up..."
    start_nginx
    exit 1
}

# Main function
main() {
    print_status "GitVizz SSL Certificate Setup"
    print_status "============================="
    print_status "Domain: $DOMAIN"
    print_status "Project Root: $PROJECT_ROOT"
    echo ""
    
    # Set up error handling
    trap cleanup ERR
    
    # Check if running as root
    check_root
    
    # Install certbot if needed
    install_certbot
    
    # Check domain resolution
    check_domain_resolution
    
    # Prompt for email (optional)
    read -p "Email for SSL certificate notifications (optional): " SSL_EMAIL
    
    # Obtain certificate
    obtain_certificate
    
    # Set up auto-renewal
    setup_auto_renewal
    
    # Start nginx
    start_nginx
    
    # Verify certificate
    verify_certificate
    
    # Show certificate status
    show_certificate_status
    
    print_success "SSL certificate setup completed!"
}

# Run main function with all arguments
main "$@"
