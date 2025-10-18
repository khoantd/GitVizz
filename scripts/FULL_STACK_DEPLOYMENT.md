# GitVizz Full-Stack Deployment

This directory contains scripts for deploying the complete GitVizz application with both frontend and backend services.

## Scripts Overview

### 1. `deploy-full-stack.sh` - Main Deployment Script
The primary script for deploying the complete GitVizz application.

**Features:**
- Deploys both frontend and backend services
- Supports MongoDB inclusion/exclusion
- Automatic environment configuration
- Health checks and monitoring
- Backup functionality
- Secure secret generation

**Usage:**
```bash
# Deploy full stack with MongoDB
./scripts/deploy-full-stack.sh

# Deploy without MongoDB (external DB)
./scripts/deploy-full-stack.sh --no-mongo

# Deploy on custom ports
./scripts/deploy-full-stack.sh --backend-port 8004 --frontend-port 3001

# Deploy with backup
./scripts/deploy-full-stack.sh --backup

# Update existing deployment
./scripts/deploy-full-stack.sh --update

# Stop all services
./scripts/deploy-full-stack.sh --stop

# Restart all services
./scripts/deploy-full-stack.sh --restart

# View logs
./scripts/deploy-full-stack.sh --logs

# Health check
./scripts/deploy-full-stack.sh --health
```

### 2. `full-stack-manager.sh` - Simplified Management Interface
A user-friendly interface for managing the full-stack application.

**Usage:**
```bash
# Deploy full stack
./scripts/full-stack-manager.sh deploy

# Deploy without MongoDB
./scripts/full-stack-manager.sh deploy --no-mongo

# Start all services
./scripts/full-stack-manager.sh start

# Stop all services
./scripts/full-stack-manager.sh stop

# Restart all services
./scripts/full-stack-manager.sh restart

# Check status
./scripts/full-stack-manager.sh status

# View logs
./scripts/full-stack-manager.sh logs

# Health check
./scripts/full-stack-manager.sh health

# Create backup
./scripts/full-stack-manager.sh backup

# Update deployment
./scripts/full-stack-manager.sh update

# Clean up resources
./scripts/full-stack-manager.sh clean
```

## Deployment Modes

### Full-Stack with MongoDB
- **Frontend**: Next.js application on port 3000
- **Backend**: FastAPI application on port 8003
- **MongoDB**: Database on port 27017
- **Phoenix**: Observability on port 6006
- **Complete Solution**: All services included

### Full-Stack without MongoDB
- **Frontend**: Next.js application on port 3000
- **Backend**: FastAPI application on port 8003
- **Phoenix**: Observability on port 6006
- **External Database**: Uses external MongoDB
- **Lighter Resource Usage**: No local database

## Prerequisites

### Required Dependencies
- Docker
- Docker Compose
- curl
- git

### Installation
```bash
sudo apt-get update
sudo apt-get install -y docker.io docker-compose curl git
sudo systemctl enable docker
sudo usermod -aG docker $USER
# Logout and login again to apply docker group changes
```

## Configuration

The deployment script will prompt for:
- GitHub OAuth credentials (optional)
- LLM API keys (OpenAI, Anthropic, Gemini, Groq)
- MongoDB connection details
- Database name
- Custom ports (optional)

## Environment Variables

The script automatically generates:
- JWT secrets
- AUTH secrets
- Encryption keys
- MongoDB passwords
- Fernet keys

## Services Included

### Frontend Service
- **Framework**: Next.js 14
- **Port**: 3000 (configurable)
- **Features**: React components, authentication, API integration
- **Health Check**: HTTP endpoint check

### Backend Service
- **Framework**: FastAPI
- **Port**: 8003 (configurable)
- **Features**: REST API, authentication, LLM integration
- **Health Check**: `/health` endpoint
- **API Docs**: `/docs` endpoint

### MongoDB (Optional)
- **Database**: gitvizz (configurable)
- **Port**: 27017
- **Authentication**: Enabled
- **Automatic Initialization**: User and database creation

### Phoenix Observability
- **Port**: 6006
- **Features**: LLM tracing, performance monitoring
- **Health Check**: HTTP endpoint check

## Health Checks

The deployment includes comprehensive health checks:
- Frontend accessibility
- Backend API health endpoint
- MongoDB connectivity (if included)
- Phoenix observability
- Service startup verification

## Backup and Recovery

### Automatic Backups
- MongoDB data volumes (if included)
- Backend storage volumes
- Configuration files
- Environment variables

### Manual Backup
```bash
./scripts/full-stack-manager.sh backup
```

### Restore from Backup
1. Stop all services
2. Restore volumes from backup
3. Restart services

## Monitoring and Logs

### View Logs
```bash
# All services
./scripts/full-stack-manager.sh logs

# Individual services
docker-compose -f docker-compose.full-stack.yaml logs frontend
docker-compose -f docker-compose.full-stack.yaml logs backend
```

### Health Monitoring
```bash
# Check all services
./scripts/full-stack-manager.sh health

# Check individual services
curl http://localhost:3000  # Frontend
curl http://localhost:8003/health  # Backend
curl http://localhost:6006  # Phoenix
```

## Service URLs

### Development
- **Frontend**: http://localhost:3000
- **Backend**: http://localhost:8003
- **API Docs**: http://localhost:8003/docs
- **Health Check**: http://localhost:8003/health
- **Phoenix**: http://localhost:6006
- **MongoDB**: localhost:27017 (if included)

### Production
- **Frontend**: https://yourdomain.com
- **Backend**: https://yourdomain.com/api
- **API Docs**: https://yourdomain.com/docs
- **Health Check**: https://yourdomain.com/health

## Troubleshooting

### Common Issues

1. **Port conflicts**
   - Change ports with `--backend-port` and `--frontend-port` options
   - Stop conflicting services

2. **Frontend can't connect to backend**
   - Check backend is running: `curl http://localhost:8003/health`
   - Verify environment variables
   - Check Docker network connectivity

3. **MongoDB connection failed**
   - Check MongoDB is running (if included)
   - Verify connection string in backend/.env
   - Check authentication credentials

4. **Docker build failed**
   - Check Docker is running
   - Verify Dockerfile exists
   - Check available disk space
   - Check Docker logs: `docker-compose logs`

5. **Health check failed**
   - Check service logs
   - Verify port accessibility
   - Check firewall settings
   - Verify environment configuration

### Debug Mode
```bash
# Enable debug logging
export DEBUG=true
./scripts/deploy-full-stack.sh
```

## Security Considerations

- Environment files are secured with 600 permissions
- Secrets are generated automatically
- MongoDB authentication is enabled (if included)
- CORS is configured for production
- SSL/TLS should be configured at reverse proxy level

## Production Deployment

For production deployment:

1. **Use external MongoDB** for better scalability
2. **Configure SSL/TLS** at reverse proxy level
3. **Set up monitoring** and alerting
4. **Configure backups** and retention policies
5. **Use environment-specific configurations**
6. **Set up load balancing** for high availability

## Integration with External Services

The full-stack deployment can be integrated with:
- External MongoDB instances
- Reverse proxy (nginx)
- Load balancer
- Monitoring systems
- CI/CD pipelines
- Cloud services

## Examples

### Quick Start
```bash
# Deploy full stack with MongoDB
./scripts/deploy-full-stack.sh

# Check status
./scripts/full-stack-manager.sh status

# View logs
./scripts/full-stack-manager.sh logs
```

### External Database Setup
```bash
# Deploy without MongoDB
./scripts/deploy-full-stack.sh --no-mongo

# Configure external MongoDB connection
# Update backend/.env with your MongoDB URI
```

### Custom Ports
```bash
# Deploy on custom ports
./scripts/deploy-full-stack.sh --backend-port 8004 --frontend-port 3001
```

### Production Deployment
```bash
# Deploy with backup and custom domain
./scripts/deploy-full-stack.sh --backup --domain yourdomain.com

# Deploy without MongoDB for external DB
./scripts/deploy-full-stack.sh --no-mongo --backup

# Set up monitoring
./scripts/full-stack-manager.sh status
```

## Support

For issues and questions:
1. Check the logs: `./scripts/full-stack-manager.sh logs`
2. Run health check: `./scripts/full-stack-manager.sh health`
3. Check service status: `./scripts/full-stack-manager.sh status`
4. Review configuration files
5. Check system resources
6. Verify Docker and Docker Compose installation

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │   MongoDB       │
│   (Next.js)     │◄──►│   (FastAPI)     │◄──►│   (Optional)    │
│   Port: 3000    │    │   Port: 8003    │    │   Port: 27017   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │
         │                       │
         ▼                       ▼
┌─────────────────┐    ┌─────────────────┐
│   Phoenix       │    │   External DB   │
│   Observability │    │   (Optional)    │
│   Port: 6006    │    │                 │
└─────────────────┘    └─────────────────┘
```

This architecture provides a complete, scalable solution for the GitVizz application with optional external database support.
