"""AI Polish — improve text style, grammar, and professionalism."""

import json

from flask import Blueprint, jsonify, request

from config import OPENAI_API_KEY, OPENAI_MODEL, MAX_TEXT_LENGTH, log
from extensions import call_openai, get_db, limiter, require_api_key

polish_bp = Blueprint("polish", __name__, url_prefix="/api/ai")

POLISH_SYSTEM_PROMPT = """You are an AI writing assistant that polishes peer review comments.
Given a review comment, improve its grammar, clarity, tone, and professionalism while preserving the original meaning and key feedback points.
Return a JSON object with EXACTLY these keys:
- "polished": the improved version of the text
- "changes": array of short strings describing what was changed
Return ONLY valid JSON, no markdown fences."""


@polish_bp.route("/polish", methods=["POST"])
@require_api_key
@limiter.limit("60 per minute")
def polish_text():
    """Polish a review comment text."""
    data = request.get_json(silent=True) or {}
    text = data.get("text", "").strip()

    if not text:
        return jsonify(error="validation", message="text is required"), 400

    if len(text) > MAX_TEXT_LENGTH:
        return jsonify(error="validation", message=f"Text exceeds maximum length of {MAX_TEXT_LENGTH} characters"), 400

    if not OPENAI_API_KEY:
        return jsonify(
            error="not_configured",
            message="OpenAI API key is not configured. AI polish is unavailable.",
        ), 503

    try:
        result = call_openai(
            model=OPENAI_MODEL, temperature=0.3,
            system_prompt=POLISH_SYSTEM_PROMPT,
            user_message=f"Polish this peer review comment:\n\n{text}",
            action="polish",
        )
    except json.JSONDecodeError:
        return jsonify(error="ai_error", message="AI returned invalid response"), 502
    except Exception as e:
        log.error("OpenAI polish call failed: %s", e)
        return jsonify(error="ai_error", message=str(e)), 502

    # Log activity
    try:
        conn = get_db()
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO ai_activity_logs (action, user_id, detail, created_at)
                   VALUES ('polish', %s, %s, now())""",
                (data.get("user_id", "unknown"), json.dumps({"input_length": len(text)})),
            )
        conn.commit()
    except Exception as e:
        log.warning("Failed to log AI polish activity: %s", e)

    return jsonify({
        "polished": result.get("polished", text),
        "changes": result.get("changes", []),
    })
