"""AI Summarize — summarize multiple peer reviews for a submission."""

import json

from flask import Blueprint, jsonify, request

from config import OPENAI_API_KEY, OPENAI_MODEL, log
from extensions import call_openai, get_db, limiter, require_api_key

summarize_bp = Blueprint("summarize", __name__, url_prefix="/api/ai")

SUMMARIZE_SYSTEM_PROMPT = """You are an AI assistant that summarizes peer review feedback.
Given an array of peer review objects (each with score, comments, reviewer_name), produce a comprehensive summary.
Return a JSON object with EXACTLY these keys:
- "summary": a markdown-formatted summary including: overall assessment, common themes, strengths noted, areas for improvement, and score analysis
- "themes": array of short theme strings identified across reviews
- "avg_score": the average score as a float
Return ONLY valid JSON, no markdown fences."""


@summarize_bp.route("/summarize", methods=["POST"])
@require_api_key
@limiter.limit("60 per minute")
def summarize_reviews():
    """Summarize multiple reviews for a submission."""
    data = request.get_json(silent=True) or {}
    reviews = data.get("reviews", [])

    if not reviews:
        return jsonify(error="validation", message="reviews array is required"), 400

    if not OPENAI_API_KEY:
        return jsonify(
            error="not_configured",
            message="OpenAI API key is not configured. AI summarization is unavailable.",
        ), 503

    review_text = json.dumps([
        {"score": r.get("score"), "comments": r.get("comments", ""), "reviewer": r.get("reviewer_name", "Anonymous")}
        for r in reviews
    ], indent=2)

    try:
        result = call_openai(
            model=OPENAI_MODEL, temperature=0.3,
            system_prompt=SUMMARIZE_SYSTEM_PROMPT,
            user_message=f"Summarize these peer reviews:\n\n{review_text}",
            action="summarize",
        )
    except json.JSONDecodeError:
        return jsonify(error="ai_error", message="AI returned invalid response"), 502
    except Exception as e:
        log.error("OpenAI summarize call failed: %s", e)
        return jsonify(error="ai_error", message=str(e)), 502

    # Log activity
    try:
        conn = get_db()
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO ai_activity_logs (action, user_id, detail, created_at)
                   VALUES ('summarize', %s, %s, now())""",
                (data.get("user_id", "unknown"), json.dumps({"input_length": len(reviews), "review_count": len(reviews)})),
            )
        conn.commit()
    except Exception as e:
        log.warning("Failed to log AI summarize activity: %s", e)

    return jsonify({
        "summary": result.get("summary", "Summary generation failed."),
        "themes": result.get("themes", []),
        "avg_score": result.get("avg_score", 0),
    })
