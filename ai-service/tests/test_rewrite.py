"""Tests for POST/GET/PATCH /api/ai/rewrite."""

from unittest.mock import patch

from tests.conftest import AUTH_HEADERS


class TestPostRewrite:
    def test_returns_401_without_api_key(self, client):
        res = client.post("/api/ai/rewrite", json={
            "review_id": "r1", "text": "Needs work",
        })
        assert res.status_code == 401

    def test_returns_400_without_review_id(self, client):
        res = client.post("/api/ai/rewrite",
                          json={"text": "only text"},
                          headers=AUTH_HEADERS)
        assert res.status_code == 400

    def test_returns_400_without_text(self, client):
        res = client.post("/api/ai/rewrite",
                          json={"review_id": "r1"},
                          headers=AUTH_HEADERS)
        assert res.status_code == 400

    def test_returns_400_when_text_exceeds_max_length(self, client):
        res = client.post("/api/ai/rewrite",
                          json={"review_id": "r1", "text": "x" * 10_001},
                          headers=AUTH_HEADERS)
        assert res.status_code == 400

    @patch("routes.rewrite.get_db")
    def test_returns_cached_result(self, mock_get_db, client, mock_db):
        mock_conn, mock_cursor = mock_db
        mock_cursor.fetchone.return_value = {
            "review_id": "r1",
            "revised_text": "Improved text",
            "edits": [{"original": "bad", "replacement": "good", "reason": "tone"}],
            "preserved": ["nice point"],
            "reasoning": {"tone": "improved", "clarity": "ok", "specificity": "ok"},
            "model_version": "gpt-4o-mini",
        }
        mock_get_db.return_value = mock_conn

        res = client.post("/api/ai/rewrite",
                          json={"review_id": "r1", "text": "Original text"},
                          headers=AUTH_HEADERS)
        assert res.status_code == 200
        data = res.get_json()
        assert data["cached"] is True
        assert data["revised_text"] == "Improved text"

    @patch("routes.rewrite.get_db")
    @patch("routes.rewrite.call_openai")
    def test_calls_openai_when_no_cache(self, mock_call, mock_get_db, client, mock_db):
        mock_conn, mock_cursor = mock_db
        mock_cursor.fetchone.return_value = None
        mock_get_db.return_value = mock_conn
        mock_call.return_value = {
            "revised_text": "Better version",
            "edits": [],
            "preserved": ["good part"],
            "reasoning": {"tone": "ok", "clarity": "ok", "specificity": "ok"},
        }

        res = client.post("/api/ai/rewrite",
                          json={"review_id": "r1", "text": "Needs work", "context": "Essay on AI"},
                          headers=AUTH_HEADERS)
        assert res.status_code == 200
        data = res.get_json()
        assert data["cached"] is False
        assert data["revised_text"] == "Better version"

    @patch("routes.rewrite.get_db")
    @patch("routes.rewrite.call_openai")
    def test_returns_502_on_openai_failure(self, mock_call, mock_get_db, client, mock_db):
        mock_conn, mock_cursor = mock_db
        mock_cursor.fetchone.return_value = None
        mock_get_db.return_value = mock_conn
        mock_call.side_effect = RuntimeError("timeout")

        res = client.post("/api/ai/rewrite",
                          json={"review_id": "r1", "text": "Some text"},
                          headers=AUTH_HEADERS)
        assert res.status_code == 502


class TestGetRewrite:
    @patch("routes.rewrite.get_db")
    def test_returns_404_when_not_found(self, mock_get_db, client, mock_db):
        mock_conn, mock_cursor = mock_db
        mock_cursor.fetchone.return_value = None
        mock_get_db.return_value = mock_conn

        res = client.get("/api/ai/rewrite/nonexistent", headers=AUTH_HEADERS)
        assert res.status_code == 404

    @patch("routes.rewrite.get_db")
    def test_returns_stored_rewrite(self, mock_get_db, client, mock_db):
        mock_conn, mock_cursor = mock_db
        mock_cursor.fetchone.return_value = {
            "review_id": "r1",
            "revised_text": "Better text",
            "edits": [],
            "preserved": [],
            "reasoning": {},
            "model_version": "gpt-4o-mini",
            "adopted": False,
            "created_at": None,
        }
        mock_get_db.return_value = mock_conn

        res = client.get("/api/ai/rewrite/r1", headers=AUTH_HEADERS)
        assert res.status_code == 200
        assert res.get_json()["adopted"] is False


class TestAdoptRewrite:
    @patch("routes.rewrite.get_db")
    def test_returns_404_when_not_found(self, mock_get_db, client, mock_db):
        mock_conn, mock_cursor = mock_db
        mock_cursor.fetchone.return_value = None
        mock_get_db.return_value = mock_conn

        res = client.patch("/api/ai/rewrite/nonexistent/adopt", headers=AUTH_HEADERS)
        assert res.status_code == 404

    @patch("routes.rewrite.get_db")
    def test_marks_rewrite_as_adopted(self, mock_get_db, client, mock_db):
        mock_conn, mock_cursor = mock_db
        mock_cursor.fetchone.return_value = ("r1",)
        mock_get_db.return_value = mock_conn

        res = client.patch("/api/ai/rewrite/r1/adopt", headers=AUTH_HEADERS)
        assert res.status_code == 200
        data = res.get_json()
        assert data["adopted"] is True
        assert data["review_id"] == "r1"
        mock_conn.commit.assert_called_once()
