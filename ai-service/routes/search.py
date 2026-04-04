"""Search — search submissions and students across courses."""

from flask import Blueprint, jsonify, request
import psycopg2.extras

from extensions import get_db, require_api_key

search_bp = Blueprint("search", __name__)


@search_bp.route("/api/search", methods=["GET"])
@require_api_key
def search_content():
    """Search submissions and users."""
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
