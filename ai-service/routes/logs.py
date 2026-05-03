"""AI Activity Logs — retrieve recent AI usage records."""

from flask import Blueprint, jsonify, request
import psycopg2.extras

from extensions import get_db, require_api_key

logs_bp = Blueprint("logs", __name__, url_prefix="/api/ai")


@logs_bp.route("/logs", methods=["GET"])
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
