"""Tests for GET /api/ai/logs."""

from unittest.mock import patch
from datetime import datetime

from tests.conftest import AUTH_HEADERS


class TestLogs:
    def test_returns_401_without_api_key(self, client):
        res = client.get("/api/ai/logs")
        assert res.status_code == 401

    @patch("routes.logs.get_db")
    def test_returns_empty_list_when_no_logs(self, mock_get_db, client, mock_db):
        mock_conn, mock_cursor = mock_db
        mock_cursor.fetchall.return_value = []
        mock_get_db.return_value = mock_conn

        res = client.get("/api/ai/logs", headers=AUTH_HEADERS)
        assert res.status_code == 200
        assert res.get_json() == []

    @patch("routes.logs.get_db")
    def test_returns_log_entries(self, mock_get_db, client, mock_db):
        mock_conn, mock_cursor = mock_db
        mock_cursor.fetchall.return_value = [
            {
                "id": 1,
                "action": "feedback",
                "user_id": "u1",
                "user_name": "Alice",
                "detail": {"input_length": 200},
                "created_at": datetime(2026, 1, 15, 10, 30),
            },
            {
                "id": 2,
                "action": "polish",
                "user_id": "u2",
                "user_name": None,
                "detail": None,
                "created_at": None,
            },
        ]
        mock_get_db.return_value = mock_conn

        res = client.get("/api/ai/logs", headers=AUTH_HEADERS)
        assert res.status_code == 200
        data = res.get_json()
        assert len(data) == 2
        assert data[0]["action"] == "feedback"
        assert data[0]["user_name"] == "Alice"
        assert data[0]["created_at"] == "2026-01-15T10:30:00"
        assert data[1]["user_name"] is None
        assert data[1]["detail"] == {}

    @patch("routes.logs.get_db")
    def test_respects_limit_param(self, mock_get_db, client, mock_db):
        mock_conn, mock_cursor = mock_db
        mock_cursor.fetchall.return_value = []
        mock_get_db.return_value = mock_conn

        client.get("/api/ai/logs?limit=5", headers=AUTH_HEADERS)
        # Verify the LIMIT parameter was passed to SQL
        call_args = mock_cursor.execute.call_args
        assert call_args[0][1] == (5,)
