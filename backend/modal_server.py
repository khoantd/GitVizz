import modal
# Define the Modal image with FastAPI dependencies

image = (
    modal.Image.debian_slim(python_version="3.12")
    .add_local_dir(".", "/root", copy=True)
    .run_commands(
        "pip install --upgrade pip",
        "pip install -r /root/requirements.txt",
    )
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
