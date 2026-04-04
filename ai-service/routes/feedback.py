"""AI Feedback — analyse a review text for toxicity, politeness, sentiment."""

import json

from flask import Blueprint, jsonify, request
import psycopg2.extras

from config import OPENAI_API_KEY, OPENAI_MODEL, MAX_TEXT_LENGTH, log
from extensions import (
    call_openai,
    get_db,
    limiter,
    require_api_key,
    validate_feedback,
)

feedback_bp = Blueprint("feedback", __name__, url_prefix="/api/ai")

FEEDBACK_SYSTEM_PROMPT = """You are an AI assistant that analyses peer review comments.
Given a review comment, return a JSON object with EXACTLY these keys:
- "toxicity": float 0-1 (0 = not toxic, 1 = very toxic)
- "politeness": float 0-1 (0 = very impolite, 1 = very polite)
- "sentiment": one of "positive", "negative", "neutral", "mixed"
- "identity_spans": array of {start, end, label} for identity-related language (empty if none)
- "evidence_spans": array of {start, end, label} for evidence/citation spans
- "summary": a short 1-2 sentence summary of the review quality
- "suggestions": array of 1-3 short improvement suggestions
- "confidence": float 0-1 indicating your confidence in this analysis
Return ONLY valid JSON, no markdown fences."""


@feedback_bp.route("/feedback", methods=["POST"])
@require_api_key
@limiter.limit("60 per minute")
def generate_feedback():
    """Analyse a review comment with OpenAI and persist to ml_outputs."""
    data = request.get_json(silent=True) or {}
    review_id = data.get("review_id")
    text = data.get("text", "").strip()

    if not review_id or not text:
        return jsonify(error="validation", message="review_id and text are required"), 400

    if len(text) > MAX_TEXT_LENGTH:
        return jsonify(error="validation", message=f"Text exceeds maximum length of {MAX_TEXT_LENGTH} characters"), 400

    # Check cache
    conn = get_db()
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute("SELECT * FROM ml_outputs WHERE review_id = %s", (review_id,))
        cached = cur.fetchone()
    if cached:
        return jsonify({
            "review_id": str(cached["review_id"]),
            "toxicity": cached["toxicity"],
            "politeness": cached["politeness"],
            "sentiment": cached["sentiment"],
            "identity_spans": cached["identity_spans"] or [],
            "evidence_spans": cached["evidence_spans"] or [],
            "summary": "Cached AI analysis result.",
            "suggestions": [],
            "confidence": 1.0,
            "model_version": cached["model_version"],
            "cached": True,
        })

    if not OPENAI_API_KEY:
        return jsonify(
            error="not_configured",
            message="OpenAI API key is not configured. AI feedback is unavailable.",
        ), 503

    try:
        result = call_openai(
            model=OPENAI_MODEL, temperature=0.2,
            system_prompt=FEEDBACK_SYSTEM_PROMPT,
            user_message=f"Analyse this peer review comment:\n\n{text}",
            action="feedback",
        )
        result = validate_feedback(result)
    except json.JSONDecodeError:
        return jsonify(error="ai_error", message="AI returned invalid response"), 502
    except Exception as e:
        log.error("OpenAI feedback call failed: %s", e)
        return jsonify(error="ai_error", message=str(e)), 502

    # Persist to ml_outputs
    model_version = OPENAI_MODEL
    try:
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO ml_outputs
                   (review_id, toxicity, politeness, sentiment, identity_spans, evidence_spans, model_version)
                   VALUES (%s, %s, %s, %s, %s, %s, %s)
                   ON CONFLICT (review_id) DO UPDATE SET
                     toxicity = EXCLUDED.toxicity,
                     politeness = EXCLUDED.politeness,
                     sentiment = EXCLUDED.sentiment,
                     identity_spans = EXCLUDED.identity_spans,
                     evidence_spans = EXCLUDED.evidence_spans,
                     model_version = EXCLUDED.model_version
                """,
                (
                    review_id,
                    result.get("toxicity", 0),
                    result.get("politeness", 0),
                    result.get("sentiment", "neutral"),
                    json.dumps(result.get("identity_spans", [])),
                    json.dumps(result.get("evidence_spans", [])),
                    model_version,
                ),
            )
        conn.commit()
    except Exception as e:
        conn.rollback()
        log.warning("Failed to persist ml_outputs for review %s: %s", review_id, e)

    result["review_id"] = review_id
    result["model_version"] = model_version
    result["cached"] = False
    return jsonify(result)


@feedback_bp.route("/feedback/<review_id>", methods=["GET"])
@require_api_key
def get_feedback(review_id):
    """Return stored ML analysis for a review, or 404."""
    conn = get_db()
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute("SELECT * FROM ml_outputs WHERE review_id = %s", (review_id,))
        row = cur.fetchone()
    if not row:
        return jsonify(error="not_found", message="No AI feedback found for this review"), 404
    return jsonify({
        "review_id": str(row["review_id"]),
        "toxicity": row["toxicity"],
        "politeness": row["politeness"],
        "sentiment": row["sentiment"],
        "identity_spans": row["identity_spans"] or [],
        "evidence_spans": row["evidence_spans"] or [],
        "model_version": row["model_version"],
        "created_at": row["created_at"].isoformat() if row["created_at"] else None,
    })
