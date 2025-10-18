#!/bin/bash

# GitVizz Production Backup Script
# This script creates automated backups of MongoDB, storage files, and environment files

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="/opt/gitvizz-backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="gitvizz_backup_$DATE"
BACKUP_PATH="$BACKUP_DIR/$BACKUP_NAME"
MONGO_CONTAINER="gitvizz-mongo"
RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-30}

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

# Function to check if running as root
check_root() {
    if [ "$EUID" -eq 0 ]; then
        print_error "This script should not be run as root. Please run as a regular user with sudo privileges."
        exit 1
    fi
}

# Function to create backup directory
create_backup_directory() {
    print_status "Creating backup directory: $BACKUP_PATH"
    
    mkdir -p "$BACKUP_PATH"
    mkdir -p "$BACKUP_PATH/mongodb"
    mkdir -p "$BACKUP_PATH/storage"
    mkdir -p "$BACKUP_PATH/environment"
    
    print_success "Backup directory created"
}

# Function to backup MongoDB
backup_mongodb() {
    print_status "Backing up MongoDB..."
    
    if ! docker ps | grep -q "$MONGO_CONTAINER"; then
        print_error "MongoDB container '$MONGO_CONTAINER' is not running"
        return 1
    fi
    
    # Get MongoDB credentials from environment
    local mongo_uri=$(grep "MONGO_URI=" "$PROJECT_ROOT/backend/.env.production" | cut -d'=' -f2-)
    local mongo_user=$(echo "$mongo_uri" | sed 's/.*:\/\/\([^:]*\):.*/\1/')
    local mongo_pass=$(echo "$mongo_uri" | sed 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/')
    local mongo_db=$(echo "$mongo_uri" | sed 's/.*\/\([^?]*\).*/\1/')
    
    # Create MongoDB dump
    docker exec "$MONGO_CONTAINER" mongodump \
        --username "$mongo_user" \
        --password "$mongo_pass" \
        --authenticationDatabase "$mongo_db" \
        --db "$mongo_db" \
        --out "/backup/$BACKUP_NAME"
    
    # Copy dump from container to host
    docker cp "$MONGO_CONTAINER:/backup/$BACKUP_NAME" "$BACKUP_PATH/mongodb/"
    
    # Clean up container backup
    docker exec "$MONGO_CONTAINER" rm -rf "/backup/$BACKUP_NAME"
    
    print_success "MongoDB backup completed"
}

# Function to backup storage files
backup_storage() {
    print_status "Backing up storage files..."
    
    local storage_path="$PROJECT_ROOT/storage"
    
    if [ -d "$storage_path" ]; then
        tar -czf "$BACKUP_PATH/storage/storage_files.tar.gz" -C "$PROJECT_ROOT" storage/
        print_success "Storage files backup completed"
    else
        print_warning "Storage directory not found: $storage_path"
    fi
}

# Function to backup environment files
backup_environment() {
    print_status "Backing up environment files..."
    
    # Backup backend environment
    if [ -f "$PROJECT_ROOT/backend/.env.production" ]; then
        cp "$PROJECT_ROOT/backend/.env.production" "$BACKUP_PATH/environment/backend.env.production"
    fi
    
    # Backup frontend environment
    if [ -f "$PROJECT_ROOT/frontend/.env.production" ]; then
        cp "$PROJECT_ROOT/frontend/.env.production" "$BACKUP_PATH/environment/frontend.env.production"
    fi
    
    # Backup docker-compose file
    if [ -f "$PROJECT_ROOT/docker-compose.prod.yaml" ]; then
        cp "$PROJECT_ROOT/docker-compose.prod.yaml" "$BACKUP_PATH/environment/docker-compose.prod.yaml"
    fi
    
    # Backup nginx configuration
    if [ -d "$PROJECT_ROOT/nginx" ]; then
        tar -czf "$BACKUP_PATH/environment/nginx_config.tar.gz" -C "$PROJECT_ROOT" nginx/
    fi
    
    # Encrypt sensitive environment files
    if command -v gpg >/dev/null 2>&1; then
        print_status "Encrypting sensitive environment files..."
        tar -czf "$BACKUP_PATH/environment/sensitive_env.tar.gz" -C "$BACKUP_PATH/environment" backend.env.production frontend.env.production
        gpg --symmetric --cipher-algo AES256 --output "$BACKUP_PATH/environment/sensitive_env.tar.gz.gpg" "$BACKUP_PATH/environment/sensitive_env.tar.gz"
        rm "$BACKUP_PATH/environment/sensitive_env.tar.gz"
        rm "$BACKUP_PATH/environment/backend.env.production"
        rm "$BACKUP_PATH/environment/frontend.env.production"
        print_success "Environment files encrypted"
    else
        print_warning "GPG not available. Environment files stored unencrypted."
    fi
    
    print_success "Environment files backup completed"
}

# Function to backup SSL certificates
backup_ssl_certificates() {
    print_status "Backing up SSL certificates..."
    
    local ssl_path="$PROJECT_ROOT/nginx/ssl"
    
    if [ -d "$ssl_path" ] && [ "$(ls -A $ssl_path)" ]; then
        tar -czf "$BACKUP_PATH/ssl_certificates.tar.gz" -C "$PROJECT_ROOT/nginx" ssl/
        print_success "SSL certificates backup completed"
    else
        print_warning "SSL certificates directory not found or empty: $ssl_path"
    fi
}

# Function to create backup manifest
create_backup_manifest() {
    print_status "Creating backup manifest..."
    
    cat > "$BACKUP_PATH/MANIFEST.txt" << EOF
GitVizz Production Backup
========================
Date: $(date)
Backup Name: $BACKUP_NAME
Project Root: $PROJECT_ROOT

Contents:
- MongoDB dump: mongodb/
- Storage files: storage/storage_files.tar.gz
- Environment files: environment/
- SSL certificates: ssl_certificates.tar.gz

Backup Size: $(du -sh "$BACKUP_PATH" | cut -f1)
Total Files: $(find "$BACKUP_PATH" -type f | wc -l)

MongoDB Collections:
$(docker exec "$MONGO_CONTAINER" mongosh --quiet --eval "db.getCollectionNames()" 2>/dev/null || echo "Unable to list collections")

Environment Files:
$(ls -la "$BACKUP_PATH/environment/" 2>/dev/null || echo "No environment files")

SSL Certificates:
$(ls -la "$BACKUP_PATH/ssl_certificates.tar.gz" 2>/dev/null || echo "No SSL certificates")

Restore Instructions:
1. Stop GitVizz services: docker-compose -f $PROJECT_ROOT/docker-compose.prod.yaml down
2. Restore MongoDB: docker exec $MONGO_CONTAINER mongorestore --db gitvizz_prod /backup/restore/mongodb/$BACKUP_NAME
3. Restore storage: tar -xzf storage/storage_files.tar.gz -C $PROJECT_ROOT/
4. Restore environment: cp environment/*.env.production $PROJECT_ROOT/backend/ and $PROJECT_ROOT/frontend/
5. Restore SSL: tar -xzf ssl_certificates.tar.gz -C $PROJECT_ROOT/nginx/
6. Start services: docker-compose -f $PROJECT_ROOT/docker-compose.prod.yaml up -d
EOF

    print_success "Backup manifest created"
}

# Function to compress backup
compress_backup() {
    print_status "Compressing backup..."
    
    cd "$BACKUP_DIR"
    tar -czf "$BACKUP_NAME.tar.gz" "$BACKUP_NAME"
    rm -rf "$BACKUP_NAME"
    
    print_success "Backup compressed: $BACKUP_DIR/$BACKUP_NAME.tar.gz"
}

# Function to upload to remote storage (optional)
upload_to_remote() {
    if [ -n "$BACKUP_S3_BUCKET" ]; then
        print_status "Uploading backup to S3..."
        
        if command -v aws >/dev/null 2>&1; then
            aws s3 cp "$BACKUP_DIR/$BACKUP_NAME.tar.gz" "s3://$BACKUP_S3_BUCKET/gitvizz-backups/"
            print_success "Backup uploaded to S3"
        else
            print_warning "AWS CLI not available. Skipping S3 upload."
        fi
    fi
    
    if [ -n "$BACKUP_RSYNC_HOST" ]; then
        print_status "Uploading backup via rsync..."
        
        if command -v rsync >/dev/null 2>&1; then
            rsync -avz "$BACKUP_DIR/$BACKUP_NAME.tar.gz" "$BACKUP_RSYNC_HOST:$BACKUP_RSYNC_PATH/"
            print_success "Backup uploaded via rsync"
        else
            print_warning "rsync not available. Skipping rsync upload."
        fi
    fi
}

# Function to cleanup old backups
cleanup_old_backups() {
    print_status "Cleaning up old backups (older than $RETENTION_DAYS days)..."
    
    find "$BACKUP_DIR" -name "gitvizz_backup_*.tar.gz" -type f -mtime +$RETENTION_DAYS -delete
    find "$BACKUP_DIR" -name "gitvizz_backup_*" -type d -mtime +$RETENTION_DAYS -exec rm -rf {} + 2>/dev/null || true
    
    local remaining_backups=$(find "$BACKUP_DIR" -name "gitvizz_backup_*" | wc -l)
    print_success "Old backups cleaned up. Remaining backups: $remaining_backups"
}

# Function to send notification (optional)
send_notification() {
    local status=$1
    local message="GitVizz backup $status at $(date)"
    
    if [ -n "$BACKUP_EMAIL" ]; then
        echo "$message" | mail -s "GitVizz Backup $status" "$BACKUP_EMAIL" 2>/dev/null || true
    fi
    
    if [ -n "$BACKUP_WEBHOOK_URL" ]; then
        curl -X POST "$BACKUP_WEBHOOK_URL" \
            -H "Content-Type: application/json" \
            -d "{\"text\":\"$message\"}" 2>/dev/null || true
    fi
}

# Function to show backup summary
show_backup_summary() {
    print_success "GitVizz backup completed!"
    echo ""
    echo "📦 Backup Information:"
    echo "  Name: $BACKUP_NAME"
    echo "  Path: $BACKUP_DIR/$BACKUP_NAME.tar.gz"
    echo "  Size: $(du -sh "$BACKUP_DIR/$BACKUP_NAME.tar.gz" | cut -f1)"
    echo "  Date: $(date)"
    echo ""
    echo "📊 Backup Contents:"
    echo "  MongoDB: $(du -sh "$BACKUP_PATH/mongodb" 2>/dev/null | cut -f1 || echo 'N/A')"
    echo "  Storage: $(du -sh "$BACKUP_PATH/storage" 2>/dev/null | cut -f1 || echo 'N/A')"
    echo "  Environment: $(du -sh "$BACKUP_PATH/environment" 2>/dev/null | cut -f1 || echo 'N/A')"
    echo "  SSL Certificates: $(du -sh "$BACKUP_PATH/ssl_certificates.tar.gz" 2>/dev/null | cut -f1 || echo 'N/A')"
    echo ""
    echo "🔧 Management Commands:"
    echo "  List backups: ls -la $BACKUP_DIR/"
    echo "  Restore backup: $PROJECT_ROOT/scripts/restore-backup.sh $BACKUP_NAME"
    echo "  Clean old backups: find $BACKUP_DIR -name 'gitvizz_backup_*' -mtime +$RETENTION_DAYS -delete"
    echo ""
    echo "📈 Backup Statistics:"
    echo "  Total backups: $(find "$BACKUP_DIR" -name "gitvizz_backup_*.tar.gz" | wc -l)"
    echo "  Total size: $(du -sh "$BACKUP_DIR" | cut -f1)"
    echo "  Retention: $RETENTION_DAYS days"
}

# Function to cleanup on error
cleanup() {
    print_error "Backup failed. Cleaning up..."
    rm -rf "$BACKUP_PATH" 2>/dev/null || true
    send_notification "FAILED"
    exit 1
}

# Main function
main() {
    print_status "GitVizz Production Backup"
    print_status "=========================="
    print_status "Backup Name: $BACKUP_NAME"
    print_status "Backup Path: $BACKUP_PATH"
    print_status "Retention: $RETENTION_DAYS days"
    echo ""
    
    # Set up error handling
    trap cleanup ERR
    
    # Check if running as root
    check_root
    
    # Create backup directory
    create_backup_directory
    
    # Backup MongoDB
    backup_mongodb
    
    # Backup storage files
    backup_storage
    
    # Backup environment files
    backup_environment
    
    # Backup SSL certificates
    backup_ssl_certificates
    
    # Create backup manifest
    create_backup_manifest
    
    # Compress backup
    compress_backup
    
    # Upload to remote storage
    upload_to_remote
    
    # Cleanup old backups
    cleanup_old_backups
    
    # Send notification
    send_notification "SUCCESS"
    
    # Show backup summary
    show_backup_summary
}

# Run main function with all arguments
main "$@"
