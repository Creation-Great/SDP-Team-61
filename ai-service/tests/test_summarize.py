"""Tests for POST /api/ai/summarize."""

from unittest.mock import patch

from tests.conftest import AUTH_HEADERS


class TestSummarize:
    def test_returns_401_without_api_key(self, client):
        res = client.post("/api/ai/summarize", json={"reviews": [{"score": 4}]})
        assert res.status_code == 401

    def test_returns_400_without_reviews(self, client):
        res = client.post("/api/ai/summarize", json={}, headers=AUTH_HEADERS)
        assert res.status_code == 400
        assert res.get_json()["error"] == "validation"

    def test_returns_400_with_empty_reviews(self, client):
        res = client.post("/api/ai/summarize", json={"reviews": []}, headers=AUTH_HEADERS)
        assert res.status_code == 400

    @patch("routes.summarize.get_db")
    @patch("routes.summarize.call_openai")
    def test_returns_summary(self, mock_call, mock_get_db, client, mock_db):
        mock_conn, mock_cursor = mock_db
        mock_get_db.return_value = mock_conn
        mock_call.return_value = {
            "summary": "Overall good submission with minor issues.",
            "themes": ["clarity", "structure"],
            "avg_score": 3.5,
        }

        reviews = [
            {"score": 4, "comments": "Good work", "reviewer_name": "Alice"},
            {"score": 3, "comments": "Needs clarity", "reviewer_name": "Bob"},
        ]
        res = client.post("/api/ai/summarize",
                          json={"reviews": reviews, "user_id": "u1"},
                          headers=AUTH_HEADERS)
        assert res.status_code == 200
        data = res.get_json()
        assert "summary" in data
        assert data["avg_score"] == 3.5
        assert len(data["themes"]) == 2

    @patch("routes.summarize.call_openai")
    def test_returns_502_on_openai_failure(self, mock_call, client):
        mock_call.side_effect = RuntimeError("timeout")
        res = client.post("/api/ai/summarize",
                          json={"reviews": [{"score": 4, "comments": "Good"}]},
                          headers=AUTH_HEADERS)
        assert res.status_code == 502
