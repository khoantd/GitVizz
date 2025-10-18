# GitVizz Backend Deployment

This directory contains scripts for deploying and managing the GitVizz backend service separately from the full application.

## Scripts Overview

### 1. `deploy-backend.sh` - Main Deployment Script
The primary script for deploying the GitVizz backend service.

**Features:**
- Supports both Docker and native Python deployment
- Automatic environment configuration
- MongoDB and Phoenix observability setup
- Health checks and monitoring
- Backup functionality
- Secure secret generation

**Usage:**
```bash
# Deploy with Docker (default)
./scripts/deploy-backend.sh

# Deploy natively with Python
./scripts/deploy-backend.sh --mode native

# Deploy on custom port
./scripts/deploy-backend.sh --port 8004

# Deploy with backup
./scripts/deploy-backend.sh --backup

# Update existing deployment
./scripts/deploy-backend.sh --update

# Stop backend service
./scripts/deploy-backend.sh --stop

# Restart backend service
./scripts/deploy-backend.sh --restart

# View logs
./scripts/deploy-backend.sh --logs

# Health check
./scripts/deploy-backend.sh --health
```

### 2. `backend-manager.sh` - Simplified Management Interface
A user-friendly interface for managing the backend service.

**Usage:**
```bash
# Deploy backend
./scripts/backend-manager.sh deploy

# Start service
./scripts/backend-manager.sh start

# Stop service
./scripts/backend-manager.sh stop

# Restart service
./scripts/backend-manager.sh restart

# Check status
./scripts/backend-manager.sh status

# View logs
./scripts/backend-manager.sh logs

# Health check
./scripts/backend-manager.sh health

# Create backup
./scripts/backend-manager.sh backup

# Update deployment
./scripts/backend-manager.sh update

# Clean up resources
./scripts/backend-manager.sh clean
```

## Deployment Modes

### Docker Mode (Recommended)
- Uses Docker Compose for orchestration
- Includes MongoDB and Phoenix observability
- Automatic health checks
- Easy scaling and management
- Isolated environment

### Native Mode
- Direct Python execution
- Requires local MongoDB and Phoenix setup
- Lighter resource usage
- Direct process management

## Prerequisites

### For Docker Mode
- Docker
- Docker Compose
- curl
- git

### For Native Mode
- Python 3.11+
- pip or uv
- MongoDB (local or remote)
- Phoenix (optional)
- curl
- git

## Configuration

The deployment script will prompt for:
- GitHub OAuth credentials (optional)
- LLM API keys (OpenAI, Anthropic, Gemini, Groq)
- MongoDB connection details
- Database name

## Environment Variables

The script automatically generates:
- JWT secrets
- Encryption keys
- MongoDB passwords
- Fernet keys

## Services Included

### Backend Service
- FastAPI application
- Port: 8003 (configurable)
- Health endpoint: `/health`
- API docs: `/docs`

### MongoDB (Docker mode only)
- Database: gitvizz (configurable)
- Port: 27017
- Authentication enabled
- Automatic initialization

### Phoenix Observability (Docker mode only)
- Port: 6006
- LLM tracing
- Performance monitoring

## Health Checks

The deployment includes automatic health checks:
- Backend API health endpoint
- MongoDB connectivity
- Phoenix observability
- Service startup verification

## Backup and Recovery

### Automatic Backups
- MongoDB data volumes
- Backend storage volumes
- Configuration files
- Environment variables

### Manual Backup
```bash
./scripts/backend-manager.sh backup
```

### Restore from Backup
1. Stop the service
2. Restore volumes from backup
3. Restart the service

## Monitoring and Logs

### View Logs
```bash
# Docker mode
./scripts/backend-manager.sh logs

# Native mode
tail -f backend/backend.log
```

### Health Monitoring
```bash
# Check health
./scripts/backend-manager.sh health

# Check status
./scripts/backend-manager.sh status
```

## Troubleshooting

### Common Issues

1. **Port already in use**
   - Change port with `--port` option
   - Stop conflicting services

2. **MongoDB connection failed**
   - Check MongoDB is running
   - Verify connection string
   - Check authentication credentials

3. **Docker build failed**
   - Check Docker is running
   - Verify Dockerfile exists
   - Check available disk space

4. **Health check failed**
   - Check service logs
   - Verify port accessibility
   - Check firewall settings

### Debug Mode
```bash
# Enable debug logging
export DEBUG=true
./scripts/deploy-backend.sh
```

## Security Considerations

- Environment files are secured with 600 permissions
- Secrets are generated automatically
- MongoDB authentication is enabled
- CORS is configured for production
- SSL/TLS should be configured at reverse proxy level

## Production Deployment

For production deployment:

1. **Use Docker mode** for better isolation
2. **Configure SSL/TLS** at reverse proxy level
3. **Set up monitoring** and alerting
4. **Configure backups** and retention policies
5. **Use environment-specific configurations**

## Integration with Full Stack

The backend can be integrated with:
- Frontend application
- Reverse proxy (nginx)
- Load balancer
- Monitoring systems
- CI/CD pipelines

## Support

For issues and questions:
1. Check the logs: `./scripts/backend-manager.sh logs`
2. Run health check: `./scripts/backend-manager.sh health`
3. Check service status: `./scripts/backend-manager.sh status`
4. Review configuration files
5. Check system resources

## Examples

### Quick Start
```bash
# Deploy backend with Docker
./scripts/deploy-backend.sh

# Check status
./scripts/backend-manager.sh status

# View logs
./scripts/backend-manager.sh logs
```

### Development Setup
```bash
# Deploy natively for development
./scripts/deploy-backend.sh --mode native --port 8004

# Start development
./scripts/backend-manager.sh start
```

### Production Deployment
```bash
# Deploy with backup
./scripts/deploy-backend.sh --backup --domain yourdomain.com

# Set up monitoring
./scripts/backend-manager.sh status
```
