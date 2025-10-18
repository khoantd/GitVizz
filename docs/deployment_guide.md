# GitVizz Production Deployment Guide

## Overview

This guide provides comprehensive instructions for deploying GitVizz to a VPS with domain `gitviz.sutools.app`. The deployment includes:

- **Frontend**: Next.js 14 with TypeScript + Tailwind CSS + ShadCN UI
- **Backend**: FastAPI + Python 3.12+ + MongoDB + Beanie ODM
- **Infrastructure**: Docker Compose + Nginx + SSL + MongoDB + Phoenix
- **Security**: UFW Firewall + fail2ban + SSH hardening + Auto-updates
- **Monitoring**: Health checks + Logging + Backup automation

## Prerequisites

### VPS Requirements

- **Minimum**: 2GB RAM, 20GB disk space, 1 vCPU
- **Recommended**: 4GB RAM, 50GB disk space, 2 vCPU
- **OS**: Ubuntu 20.04+ or Debian 11+
- **Domain**: `gitviz.sutools.app` (A record pointing to VPS IP)

### Required Software

- Docker 20.10+
- Docker Compose 2.0+
- Git
- OpenSSL
- Certbot (for SSL certificates)

## Pre-Deployment Checklist

### 1. DNS Configuration

Before starting deployment, configure DNS:

```bash
# Add A record for your domain
gitviz.sutools.app    A    YOUR_VPS_IP
www.gitviz.sutools.app A    YOUR_VPS_IP
```

Verify DNS propagation:
```bash
dig gitviz.sutools.app
nslookup gitviz.sutools.app
```

### 2. VPS Preparation

Connect to your VPS and update the system:

```bash
# Update system packages
sudo apt-get update && sudo apt-get upgrade -y

# Install required packages
sudo apt-get install -y docker.io docker-compose certbot python3-certbot-nginx git openssl curl

# Enable Docker service
sudo systemctl enable docker
sudo systemctl start docker

# Add user to docker group
sudo usermod -aG docker $USER
# Logout and login again to apply group changes
```

### 3. GitHub OAuth Setup

1. Go to GitHub Settings > Developer settings > OAuth Apps
2. Create a new OAuth App with:
   - **Application name**: GitVizz Production
   - **Homepage URL**: `https://gitviz.sutools.app`
   - **Authorization callback URL**: `https://gitviz.sutools.app/api/auth/callback/github`
3. Note down the Client ID and Client Secret

### 4. LLM API Keys (Optional)

Prepare API keys for LLM providers you want to use:
- OpenAI API Key
- Anthropic API Key
- Gemini API Key
- Groq API Key

## Deployment Process

### Step 1: Clone Repository

```bash
# Clone the repository
git clone https://github.com/your-username/gitvizz.git
cd gitvizz

# Make scripts executable
chmod +x scripts/*.sh
```

### Step 2: Security Hardening (Recommended)

```bash
# Run security hardening script
sudo ./scripts/security-setup.sh
```

This script will:
- Update system packages
- Install and configure fail2ban
- Configure UFW firewall
- Set up automatic security updates
- Harden SSH configuration
- Create deployment user
- Configure log monitoring

### Step 3: Main Deployment

```bash
# Run the main deployment script
./scripts/deploy-prod.sh
```

The script will:
1. Check VPS requirements
2. Verify prerequisites
3. Generate secure secrets
4. Prompt for configuration values
5. Create environment files
6. Set up SSL certificates
7. Deploy Docker services
8. Initialize MongoDB
9. Run health checks

### Step 4: Post-Deployment Verification

```bash
# Check service status
./scripts/health-check.sh

# View service logs
docker-compose -f docker-compose.prod.yaml logs -f

# Test the application
curl -I https://gitviz.sutools.app
```

## Configuration Details

### Environment Variables

The deployment script creates the following environment files:

**Backend** (`backend/.env.production`):
```bash
# Production settings
HOST=0.0.0.0
PORT=8003

# MongoDB with authentication
MONGO_URI=mongodb://gitvizz_app:PASSWORD@mongo:27017/gitvizz_prod?authSource=gitvizz_prod
MONGODB_DB_NAME=gitvizz_prod

# JWT and encryption keys (auto-generated)
JWT_SECRET=...
ENCRYPTION_KEY=...
FERNET_KEY=...

# GitHub OAuth
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...

# LLM API Keys
OPENAI_API_KEY=...
ANTHROPIC_API_KEY=...
GEMINI_API_KEY=...
GROQ_API_KEY=...

# Phoenix observability
PHOENIX_COLLECTOR_ENDPOINT=http://phoenix:6006/v1/traces
```

**Frontend** (`frontend/.env.production`):
```bash
# Production backend URL
NEXT_PUBLIC_BACKEND_URL=https://gitviz.sutools.app

# NextAuth configuration
NEXTAUTH_URL=https://gitviz.sutools.app
AUTH_SECRET=...

# GitHub OAuth
AUTH_GITHUB_ID=...
AUTH_GITHUB_SECRET=...
```

### Docker Services

The deployment includes the following services:

- **nginx**: Reverse proxy with SSL termination
- **backend**: FastAPI application
- **frontend**: Next.js application
- **mongo**: MongoDB database with authentication
- **phoenix**: Observability and monitoring

### SSL Configuration

SSL certificates are automatically obtained using Let's Encrypt:
- Automatic renewal via cron job
- HTTP to HTTPS redirect
- Modern TLS configuration (TLS 1.2/1.3)
- Security headers (HSTS, X-Frame-Options, etc.)

## Management Commands

### Service Management

```bash
# Start services
docker-compose -f docker-compose.prod.yaml up -d

# Stop services
docker-compose -f docker-compose.prod.yaml down

# Restart services
docker-compose -f docker-compose.prod.yaml restart

# View logs
docker-compose -f docker-compose.prod.yaml logs -f

# View specific service logs
docker-compose -f docker-compose.prod.yaml logs -f backend
```

### Health Monitoring

```bash
# Run comprehensive health check
./scripts/health-check.sh

# Check individual services
curl -f http://localhost:8003/health  # Backend
curl -f http://localhost:3000         # Frontend
curl -f https://gitviz.sutools.app    # Nginx
```

### Backup and Restore

```bash
# Create backup
./scripts/backup-prod.sh

# List backups
ls -la /opt/gitvizz-backups/

# Restore from backup (manual process)
# 1. Stop services
# 2. Restore MongoDB
# 3. Restore files
# 4. Start services
```

### Updates

```bash
# Update to latest version
./scripts/update-prod.sh

# Manual update process
git pull origin main
docker-compose -f docker-compose.prod.yaml build
docker-compose -f docker-compose.prod.yaml up -d
```

## Security Features

### Firewall Configuration

UFW firewall is configured to allow only necessary ports:
- Port 22 (SSH)
- Port 80 (HTTP)
- Port 443 (HTTPS)

### Intrusion Prevention

fail2ban is configured to prevent brute force attacks:
- SSH protection
- Nginx protection
- Docker container protection

### SSH Hardening

- Root login disabled
- Password authentication disabled
- Key-based authentication only
- Strong cipher configuration

### Automatic Updates

- Security updates installed automatically
- System packages updated regularly
- Docker images cleaned up

## Monitoring and Logging

### Health Checks

The health check script monitors:
- Container status
- HTTP endpoints
- Database connectivity
- SSL certificate validity
- System resources
- Recent error logs

### Log Monitoring

- Centralized logging via Docker
- Log rotation configured
- Error monitoring via logwatch
- Security event monitoring

### Observability

Phoenix provides:
- LLM usage tracking
- Performance monitoring
- Cost analysis
- Request tracing

## Troubleshooting

### Common Issues

#### 1. SSL Certificate Issues

```bash
# Check certificate status
sudo certbot certificates

# Renew certificates manually
sudo certbot renew

# Check nginx configuration
docker exec gitvizz-nginx nginx -t
```

#### 2. Database Connection Issues

```bash
# Check MongoDB status
docker exec gitvizz-mongo mongosh --eval "db.adminCommand('ping')"

# Check MongoDB logs
docker logs gitvizz-mongo

# Restart MongoDB
docker-compose -f docker-compose.prod.yaml restart mongo
```

#### 3. Service Startup Issues

```bash
# Check service status
docker-compose -f docker-compose.prod.yaml ps

# Check service logs
docker-compose -f docker-compose.prod.yaml logs

# Restart specific service
docker-compose -f docker-compose.prod.yaml restart backend
```

#### 4. Memory Issues

```bash
# Check memory usage
free -h

# Check Docker memory usage
docker stats

# Clean up unused Docker resources
docker system prune -f
```

### Log Locations

- **Application logs**: `docker-compose -f docker-compose.prod.yaml logs`
- **Nginx logs**: `/var/log/nginx/`
- **System logs**: `/var/log/syslog`
- **Security logs**: `/var/log/auth.log`
- **fail2ban logs**: `/var/log/fail2ban.log`

## Maintenance

### Regular Tasks

#### Daily
- Monitor health checks
- Review error logs
- Check disk space

#### Weekly
- Review security logs
- Check SSL certificate status
- Verify backup integrity

#### Monthly
- Update system packages
- Review security configurations
- Test disaster recovery procedures

### Backup Strategy

- **Frequency**: Daily automated backups
- **Retention**: 30 days
- **Contents**: MongoDB, storage files, environment files, SSL certificates
- **Location**: `/opt/gitvizz-backups/`

### Update Strategy

- **Method**: Rolling updates with zero downtime
- **Process**: Automated via update script
- **Rollback**: Automatic rollback on health check failure
- **Testing**: Health checks before and after update

## Performance Optimization

### Resource Allocation

- **Backend**: 1GB RAM, 1 vCPU
- **Frontend**: 512MB RAM, 0.5 vCPU
- **MongoDB**: 1GB RAM, 1 vCPU
- **Nginx**: 256MB RAM, 0.5 vCPU

### Caching

- **Nginx**: Static file caching
- **Frontend**: Next.js built-in caching
- **Backend**: Application-level caching

### Database Optimization

- **Indexes**: Optimized for common queries
- **Connection pooling**: Configured for production load
- **Backup strategy**: Regular automated backups

## Cost Estimation

### Monthly Costs (Approximate)

- **VPS (4GB RAM, 2 vCPU)**: $20-40
- **Domain + SSL**: $10-15
- **Backup storage**: $5-10
- **LLM API usage**: Variable (usage-based)

**Total**: ~$50-150/month (excluding LLM costs)

## Support and Documentation

### Additional Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [MongoDB Documentation](https://docs.mongodb.com/)
- [Docker Documentation](https://docs.docker.com/)
- [Nginx Documentation](https://nginx.org/en/docs/)

### Support Channels

- **GitHub Issues**: For bug reports and feature requests
- **Documentation**: This deployment guide
- **Community**: GitVizz community forums

## Conclusion

This deployment guide provides a comprehensive solution for deploying GitVizz to production. The automated scripts handle most of the complexity, but understanding the underlying components is important for troubleshooting and maintenance.

For additional support or questions, please refer to the troubleshooting section or create an issue in the GitHub repository.
