"""Tests for GET /healthz."""

from tests.conftest import AUTH_HEADERS


class TestHealthz:
    def test_returns_200_with_status_ok(self, client):
        res = client.get("/healthz")
        assert res.status_code == 200
        data = res.get_json()
        assert data["status"] == "ok"
        assert data["service"] == "ai-service"

    def test_includes_openai_configured_flag(self, client):
        res = client.get("/healthz")
        data = res.get_json()
        assert "openai_configured" in data
        assert isinstance(data["openai_configured"], bool)

    def test_does_not_require_api_key(self, client):
        """Healthz is public — no X-AI-API-Key needed."""
        res = client.get("/healthz")
        assert res.status_code == 200
