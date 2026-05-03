"""Tests for shared extensions: validate_feedback, require_api_key."""

import json
from unittest.mock import patch, MagicMock

from tests.conftest import AUTH_HEADERS


class TestValidateFeedback:
    """Test the validate_feedback() clamping logic."""

    def test_clamps_toxicity_to_0_1(self):
        from extensions import validate_feedback
        result = validate_feedback({"toxicity": 1.5, "politeness": 0.5, "sentiment": "neutral"})
        assert result["toxicity"] == 1.0

        result = validate_feedback({"toxicity": -0.3, "politeness": 0.5, "sentiment": "neutral"})
        assert result["toxicity"] == 0.0

    def test_clamps_politeness_to_0_1(self):
        from extensions import validate_feedback
        result = validate_feedback({"toxicity": 0.5, "politeness": 2.0, "sentiment": "neutral"})
        assert result["politeness"] == 1.0

        result = validate_feedback({"toxicity": 0.5, "politeness": -1.0, "sentiment": "neutral"})
        assert result["politeness"] == 0.0

    def test_defaults_invalid_sentiment(self):
        from extensions import validate_feedback
        result = validate_feedback({"toxicity": 0.1, "politeness": 0.9, "sentiment": "invalid"})
        assert result["sentiment"] == "neutral"

    def test_accepts_valid_sentiments(self):
        from extensions import validate_feedback
        for sentiment in ("positive", "negative", "neutral", "mixed"):
            result = validate_feedback({"toxicity": 0.1, "politeness": 0.9, "sentiment": sentiment})
            assert result["sentiment"] == sentiment

    def test_defaults_non_list_spans_to_empty(self):
        from extensions import validate_feedback
        result = validate_feedback({
            "toxicity": 0.1,
            "politeness": 0.9,
            "sentiment": "neutral",
            "identity_spans": "not a list",
            "evidence_spans": None,
        })
        assert result["identity_spans"] == []
        assert result["evidence_spans"] == []

    def test_preserves_valid_spans(self):
        from extensions import validate_feedback
        spans = [{"start": 0, "end": 5, "label": "test"}]
        result = validate_feedback({
            "toxicity": 0.1,
            "politeness": 0.9,
            "sentiment": "neutral",
            "identity_spans": spans,
            "evidence_spans": [],
        })
        assert result["identity_spans"] == spans

    def test_defaults_confidence(self):
        from extensions import validate_feedback
        result = validate_feedback({"toxicity": 0.1, "politeness": 0.9, "sentiment": "neutral"})
        assert result["confidence"] == 0.5

    def test_handles_non_numeric_toxicity(self):
        from extensions import validate_feedback
        result = validate_feedback({"toxicity": "high", "politeness": 0.5, "sentiment": "neutral"})
        assert result["toxicity"] == 0.0


class TestRequireApiKey:
    def test_rejects_missing_key(self, client):
        res = client.get("/api/ai/logs")
        assert res.status_code == 401

    def test_rejects_wrong_key(self, client):
        res = client.get("/api/ai/logs", headers={
            "X-AI-API-Key": "wrong-key",
            "Content-Type": "application/json",
        })
        assert res.status_code == 401
        assert res.get_json()["error"] == "unauthorized"

    @patch("routes.logs.get_db")
    def test_accepts_correct_key(self, mock_get_db, client, mock_db):
        mock_conn, mock_cursor = mock_db
        mock_cursor.fetchall.return_value = []
        mock_get_db.return_value = mock_conn

        res = client.get("/api/ai/logs", headers=AUTH_HEADERS)
        assert res.status_code == 200

    def test_rejects_when_ai_api_key_not_configured(self, client):
        """When AI_API_KEY env is empty, all requests are rejected (fail closed)."""
        import os
        original = os.environ.get("AI_API_KEY")
        try:
            # Patch the config value
            with patch("extensions.AI_API_KEY", ""):
                from app import create_app
                app = create_app()
                app.config["TESTING"] = True
                with app.test_client() as c:
                    res = c.get("/api/ai/logs", headers=AUTH_HEADERS)
                    assert res.status_code == 503
                    assert res.get_json()["error"] == "not_configured"
        finally:
            if original:
                os.environ["AI_API_KEY"] = original
