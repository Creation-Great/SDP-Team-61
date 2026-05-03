"""
AI Feedback Service – OpenAI-powered
Provides AI feedback analysis and rewrite suggestions for peer review comments.
Persists results to PostgreSQL (ml_outputs, rewrite_suggestions tables).
"""

import os

from flask import Flask
from flask_cors import CORS

from config import MAX_CONTENT_LENGTH, FRONTEND_URL, OPENAI_API_KEY, log
from extensions import close_db, limiter
from routes import register_all


def create_app() -> Flask:
    """Application factory — creates and configures the Flask app."""
    application = Flask(__name__)
    application.config["MAX_CONTENT_LENGTH"] = MAX_CONTENT_LENGTH

    # CORS
    CORS(application, origins=[FRONTEND_URL])

    # Rate limiter
    limiter.init_app(application)

    # DB teardown
    application.teardown_appcontext(close_db)

    # Register all Blueprints
    register_all(application)

    return application


# Module-level app instance for Gunicorn (``gunicorn app:app``)
app = create_app()


if __name__ == "__main__":
    port = int(os.getenv("AI_PORT", "5001"))
    debug = os.getenv("FLASK_DEBUG", "0") == "1"
    log.info("AI service starting on port %d (OpenAI configured: %s)", port, bool(OPENAI_API_KEY))
    app.run(host="0.0.0.0", port=port, debug=debug)
