"""Tests for GET /api/search."""

from unittest.mock import patch
from datetime import datetime

from tests.conftest import AUTH_HEADERS


class TestSearch:
    def test_returns_401_without_api_key(self, client):
        res = client.get("/api/search?q=test")
        assert res.status_code == 401

    def test_returns_empty_for_short_query(self, client):
        res = client.get("/api/search?q=a", headers=AUTH_HEADERS)
        assert res.status_code == 200
        data = res.get_json()
        assert data["submissions"] == []
        assert data["users"] == []

    def test_returns_empty_for_missing_query(self, client):
        res = client.get("/api/search", headers=AUTH_HEADERS)
        assert res.status_code == 200
        data = res.get_json()
        assert data["submissions"] == []
        assert data["users"] == []

    @patch("routes.search.get_db")
    def test_searches_submissions(self, mock_get_db, client, mock_db):
        mock_conn, mock_cursor = mock_db
        mock_cursor.fetchall.side_effect = [
            # submissions query
            [{
                "submission_id": "s1",
                "title": "AI Ethics Essay",
                "filename": "essay.pdf",
                "status": "submitted",
                "student_name": "Alice",
                "student_email": "alice@example.com",
                "created_at": datetime(2026, 3, 1),
            }],
            # users query
            [],
        ]
        mock_get_db.return_value = mock_conn

        res = client.get("/api/search?q=Ethics&type=all", headers=AUTH_HEADERS)
        assert res.status_code == 200
        data = res.get_json()
        assert len(data["submissions"]) == 1
        assert data["submissions"][0]["title"] == "AI Ethics Essay"
        assert data["submissions"][0]["original_filename"] == "essay.pdf"
        assert data["submissions"][0]["uploader_name"] == "Alice"

    @patch("routes.search.get_db")
    def test_searches_students_only(self, mock_get_db, client, mock_db):
        mock_conn, mock_cursor = mock_db
        mock_cursor.fetchall.return_value = [{
            "user_id": "u1",
            "name": "Bob Smith",
            "email": "bob@example.com",
            "role": "student",
        }]
        mock_get_db.return_value = mock_conn

        res = client.get("/api/search?q=Bob&type=students", headers=AUTH_HEADERS)
        assert res.status_code == 200
        data = res.get_json()
        assert data["submissions"] == []
        assert len(data["users"]) == 1
        assert data["users"][0]["name"] == "Bob Smith"

    @patch("routes.search.get_db")
    def test_uses_ilike_pattern(self, mock_get_db, client, mock_db):
        mock_conn, mock_cursor = mock_db
        mock_cursor.fetchall.return_value = []
        mock_get_db.return_value = mock_conn

        client.get("/api/search?q=test&type=submissions", headers=AUTH_HEADERS)
        # Verify ILIKE pattern %test% was passed
        call_args = mock_cursor.execute.call_args
        pattern = call_args[0][1][0]
        assert pattern == "%test%"
