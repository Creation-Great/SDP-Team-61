"""Similarity — TF-IDF pairwise cosine similarity and mock Turnitin."""

import random

from flask import Blueprint, jsonify, request
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity as sklearn_cosine_similarity

from config import log
from extensions import get_db, limiter, require_api_key

similarity_bp = Blueprint("similarity", __name__, url_prefix="/api/ai")


@similarity_bp.route("/similarity", methods=["POST"])
@require_api_key
@limiter.limit("60 per minute")
def similarity():
    """Compute pairwise similarity between submissions using TF-IDF + cosine similarity."""
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

    # Persist results
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


@similarity_bp.route("/similarity/turnitin", methods=["POST"])
@require_api_key
@limiter.limit("60 per minute")
def similarity_turnitin():
    """Mock Turnitin endpoint — returns simulated plagiarism results."""
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
