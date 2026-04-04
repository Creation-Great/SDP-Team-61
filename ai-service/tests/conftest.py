"""
Shared test fixtures for the AI service test suite.

Sets environment variables and patches the DB pool BEFORE any app import.
All tests share ``client`` and ``AUTH_HEADERS`` fixtures.
"""

import os
import pytest
from unittest.mock import patch, MagicMock

# Set env vars BEFORE importing app so config picks them up
os.environ["AI_API_KEY"] = "test-key"
os.environ["OPENAI_API_KEY"] = "test-openai-key"
os.environ["DATABASE_URL"] = "postgresql://test:test@localhost:5432/test"

# Patch the connection pool before importing app
with patch("psycopg2.pool.ThreadedConnectionPool"):
    from app import create_app


AUTH_HEADERS = {"X-AI-API-Key": "test-key", "Content-Type": "application/json"}


@pytest.fixture
def client():
    """Create a fresh Flask test client for each test."""
    app = create_app()
    app.config["TESTING"] = True
    with app.test_client() as c:
        yield c


@pytest.fixture
def mock_db():
    """Provide a mock DB connection with cursor context manager wired up."""
    mock_conn = MagicMock()
    mock_cursor = MagicMock()
    mock_cursor.__enter__ = MagicMock(return_value=mock_cursor)
    mock_cursor.__exit__ = MagicMock(return_value=False)
    mock_conn.cursor.return_value = mock_cursor
    return mock_conn, mock_cursor


@pytest.fixture
def mock_openai_json():
    """Return a factory that creates a mock OpenAI JSON response."""
    def _factory(response_dict: dict):
        mock_completion = MagicMock()
        mock_completion.choices = [MagicMock()]
        mock_completion.choices[0].message.content = __import__("json").dumps(response_dict)
        mock_completion.usage = MagicMock(
            prompt_tokens=50, completion_tokens=30, total_tokens=80
        )
        return mock_completion
    return _factory


@pytest.fixture
def mock_openai_text():
    """Return a factory that creates a mock OpenAI plain-text response."""
    def _factory(reply_text: str):
        mock_completion = MagicMock()
        mock_completion.choices = [MagicMock()]
        mock_completion.choices[0].message.content = reply_text
        mock_completion.usage = MagicMock(
            prompt_tokens=50, completion_tokens=30, total_tokens=80
        )
        return mock_completion
    return _factory
