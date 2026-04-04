"""Tests for POST /api/ai/polish."""

from unittest.mock import patch

from tests.conftest import AUTH_HEADERS


class TestPolish:
    def test_returns_401_without_api_key(self, client):
        res = client.post("/api/ai/polish", json={"text": "Hello"})
        assert res.status_code == 401

    def test_returns_400_without_text(self, client):
        res = client.post("/api/ai/polish", json={}, headers=AUTH_HEADERS)
        assert res.status_code == 400
        assert res.get_json()["error"] == "validation"

    def test_returns_400_with_empty_text(self, client):
        res = client.post("/api/ai/polish", json={"text": "   "}, headers=AUTH_HEADERS)
        assert res.status_code == 400

    def test_returns_400_when_text_exceeds_max_length(self, client):
        res = client.post("/api/ai/polish",
                          json={"text": "x" * 10_001},
                          headers=AUTH_HEADERS)
        assert res.status_code == 400

    @patch("routes.polish.get_db")
    @patch("routes.polish.call_openai")
    def test_returns_polished_text(self, mock_call, mock_get_db, client, mock_db):
        mock_conn, mock_cursor = mock_db
        mock_get_db.return_value = mock_conn
        mock_call.return_value = {
            "polished": "Your work demonstrates strong analytical thinking.",
            "changes": ["Improved tone", "Fixed grammar"],
        }

        res = client.post("/api/ai/polish",
                          json={"text": "ur work is ok i guess", "user_id": "u1"},
                          headers=AUTH_HEADERS)
        assert res.status_code == 200
        data = res.get_json()
        assert "polished" in data
        assert len(data["changes"]) == 2

    @patch("routes.polish.get_db")
    @patch("routes.polish.call_openai")
    def test_logs_activity(self, mock_call, mock_get_db, client, mock_db):
        mock_conn, mock_cursor = mock_db
        mock_get_db.return_value = mock_conn
        mock_call.return_value = {"polished": "Better text", "changes": []}

        client.post("/api/ai/polish",
                    json={"text": "Original text", "user_id": "u1"},
                    headers=AUTH_HEADERS)
        # Verify INSERT INTO ai_activity_logs was called
        mock_cursor.execute.assert_called()
        insert_calls = [
            c for c in mock_cursor.execute.call_args_list
            if "ai_activity_logs" in str(c)
        ]
        assert len(insert_calls) == 1

    @patch("routes.polish.call_openai")
    def test_returns_502_on_openai_failure(self, mock_call, client):
        mock_call.side_effect = RuntimeError("API error")
        res = client.post("/api/ai/polish",
                          json={"text": "Some text"},
                          headers=AUTH_HEADERS)
        assert res.status_code == 502
