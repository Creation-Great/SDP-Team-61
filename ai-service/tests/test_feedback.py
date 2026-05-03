"""Tests for POST/GET /api/ai/feedback."""

from unittest.mock import patch, MagicMock

from tests.conftest import AUTH_HEADERS


class TestPostFeedback:
    def test_returns_401_without_api_key(self, client):
        res = client.post("/api/ai/feedback", json={
            "review_id": "r1", "text": "Good work",
        })
        assert res.status_code == 401
        assert res.get_json()["error"] == "unauthorized"

    def test_returns_400_without_review_id(self, client):
        res = client.post("/api/ai/feedback",
                          json={"text": "only text"},
                          headers=AUTH_HEADERS)
        assert res.status_code == 400

    def test_returns_400_without_text(self, client):
        res = client.post("/api/ai/feedback",
                          json={"review_id": "r1"},
                          headers=AUTH_HEADERS)
        assert res.status_code == 400

    def test_returns_400_when_text_exceeds_max_length(self, client):
        res = client.post("/api/ai/feedback",
                          json={"review_id": "r1", "text": "x" * 10_001},
                          headers=AUTH_HEADERS)
        assert res.status_code == 400
        assert "maximum length" in res.get_json()["message"]

    @patch("routes.feedback.get_db")
    def test_returns_cached_result(self, mock_get_db, client, mock_db):
        mock_conn, mock_cursor = mock_db
        mock_cursor.fetchone.return_value = {
            "review_id": "r1",
            "toxicity": 0.2,
            "politeness": 0.8,
            "sentiment": "positive",
            "identity_spans": [],
            "evidence_spans": [],
            "model_version": "gpt-4o-mini",
        }
        mock_get_db.return_value = mock_conn

        res = client.post("/api/ai/feedback",
                          json={"review_id": "r1", "text": "Good work"},
                          headers=AUTH_HEADERS)
        assert res.status_code == 200
        data = res.get_json()
        assert data["cached"] is True
        assert data["toxicity"] == 0.2
        assert data["sentiment"] == "positive"

    @patch("routes.feedback.get_db")
    @patch("routes.feedback.call_openai")
    def test_calls_openai_when_no_cache(self, mock_call, mock_get_db, client, mock_db):
        mock_conn, mock_cursor = mock_db
        mock_cursor.fetchone.return_value = None  # no cache
        mock_get_db.return_value = mock_conn
        mock_call.return_value = {
            "toxicity": 0.1,
            "politeness": 0.9,
            "sentiment": "positive",
            "identity_spans": [],
            "evidence_spans": [],
            "confidence": 0.95,
        }

        res = client.post("/api/ai/feedback",
                          json={"review_id": "r1", "text": "Great analysis"},
                          headers=AUTH_HEADERS)
        assert res.status_code == 200
        data = res.get_json()
        assert data["cached"] is False
        assert data["review_id"] == "r1"
        assert 0 <= data["toxicity"] <= 1
        mock_call.assert_called_once()

    @patch("routes.feedback.get_db")
    @patch("routes.feedback.call_openai")
    def test_returns_502_on_openai_failure(self, mock_call, mock_get_db, client, mock_db):
        mock_conn, mock_cursor = mock_db
        mock_cursor.fetchone.return_value = None
        mock_get_db.return_value = mock_conn
        mock_call.side_effect = RuntimeError("OpenAI down")

        res = client.post("/api/ai/feedback",
                          json={"review_id": "r1", "text": "Some text"},
                          headers=AUTH_HEADERS)
        assert res.status_code == 502
        assert res.get_json()["error"] == "ai_error"


class TestGetFeedback:
    @patch("routes.feedback.get_db")
    def test_returns_404_when_not_found(self, mock_get_db, client, mock_db):
        mock_conn, mock_cursor = mock_db
        mock_cursor.fetchone.return_value = None
        mock_get_db.return_value = mock_conn

        res = client.get("/api/ai/feedback/nonexistent-id", headers=AUTH_HEADERS)
        assert res.status_code == 404
        assert res.get_json()["error"] == "not_found"

    @patch("routes.feedback.get_db")
    def test_returns_stored_feedback(self, mock_get_db, client, mock_db):
        mock_conn, mock_cursor = mock_db
        mock_cursor.fetchone.return_value = {
            "review_id": "r1",
            "toxicity": 0.3,
            "politeness": 0.7,
            "sentiment": "neutral",
            "identity_spans": [],
            "evidence_spans": [{"start": 0, "end": 5, "label": "cite"}],
            "model_version": "gpt-4o-mini",
            "created_at": None,
        }
        mock_get_db.return_value = mock_conn

        res = client.get("/api/ai/feedback/r1", headers=AUTH_HEADERS)
        assert res.status_code == 200
        data = res.get_json()
        assert data["review_id"] == "r1"
        assert data["sentiment"] == "neutral"
        assert len(data["evidence_spans"]) == 1
