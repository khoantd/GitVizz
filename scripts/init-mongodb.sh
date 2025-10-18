#!/bin/bash

# GitVizz MongoDB Initialization Script
# This script initializes MongoDB with authentication for production

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MONGO_CONTAINER="gitvizz-mongo"
MONGO_ADMIN_USER="admin"
MONGO_APP_USER="gitvizz_app"
MONGO_APP_DB="gitvizz_prod"

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

# Function to check if MongoDB container is running
check_mongodb_container() {
    print_status "Checking MongoDB container status..."
    
    if ! docker ps | grep -q "$MONGO_CONTAINER"; then
        print_error "MongoDB container '$MONGO_CONTAINER' is not running"
        print_status "Please start the MongoDB container first:"
        print_status "  docker-compose -f $PROJECT_ROOT/docker-compose.prod.yaml up -d mongo"
        exit 1
    fi
    
    print_success "MongoDB container is running"
}

# Function to wait for MongoDB to be ready
wait_for_mongodb() {
    print_status "Waiting for MongoDB to be ready..."
    
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if docker exec "$MONGO_CONTAINER" mongosh --eval "db.adminCommand('ping')" >/dev/null 2>&1; then
            print_success "MongoDB is ready"
            return 0
        fi
        
        print_status "Attempt $attempt/$max_attempts - MongoDB not ready yet..."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    print_error "MongoDB failed to start within expected time"
    return 1
}

# Function to check if MongoDB is already initialized
check_existing_users() {
    print_status "Checking if MongoDB is already initialized..."
    
    # Check if admin user exists
    local admin_exists=$(docker exec "$MONGO_CONTAINER" mongosh --quiet --eval "
        use admin;
        db.getUsers().length > 0;
    " 2>/dev/null || echo "false")
    
    if [ "$admin_exists" = "true" ]; then
        print_warning "MongoDB appears to be already initialized"
        read -p "Do you want to reinitialize? This will remove existing users. (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_status "Skipping MongoDB initialization"
            exit 0
        fi
    fi
}

# Function to get MongoDB passwords
get_mongodb_passwords() {
    print_status "Getting MongoDB passwords from environment..."
    
    # Try to get passwords from docker-compose environment
    MONGO_ADMIN_PASSWORD=$(docker exec "$MONGO_CONTAINER" printenv MONGO_INITDB_ROOT_PASSWORD 2>/dev/null || echo "")
    
    if [ -z "$MONGO_ADMIN_PASSWORD" ]; then
        print_error "Could not retrieve MongoDB admin password from container environment"
        print_status "Please check your docker-compose.prod.yaml configuration"
        exit 1
    fi
    
    # Get app password from backend environment file
    if [ -f "$PROJECT_ROOT/backend/.env.production" ]; then
        MONGO_APP_PASSWORD=$(grep "MONGO_URI=" "$PROJECT_ROOT/backend/.env.production" | sed 's/.*:\([^@]*\)@.*/\1/')
    else
        print_error "Backend environment file not found: $PROJECT_ROOT/backend/.env.production"
        exit 1
    fi
    
    if [ -z "$MONGO_APP_PASSWORD" ]; then
        print_error "Could not retrieve MongoDB app password from environment file"
        exit 1
    fi
    
    print_success "MongoDB passwords retrieved"
}

# Function to create admin user
create_admin_user() {
    print_status "Creating MongoDB admin user..."
    
    docker exec "$MONGO_CONTAINER" mongosh --eval "
        use admin;
        try {
            db.createUser({
                user: '$MONGO_ADMIN_USER',
                pwd: '$MONGO_ADMIN_PASSWORD',
                roles: ['root']
            });
            print('Admin user created successfully');
        } catch (e) {
            if (e.code === 51003) {
                print('Admin user already exists');
            } else {
                throw e;
            }
        }
    "
    
    print_success "Admin user configured"
}

# Function to create application database and user
create_app_database() {
    print_status "Creating application database and user..."
    
    docker exec "$MONGO_CONTAINER" mongosh --eval "
        use $MONGO_APP_DB;
        try {
            db.createUser({
                user: '$MONGO_APP_USER',
                pwd: '$MONGO_APP_PASSWORD',
                roles: [{role: 'readWrite', db: '$MONGO_APP_DB'}]
            });
            print('Application user created successfully');
        } catch (e) {
            if (e.code === 51003) {
                print('Application user already exists');
            } else {
                throw e;
            }
        }
    "
    
    print_success "Application database and user configured"
}

# Function to test database connection
test_connection() {
    print_status "Testing database connection..."
    
    # Test admin connection
    if docker exec "$MONGO_CONTAINER" mongosh -u "$MONGO_ADMIN_USER" -p "$MONGO_ADMIN_PASSWORD" --authenticationDatabase admin --eval "db.adminCommand('ping')" >/dev/null 2>&1; then
        print_success "Admin connection test passed"
    else
        print_error "Admin connection test failed"
        return 1
    fi
    
    # Test app connection
    if docker exec "$MONGO_CONTAINER" mongosh -u "$MONGO_APP_USER" -p "$MONGO_APP_PASSWORD" --authenticationDatabase "$MONGO_APP_DB" --eval "db.adminCommand('ping')" >/dev/null 2>&1; then
        print_success "Application connection test passed"
    else
        print_error "Application connection test failed"
        return 1
    fi
}

# Function to create initial collections
create_initial_collections() {
    print_status "Creating initial collections..."
    
    docker exec "$MONGO_CONTAINER" mongosh -u "$MONGO_APP_USER" -p "$MONGO_APP_PASSWORD" --authenticationDatabase "$MONGO_APP_DB" --eval "
        use $MONGO_APP_DB;
        
        // Create collections with indexes
        db.createCollection('users');
        db.createCollection('repositories');
        db.createCollection('conversations');
        db.createCollection('chatsessions');
        db.createCollection('userapikeys');
        
        // Create indexes for better performance
        db.users.createIndex({ 'email': 1 }, { unique: true });
        db.users.createIndex({ 'github_id': 1 }, { unique: true, sparse: true });
        
        db.repositories.createIndex({ 'owner': 1, 'name': 1 }, { unique: true });
        db.repositories.createIndex({ 'user_id': 1 });
        db.repositories.createIndex({ 'created_at': -1 });
        
        db.conversations.createIndex({ 'user_id': 1 });
        db.conversations.createIndex({ 'created_at': -1 });
        
        db.chatsessions.createIndex({ 'conversation_id': 1 });
        db.chatsessions.createIndex({ 'created_at': -1 });
        
        db.userapikeys.createIndex({ 'user_id': 1 });
        db.userapikeys.createIndex({ 'provider': 1 });
        
        print('Initial collections and indexes created');
    "
    
    print_success "Initial collections created"
}

# Function to show connection information
show_connection_info() {
    print_success "MongoDB initialization completed!"
    echo ""
    echo "📊 Database Information:"
    echo "  Container: $MONGO_CONTAINER"
    echo "  Admin User: $MONGO_ADMIN_USER"
    echo "  App User: $MONGO_APP_USER"
    echo "  App Database: $MONGO_APP_DB"
    echo ""
    echo "🔗 Connection Strings:"
    echo "  Admin: mongodb://$MONGO_ADMIN_USER:$MONGO_ADMIN_PASSWORD@localhost:27017/admin"
    echo "  App: mongodb://$MONGO_APP_USER:$MONGO_APP_PASSWORD@localhost:27017/$MONGO_APP_DB"
    echo ""
    echo "🔧 Management Commands:"
    echo "  Connect as admin: docker exec -it $MONGO_CONTAINER mongosh -u $MONGO_ADMIN_USER -p $MONGO_ADMIN_PASSWORD --authenticationDatabase admin"
    echo "  Connect as app: docker exec -it $MONGO_CONTAINER mongosh -u $MONGO_APP_USER -p $MONGO_APP_PASSWORD --authenticationDatabase $MONGO_APP_DB"
    echo "  View logs: docker logs $MONGO_CONTAINER"
    echo "  Backup: docker exec $MONGO_CONTAINER mongodump --out /backup/$(date +%Y%m%d_%H%M%S)"
    echo ""
    echo "📈 Collections Created:"
    echo "  - users (with email and github_id indexes)"
    echo "  - repositories (with owner/name and user_id indexes)"
    echo "  - conversations (with user_id and created_at indexes)"
    echo "  - chatsessions (with conversation_id and created_at indexes)"
    echo "  - userapikeys (with user_id and provider indexes)"
}

# Function to cleanup on error
cleanup() {
    print_error "MongoDB initialization failed. Cleaning up..."
    exit 1
}

# Main function
main() {
    print_status "GitVizz MongoDB Initialization"
    print_status "==============================="
    print_status "Container: $MONGO_CONTAINER"
    print_status "Project Root: $PROJECT_ROOT"
    echo ""
    
    # Set up error handling
    trap cleanup ERR
    
    # Check MongoDB container
    check_mongodb_container
    
    # Wait for MongoDB to be ready
    wait_for_mongodb
    
    # Check if already initialized
    check_existing_users
    
    # Get passwords
    get_mongodb_passwords
    
    # Create admin user
    create_admin_user
    
    # Create application database and user
    create_app_database
    
    # Test connections
    test_connection
    
    # Create initial collections
    create_initial_collections
    
    # Show connection information
    show_connection_info
}

# Run main function with all arguments
main "$@"
