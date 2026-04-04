"""
Shared extensions — DB pool, OpenAI client, rate limiter, auth decorator.

IMPORTANT: All resource initialisation is LAZY. Nothing connects at import
time. The DB pool is created on the first ``get_db()`` call; the OpenAI
client is created on the first ``_get_openai()`` call. This ensures that
importing this module in tests (with mocked env vars) never triggers real
network connections.
"""

import functools
import json
import logging
import random
import time

from flask import g, jsonify, request
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from openai import OpenAI, APIConnectionError, RateLimitError, APITimeoutError
import psycopg2
import psycopg2.extras
import psycopg2.pool

from config import (
    AI_API_KEY,
    DATABASE_URL,
    MAX_RETRIES,
    OPENAI_API_KEY,
    OPENAI_MODEL,
    log,
)

# ---------------------------------------------------------------------------
# Rate limiter (initialised without app — call limiter.init_app(app) later)
# ---------------------------------------------------------------------------
limiter = Limiter(
    get_remote_address,
    default_limits=["300 per minute"],
    storage_uri="memory://",
)

# ---------------------------------------------------------------------------
# OpenAI client — lazy singleton
# ---------------------------------------------------------------------------
RETRYABLE_ERRORS = (APIConnectionError, RateLimitError, APITimeoutError)

_openai_client: OpenAI | None = None


def _get_openai() -> OpenAI:
    """Return the singleton OpenAI client, creating it on first call."""
    global _openai_client
    if _openai_client is None:
        if not OPENAI_API_KEY:
            raise RuntimeError("OPENAI_API_KEY is not configured")
        _openai_client = OpenAI(api_key=OPENAI_API_KEY, timeout=30.0)
    return _openai_client


def call_openai(
    *, model: str, temperature: float, system_prompt: str, user_message: str, action: str
) -> dict:
    """Call OpenAI with exponential-backoff retry and token-usage logging.

    Returns the parsed JSON response dict.
    """
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

            usage = completion.usage
            if usage:
                log.info(
                    "OpenAI usage",
                    extra={
                        "extra_data": {
                            "action": action,
                            "model": model,
                            "prompt_tokens": usage.prompt_tokens,
                            "completion_tokens": usage.completion_tokens,
                            "total_tokens": usage.total_tokens,
                        }
                    },
                )
            return result
        except json.JSONDecodeError:
            log.error("OpenAI returned non-JSON for %s: %s", action, raw)
            raise
        except RETRYABLE_ERRORS as e:
            last_error = e
            wait = (2 ** attempt) + random.uniform(0, 1)
            log.warning(
                "OpenAI %s attempt %d/%d failed (%s), retrying in %.1fs",
                action, attempt + 1, MAX_RETRIES, type(e).__name__, wait,
            )
            if attempt < MAX_RETRIES - 1:
                time.sleep(wait)
    raise last_error  # type: ignore[misc]


def call_openai_chat(
    *, model: str, temperature: float, system_prompt: str, messages: list, action: str
) -> str:
    """Call OpenAI with a multi-turn messages array (plain text response).

    Returns the assistant reply as a string.
    """
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
                log.info(
                    "OpenAI usage",
                    extra={
                        "extra_data": {
                            "action": action,
                            "model": model,
                            "prompt_tokens": usage.prompt_tokens,
                            "completion_tokens": usage.completion_tokens,
                            "total_tokens": usage.total_tokens,
                        }
                    },
                )
            return reply
        except RETRYABLE_ERRORS as e:
            last_error = e
            wait = (2 ** attempt) + random.uniform(0, 1)
            log.warning(
                "OpenAI %s attempt %d/%d failed (%s), retrying in %.1fs",
                action, attempt + 1, MAX_RETRIES, type(e).__name__, wait,
            )
            if attempt < MAX_RETRIES - 1:
                time.sleep(wait)
    raise last_error  # type: ignore[misc]


# ---------------------------------------------------------------------------
# Feedback validation helper
# ---------------------------------------------------------------------------
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
# Database — connection pool with timeouts (LAZY: pool created on first call)
# ---------------------------------------------------------------------------
_db_pool = None


def _get_pool():
    """Return the ThreadedConnectionPool, creating it on first call."""
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


def close_db(_exc):
    """Teardown handler — return connection to pool."""
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
    """Validate ``X-AI-API-Key`` header against the shared secret.

    When ``AI_API_KEY`` is not configured, reject all requests (fail closed).
    """
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
