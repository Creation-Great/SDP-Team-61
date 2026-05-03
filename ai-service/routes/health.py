"""Health check endpoint."""

from flask import Blueprint, jsonify

from config import OPENAI_API_KEY

health_bp = Blueprint("health", __name__)


@health_bp.route("/healthz")
def healthz():
    return jsonify({"status": "ok", "service": "ai-service", "openai_configured": bool(OPENAI_API_KEY)})
