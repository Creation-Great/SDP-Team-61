"""AI Rewrite — suggest improved versions of peer review comments."""

import json

from flask import Blueprint, jsonify, request
import psycopg2.extras

from config import OPENAI_API_KEY, OPENAI_MODEL, MAX_TEXT_LENGTH, log
from extensions import call_openai, get_db, limiter, require_api_key

rewrite_bp = Blueprint("rewrite", __name__, url_prefix="/api/ai")

REWRITE_SYSTEM_PROMPT = """You are an AI assistant that improves peer review comments.
Given a review comment and optional context, return a JSON object with EXACTLY these keys:
- "revised_text": the improved version of the text
- "edits": array of {original, replacement, reason} describing each change
- "preserved": array of strings that were good and kept unchanged
- "reasoning": object with keys "tone", "clarity", "specificity" each being a short explanation
Return ONLY valid JSON, no markdown fences."""


@rewrite_bp.route("/rewrite", methods=["POST"])
@require_api_key
@limiter.limit("60 per minute")
def suggest_rewrite():
    """Suggest improved version of a review comment and persist to rewrite_suggestions."""
    data = request.get_json(silent=True) or {}
    review_id = data.get("review_id")
    text = data.get("text", "").strip()
    context = data.get("context", "").strip()

    if not review_id or not text:
        return jsonify(error="validation", message="review_id and text are required"), 400

    if len(text) > MAX_TEXT_LENGTH:
        return jsonify(error="validation", message=f"Text exceeds maximum length of {MAX_TEXT_LENGTH} characters"), 400

    # Check cache
    conn = get_db()
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute("SELECT * FROM rewrite_suggestions WHERE review_id = %s", (review_id,))
        cached = cur.fetchone()
    if cached:
        return jsonify({
            "review_id": str(cached["review_id"]),
            "original": text,
            "revised_text": cached["revised_text"],
            "edits": cached["edits"] or [],
            "preserved": cached["preserved"] or [],
            "reasoning": cached["reasoning"] or {},
            "model_version": cached["model_version"],
            "cached": True,
        })

    if not OPENAI_API_KEY:
        return jsonify(
            error="not_configured",
            message="OpenAI API key is not configured. Rewrite suggestions are unavailable.",
        ), 503

    user_msg = f"Improve this peer review comment:\n\n{text}"
    if context:
        user_msg += f"\n\nContext about the submission being reviewed:\n{context}"

    try:
        result = call_openai(
            model=OPENAI_MODEL, temperature=0.3,
            system_prompt=REWRITE_SYSTEM_PROMPT,
            user_message=user_msg, action="rewrite",
        )
    except json.JSONDecodeError:
        return jsonify(error="ai_error", message="AI returned invalid response"), 502
    except Exception as e:
        log.error("OpenAI rewrite call failed: %s", e)
        return jsonify(error="ai_error", message=str(e)), 502

    # Persist
    model_version = OPENAI_MODEL
    try:
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO rewrite_suggestions
                   (review_id, revised_text, edits, preserved, reasoning, model_version, adopted)
                   VALUES (%s, %s, %s, %s, %s, %s, false)
                   ON CONFLICT (review_id) DO UPDATE SET
                     revised_text = EXCLUDED.revised_text,
                     edits = EXCLUDED.edits,
                     preserved = EXCLUDED.preserved,
                     reasoning = EXCLUDED.reasoning,
                     model_version = EXCLUDED.model_version
                """,
                (
                    review_id,
                    result.get("revised_text", text),
                    json.dumps(result.get("edits", [])),
                    json.dumps(result.get("preserved", [])),
                    json.dumps(result.get("reasoning", {})),
                    model_version,
                ),
            )
        conn.commit()
    except Exception as e:
        conn.rollback()
        log.warning("Failed to persist rewrite_suggestions for review %s: %s", review_id, e)

    return jsonify({
        "review_id": review_id,
        "original": text,
        "revised_text": result.get("revised_text", text),
        "edits": result.get("edits", []),
        "preserved": result.get("preserved", []),
        "reasoning": result.get("reasoning", {}),
        "model_version": model_version,
        "cached": False,
    })


@rewrite_bp.route("/rewrite/<review_id>", methods=["GET"])
@require_api_key
def get_rewrite(review_id):
    """Return stored rewrite suggestion for a review, or 404."""
    conn = get_db()
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute("SELECT * FROM rewrite_suggestions WHERE review_id = %s", (review_id,))
        row = cur.fetchone()
    if not row:
        return jsonify(error="not_found", message="No rewrite suggestion found for this review"), 404
    return jsonify({
        "review_id": str(row["review_id"]),
        "revised_text": row["revised_text"],
        "edits": row["edits"] or [],
        "preserved": row["preserved"] or [],
        "reasoning": row["reasoning"] or {},
        "model_version": row["model_version"],
        "adopted": row["adopted"],
        "created_at": row["created_at"].isoformat() if row["created_at"] else None,
    })


@rewrite_bp.route("/rewrite/<review_id>/adopt", methods=["PATCH"])
@require_api_key
def adopt_rewrite(review_id):
    """Mark a rewrite suggestion as adopted."""
    conn = get_db()
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE rewrite_suggestions SET adopted = true WHERE review_id = %s RETURNING review_id",
            (review_id,),
        )
        updated = cur.fetchone()
    if not updated:
        conn.rollback()
        return jsonify(error="not_found", message="No rewrite suggestion found for this review"), 404
    conn.commit()
    return jsonify({"review_id": review_id, "adopted": True})
