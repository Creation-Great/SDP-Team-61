"""Tests for scoring endpoints: review-depth, score-suggestion, calibration, score-reasoning."""

from unittest.mock import patch

from tests.conftest import AUTH_HEADERS


class TestReviewDepth:
    def test_returns_401_without_api_key(self, client):
        res = client.post("/api/ai/review-depth", json={"review_id": "r1", "text": "ok"})
        assert res.status_code == 401

    def test_returns_400_without_review_id(self, client):
        res = client.post("/api/ai/review-depth",
                          json={"text": "some text"},
                          headers=AUTH_HEADERS)
        assert res.status_code == 400

    def test_returns_400_without_text(self, client):
        res = client.post("/api/ai/review-depth",
                          json={"review_id": "r1"},
                          headers=AUTH_HEADERS)
        assert res.status_code == 400

    def test_returns_400_when_text_exceeds_max_length(self, client):
        res = client.post("/api/ai/review-depth",
                          json={"review_id": "r1", "text": "x" * 10_001},
                          headers=AUTH_HEADERS)
        assert res.status_code == 400

    @patch("routes.scoring.get_db")
    @patch("routes.scoring.call_openai")
    def test_returns_depth_scores(self, mock_call, mock_get_db, client, mock_db):
        mock_conn, mock_cursor = mock_db
        mock_get_db.return_value = mock_conn
        mock_call.return_value = {
            "constructiveness": 0.8,
            "specificity": 0.7,
            "actionability": 0.6,
            "explanation": "The review provides specific feedback.",
        }

        res = client.post("/api/ai/review-depth",
                          json={"review_id": "r1", "text": "You should fix the intro paragraph."},
                          headers=AUTH_HEADERS)
        assert res.status_code == 200
        data = res.get_json()
        assert data["constructiveness"] == 0.8
        assert data["specificity"] == 0.7
        assert data["actionability"] == 0.6
        assert data["review_id"] == "r1"


class TestScoreSuggestion:
    def test_returns_400_without_submission_text(self, client):
        res = client.post("/api/ai/score-suggestion",
                          json={"rubric_json": "{}"},
                          headers=AUTH_HEADERS)
        assert res.status_code == 400

    def test_returns_400_without_rubric(self, client):
        res = client.post("/api/ai/score-suggestion",
                          json={"submission_text": "Essay content"},
                          headers=AUTH_HEADERS)
        assert res.status_code == 400

    @patch("routes.scoring.call_openai")
    def test_returns_score_range(self, mock_call, client):
        mock_call.return_value = {
            "suggested_min": 3.0,
            "suggested_max": 4.0,
            "reasoning": "Well-structured but lacks depth.",
            "confidence": 0.75,
        }

        res = client.post("/api/ai/score-suggestion",
                          json={"submission_text": "My essay on AI ethics...",
                                "rubric_json": {"criteria": "clarity"}},
                          headers=AUTH_HEADERS)
        assert res.status_code == 200
        data = res.get_json()
        assert data["suggested_min"] == 3.0
        assert data["suggested_max"] == 4.0
        assert 0 <= data["confidence"] <= 1


class TestCalibration:
    def test_returns_400_without_scores(self, client):
        res = client.post("/api/ai/calibration",
                          json={},
                          headers=AUTH_HEADERS)
        assert res.status_code == 400

    def test_returns_400_with_non_numeric_score(self, client):
        res = client.post("/api/ai/calibration",
                          json={"reviewer_score": "abc", "peer_avg_score": 3.0},
                          headers=AUTH_HEADERS)
        assert res.status_code == 400
        assert "numeric" in res.get_json()["message"]

    @patch("routes.scoring.call_openai")
    def test_returns_calibration_advice(self, mock_call, client):
        mock_call.return_value = {
            "is_significant": True,
            "recommendation": "Consider reviewing the rubric again.",
            "severity": "medium",
        }

        res = client.post("/api/ai/calibration",
                          json={"reviewer_score": 5.0, "peer_avg_score": 3.0},
                          headers=AUTH_HEADERS)
        assert res.status_code == 200
        data = res.get_json()
        assert data["deviation"] == 2.0
        assert data["is_significant"] is True
        assert data["severity"] == "medium"

    @patch("routes.scoring.call_openai")
    def test_includes_deviation_in_response(self, mock_call, client):
        mock_call.return_value = {
            "is_significant": False,
            "recommendation": "Score looks fine.",
            "severity": "low",
        }

        res = client.post("/api/ai/calibration",
                          json={"reviewer_score": 3.5, "peer_avg_score": 3.0},
                          headers=AUTH_HEADERS)
        data = res.get_json()
        assert data["deviation"] == 0.5


class TestScoreReasoning:
    def test_returns_400_without_score(self, client):
        res = client.post("/api/ai/score-reasoning",
                          json={"submission_context": "An essay"},
                          headers=AUTH_HEADERS)
        assert res.status_code == 400

    def test_returns_400_without_context(self, client):
        res = client.post("/api/ai/score-reasoning",
                          json={"score": 4},
                          headers=AUTH_HEADERS)
        assert res.status_code == 400

    @patch("routes.scoring.call_openai")
    def test_returns_reasoning(self, mock_call, client):
        mock_call.return_value = {
            "reasoning": "The submission shows clear understanding.",
            "strengths": ["Clear thesis", "Good evidence"],
            "improvements": ["Needs better conclusion"],
        }

        res = client.post("/api/ai/score-reasoning",
                          json={"score": 4, "submission_context": "AI ethics essay"},
                          headers=AUTH_HEADERS)
        assert res.status_code == 200
        data = res.get_json()
        assert data["score"] == 4
        assert len(data["strengths"]) == 2
        assert len(data["improvements"]) == 1
