"""
Tests for the AI service Flask application.

Uses pytest with unittest.mock to avoid real DB connections and OpenAI calls.
"""

import pytest
from unittest.mock import patch, MagicMock
import os

# Set env vars BEFORE importing app so config picks them up
os.environ['AI_API_KEY'] = 'test-key'
os.environ['OPENAI_API_KEY'] = 'test-openai-key'
os.environ['DATABASE_URL'] = 'postgresql://test:test@localhost:5432/test'

# Patch the connection pool before importing app to prevent real DB connections
with patch('psycopg2.pool.ThreadedConnectionPool'):
    from app import app


@pytest.fixture
def client():
    app.config['TESTING'] = True
    with app.test_client() as c:
        yield c


# Headers with valid API key for inter-service auth
AUTH_HEADERS = {'X-AI-API-Key': 'test-key', 'Content-Type': 'application/json'}


# ================================================================
# GET /healthz
# ================================================================
class TestHealthz:
    def test_returns_200_with_status_ok(self, client):
        res = client.get('/healthz')
        assert res.status_code == 200
        data = res.get_json()
        assert data['status'] == 'ok'
        assert data['service'] == 'ai-service'


# ================================================================
# POST /api/ai/feedback
# ================================================================
class TestFeedback:
    def test_returns_401_without_api_key(self, client):
        res = client.post('/api/ai/feedback', json={
            'review_id': 'r1',
            'text': 'Good work',
        })
        assert res.status_code == 401
        data = res.get_json()
        assert data['error'] == 'unauthorized'

    def test_returns_400_without_review_id_or_text(self, client):
        res = client.post('/api/ai/feedback',
                          json={'text': 'only text'},
                          headers=AUTH_HEADERS)
        assert res.status_code == 400

        res2 = client.post('/api/ai/feedback',
                           json={'review_id': 'r1'},
                           headers=AUTH_HEADERS)
        assert res2.status_code == 400

    def test_returns_400_when_text_exceeds_max_length(self, client):
        long_text = 'x' * 10_001
        res = client.post('/api/ai/feedback',
                          json={'review_id': 'r1', 'text': long_text},
                          headers=AUTH_HEADERS)
        assert res.status_code == 400
        data = res.get_json()
        assert 'maximum length' in data['message']

    @patch('app.get_db')
    def test_returns_cached_result_when_ml_outputs_has_entry(self, mock_get_db, client):
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.__enter__ = MagicMock(return_value=mock_cursor)
        mock_cursor.__exit__ = MagicMock(return_value=False)
        mock_cursor.fetchone.return_value = {
            'review_id': 'r1',
            'toxicity': 0.2,
            'politeness': 0.8,
            'sentiment': 'positive',
            'identity_spans': [],
            'evidence_spans': [],
            'model_version': 'gpt-4o-mini',
        }
        mock_conn.cursor.return_value = mock_cursor
        mock_get_db.return_value = mock_conn

        res = client.post('/api/ai/feedback',
                          json={'review_id': 'r1', 'text': 'Good work'},
                          headers=AUTH_HEADERS)
        assert res.status_code == 200
        data = res.get_json()
        assert data['cached'] is True
        assert data['toxicity'] == 0.2
        assert data['sentiment'] == 'positive'


# ================================================================
# POST /api/ai/polish
# ================================================================
class TestPolish:
    def test_returns_400_without_text(self, client):
        res = client.post('/api/ai/polish',
                          json={},
                          headers=AUTH_HEADERS)
        assert res.status_code == 400
        data = res.get_json()
        assert data['error'] == 'validation'


# ================================================================
# GET /api/search
# ================================================================
class TestSearch:
    def test_returns_empty_results_for_short_query(self, client):
        # Query with fewer than 2 characters returns empty results
        res = client.get('/api/search?q=a', headers=AUTH_HEADERS)
        assert res.status_code == 200
        data = res.get_json()
        assert data['submissions'] == []
        assert data['users'] == []
