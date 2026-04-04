"""Tests for POST /api/ai/similarity and /api/ai/similarity/turnitin."""

from unittest.mock import patch

from tests.conftest import AUTH_HEADERS


class TestSimilarity:
    def test_returns_401_without_api_key(self, client):
        res = client.post("/api/ai/similarity", json={"submissions": []})
        assert res.status_code == 401

    def test_returns_400_with_fewer_than_2_submissions(self, client):
        res = client.post("/api/ai/similarity",
                          json={"submissions": [{"submission_id": "s1", "text": "Hello"}]},
                          headers=AUTH_HEADERS)
        assert res.status_code == 400

    def test_returns_400_with_empty_text(self, client):
        res = client.post("/api/ai/similarity",
                          json={"submissions": [
                              {"submission_id": "s1", "text": "Hello"},
                              {"submission_id": "s2", "text": ""},
                          ]},
                          headers=AUTH_HEADERS)
        assert res.status_code == 400

    def test_returns_400_without_submission_id(self, client):
        res = client.post("/api/ai/similarity",
                          json={"submissions": [
                              {"text": "Hello"},
                              {"submission_id": "s2", "text": "World"},
                          ]},
                          headers=AUTH_HEADERS)
        assert res.status_code == 400

    @patch("routes.similarity.get_db")
    def test_computes_similarity_pairs(self, mock_get_db, client, mock_db):
        mock_conn, mock_cursor = mock_db
        mock_get_db.return_value = mock_conn

        res = client.post("/api/ai/similarity",
                          json={"submissions": [
                              {"submission_id": "s1", "text": "The quick brown fox jumps over the lazy dog"},
                              {"submission_id": "s2", "text": "The quick brown fox jumps over the lazy dog"},
                          ]},
                          headers=AUTH_HEADERS)
        assert res.status_code == 200
        data = res.get_json()
        assert "pairs" in data
        # Identical texts should have high similarity
        assert len(data["pairs"]) > 0
        assert data["pairs"][0]["similarity_score"] > 0.9

    @patch("routes.similarity.get_db")
    def test_filters_low_similarity_pairs(self, mock_get_db, client, mock_db):
        mock_conn, mock_cursor = mock_db
        mock_get_db.return_value = mock_conn

        res = client.post("/api/ai/similarity",
                          json={"submissions": [
                              {"submission_id": "s1", "text": "Quantum physics explains the behavior of matter at atomic scales"},
                              {"submission_id": "s2", "text": "Baking a chocolate cake requires flour sugar eggs and cocoa powder"},
                          ]},
                          headers=AUTH_HEADERS)
        assert res.status_code == 200
        data = res.get_json()
        # Very different texts — pairs may be empty or have low scores
        for pair in data["pairs"]:
            assert pair["similarity_score"] > 0.1  # threshold filter


class TestSimilarityTurnitin:
    def test_returns_401_without_api_key(self, client):
        res = client.post("/api/ai/similarity/turnitin", json={})
        assert res.status_code == 401

    def test_returns_400_without_submission_id(self, client):
        res = client.post("/api/ai/similarity/turnitin",
                          json={"text": "Some text"},
                          headers=AUTH_HEADERS)
        assert res.status_code == 400

    def test_returns_400_without_text(self, client):
        res = client.post("/api/ai/similarity/turnitin",
                          json={"submission_id": "s1"},
                          headers=AUTH_HEADERS)
        assert res.status_code == 400

    def test_returns_mock_turnitin_result(self, client):
        res = client.post("/api/ai/similarity/turnitin",
                          json={"submission_id": "s1", "text": "My essay content"},
                          headers=AUTH_HEADERS)
        assert res.status_code == 200
        data = res.get_json()
        assert data["provider"] == "turnitin_mock"
        assert data["submission_id"] == "s1"
        assert data["status"] == "complete"
        assert 5 <= data["originality_score"] <= 30
        assert isinstance(data["internet_matches"], int)
        assert isinstance(data["publication_matches"], int)
        assert isinstance(data["student_paper_matches"], int)
