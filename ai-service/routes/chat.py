"""AI Chat — multi-turn conversational assistant for peer review."""

import json
import uuid as _uuid

from flask import Blueprint, jsonify, request
import psycopg2.extras

from config import OPENAI_API_KEY, OPENAI_MODEL, log
from extensions import call_openai_chat, get_db, limiter, require_api_key

chat_bp = Blueprint("chat", __name__, url_prefix="/api/ai")

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


@chat_bp.route("/chat", methods=["POST"])
@require_api_key
@limiter.limit("60 per minute")
def ai_chat():
    """Multi-turn conversational AI assistant for peer review."""
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

    # Load existing conversation
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

    messages.append({"role": "assistant", "content": reply})

    # Persist conversation
    if not conversation_id:
        conversation_id = str(_uuid.uuid4())

    if not user_id:
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
                    user_id,
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
