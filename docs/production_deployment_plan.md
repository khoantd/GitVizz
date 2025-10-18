# Production Deployment Plan for GitVizz

## Overview

Deploy GitVizz to production with enterprise-grade security, scalability, and monitoring capabilities.

## Deployment Options

### Option 1: VPS/Cloud Server (Recommended for Full Control)

- **Platforms**: AWS EC2, DigitalOcean, Linode, Hetzner
- **Best for**: Full control, custom configurations, cost-effective at scale

### Option 2: Container Platforms

- **Platforms**: AWS ECS, Google Cloud Run, Azure Container Apps
- **Best for**: Managed infrastructure, auto-scaling

### Option 3: Platform as a Service

- **Frontend**: Vercel, Netlify
- **Backend**: Railway, Render, Fly.io
- **Best for**: Quick deployment, minimal DevOps

## Implementation Steps

### 1. Production Environment Files

Create production-specific environment files:

**`backend/.env.production`**:

```bash
# Production settings
HOST=0.0.0.0
PORT=8003

# Use production MongoDB (managed service recommended)
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/gitvizz?retryWrites=true&w=majority
MONGODB_DB_NAME=gitvizz_prod

# Strong JWT secret (generate new for production)
JWT_SECRET=<generate-with-openssl-rand-base64-32>
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=10080
REFRESH_TOKEN_EXPIRE_DAYS=30

# Strong encryption keys (generate new for production)
ENCRYPTION_KEY=<generate-with-fernet>
FERNET_KEY=<generate-with-fernet>

# Production GitHub OAuth
GITHUB_CLIENT_ID=<production-github-app-id>
GITHUB_CLIENT_SECRET=<production-github-app-secret>
GITHUB_USER_AGENT=gitvizz-production

# Phoenix Cloud (recommended for production)
PHOENIX_API_KEY=<your-phoenix-cloud-key>
PHOENIX_COLLECTOR_ENDPOINT=https://app.phoenix.arize.com
PHOENIX_PROJECT_NAME=gitvizz-production
IS_DISABLING_OBSERVABILITY=false

# LLM API Keys
OPENAI_API_KEY=<production-key>
ANTHROPIC_API_KEY=<production-key>
GEMINI_API_KEY=<production-key>
GROQ_API_KEY=<production-key>

# File storage (use S3 or similar for production)
FILE_STORAGE_BASEPATH=/data/storage
```

**`frontend/.env.production`**:

```bash
# Production backend URL
NEXT_PUBLIC_BACKEND_URL=https://api.yourdomain.com

# NextAuth configuration
NEXTAUTH_URL=https://yourdomain.com
AUTH_SECRET=<generate-new-secret>
AUTH_GITHUB_ID=<production-github-app-id>
AUTH_GITHUB_SECRET=<production-github-app-secret>
NEXT_PUBLIC_GITHUB_APP_NAME=<your-github-app-name>

# Disable telemetry
NEXT_TELEMETRY_DISABLED=1
```

### 2. Production Docker Compose

Create `docker-compose.prod.yaml`:

```yaml
version: '3.8'

services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
      - ./nginx/logs:/var/log/nginx
    depends_on:
      - frontend
      - backend
    networks:
      - gitvizz-network
    restart: always

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    env_file:
      - ./backend/.env.production
    environment:
      - PHOENIX_COLLECTOR_ENDPOINT=http://phoenix:6006/v1/traces
    volumes:
      - backend-storage:/data/storage
    depends_on:
      - mongo
      - phoenix
    networks:
      - gitvizz-network
    restart: always
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8003/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
      args:
        - NEXT_PUBLIC_BACKEND_URL=https://api.yourdomain.com
    env_file:
      - ./frontend/.env.production
    depends_on:
      - backend
    networks:
      - gitvizz-network
    restart: always
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000"]
      interval: 30s
      timeout: 10s
      retries: 3

  mongo:
    image: mongo:7.0
    environment:
      MONGO_INITDB_ROOT_USERNAME: admin
      MONGO_INITDB_ROOT_PASSWORD: <strong-password>
    volumes:
      - mongo-data:/data/db
      - ./mongo/backup:/backup
    networks:
      - gitvizz-network
    restart: always
    command: mongod --auth

  phoenix:
    image: arizephoenix/phoenix:latest
    environment:
      - PHOENIX_WORKING_DIR=/mnt/data
    volumes:
      - phoenix-data:/mnt/data
    networks:
      - gitvizz-network
    restart: always

networks:
  gitvizz-network:
    driver: bridge

volumes:
  mongo-data:
  phoenix-data:
  backend-storage:
```

### 3. Nginx Reverse Proxy Configuration

Create `nginx/nginx.conf`:

```nginx
events {
    worker_connections 1024;
}

http {
    upstream backend {
        server backend:8003;
    }

    upstream frontend {
        server frontend:3000;
    }

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=general_limit:10m rate=30r/s;

    # Redirect HTTP to HTTPS
    server {
        listen 80;
        server_name yourdomain.com www.yourdomain.com;
        return 301 https://$server_name$request_uri;
    }

    # Main application
    server {
        listen 443 ssl http2;
        server_name yourdomain.com www.yourdomain.com;

        ssl_certificate /etc/nginx/ssl/fullchain.pem;
        ssl_certificate_key /etc/nginx/ssl/privkey.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;

        client_max_body_size 100M;

        # Frontend
        location / {
            proxy_pass http://frontend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            
            limit_req zone=general_limit burst=20 nodelay;
        }

        # Backend API
        location /backend- {
            proxy_pass http://backend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            
            # Longer timeout for LLM operations
            proxy_read_timeout 300s;
            proxy_connect_timeout 300s;
            proxy_send_timeout 300s;
            
            limit_req zone=api_limit burst=5 nodelay;
        }

        # Health check endpoint (no rate limit)
        location /health {
            proxy_pass http://backend;
            access_log off;
        }
    }

    # API subdomain
    server {
        listen 443 ssl http2;
        server_name api.yourdomain.com;

        ssl_certificate /etc/nginx/ssl/fullchain.pem;
        ssl_certificate_key /etc/nginx/ssl/privkey.pem;
        ssl_protocols TLSv1.2 TLSv1.3;

        location / {
            proxy_pass http://backend;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            
            proxy_read_timeout 300s;
            limit_req zone=api_limit burst=10 nodelay;
        }
    }
}
```

### 4. SSL Certificate Setup

Use Let's Encrypt with Certbot:

```bash
# Install certbot
sudo apt-get install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com -d api.yourdomain.com

# Copy certificates to nginx directory
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem ./nginx/ssl/
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem ./nginx/ssl/

# Set up auto-renewal
sudo certbot renew --dry-run
```

### 5. MongoDB Production Setup

Use MongoDB Atlas (recommended) or self-hosted with authentication:

```bash
# For self-hosted MongoDB
docker exec -it mongo mongosh

# Create admin user
use admin
db.createUser({
  user: "admin",
  pwd: "<strong-password>",
  roles: ["root"]
})

# Create app user
use gitvizz_prod
db.createUser({
  user: "gitvizz_app",
  pwd: "<strong-password>",
  roles: [{role: "readWrite", db: "gitvizz_prod"}]
})
```

### 6. Monitoring & Logging Setup

Create `docker-compose.monitoring.yaml`:

```yaml
version: '3.8'

services:
  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus-data:/prometheus
    ports:
      - "9090:9090"
    networks:
      - gitvizz-network
    restart: always

  grafana:
    image: grafana/grafana:latest
    volumes:
      - grafana-data:/var/lib/grafana
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=<strong-password>
    networks:
      - gitvizz-network
    restart: always

  loki:
    image: grafana/loki:latest
    ports:
      - "3100:3100"
    volumes:
      - ./monitoring/loki-config.yaml:/etc/loki/local-config.yaml
      - loki-data:/loki
    networks:
      - gitvizz-network
    restart: always

volumes:
  prometheus-data:
  grafana-data:
  loki-data:

networks:
  gitvizz-network:
    external: true
```

### 7. Backup Strategy

Create `scripts/backup.sh`:

```bash
#!/bin/bash
# Automated backup script

BACKUP_DIR="/backup/gitvizz"
DATE=$(date +%Y%m%d_%H%M%S)

# Backup MongoDB
docker exec mongo mongodump --out /backup/mongo_$DATE

# Backup storage files
tar -czf $BACKUP_DIR/storage_$DATE.tar.gz ./storage

# Backup environment files (encrypted)
tar -czf $BACKUP_DIR/env_$DATE.tar.gz ./backend/.env.production ./frontend/.env.production
gpg --encrypt $BACKUP_DIR/env_$DATE.tar.gz

# Upload to S3 or backup service
# aws s3 cp $BACKUP_DIR s3://your-backup-bucket/ --recursive

# Clean old backups (keep last 30 days)
find $BACKUP_DIR -type f -mtime +30 -delete
```

### 8. CI/CD Pipeline

Create `.github/workflows/deploy-production.yaml`:

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Run Backend Tests
        run: |
          cd backend
          pip install pytest
          pytest tests/
      
      - name: Run Frontend Tests
        run: |
          cd frontend
          npm install
          npm run lint
          npm run build

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Deploy to Server
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.PRODUCTION_HOST }}
          username: ${{ secrets.PRODUCTION_USER }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            cd /opt/gitvizz
            git pull origin main
            docker-compose -f docker-compose.prod.yaml down
            docker-compose -f docker-compose.prod.yaml build
            docker-compose -f docker-compose.prod.yaml up -d
            docker system prune -f
```

### 9. Health Checks & Monitoring

Add health check endpoints to backend (`backend/routes/health_routes.py`):

```python
from fastapi import APIRouter
from utils.db import db_instance

router = APIRouter()

@router.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "gitvizz-backend"
    }

@router.get("/health/detailed")
async def detailed_health():
    checks = {
        "database": "unknown",
        "llm_providers": "unknown"
    }
    
    try:
        await db_instance.client.admin.command('ping')
        checks["database"] = "healthy"
    except:
        checks["database"] = "unhealthy"
    
    return {"status": "healthy", "checks": checks}
```

### 10. Security Hardening

Create `scripts/security-setup.sh`:

```bash
#!/bin/bash
# Security hardening script

# Update system
sudo apt-get update && sudo apt-get upgrade -y

# Install fail2ban
sudo apt-get install fail2ban -y

# Configure firewall
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

# Set up automatic security updates
sudo apt-get install unattended-upgrades -y
sudo dpkg-reconfigure -plow unattended-upgrades
```

## Deployment Checklist

- [ ] Generate new production secrets (JWT, encryption keys)
- [ ] Set up production MongoDB (Atlas or self-hosted with auth)
- [ ] Configure production GitHub OAuth app
- [ ] Obtain SSL certificates (Let's Encrypt)
- [ ] Set up domain DNS records
- [ ] Configure environment variables
- [ ] Set up monitoring (Prometheus, Grafana, Phoenix)
- [ ] Configure backup automation
- [ ] Set up CI/CD pipeline
- [ ] Run security hardening
- [ ] Test deployment in staging environment
- [ ] Deploy to production
- [ ] Verify all services are running
- [ ] Test chat functionality end-to-end
- [ ] Monitor logs and metrics
- [ ] Set up alerts for critical issues

## Post-Deployment

- Monitor Phoenix dashboard for LLM usage and costs
- Set up log aggregation and analysis
- Configure automated backups
- Set up uptime monitoring (UptimeRobot, Pingdom)
- Document deployment process
- Create runbook for common issues
- Set up on-call rotation if needed

## Estimated Costs (Monthly)

- **VPS (4GB RAM, 2 vCPU)**: $20-40
- **MongoDB Atlas (Shared)**: $0-9
- **Domain + SSL**: $10-15
- **Phoenix Cloud (Optional)**: $0-50
- **Backup Storage**: $5-10
- **LLM API Usage**: Variable (usage-based)

**Total**: ~$50-150/month (excluding LLM costs)