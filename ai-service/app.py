"""
AI Feedback Service – OpenAI-powered
Provides AI feedback analysis and rewrite suggestions for peer review comments.
Persists results to PostgreSQL (ml_outputs, rewrite_suggestions tables).
"""

import json
import os
import functools
import logging

from flask import Flask, request, jsonify, g
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from dotenv import load_dotenv
import psycopg2
import psycopg2.extras
from openai import OpenAI

load_dotenv()

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
AI_API_KEY = os.getenv("AI_API_KEY", "")          # inter-service shared secret
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5432/peerreview",
)

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("ai-service")

app = Flask(__name__)
CORS(app, origins=[os.getenv("FRONTEND_URL", "http://localhost:5173")])

# Rate limiting – keyed by remote IP
limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=["120 per minute"],
    storage_uri="memory://",
)

# Lazy OpenAI client (created once, only when key is present)
_openai_client: OpenAI | None = None


def _get_openai() -> OpenAI:
    global _openai_client
    if _openai_client is None:
        if not OPENAI_API_KEY:
            raise RuntimeError("OPENAI_API_KEY is not configured")
        _openai_client = OpenAI(api_key=OPENAI_API_KEY)
    return _openai_client


# ---------------------------------------------------------------------------
# Database helpers
# ---------------------------------------------------------------------------
def get_db():
    """Return a per-request psycopg2 connection (reused within the same request)."""
    if "db" not in g:
        g.db = psycopg2.connect(DATABASE_URL)
    return g.db


@app.teardown_appcontext
def close_db(_exc):
    conn = g.pop("db", None)
    if conn is not None:
        conn.close()


# ---------------------------------------------------------------------------
# Inter-service auth decorator
# ---------------------------------------------------------------------------
def require_api_key(fn):
    """Validate X-AI-API-Key header against the shared secret."""
    @functools.wraps(fn)
    def wrapper(*args, **kwargs):
        if AI_API_KEY:
            incoming = request.headers.get("X-AI-API-Key", "")
            if incoming != AI_API_KEY:
                return jsonify(error="unauthorized", message="Invalid or missing API key"), 401
        return fn(*args, **kwargs)
    return wrapper


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------
@app.route("/healthz")
def healthz():
    status = {"status": "ok", "service": "ai-service", "openai_configured": bool(OPENAI_API_KEY)}
    return jsonify(status)


# ---------------------------------------------------------------------------
# AI Feedback – analyse a review text
# ---------------------------------------------------------------------------
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


@app.route("/api/ai/feedback", methods=["POST"])
@require_api_key
@limiter.limit("30 per minute")
def generate_feedback():
    """
    Analyse a review comment with OpenAI and persist to ml_outputs.
    Body: { "review_id": str(uuid), "text": str }
    """
    data = request.get_json(silent=True) or {}
    review_id = data.get("review_id")
    text = data.get("text", "").strip()

    if not review_id or not text:
        return jsonify(error="validation", message="review_id and text are required"), 400

    # Check cache – return stored result if it already exists
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

    # Call OpenAI
    if not OPENAI_API_KEY:
        return jsonify(
            error="not_configured",
            message="OpenAI API key is not configured. AI feedback is unavailable.",
        ), 503

    try:
        client = _get_openai()
        completion = client.chat.completions.create(
            model=OPENAI_MODEL,
            temperature=0.2,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": FEEDBACK_SYSTEM_PROMPT},
                {"role": "user", "content": f"Analyse this peer review comment:\n\n{text}"},
            ],
        )
        raw = completion.choices[0].message.content or "{}"
        result = json.loads(raw)
    except json.JSONDecodeError:
        log.error("OpenAI returned non-JSON for feedback: %s", raw)
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


# ---------------------------------------------------------------------------
# Rewrite Suggestions – rewrite a review passage
# ---------------------------------------------------------------------------
REWRITE_SYSTEM_PROMPT = """You are an AI assistant that improves peer review comments.
Given a review comment and optional context, return a JSON object with EXACTLY these keys:
- "revised_text": the improved version of the text
- "edits": array of {original, replacement, reason} describing each change
- "preserved": array of strings that were good and kept unchanged
- "reasoning": object with keys "tone", "clarity", "specificity" each being a short explanation
Return ONLY valid JSON, no markdown fences."""


@app.route("/api/ai/rewrite", methods=["POST"])
@require_api_key
@limiter.limit("20 per minute")
def suggest_rewrite():
    """
    Suggest improved version of a review comment and persist to rewrite_suggestions.
    Body: { "review_id": str(uuid), "text": str, "context": str (optional) }
    """
    data = request.get_json(silent=True) or {}
    review_id = data.get("review_id")
    text = data.get("text", "").strip()
    context = data.get("context", "").strip()

    if not review_id or not text:
        return jsonify(error="validation", message="review_id and text are required"), 400

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
        client = _get_openai()
        completion = client.chat.completions.create(
            model=OPENAI_MODEL,
            temperature=0.3,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": REWRITE_SYSTEM_PROMPT},
                {"role": "user", "content": user_msg},
            ],
        )
        raw = completion.choices[0].message.content or "{}"
        result = json.loads(raw)
    except json.JSONDecodeError:
        log.error("OpenAI returned non-JSON for rewrite: %s", raw)
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


# ---------------------------------------------------------------------------
# GET endpoints – retrieve stored AI results
# ---------------------------------------------------------------------------
@app.route("/api/ai/feedback/<review_id>", methods=["GET"])
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


@app.route("/api/ai/rewrite/<review_id>", methods=["GET"])
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


# ---------------------------------------------------------------------------
# Adopt a rewrite suggestion
# ---------------------------------------------------------------------------
@app.route("/api/ai/rewrite/<review_id>/adopt", methods=["PATCH"])
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


# ---------------------------------------------------------------------------
# Entry
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    port = int(os.getenv("AI_PORT", "5001"))
    debug = os.getenv("FLASK_DEBUG", "0") == "1"
    log.info("AI service starting on port %d (OpenAI configured: %s)", port, bool(OPENAI_API_KEY))
    app.run(host="0.0.0.0", port=port, debug=debug)
