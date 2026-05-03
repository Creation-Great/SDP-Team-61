"""Tests for POST /api/ai/chat."""

from unittest.mock import patch

from tests.conftest import AUTH_HEADERS


class TestChat:
    def test_returns_401_without_api_key(self, client):
        res = client.post("/api/ai/chat", json={"message": "Hi"})
        assert res.status_code == 401

    def test_returns_400_without_message(self, client):
        res = client.post("/api/ai/chat",
                          json={"context_type": "writing_review"},
                          headers=AUTH_HEADERS)
        assert res.status_code == 400

    def test_returns_400_with_empty_message(self, client):
        res = client.post("/api/ai/chat",
                          json={"message": "   ", "context_type": "writing_review"},
                          headers=AUTH_HEADERS)
        assert res.status_code == 400

    def test_returns_400_with_invalid_context_type(self, client):
        res = client.post("/api/ai/chat",
                          json={"message": "Hi", "context_type": "invalid_type"},
                          headers=AUTH_HEADERS)
        assert res.status_code == 400
        assert "context_type" in res.get_json()["message"]

    @patch("routes.chat.get_db")
    @patch("routes.chat.call_openai_chat")
    def test_accepts_all_valid_context_types(self, mock_call, mock_get_db, client, mock_db):
        """All three context types should pass validation."""
        mock_conn, mock_cursor = mock_db
        mock_get_db.return_value = mock_conn
        mock_call.return_value = "Reply"

        for ctx in ["writing_review", "reading_review", "teacher_summary"]:
            res = client.post("/api/ai/chat",
                              json={"message": "Hi", "context_type": ctx},
                              headers=AUTH_HEADERS)
            assert res.status_code == 200

    @patch("routes.chat.get_db")
    @patch("routes.chat.call_openai_chat")
    def test_returns_reply_without_user_id(self, mock_call, mock_get_db, client, mock_db):
        """Without user_id, conversation is not persisted but reply is returned."""
        mock_conn, mock_cursor = mock_db
        mock_get_db.return_value = mock_conn
        mock_call.return_value = "Here are some tips for writing better reviews."

        res = client.post("/api/ai/chat",
                          json={"message": "How to write a good review?",
                                "context_type": "writing_review"},
                          headers=AUTH_HEADERS)
        assert res.status_code == 200
        data = res.get_json()
        assert data["reply"] == "Here are some tips for writing better reviews."
        assert "conversation_id" in data
        assert data["messages_count"] == 2  # user + assistant

    @patch("routes.chat.get_db")
    @patch("routes.chat.call_openai_chat")
    def test_persists_conversation_with_user_id(self, mock_call, mock_get_db, client, mock_db):
        mock_conn, mock_cursor = mock_db
        mock_get_db.return_value = mock_conn
        mock_call.return_value = "Great question!"

        res = client.post("/api/ai/chat",
                          json={
                              "message": "What does this feedback mean?",
                              "context_type": "reading_review",
                              "user_id": "550e8400-e29b-41d4-a716-446655440000",
                          },
                          headers=AUTH_HEADERS)
        assert res.status_code == 200
        # Verify INSERT INTO ai_conversations was called
        insert_calls = [
            c for c in mock_cursor.execute.call_args_list
            if "ai_conversations" in str(c)
        ]
        assert len(insert_calls) == 1
        mock_conn.commit.assert_called_once()

    @patch("routes.chat.get_db")
    @patch("routes.chat.call_openai_chat")
    def test_loads_existing_conversation(self, mock_call, mock_get_db, client, mock_db):
        import json
        mock_conn, mock_cursor = mock_db
        mock_get_db.return_value = mock_conn
        mock_call.return_value = "Continuing our conversation."

        # Simulate stored conversation
        mock_cursor.fetchone.return_value = {
            "messages": json.dumps([
                {"role": "user", "content": "First message"},
                {"role": "assistant", "content": "First reply"},
            ])
        }

        res = client.post("/api/ai/chat",
                          json={
                              "message": "Follow-up question",
                              "context_type": "writing_review",
                              "conversation_id": "conv-123",
                              "user_id": "550e8400-e29b-41d4-a716-446655440000",
                          },
                          headers=AUTH_HEADERS)
        assert res.status_code == 200
        data = res.get_json()
        assert data["messages_count"] == 4  # 2 stored + user + assistant
