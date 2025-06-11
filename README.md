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
├── frontend/           # Next.js frontend (see frontend/README.md)
├── server.py           # FastAPI app entry point
├── custom_ast_parser.py
├── graph_generator.py
├── lib/                # Backend helper modules
├── templates/          # HTML templates (if any)
├── static/             # Static files (images, etc.)
├── archives/           # Uploaded or processed repo files
├── examples/           # Sample inputs or test repos
├── .venv/              # Virtual environment (ignored in Git)
├── requirements.txt    # Python dependencies
└── README.md           # You are here
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
pip install -r requirements.txt
```

### 3. Run the API Server (with FastAPI + Uvicorn)

```bash
uvicorn server:app --host 0.0.0.0 --port 8003 --reload
```

The API will be available at: [http://localhost:8003](http://localhost:8003)

---

## 🧑‍🎨 Frontend Setup

Please refer to `frontend/README.md` for full frontend setup instructions.

**TL;DR:**
- Install with `pnpm install`
- Copy `.example.env` → `.env.local`
- Run dev server: `pnpm dev`

---

## 🔧 API Overview

The backend supports:

- Parsing ZIP or GitHub repos
- Generating:
  - LLM-friendly summaries
  - File structure trees
  - AST/dependency graphs