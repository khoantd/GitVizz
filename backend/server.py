from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes.repo_routes import router as repo_router

app = FastAPI(
    title="GitViz API",
    description="API for generating text, graphs, and structure from code repositories."
)

# CORS middleware to allow cross-origin requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include the repository routes
app.include_router(repo_router, prefix="/api", tags=["Repository Operations"])


# =====================
# Main Entrypoint
# =====================
if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run("server:app", host="0.0.0.0", port=8003, reload=True)