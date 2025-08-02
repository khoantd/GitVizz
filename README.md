<p align="center">
  <img src="./frontend/public/logo.svg" width="150" alt="GitVizz Logo" />
</p>

# GitVizz

**Visualize and analyze GitHub or local repositories with LLM-friendly summaries, file structure, interactive dependency graphs, generate documentation and chat with your repositories.**

---

## 🚀 What is GitVizz?

GitVizz is a full-stack application for developers and teams to:
- Upload or link GitHub/local repositories
- Instantly visualize code structure and dependencies
- Generate LLM-friendly summaries and documentation
- Explore codebases with interactive graphs and a modern UI
- Chat with your repositories to ask questions and get insights
- Generate documentation paths and code navigation

## 📝 Prerequisites

Before using GitVizz, ensure you have the following:

- **GitHub Personal Access Token (optional, but recommended):**  
   See the [GitHub Personal Access Token Guide](./docs/github_personal_token.md) for instructions on creating and configuring your token.

- **GitHub App (mandatory for advanced features):**  
   Follow the [Creating a New GitHub App Guide](./docs/create_github_app.md) to set up a GitHub App if you want deeper integration.

---

## 🧱 Project Overview

GitVizz consists of:
- **Frontend**: Next.js, TailwindCSS, ShadCN UI
- **Backend**: Python FastAPI for parsing, analysis, and graph generation

---

## ⚡ Quick Start

You can run GitVizz using **Docker Compose** (recommended) or set up manually.

### Option 1: Docker Compose (Recommended)

1. **Copy environment variable templates:**
   - Backend: `cp backend/.env.example backend/.env` (edit as needed)
   - Frontend: `cp frontend/.example.env frontend/.env.local` (edit as needed)

2. **Start all services:**
   ```bash
   docker-compose up --build
   ```

3. Access the app:
   - Frontend: [http://localhost:3000](http://localhost:3000)
   - Backend API: [http://localhost:8003](http://localhost:8003)

---

### Option 2: Manual Setup

#### Backend
1. **Create a virtual environment:**
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   ```
2. **Install dependencies:**
   ```bash
   pip install -r backend/requirements.txt
   ```
3. **Copy and edit environment variables:**
   ```bash
   cp backend/.env.example backend/.env
   # Edit backend/.env as needed
   ```
4. **Run the API server:**
   ```bash
   uvicorn backend.server:app --host 0.0.0.0 --port 8003 --reload
   ```
   The API will be available at [http://localhost:8003](http://localhost:8003)

#### Frontend
1. **Install dependencies:**
   ```bash
   cd frontend
   pnpm install
   ```
2. **Copy and edit environment variables:**
   ```bash
   cp .example.env .env.local
   # Edit .env.local as needed
   ```
3. **Run the dev server:**
   ```bash
   pnpm dev
   ```
   The frontend will be available at [http://localhost:3000](http://localhost:3000)

---

## 🛠️ Environment Variables

Both backend and frontend require environment variables for configuration (API keys, ports, etc.).

- **Backend:** Edit `backend/.env` (see `backend/.env.example` for required variables)
- **Frontend:** Edit `frontend/.env.local` (see `frontend/.example.env` for required variables)

---

## 🗂️ Folder Structure

```
.
├── backend/                # Main backend FastAPI app and modules
│   ├── config.py           # Configuration and settings
│   ├── server.py           # FastAPI app entry point
│   ├── controllers/        # API controllers (auth, chat, repo, etc.)
│   ├── documentationo_generator/ # Documentation and code analysis logic
│   ├── graphing/           # AST and dependency graph generation
│   ├── models/             # Pydantic models and ORM classes
│   ├── routes/             # API route definitions
│   ├── schemas/            # Request/response schemas
│   ├── storage/            # User and repo storage
│   ├── utils/              # Utility functions (db, jwt, file, etc.)
│   └── requirements.txt    # Python dependencies
├── frontend/               # Next.js frontend (see frontend/README.md)
│   ├── app/                # Main app pages and logic
│   ├── components/         # React UI components
│   ├── api-client/         # OpenAPI-generated client
│   ├── public/             # Static assets (logo, etc.)
│   └── ...                 # Other frontend folders
├── archives/               # Old codebases or processed repositories
├── examples/               # Sample inputs or test repos
├── static/                 # Static files (dependency graphs, etc.)
├── docker-compose.yaml     # Docker orchestration
├── README.md               # You are here
└── ...                     # Other project files
```

---

## 📝 Contributing & More

For questions, see the [GitHub Personal Access Token Guide](./GitHub%20Personal%20Access%20Token%20Guide.md) or open an issue.