import modal
# Define the Modal image with FastAPI dependencies

image = (
    modal.Image.debian_slim(python_version="3.12")
    .add_local_file("requirements.txt", "/root/requirements.txt", copy=True)
    .add_local_file("custom_ast_parser.py", "/root/custom_ast_parser.py", copy=True)
    .add_local_file("graph_generator.py", "/root/graph_generator.py", copy=True)
    .add_local_file("server.py", "/root/server.py", copy=True)
    .run_commands(
        "pip install --upgrade pip",
        "pip install -r /root/requirements.txt",
    )
    # .add_local_dir(".", "/root", copy=True)
    # .run_commands("cd /root && pip install .")
)
vol = modal.Volume.from_name("omniparse_backend")

# Create a Modal app
app = modal.App("omniparse-code", image=image)


@app.function(
    secrets=[modal.Secret.from_name("omniparse_cloud"), modal.Secret.from_dotenv()],
    volumes={"/data": vol},
)
@modal.asgi_app()
def serve_omniparse_backend():
    import sys

    sys.path.append("/root")  # Add the root directory to the Python path
    from server import app as fastapi_app

    return fastapi_app
