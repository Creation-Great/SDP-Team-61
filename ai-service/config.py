"""
Configuration — environment variables, constants, and structured logging.

All values are read from environment variables at import time.
No connections or external resources are created here.
"""

import json
import logging
import os

from dotenv import load_dotenv

load_dotenv()

# ---------------------------------------------------------------------------
# Environment configuration
# ---------------------------------------------------------------------------
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
AI_API_KEY = os.getenv("AI_API_KEY", "")
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5432/peerreview",
)
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

# ---------------------------------------------------------------------------
# Application constants
# ---------------------------------------------------------------------------
MAX_TEXT_LENGTH = 10_000          # Maximum characters for AI text input
MAX_CONTENT_LENGTH = 1 * 1024 * 1024  # 1 MB request body limit
MAX_RETRIES = 3                  # OpenAI retry attempts


# ---------------------------------------------------------------------------
# Structured JSON logging
# ---------------------------------------------------------------------------
class JsonFormatter(logging.Formatter):
    """Structured JSON log formatter for production observability."""

    def format(self, record):
        entry = {
            "ts": self.formatTime(record, "%Y-%m-%dT%H:%M:%S"),
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
        }
        if hasattr(record, "extra_data"):
            entry.update(record.extra_data)
        if record.exc_info and record.exc_info[0]:
            entry["exception"] = self.formatException(record.exc_info)
        return json.dumps(entry)


handler = logging.StreamHandler()
handler.setFormatter(JsonFormatter())
logging.basicConfig(level=logging.INFO, handlers=[handler])
log = logging.getLogger("ai-service")
