# GitVizz Production Management Commands

## Overview

This document provides a comprehensive reference for all management commands and operations for the GitVizz production deployment. Use this as a quick reference guide for daily operations, troubleshooting, and maintenance tasks.

## Quick Reference

### Essential Commands
```bash
# Check system health
./scripts/health-check.sh

# View service status
docker-compose -f docker-compose.prod.yaml ps

# View logs
docker-compose -f docker-compose.prod.yaml logs -f

# Restart services
docker-compose -f docker-compose.prod.yaml restart
```

## Service Management

### Starting and Stopping Services

```bash
# Start all services
docker-compose -f docker-compose.prod.yaml up -d

# Stop all services
docker-compose -f docker-compose.prod.yaml down

# Restart all services
docker-compose -f docker-compose.prod.yaml restart

# Restart specific service
docker-compose -f docker-compose.prod.yaml restart backend
docker-compose -f docker-compose.prod.yaml restart frontend
docker-compose -f docker-compose.prod.yaml restart nginx
docker-compose -f docker-compose.prod.yaml restart mongo
docker-compose -f docker-compose.prod.yaml restart phoenix
```

### Service Status and Information

```bash
# Check service status
docker-compose -f docker-compose.prod.yaml ps

# View service logs
docker-compose -f docker-compose.prod.yaml logs -f

# View specific service logs
docker-compose -f docker-compose.prod.yaml logs -f backend
docker-compose -f docker-compose.prod.yaml logs -f frontend
docker-compose -f docker-compose.prod.yaml logs -f nginx
docker-compose -f docker-compose.prod.yaml logs -f mongo
docker-compose -f docker-compose.prod.yaml logs -f phoenix

# View last 100 lines of logs
docker-compose -f docker-compose.prod.yaml logs --tail=100 backend

# View logs since specific time
docker-compose -f docker-compose.prod.yaml logs --since="2024-01-01T00:00:00" backend
```

### Container Management

```bash
# List all containers
docker ps -a

# Check container resource usage
docker stats

# Execute commands in running containers
docker exec -it gitvizz-backend bash
docker exec -it gitvizz-mongo mongosh
docker exec -it gitvizz-nginx nginx -t

# View container details
docker inspect gitvizz-backend

# Check container logs directly
docker logs gitvizz-backend
docker logs gitvizz-frontend
docker logs gitvizz-nginx
docker logs gitvizz-mongo
docker logs gitvizz-phoenix
```

## Health Monitoring

### Health Check Commands

```bash
# Run comprehensive health check
./scripts/health-check.sh

# Check individual service health
curl -f http://localhost:8003/health  # Backend
curl -f http://localhost:3000         # Frontend
curl -f https://gitvizz.sutools.app   # Nginx/HTTPS
curl -f http://localhost:6006         # Phoenix

# Check MongoDB connection
docker exec gitvizz-mongo mongosh --eval "db.adminCommand('ping')"

# Check SSL certificate
openssl s_client -connect gitvizz.sutools.app:443 -servername gitvizz.sutools.app
```

### System Resource Monitoring

```bash
# Check system resources
free -h                    # Memory usage
df -h                      # Disk usage
top                        # CPU usage
htop                       # Interactive process viewer

# Check Docker resource usage
docker system df           # Docker disk usage
docker system events       # Docker events
docker system prune        # Clean up unused resources
```

## Database Management

### MongoDB Operations

```bash
# Connect to MongoDB
docker exec -it gitvizz-mongo mongosh

# Connect with authentication
docker exec -it gitvizz-mongo mongosh -u gitvizz_app -p PASSWORD --authenticationDatabase gitvizz_prod

# Backup MongoDB
docker exec gitvizz-mongo mongodump --out /backup/$(date +%Y%m%d_%H%M%S)

# Restore MongoDB
docker exec gitvizz-mongo mongorestore /backup/BACKUP_NAME

# Check database size
docker exec gitvizz-mongo mongosh --eval "db.stats()"

# List databases
docker exec gitvizz-mongo mongosh --eval "show dbs"

# List collections
docker exec gitvizz-mongo mongosh --eval "use gitvizz_prod; show collections"
```

### Database Initialization

```bash
# Initialize MongoDB with users and permissions
./scripts/init-mongodb.sh

# Check MongoDB users
docker exec gitvizz-mongo mongosh --eval "use admin; db.getUsers()"
```

## Backup and Restore

### Backup Operations

```bash
# Create manual backup
./scripts/backup-prod.sh

# List available backups
ls -la /opt/gitvizz-backups/

# Check backup size
du -sh /opt/gitvizz-backups/*

# Clean old backups (older than 30 days)
find /opt/gitvizz-backups/ -name "gitvizz_backup_*" -mtime +30 -delete
```

### Restore Operations

```bash
# Stop services before restore
docker-compose -f docker-compose.prod.yaml down

# Restore from backup (manual process)
# 1. Extract backup
cd /opt/gitvizz-backups/
tar -xzf gitvizz_backup_TIMESTAMP.tar.gz

# 2. Restore MongoDB
docker exec gitvizz-mongo mongorestore --db gitvizz_prod /backup/restore/mongodb/BACKUP_NAME

# 3. Restore files
tar -xzf storage/storage_files.tar.gz -C /path/to/gitvizz/

# 4. Restore environment files
cp environment/*.env.production /path/to/gitvizz/backend/
cp environment/*.env.production /path/to/gitvizz/frontend/

# 5. Start services
docker-compose -f docker-compose.prod.yaml up -d
```

## Updates and Maintenance

### Application Updates

```bash
# Update to latest version (recommended)
./scripts/update-prod.sh

# Manual update process
git pull origin main
docker-compose -f docker-compose.prod.yaml build
docker-compose -f docker-compose.prod.yaml up -d

# Check for updates
git fetch origin
git log HEAD..origin/main --oneline
```

### System Updates

```bash
# Update system packages
sudo apt-get update && sudo apt-get upgrade -y

# Update Docker images
docker-compose -f docker-compose.prod.yaml pull
docker-compose -f docker-compose.prod.yaml up -d

# Clean up old Docker images
docker image prune -f
docker system prune -f
```

## SSL Certificate Management

### Certificate Operations

```bash
# Setup SSL certificates
./scripts/setup-ssl.sh

# Check certificate status
sudo certbot certificates

# Renew certificates manually
sudo certbot renew

# Test certificate renewal
sudo certbot renew --dry-run

# Check certificate expiry
openssl x509 -in nginx/ssl/fullchain.pem -noout -dates
```

### Nginx Configuration

```bash
# Test nginx configuration
docker exec gitvizz-nginx nginx -t

# Reload nginx configuration
docker exec gitvizz-nginx nginx -s reload

# View nginx access logs
docker exec gitvizz-nginx tail -f /var/log/nginx/access.log

# View nginx error logs
docker exec gitvizz-nginx tail -f /var/log/nginx/error.log
```

## Security Management

### Security Hardening

```bash
# Run security setup (one-time)
sudo ./scripts/security-setup.sh

# Check firewall status
sudo ufw status

# Check fail2ban status
sudo fail2ban-client status

# Check SSH configuration
sudo sshd -T
```

### Security Monitoring

```bash
# Check security logs
sudo tail -f /var/log/auth.log
sudo tail -f /var/log/fail2ban.log

# Run security scans
sudo rkhunter --check
sudo chkrootkit

# Check for failed login attempts
sudo grep "Failed password" /var/log/auth.log
```

## Log Management

### Log Viewing

```bash
# View application logs
docker-compose -f docker-compose.prod.yaml logs -f

# View system logs
sudo journalctl -f

# View specific log files
sudo tail -f /var/log/syslog
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### Log Analysis

```bash
# Count error logs
docker logs gitvizz-backend 2>&1 | grep -i error | wc -l

# Find specific errors
docker logs gitvizz-backend 2>&1 | grep -i "connection refused"

# Monitor real-time logs
docker-compose -f docker-compose.prod.yaml logs -f --tail=100
```

## Performance Monitoring

### Resource Monitoring

```bash
# Monitor system resources
htop
iotop
nethogs

# Monitor Docker resources
docker stats --no-stream

# Check disk usage
df -h
du -sh /var/lib/docker/
```

### Application Performance

```bash
# Check response times
curl -w "@curl-format.txt" -o /dev/null -s https://gitvizz.sutools.app

# Monitor API endpoints
curl -f https://gitvizz.sutools.app/api/health

# Check database performance
docker exec gitvizz-mongo mongosh --eval "db.runCommand({serverStatus: 1})"
```

## Troubleshooting

### Common Issues

```bash
# Service won't start
docker-compose -f docker-compose.prod.yaml logs SERVICE_NAME

# Port conflicts
sudo netstat -tulpn | grep :PORT_NUMBER

# Permission issues
sudo chown -R $USER:$USER /path/to/directory

# Disk space issues
sudo du -sh /* | sort -hr | head -10
```

### Debugging Commands

```bash
# Check service dependencies
docker-compose -f docker-compose.prod.yaml config

# Verify environment variables
docker exec gitvizz-backend env | grep -E "(MONGO|JWT|GITHUB)"

# Test network connectivity
docker exec gitvizz-backend ping mongo
docker exec gitvizz-backend ping phoenix

# Check file permissions
ls -la backend/.env.production
ls -la frontend/.env.production
```

## Emergency Procedures

### Service Recovery

```bash
# Emergency restart
docker-compose -f docker-compose.prod.yaml down
docker-compose -f docker-compose.prod.yaml up -d

# Force rebuild
docker-compose -f docker-compose.prod.yaml build --no-cache
docker-compose -f docker-compose.prod.yaml up -d

# Reset to clean state
docker-compose -f docker-compose.prod.yaml down -v
docker system prune -a -f
```

### Data Recovery

```bash
# Emergency backup
./scripts/backup-prod.sh

# Check data integrity
docker exec gitvizz-mongo mongosh --eval "db.runCommand({dbStats: 1})"

# Verify file system
sudo fsck /dev/sda1
```

## Maintenance Schedule

### Daily Tasks
```bash
# Check service health
./scripts/health-check.sh

# Monitor logs for errors
docker-compose -f docker-compose.prod.yaml logs --since="1h" | grep -i error
```

### Weekly Tasks
```bash
# Create backup
./scripts/backup-prod.sh

# Check SSL certificate
sudo certbot certificates

# Review security logs
sudo tail -n 100 /var/log/auth.log
```

### Monthly Tasks
```bash
# Update system packages
sudo apt-get update && sudo apt-get upgrade -y

# Clean up old backups
find /opt/gitvizz-backups/ -name "gitvizz_backup_*" -mtime +30 -delete

# Run security scans
sudo rkhunter --update && sudo rkhunter --check
```

## Environment Variables Reference

### Backend Environment
```bash
# Check backend environment
docker exec gitvizz-backend env | grep -E "(MONGO|JWT|GITHUB|OPENAI|ANTHROPIC|GEMINI|GROQ)"
```

### Frontend Environment
```bash
# Check frontend environment
docker exec gitvizz-frontend env | grep -E "(NEXT_PUBLIC|NEXTAUTH|AUTH)"
```

## Network and Connectivity

### Network Testing
```bash
# Test external connectivity
curl -I https://gitvizz.sutools.app
curl -I https://gitvizz.sutools.app/api/health

# Test internal connectivity
docker exec gitvizz-backend curl -f http://mongo:27017
docker exec gitvizz-backend curl -f http://phoenix:6006
```

### DNS and Domain
```bash
# Check DNS resolution
dig gitvizz.sutools.app
nslookup gitvizz.sutools.app

# Check domain configuration
curl -I http://gitvizz.sutools.app  # Should redirect to HTTPS
curl -I https://gitvizz.sutools.app
```

## Useful Scripts and Aliases

### Create Management Aliases
```bash
# Add to ~/.bashrc or ~/.zshrc
alias gitvizz-status='docker-compose -f docker-compose.prod.yaml ps'
alias gitvizz-logs='docker-compose -f docker-compose.prod.yaml logs -f'
alias gitvizz-restart='docker-compose -f docker-compose.prod.yaml restart'
alias gitvizz-health='./scripts/health-check.sh'
alias gitvizz-backup='./scripts/backup-prod.sh'
alias gitvizz-update='./scripts/update-prod.sh'
```

### Custom Scripts
```bash
# Create quick status script
cat > quick-status.sh << 'EOF'
#!/bin/bash
echo "=== GitVizz Production Status ==="
echo "Services:"
docker-compose -f docker-compose.prod.yaml ps
echo ""
echo "Health Check:"
./scripts/health-check.sh
EOF
chmod +x quick-status.sh
```

## Support and Documentation

### Getting Help
- **Health Check**: `./scripts/health-check.sh`
- **Service Logs**: `docker-compose -f docker-compose.prod.yaml logs -f`
- **System Logs**: `sudo journalctl -f`
- **Documentation**: `docs/deployment_guide.md`

### Emergency Contacts
- **System Administrator**: [Your contact info]
- **GitHub Repository**: [Repository URL]
- **Documentation**: [Documentation URL]

---

**Note**: Always test commands in a staging environment before running in production. Keep backups before making significant changes.
