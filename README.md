<p align="center">
  <img src="./frontend/public/logo.svg" width="150" alt="GitViz Logo" />
</p>

<h1 align="center">GitViz</h1>

<p align="center">Visualize and analyze GitHub or local repositories using LLM-friendly summaries, file structure, and interactive dependency graphs.</p>

---

## 🧱 Project Overview

GitViz is a full-stack application that allows users to upload or link repositories and receive structured insights. It is split into:

- **Frontend**: A modern UI built with Next.js, TailwindCSS, and ShadCN.
- **Backend**: A Python API that parses, processes, and generates visualizable data from codebases.

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


## ⚙️ Backend Setup

### 1. Create a virtual environment

```bash
python3 -m venv .venv
source .venv/bin/activate
```

### 2. Install dependencies

```bash
pip install -r backend/requirements.txt
```

### 3. Run the API Server (with FastAPI + Uvicorn)

```bash
uvicorn backend.server:app --host 0.0.0.0 --port 8003 --reload
```

The API will be available at: [http://localhost:8003](http://localhost:8003)

---


## 🧑‍🎨 Frontend Setup

Please refer to `frontend/README.md` for full frontend setup instructions.

**TL;DR:**
- Install dependencies: `pnpm install`
- Copy `.example.env` → `.env.local`
- Run dev server: `pnpm dev`

---


## 🔧 API & Features Overview

The backend supports:

- Parsing and analyzing ZIP uploads or GitHub repositories
- Generating:
  - LLM-friendly summaries for codebases and files
  - File structure trees and repository overviews
  - AST and interactive dependency graphs (HTML/JS)
  - Documentation path integration and code navigation
- User authentication and chat endpoints
- OpenAPI schema for API client generation

The frontend provides:

- Modern UI for uploading/linking repositories
- Interactive graph visualizations (vis.js)
- File explorer and code summaries
- Chat interface for code Q&A

---

## 📝 Contributing & More

See `TODO.md` for planned features and improvements.

For questions, see the [GitHub Personal Access Token Guide](./GitHub%20Personal%20Access%20Token%20Guide.md) or open an issue.