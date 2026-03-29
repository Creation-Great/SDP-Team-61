"""
AI Feedback Service – OpenAI-powered
Provides AI feedback analysis and rewrite suggestions for peer review comments.
Persists results to PostgreSQL (ml_outputs, rewrite_suggestions tables).
"""

import json
import os
import functools
import logging
import time
import random
import uuid as _uuid

from flask import Flask, request, jsonify, g
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from dotenv import load_dotenv
import psycopg2
import psycopg2.extras
import psycopg2.pool
from openai import OpenAI, APIConnectionError, RateLimitError, APITimeoutError
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity as sklearn_cosine_similarity

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

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 1 * 1024 * 1024  # 1 MB request body limit
CORS(app, origins=[os.getenv("FRONTEND_URL", "http://localhost:5173")])

MAX_TEXT_LENGTH = 10_000  # Maximum characters for AI text input

# Rate limiting – keyed by remote IP
limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=["300 per minute"],
    storage_uri="memory://",
)

# Lazy OpenAI client (created once, only when key is present)
_openai_client: OpenAI | None = None


def _get_openai() -> OpenAI:
    global _openai_client
    if _openai_client is None:
        if not OPENAI_API_KEY:
            raise RuntimeError("OPENAI_API_KEY is not configured")
        _openai_client = OpenAI(api_key=OPENAI_API_KEY, timeout=30.0)
    return _openai_client


# ---------------------------------------------------------------------------
# OpenAI call with retry + token tracking
# ---------------------------------------------------------------------------
MAX_RETRIES = 3
RETRYABLE_ERRORS = (APIConnectionError, RateLimitError, APITimeoutError)


def call_openai(*, model: str, temperature: float, system_prompt: str, user_message: str, action: str) -> dict:
    """Call OpenAI with exponential backoff retry and token usage logging.
    Returns the parsed JSON response dict."""
    client = _get_openai()
    last_error = None
    for attempt in range(MAX_RETRIES):
        try:
            completion = client.chat.completions.create(
                model=model,
                temperature=temperature,
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message},
                ],
            )
            raw = completion.choices[0].message.content or "{}"
            result = json.loads(raw)

            # Log token usage
            usage = completion.usage
            if usage:
                log.info("OpenAI usage", extra={"extra_data": {
                    "action": action,
                    "model": model,
                    "prompt_tokens": usage.prompt_tokens,
                    "completion_tokens": usage.completion_tokens,
                    "total_tokens": usage.total_tokens,
                }})

            return result
        except json.JSONDecodeError:
            log.error("OpenAI returned non-JSON for %s: %s", action, raw)
            raise
        except RETRYABLE_ERRORS as e:
            last_error = e
            wait = (2 ** attempt) + random.uniform(0, 1)
            log.warning("OpenAI %s attempt %d/%d failed (%s), retrying in %.1fs",
                        action, attempt + 1, MAX_RETRIES, type(e).__name__, wait)
            if attempt < MAX_RETRIES - 1:
                time.sleep(wait)
    raise last_error  # type: ignore[misc]


def validate_feedback(result: dict) -> dict:
    """Clamp feedback values to expected ranges."""
    toxicity = result.get("toxicity", 0)
    politeness = result.get("politeness", 0)
    result["toxicity"] = max(0.0, min(1.0, float(toxicity))) if isinstance(toxicity, (int, float)) else 0.0
    result["politeness"] = max(0.0, min(1.0, float(politeness))) if isinstance(politeness, (int, float)) else 0.0
    if result.get("sentiment") not in ("positive", "negative", "neutral", "mixed"):
        result["sentiment"] = "neutral"
    if not isinstance(result.get("identity_spans"), list):
        result["identity_spans"] = []
    if not isinstance(result.get("evidence_spans"), list):
        result["evidence_spans"] = []
    result.setdefault("confidence", 0.5)
    return result


# ---------------------------------------------------------------------------
# Database helpers — connection pool with timeouts
# ---------------------------------------------------------------------------
_db_pool = None

def _get_pool():
    global _db_pool
    if _db_pool is None:
        _db_pool = psycopg2.pool.ThreadedConnectionPool(
            minconn=1,
            maxconn=10,
            dsn=DATABASE_URL,
            connect_timeout=10,
            options="-c statement_timeout=30000",
        )
    return _db_pool

def get_db():
    """Return a per-request connection from the pool (returned on teardown)."""
    if "db" not in g:
        g.db = _get_pool().getconn()
    return g.db


@app.teardown_appcontext
def close_db(_exc):
    conn = g.pop("db", None)
    if conn is not None:
        try:
            conn.rollback()
        except Exception:
            pass
        try:
            _get_pool().putconn(conn)
        except Exception:
            try:
                conn.close()
            except Exception:
                pass


# ---------------------------------------------------------------------------
# Inter-service auth decorator
# ---------------------------------------------------------------------------
def require_api_key(fn):
    """Validate X-AI-API-Key header against the shared secret.
    When AI_API_KEY is not configured, reject all requests (fail closed)."""
    @functools.wraps(fn)
    def wrapper(*args, **kwargs):
        if not AI_API_KEY:
            log.warning("AI_API_KEY not configured — rejecting request")
            return jsonify(error="not_configured", message="AI service API key is not configured"), 503
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
@limiter.limit("60 per minute")
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

    if len(text) > MAX_TEXT_LENGTH:
        return jsonify(error="validation", message=f"Text exceeds maximum length of {MAX_TEXT_LENGTH} characters"), 400

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

    # Call OpenAI (with retry + validation)
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
@limiter.limit("60 per minute")
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


# ---------------------------------------------------------------------------
# AI Polish – improve text style and grammar
# ---------------------------------------------------------------------------
POLISH_SYSTEM_PROMPT = """You are an AI writing assistant that polishes peer review comments.
Given a review comment, improve its grammar, clarity, tone, and professionalism while preserving the original meaning and key feedback points.
Return a JSON object with EXACTLY these keys:
- "polished": the improved version of the text
- "changes": array of short strings describing what was changed
Return ONLY valid JSON, no markdown fences."""


@app.route("/api/ai/polish", methods=["POST"])
@require_api_key
@limiter.limit("60 per minute")
def polish_text():
    """
    Polish a review comment text.
    Body: { "text": str }
    """
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

    # Log this AI activity
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


# ---------------------------------------------------------------------------
# AI Summarize – summarize multiple reviews
# ---------------------------------------------------------------------------
SUMMARIZE_SYSTEM_PROMPT = """You are an AI assistant that summarizes peer review feedback.
Given an array of peer review objects (each with score, comments, reviewer_name), produce a comprehensive summary.
Return a JSON object with EXACTLY these keys:
- "summary": a markdown-formatted summary including: overall assessment, common themes, strengths noted, areas for improvement, and score analysis
- "themes": array of short theme strings identified across reviews
- "avg_score": the average score as a float
Return ONLY valid JSON, no markdown fences."""


@app.route("/api/ai/summarize", methods=["POST"])
@require_api_key
@limiter.limit("60 per minute")
def summarize_reviews():
    """
    Summarize multiple reviews for a submission.
    Body: { "reviews": [...] }
    """
    data = request.get_json(silent=True) or {}
    reviews = data.get("reviews", [])

    if not reviews:
        return jsonify(error="validation", message="reviews array is required"), 400

    if not OPENAI_API_KEY:
        return jsonify(
            error="not_configured",
            message="OpenAI API key is not configured. AI summarization is unavailable.",
        ), 503

    # Build a text representation of reviews
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

    # Log this AI activity
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


# ---------------------------------------------------------------------------
# AI Activity Logs – retrieve recent AI usage
# ---------------------------------------------------------------------------
@app.route("/api/ai/logs", methods=["GET"])
@require_api_key
def get_ai_logs():
    """Return recent AI activity logs."""
    limit = request.args.get("limit", 20, type=int)
    conn = get_db()
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(
            """SELECT a.id, a.action, a.user_id, a.detail, a.created_at,
                      u.name AS user_name
               FROM ai_activity_logs a
               LEFT JOIN users u ON u.user_id = a.user_id
               ORDER BY a.created_at DESC
               LIMIT %s""",
            (limit,),
        )
        rows = cur.fetchall()
    return jsonify([
        {
            "id": row["id"],
            "action": row["action"],
            "user_id": row["user_id"],
            "user_name": row.get("user_name"),
            "detail": row["detail"] or {},
            "created_at": row["created_at"].isoformat() if row["created_at"] else None,
        }
        for row in rows
    ])


# ---------------------------------------------------------------------------
# Search – search submissions and students
# ---------------------------------------------------------------------------
@app.route("/api/search", methods=["GET"])
@require_api_key
def search_content():
    """
    Search submissions and users.
    Query params: q (search term), type (submissions|students|all)
    """
    q = request.args.get("q", "").strip()
    search_type = request.args.get("type", "all")

    if not q or len(q) < 2:
        return jsonify({"submissions": [], "users": []})

    conn = get_db()
    results = {"submissions": [], "users": []}
    pattern = f"%{q}%"

    if search_type in ("submissions", "all"):
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """SELECT s.submission_id, s.title, s.filename, s.status, s.created_at,
                          u.name as student_name, u.email as student_email
                   FROM submissions s
                   JOIN users u ON s.user_id = u.user_id
                   WHERE s.title ILIKE %s OR u.name ILIKE %s OR u.email ILIKE %s
                   ORDER BY s.created_at DESC
                   LIMIT 10""",
                (pattern, pattern, pattern),
            )
            rows = cur.fetchall()
        results["submissions"] = [
            {
                "submission_id": str(row["submission_id"]),
                "title": row["title"],
                "original_filename": row["filename"],
                "status": row["status"],
                "uploader_name": row["student_name"],
                "created_at": row["created_at"].isoformat() if row["created_at"] else None,
            }
            for row in rows
        ]

    if search_type in ("students", "all"):
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """SELECT user_id, name, email, role
                   FROM users
                   WHERE name ILIKE %s OR email ILIKE %s
                   ORDER BY name ASC
                   LIMIT 10""",
                (pattern, pattern),
            )
            rows = cur.fetchall()
        results["users"] = [
            {
                "user_id": str(row["user_id"]),
                "name": row["name"],
                "email": row["email"],
                "role": row["role"],
            }
            for row in rows
        ]

    return jsonify(results)


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
# AI Review Depth – evaluate quality of a peer review comment
# ---------------------------------------------------------------------------
REVIEW_DEPTH_SYSTEM_PROMPT = """You are an AI that evaluates the depth and quality of peer review comments. Given a review comment, return JSON with: constructiveness (0-1), specificity (0-1), actionability (0-1), explanation (string). constructiveness measures how much the review helps the author improve. specificity measures concrete vs vague feedback. actionability measures whether clear next steps are suggested. Return ONLY valid JSON."""


@app.route("/api/ai/review-depth", methods=["POST"])
@require_api_key
@limiter.limit("60 per minute")
def review_depth():
    """
    Evaluate depth and quality of a peer review comment.
    Body: { "review_id": str(uuid), "text": str }
    """
    data = request.get_json(silent=True) or {}
    review_id = data.get("review_id")
    text = data.get("text", "").strip()

    if not review_id or not text:
        return jsonify(error="validation", message="review_id and text are required"), 400

    if len(text) > MAX_TEXT_LENGTH:
        return jsonify(error="validation", message=f"Text exceeds maximum length of {MAX_TEXT_LENGTH} characters"), 400

    if not OPENAI_API_KEY:
        return jsonify(
            error="not_configured",
            message="OpenAI API key is not configured. Review depth analysis is unavailable.",
        ), 503

    try:
        result = call_openai(
            model=OPENAI_MODEL, temperature=0.2,
            system_prompt=REVIEW_DEPTH_SYSTEM_PROMPT,
            user_message=f"Evaluate this peer review comment:\n\n{text}",
            action="review_depth",
        )
    except json.JSONDecodeError:
        return jsonify(error="ai_error", message="AI returned invalid response"), 502
    except Exception as e:
        log.error("OpenAI review-depth call failed: %s", e)
        return jsonify(error="ai_error", message=str(e)), 502

    # Persist to review_depth_scores (UPSERT)
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO review_depth_scores
                   (review_id, constructiveness, specificity, actionability, model_version)
                   VALUES (%s, %s, %s, %s, %s)
                   ON CONFLICT (review_id) DO UPDATE SET
                     constructiveness = EXCLUDED.constructiveness,
                     specificity = EXCLUDED.specificity,
                     actionability = EXCLUDED.actionability,
                     model_version = EXCLUDED.model_version
                """,
                (
                    review_id,
                    result.get("constructiveness", 0),
                    result.get("specificity", 0),
                    result.get("actionability", 0),
                    OPENAI_MODEL,
                ),
            )
        conn.commit()
    except Exception as e:
        conn.rollback()
        log.warning("Failed to persist review_depth_scores for review %s: %s", review_id, e)

    return jsonify({
        "review_id": review_id,
        "constructiveness": result.get("constructiveness", 0),
        "specificity": result.get("specificity", 0),
        "actionability": result.get("actionability", 0),
        "explanation": result.get("explanation", ""),
    })


# ---------------------------------------------------------------------------
# AI Score Suggestion – suggest score range for a submission
# ---------------------------------------------------------------------------
SCORE_SUGGESTION_SYSTEM_PROMPT = """You are an AI grading assistant. Given the text content of a student submission and a rubric with scoring criteria, suggest an appropriate score range. Return JSON with: suggested_min (float), suggested_max (float), reasoning (string explaining your assessment), confidence (0-1). Be calibrated and fair. Return ONLY valid JSON."""


@app.route("/api/ai/score-suggestion", methods=["POST"])
@require_api_key
@limiter.limit("60 per minute")
def score_suggestion():
    """
    Suggest a score range for a submission based on rubric.
    Body: { "submission_text": str, "rubric_json": str|object }
    """
    data = request.get_json(silent=True) or {}
    submission_text = data.get("submission_text", "").strip()
    rubric_json = data.get("rubric_json", "")

    if not submission_text or not rubric_json:
        return jsonify(error="validation", message="submission_text and rubric_json are required"), 400

    if len(submission_text) > MAX_TEXT_LENGTH:
        return jsonify(error="validation", message=f"Text exceeds maximum length of {MAX_TEXT_LENGTH} characters"), 400

    if not OPENAI_API_KEY:
        return jsonify(
            error="not_configured",
            message="OpenAI API key is not configured. Score suggestion is unavailable.",
        ), 503

    rubric_str = rubric_json if isinstance(rubric_json, str) else json.dumps(rubric_json, indent=2)

    try:
        result = call_openai(
            model=OPENAI_MODEL, temperature=0.3,
            system_prompt=SCORE_SUGGESTION_SYSTEM_PROMPT,
            user_message=f"Submission text:\n\n{submission_text}\n\nRubric:\n{rubric_str}",
            action="score_suggestion",
        )
    except json.JSONDecodeError:
        return jsonify(error="ai_error", message="AI returned invalid response"), 502
    except Exception as e:
        log.error("OpenAI score-suggestion call failed: %s", e)
        return jsonify(error="ai_error", message=str(e)), 502

    return jsonify({
        "suggested_min": result.get("suggested_min", 0),
        "suggested_max": result.get("suggested_max", 0),
        "reasoning": result.get("reasoning", ""),
        "confidence": result.get("confidence", 0),
    })


# ---------------------------------------------------------------------------
# AI Calibration – advise reviewer on score deviation
# ---------------------------------------------------------------------------
CALIBRATION_SYSTEM_PROMPT = """You are a peer review calibration assistant. Given a reviewer's score for a submission, the peer average score for the same submission, and the deviation, provide calibration advice. Return JSON with: is_significant (boolean, true if |deviation| >= 1.0), recommendation (string with advice for the reviewer), severity ('low'|'medium'|'high'). Return ONLY valid JSON."""


@app.route("/api/ai/calibration", methods=["POST"])
@require_api_key
@limiter.limit("60 per minute")
def calibration():
    """
    Provide calibration advice for a reviewer's score.
    Body: { "reviewer_score": float, "peer_avg_score": float, "submission_context": str (optional) }
    """
    data = request.get_json(silent=True) or {}
    reviewer_score = data.get("reviewer_score")
    peer_avg_score = data.get("peer_avg_score")
    submission_context = data.get("submission_context", "").strip()

    if reviewer_score is None or peer_avg_score is None:
        return jsonify(error="validation", message="reviewer_score and peer_avg_score are required"), 400

    try:
        reviewer_score = float(reviewer_score)
        peer_avg_score = float(peer_avg_score)
    except (TypeError, ValueError):
        return jsonify(error="validation", message="reviewer_score and peer_avg_score must be numeric"), 400

    deviation = reviewer_score - peer_avg_score

    if not OPENAI_API_KEY:
        return jsonify(
            error="not_configured",
            message="OpenAI API key is not configured. Calibration is unavailable.",
        ), 503

    user_msg = (
        f"Reviewer score: {reviewer_score}\n"
        f"Peer average score: {peer_avg_score}\n"
        f"Deviation: {deviation}"
    )
    if submission_context:
        user_msg += f"\n\nSubmission context:\n{submission_context}"

    try:
        result = call_openai(
            model=OPENAI_MODEL, temperature=0.3,
            system_prompt=CALIBRATION_SYSTEM_PROMPT,
            user_message=user_msg,
            action="calibration",
        )
    except json.JSONDecodeError:
        return jsonify(error="ai_error", message="AI returned invalid response"), 502
    except Exception as e:
        log.error("OpenAI calibration call failed: %s", e)
        return jsonify(error="ai_error", message=str(e)), 502

    return jsonify({
        "reviewer_score": reviewer_score,
        "peer_avg_score": peer_avg_score,
        "deviation": deviation,
        "is_significant": result.get("is_significant", abs(deviation) >= 1.0),
        "recommendation": result.get("recommendation", ""),
        "severity": result.get("severity", "low"),
    })


# ---------------------------------------------------------------------------
# AI Score Reasoning – articulate scoring rationale
# ---------------------------------------------------------------------------
SCORE_REASONING_SYSTEM_PROMPT = """You are a peer review assistant that helps reviewers articulate their scoring rationale. Given a score (1-5) and the context of the submission being reviewed, generate a well-structured explanation for why this score was given. Return JSON with: reasoning (string, 2-3 sentences), strengths (array of strings), improvements (array of strings). Return ONLY valid JSON."""


@app.route("/api/ai/score-reasoning", methods=["POST"])
@require_api_key
@limiter.limit("60 per minute")
def score_reasoning():
    """
    Generate reasoning for a peer review score.
    Body: { "score": int, "submission_context": str }
    """
    data = request.get_json(silent=True) or {}
    score = data.get("score")
    submission_context = data.get("submission_context", "").strip()

    if score is None or not submission_context:
        return jsonify(error="validation", message="score and submission_context are required"), 400

    if not OPENAI_API_KEY:
        return jsonify(
            error="not_configured",
            message="OpenAI API key is not configured. Score reasoning is unavailable.",
        ), 503

    try:
        result = call_openai(
            model=OPENAI_MODEL, temperature=0.4,
            system_prompt=SCORE_REASONING_SYSTEM_PROMPT,
            user_message=f"Score: {score}\n\nSubmission context:\n{submission_context}",
            action="score_reasoning",
        )
    except json.JSONDecodeError:
        return jsonify(error="ai_error", message="AI returned invalid response"), 502
    except Exception as e:
        log.error("OpenAI score-reasoning call failed: %s", e)
        return jsonify(error="ai_error", message=str(e)), 502

    return jsonify({
        "score": score,
        "reasoning": result.get("reasoning", ""),
        "strengths": result.get("strengths", []),
        "improvements": result.get("improvements", []),
    })


# ---------------------------------------------------------------------------
# Similarity – TF-IDF pairwise cosine similarity (no OpenAI)
# ---------------------------------------------------------------------------
@app.route("/api/ai/similarity", methods=["POST"])
@require_api_key
@limiter.limit("60 per minute")
def similarity():
    """
    Compute pairwise similarity between submissions using TF-IDF + cosine similarity.
    Body: { "submissions": [{ "submission_id": str, "text": str }, ...] }
    """
    data = request.get_json(silent=True) or {}
    submissions = data.get("submissions", [])

    if not isinstance(submissions, list) or len(submissions) < 2:
        return jsonify(error="validation", message="At least 2 submissions are required"), 400

    for sub in submissions:
        if not sub.get("submission_id") or not sub.get("text", "").strip():
            return jsonify(error="validation", message="Each submission must have submission_id and non-empty text"), 400

    texts = [sub["text"].strip() for sub in submissions]
    ids = [sub["submission_id"] for sub in submissions]

    try:
        vectorizer = TfidfVectorizer(stop_words="english")
        tfidf_matrix = vectorizer.fit_transform(texts)
        cos_sim = sklearn_cosine_similarity(tfidf_matrix)
    except Exception as e:
        log.error("Similarity computation failed: %s", e)
        return jsonify(error="computation_error", message=str(e)), 500

    pairs = []
    for i in range(len(ids)):
        for j in range(i + 1, len(ids)):
            score = float(cos_sim[i][j])
            if score > 0.1:
                pairs.append({
                    "id_a": ids[i],
                    "id_b": ids[j],
                    "similarity_score": round(score, 4),
                })

    # Persist results to similarity_reports (UPSERT)
    conn = get_db()
    try:
        with conn.cursor() as cur:
            for pair in pairs:
                cur.execute(
                    """INSERT INTO similarity_reports
                       (submission_id_a, submission_id_b, similarity_score, method)
                       VALUES (%s, %s, %s, 'tfidf_cosine')
                       ON CONFLICT (submission_id_a, submission_id_b, method) DO UPDATE SET
                         similarity_score = EXCLUDED.similarity_score
                    """,
                    (pair["id_a"], pair["id_b"], pair["similarity_score"]),
                )
        conn.commit()
    except Exception as e:
        conn.rollback()
        log.warning("Failed to persist similarity_reports: %s", e)

    return jsonify({"pairs": pairs})


# ---------------------------------------------------------------------------
# Similarity / Turnitin Mock – simulated plagiarism check
# ---------------------------------------------------------------------------
@app.route("/api/ai/similarity/turnitin", methods=["POST"])
@require_api_key
@limiter.limit("60 per minute")
def similarity_turnitin():
    """
    Mock Turnitin endpoint — returns simulated plagiarism results.
    Body: { "submission_id": str, "text": str }
    """
    data = request.get_json(silent=True) or {}
    submission_id = data.get("submission_id")
    text = data.get("text", "").strip()

    if not submission_id or not text:
        return jsonify(error="validation", message="submission_id and text are required"), 400

    return jsonify({
        "provider": "turnitin_mock",
        "submission_id": submission_id,
        "originality_score": random.randint(5, 30),
        "internet_matches": random.randint(2, 15),
        "publication_matches": random.randint(0, 5),
        "student_paper_matches": random.randint(1, 10),
        "status": "complete",
    })


# ---------------------------------------------------------------------------
# AI Chat – multi-turn conversational assistant
# ---------------------------------------------------------------------------
CHAT_SYSTEM_PROMPTS = {
    "writing_review": (
        "You are a peer review writing assistant. Help the student write constructive, "
        "specific, and actionable peer review feedback. Ask clarifying questions if needed. "
        "Guide them toward providing evidence-based feedback."
    ),
    "reading_review": (
        "You are a peer review interpretation assistant. Help the student understand the "
        "feedback they received in a peer review. Explain what the reviewer likely meant, "
        "suggest concrete steps for improvement, and provide encouragement."
    ),
    "teacher_summary": (
        "You are an instructor's assistant for peer review analysis. Help the instructor "
        "understand aggregate patterns in student reviews. Provide insights about common "
        "themes, scoring trends, and areas where students may need guidance."
    ),
}


def call_openai_chat(*, model: str, temperature: float, system_prompt: str,
                     messages: list, action: str) -> str:
    """Call OpenAI with a multi-turn messages array (no JSON response format).
    Returns the assistant reply as a plain string."""
    client = _get_openai()
    last_error = None
    full_messages = [{"role": "system", "content": system_prompt}] + messages
    for attempt in range(MAX_RETRIES):
        try:
            completion = client.chat.completions.create(
                model=model,
                temperature=temperature,
                messages=full_messages,
            )
            reply = completion.choices[0].message.content or ""

            usage = completion.usage
            if usage:
                log.info("OpenAI usage", extra={"extra_data": {
                    "action": action,
                    "model": model,
                    "prompt_tokens": usage.prompt_tokens,
                    "completion_tokens": usage.completion_tokens,
                    "total_tokens": usage.total_tokens,
                }})

            return reply
        except RETRYABLE_ERRORS as e:
            last_error = e
            wait = (2 ** attempt) + random.uniform(0, 1)
            log.warning("OpenAI %s attempt %d/%d failed (%s), retrying in %.1fs",
                        action, attempt + 1, MAX_RETRIES, type(e).__name__, wait)
            if attempt < MAX_RETRIES - 1:
                time.sleep(wait)
    raise last_error  # type: ignore[misc]


@app.route("/api/ai/chat", methods=["POST"])
@require_api_key
@limiter.limit("60 per minute")
def ai_chat():
    """
    Multi-turn conversational AI assistant for peer review.
    Body: { "message": str, "context_type": str, "context_id": str?,
            "conversation_id": str?, "user_id": str? }
    """
    data = request.get_json(silent=True) or {}
    message = data.get("message", "").strip()
    context_type = data.get("context_type", "")
    context_id = data.get("context_id")
    conversation_id = data.get("conversation_id")
    user_id = data.get("user_id")

    if not message:
        return jsonify(error="validation", message="message is required"), 400

    if context_type not in CHAT_SYSTEM_PROMPTS:
        return jsonify(
            error="validation",
            message=f"context_type must be one of: {', '.join(CHAT_SYSTEM_PROMPTS.keys())}",
        ), 400

    if not OPENAI_API_KEY:
        return jsonify(
            error="not_configured",
            message="OpenAI API key is not configured. AI chat is unavailable.",
        ), 503

    system_prompt = CHAT_SYSTEM_PROMPTS[context_type]
    messages = []

    # Load existing conversation if conversation_id provided
    conn = get_db()
    if conversation_id:
        try:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    "SELECT messages FROM ai_conversations WHERE id = %s",
                    (conversation_id,),
                )
                row = cur.fetchone()
            if row and row["messages"]:
                stored = row["messages"]
                messages = stored if isinstance(stored, list) else json.loads(stored)
        except Exception as e:
            log.warning("Failed to load conversation %s: %s", conversation_id, e)

    # Append user message
    messages.append({"role": "user", "content": message})

    # Use only last 20 messages for the OpenAI call
    recent_messages = messages[-20:]

    try:
        reply = call_openai_chat(
            model=OPENAI_MODEL, temperature=0.5,
            system_prompt=system_prompt,
            messages=recent_messages,
            action="chat",
        )
    except Exception as e:
        log.error("OpenAI chat call failed: %s", e)
        return jsonify(error="ai_error", message=str(e)), 502

    # Append assistant reply
    messages.append({"role": "assistant", "content": reply})

    # Persist conversation (INSERT or UPDATE) — only when user_id is a valid UUID
    if not conversation_id:
        conversation_id = str(_uuid.uuid4())

    if not user_id:
        # Cannot persist without valid user_id (FK constraint)
        return jsonify({
            "conversation_id": conversation_id,
            "reply": reply,
            "messages_count": len(messages),
        })

    try:
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO ai_conversations
                   (id, user_id, context_type, context_id, messages, updated_at)
                   VALUES (%s, %s, %s, %s, %s, now())
                   ON CONFLICT (id) DO UPDATE SET
                     messages = EXCLUDED.messages,
                     updated_at = now()
                """,
                (
                    conversation_id,
                    user_id,  # must be a valid UUID FK
                    context_type,
                    context_id,
                    json.dumps(messages),
                ),
            )
        conn.commit()
    except Exception as e:
        conn.rollback()
        log.warning("Failed to persist ai_conversations for %s: %s", conversation_id, e)

    return jsonify({
        "conversation_id": conversation_id,
        "reply": reply,
        "messages_count": len(messages),
    })


# ---------------------------------------------------------------------------
# Entry
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    port = int(os.getenv("AI_PORT", "5001"))
    debug = os.getenv("FLASK_DEBUG", "0") == "1"
    log.info("AI service starting on port %d (OpenAI configured: %s)", port, bool(OPENAI_API_KEY))
    app.run(host="0.0.0.0", port=port, debug=debug)
