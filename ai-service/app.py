"""
AI Feedback Service – Stub
Provides ML-powered feedback and rewrite suggestions for peer review.
Designed to integrate with the PostgreSQL database (ml_outputs, rewrite_suggestions tables).
"""

import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app, origins=[os.getenv("FRONTEND_URL", "http://localhost:5173")])

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://sdp:sdp_pass@localhost:5432/sdp_peer_review")


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------
@app.route("/healthz")
def healthz():
    return jsonify(status="ok", service="ai-service")


# ---------------------------------------------------------------------------
# AI Feedback  (stub – replace with real ML model later)
# ---------------------------------------------------------------------------
@app.route("/api/ai/feedback", methods=["POST"])
def generate_feedback():
    """
    Generate AI feedback for a submission.
    Expected body: { "submission_id": int, "text": str }
    """
    data = request.get_json(silent=True) or {}
    submission_id = data.get("submission_id")
    text = data.get("text", "")

    if not submission_id:
        return jsonify(error="validation", message="submission_id is required"), 400

    # TODO: Replace with actual ML inference (e.g., LLM-based feedback)
    feedback = {
        "submission_id": submission_id,
        "summary": "AI feedback is not yet configured. This is a placeholder response.",
        "suggestions": [
            "Consider expanding section 2 with more detail.",
            "The conclusion could be strengthened with supporting evidence.",
        ],
        "confidence": 0.0,
    }

    return jsonify(feedback)


# ---------------------------------------------------------------------------
# Rewrite Suggestions  (stub)
# ---------------------------------------------------------------------------
@app.route("/api/ai/rewrite", methods=["POST"])
def suggest_rewrite():
    """
    Suggest rewrite for a passage.
    Expected body: { "text": str, "context": str (optional) }
    """
    data = request.get_json(silent=True) or {}
    text = data.get("text", "")

    if not text:
        return jsonify(error="validation", message="text is required"), 400

    # TODO: Replace with actual rewrite model
    return jsonify(
        original=text,
        rewritten=text,  # no-op for now
        note="Rewrite model not yet configured.",
    )


# ---------------------------------------------------------------------------
# Entry
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    port = int(os.getenv("AI_PORT", "5001"))
    debug = os.getenv("FLASK_DEBUG", "0") == "1"
    print(f"AI service starting on port {port}")
    app.run(host="0.0.0.0", port=port, debug=debug)
