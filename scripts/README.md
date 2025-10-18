# GitVizz Development Scripts

This directory contains scripts to help you set up and run the GitVizz development environment.

## Quick Start

The fastest way to get GitVizz running:

```bash
# 1. Setup environment files
./scripts/setup-env.sh

# 2. Start the development environment
./scripts/quick-start.sh
```

## Available Scripts

### 🚀 `quick-start.sh`
**Purpose**: Quick startup of the development environment using Docker

**Usage**:
```bash
./scripts/quick-start.sh
```

**What it does**:
- Checks if Docker is running
- Starts all services with `docker-compose up -d`
- Verifies service health
- Shows service URLs and useful commands

**Best for**: Quick development startup when you just want to get everything running

---

### 🔧 `dev-env.sh`
**Purpose**: Comprehensive development environment management

**Usage**:
```bash
# Start with Docker (default)
./scripts/dev-env.sh

# Start locally (requires local MongoDB)
./scripts/dev-env.sh --local

# Setup environment files only
./scripts/dev-env.sh --setup

# Cleanup and stop all services
./scripts/dev-env.sh --cleanup

# Show help
./scripts/dev-env.sh --help
```

**Features**:
- Prerequisites checking (Docker, pnpm, Python, uv)
- Environment file setup
- Dependency installation
- Service health monitoring
- Local and Docker deployment options
- Comprehensive error handling

**Best for**: Full development setup, troubleshooting, or when you need more control

---

### 📝 `setup-env.sh`
**Purpose**: Setup environment files from templates

**Usage**:
```bash
./scripts/setup-env.sh
```

**What it does**:
- Copies environment templates to the correct locations
- Creates `backend/.env` from template
- Creates `frontend/.env.local` from template
- Provides guidance on required configuration

**Best for**: Initial setup or when you need to reset environment files

---

## Development Workflow

### First Time Setup

1. **Clone the repository** (if not already done)
2. **Setup environment files**:
   ```bash
   ./scripts/setup-env.sh
   ```
3. **Configure your API keys** in `backend/.env`
4. **Start the development environment**:
   ```bash
   ./scripts/quick-start.sh
   ```

### Daily Development

1. **Start services**:
   ```bash
   ./scripts/quick-start.sh
   ```
2. **Open your browser** to http://localhost:3000
3. **Stop services when done**:
   ```bash
   docker-compose down
   ```

### Troubleshooting

If you encounter issues:

1. **Check service status**:
   ```bash
   docker-compose ps
   ```

2. **View logs**:
   ```bash
   docker-compose logs -f
   ```

3. **Restart services**:
   ```bash
   docker-compose restart
   ```

4. **Full cleanup and restart**:
   ```bash
   ./scripts/dev-env.sh --cleanup
   ./scripts/quick-start.sh
   ```

## Service URLs

When the development environment is running, you can access:

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8003
- **API Documentation**: http://localhost:8003/docs
- **Phoenix Observability**: http://localhost:6006
- **MongoDB**: mongodb://localhost:27017

## Environment Configuration

### Backend Environment (`backend/.env`)

Required for basic functionality:
```bash
MONGO_URI=mongodb://localhost:27017
MONGODB_DB_NAME=gitvizz
JWT_SECRET=your-super-secret-jwt-key
```

Required for AI features (at least one):
```bash
OPENAI_API_KEY=your-openai-key
ANTHROPIC_API_KEY=your-anthropic-key
GEMINI_API_KEY=your-gemini-key
GROQ_API_KEY=your-groq-key
```

### Frontend Environment (`frontend/.env.local`)

Required:
```bash
NEXT_PUBLIC_BACKEND_URL=http://localhost:8003
NEXTAUTH_URL=http://localhost:3000
AUTH_SECRET=your-super-secret-auth-key
```

Optional (for GitHub authentication):
```bash
AUTH_GITHUB_ID=your-github-client-id
AUTH_GITHUB_SECRET=your-github-client-secret
```

## Prerequisites

### Required
- **Docker & Docker Compose**: For containerized services
- **Node.js & pnpm**: For frontend development
- **Python 3.12+ & uv**: For backend development

### Installation Guides

**Docker**:
- macOS: https://docs.docker.com/desktop/mac/install/
- Linux: https://docs.docker.com/engine/install/

**pnpm**:
```bash
npm install -g pnpm
```

**uv** (Python package manager):
```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

## Common Issues

### Port Conflicts
If you get port conflicts, check what's using the ports:
```bash
lsof -i :3000  # Frontend
lsof -i :8003  # Backend
lsof -i :6006  # Phoenix
lsof -i :27017 # MongoDB
```

### Docker Issues
```bash
# Restart Docker
docker-compose down
docker-compose up -d

# Or full cleanup
docker system prune -a
```

### Environment Issues
```bash
# Reset environment files
rm backend/.env frontend/.env.local
./scripts/setup-env.sh
```

## Advanced Usage

### Local Development (without Docker)

If you prefer to run services locally:

1. **Install MongoDB locally**:
   ```bash
   # macOS
   brew install mongodb-community
   brew services start mongodb-community
   
   # Ubuntu/Debian
   sudo apt-get install mongodb
   sudo systemctl start mongodb
   ```

2. **Start Phoenix with Docker**:
   ```bash
   docker run -d --name gitvizz-phoenix -p 6006:6006 arizephoenix/phoenix:latest
   ```

3. **Start backend and frontend locally**:
   ```bash
   ./scripts/dev-env.sh --local
   ```

### Custom Configuration

You can customize the development environment by:

1. **Modifying `docker-compose.yaml`** for Docker services
2. **Editing environment files** for configuration
3. **Using the `--local` flag** for local development

## Contributing

When adding new features or fixing issues:

1. **Test with the development environment**
2. **Update scripts if needed**
3. **Document any new requirements**
4. **Test both Docker and local modes**

## Support

If you encounter issues:

1. **Check the logs**: `docker-compose logs -f`
2. **Verify prerequisites**: All required tools are installed
3. **Check environment files**: API keys and configuration
4. **Try cleanup and restart**: `./scripts/dev-env.sh --cleanup && ./scripts/quick-start.sh`

For more help, check the main project documentation or create an issue.
