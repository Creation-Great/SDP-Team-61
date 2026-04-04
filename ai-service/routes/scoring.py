"""AI Scoring — review depth, score suggestion, calibration, score reasoning.

Four endpoints that share the same pattern: validate → call OpenAI → optional
DB persist → return JSON. Grouped together to avoid four tiny files.
"""

import json

from flask import Blueprint, jsonify, request

from config import OPENAI_API_KEY, OPENAI_MODEL, MAX_TEXT_LENGTH, log
from extensions import call_openai, get_db, limiter, require_api_key

scoring_bp = Blueprint("scoring", __name__, url_prefix="/api/ai")

# ---------------------------------------------------------------------------
# System prompts (all named *_SYSTEM_PROMPT for future extraction)
# ---------------------------------------------------------------------------
REVIEW_DEPTH_SYSTEM_PROMPT = """You are an AI that evaluates the depth and quality of peer review comments. Given a review comment, return JSON with: constructiveness (0-1), specificity (0-1), actionability (0-1), explanation (string). constructiveness measures how much the review helps the author improve. specificity measures concrete vs vague feedback. actionability measures whether clear next steps are suggested. Return ONLY valid JSON."""

SCORE_SUGGESTION_SYSTEM_PROMPT = """You are an AI grading assistant. Given the text content of a student submission and a rubric with scoring criteria, suggest an appropriate score range. Return JSON with: suggested_min (float), suggested_max (float), reasoning (string explaining your assessment), confidence (0-1). Be calibrated and fair. Return ONLY valid JSON."""

CALIBRATION_SYSTEM_PROMPT = """You are a peer review calibration assistant. Given a reviewer's score for a submission, the peer average score for the same submission, and the deviation, provide calibration advice. Return JSON with: is_significant (boolean, true if |deviation| >= 1.0), recommendation (string with advice for the reviewer), severity ('low'|'medium'|'high'). Return ONLY valid JSON."""

SCORE_REASONING_SYSTEM_PROMPT = """You are a peer review assistant that helps reviewers articulate their scoring rationale. Given a score (1-5) and the context of the submission being reviewed, generate a well-structured explanation for why this score was given. Return JSON with: reasoning (string, 2-3 sentences), strengths (array of strings), improvements (array of strings). Return ONLY valid JSON."""


# ---------------------------------------------------------------------------
# POST /api/ai/review-depth
# ---------------------------------------------------------------------------
@scoring_bp.route("/review-depth", methods=["POST"])
@require_api_key
@limiter.limit("60 per minute")
def review_depth():
    """Evaluate depth and quality of a peer review comment."""
    data = request.get_json(silent=True) or {}
    review_id = data.get("review_id")
    text = data.get("text", "").strip()

    if not review_id or not text:
        return jsonify(error="validation", message="review_id and text are required"), 400

    if len(text) > MAX_TEXT_LENGTH:
        return jsonify(error="validation", message=f"Text exceeds maximum length of {MAX_TEXT_LENGTH} characters"), 400

    if not OPENAI_API_KEY:
        return jsonify(error="not_configured", message="OpenAI API key is not configured. Review depth analysis is unavailable."), 503

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

    # Persist to review_depth_scores
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
# POST /api/ai/score-suggestion
# ---------------------------------------------------------------------------
@scoring_bp.route("/score-suggestion", methods=["POST"])
@require_api_key
@limiter.limit("60 per minute")
def score_suggestion():
    """Suggest a score range for a submission based on rubric."""
    data = request.get_json(silent=True) or {}
    submission_text = data.get("submission_text", "").strip()
    rubric_json = data.get("rubric_json", "")

    if not submission_text or not rubric_json:
        return jsonify(error="validation", message="submission_text and rubric_json are required"), 400

    if len(submission_text) > MAX_TEXT_LENGTH:
        return jsonify(error="validation", message=f"Text exceeds maximum length of {MAX_TEXT_LENGTH} characters"), 400

    if not OPENAI_API_KEY:
        return jsonify(error="not_configured", message="OpenAI API key is not configured. Score suggestion is unavailable."), 503

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
# POST /api/ai/calibration
# ---------------------------------------------------------------------------
@scoring_bp.route("/calibration", methods=["POST"])
@require_api_key
@limiter.limit("60 per minute")
def calibration():
    """Provide calibration advice for a reviewer's score."""
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
        return jsonify(error="not_configured", message="OpenAI API key is not configured. Calibration is unavailable."), 503

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
# POST /api/ai/score-reasoning
# ---------------------------------------------------------------------------
@scoring_bp.route("/score-reasoning", methods=["POST"])
@require_api_key
@limiter.limit("60 per minute")
def score_reasoning():
    """Generate reasoning for a peer review score."""
    data = request.get_json(silent=True) or {}
    score = data.get("score")
    submission_context = data.get("submission_context", "").strip()

    if score is None or not submission_context:
        return jsonify(error="validation", message="score and submission_context are required"), 400

    if not OPENAI_API_KEY:
        return jsonify(error="not_configured", message="OpenAI API key is not configured. Score reasoning is unavailable."), 503

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
