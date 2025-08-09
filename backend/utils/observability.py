import os
import logging
from dotenv import load_dotenv


def initialize_observability() -> None:
    """Initialize Arize Phoenix observability if environment is configured.

    Expects the following environment variables (typically via .env):
      - PHOENIX_API_KEY
      - PHOENIX_COLLECTOR_ENDPOINT

    For Phoenix Cloud, we set both OTEL headers and PHOENIX client headers.
    """
    # Ensure .env is loaded (safe to call multiple times)
    load_dotenv()

    phoenix_api_key = os.getenv("PHOENIX_API_KEY")
    collector_endpoint = os.getenv("PHOENIX_COLLECTOR_ENDPOINT")

    logger = logging.getLogger(__name__)

    if not phoenix_api_key or not collector_endpoint:
        logger.info(
            "Phoenix observability not configured (missing PHOENIX_API_KEY or PHOENIX_COLLECTOR_ENDPOINT)."
        )
        return

    # Required for Phoenix Cloud – OTLP exporter header must include api_key
    os.environ["OTEL_EXPORTER_OTLP_HEADERS"] = f"api_key={phoenix_api_key}"

    # Also set Phoenix client headers for compatibility with certain cloud spaces
    os.environ["PHOENIX_CLIENT_HEADERS"] = f"api_key={phoenix_api_key}"

    # Ensure collector endpoint is set
    os.environ["PHOENIX_COLLECTOR_ENDPOINT"] = collector_endpoint

    try:
        # Register Phoenix OpenInference and auto-instrument installed libs (e.g., LiteLLM)
        from phoenix.otel import register

        register(
            project_name=os.getenv("PHOENIX_PROJECT_NAME", "gitvizz-backend"),
            auto_instrument=True,
        )
        logger.info("Phoenix observability initialized and auto-instrumented.")
    except Exception as exc:  # Pragmatic catch to avoid blocking app start
        logger.warning(f"Phoenix initialization failed: {exc}") 