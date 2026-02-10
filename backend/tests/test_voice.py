# tests/test_voice.py
"""
Tests for voice router (app/routers/voice.py).

Coverage:
- Voice transcript saving (POST endpoint)
- WebSocket connection (basic test - complex WebSocket testing deferred)

Note: Full WebSocket testing with Gemini Live API is complex.
This focuses on the transcript saving endpoint which is more testable.
"""

import pytest
from unittest.mock import MagicMock


@pytest.mark.integration
class TestVoiceTranscripts:
    """Test voice transcript saving endpoints."""

    def test_save_transcript_success(
        self,
        client,
        override_get_current_user,
        mock_supabase,
        mock_supabase_response,
        mock_therapy_session,
        mock_patient,
    ):
        """Test saving voice interaction transcript."""
        # Endpoint queries therapy_sessions and patients with .single(), then inserts voice_transcripts
        mock_session_q = MagicMock()
        mock_session_q.select.return_value.eq.return_value.single.return_value.execute.return_value = (
            mock_supabase_response({"id": mock_therapy_session["id"], "patient_id": mock_patient["id"]})
        )

        mock_patient_q = MagicMock()
        mock_patient_q.select.return_value.eq.return_value.single.return_value.execute.return_value = (
            mock_supabase_response({"caregiver_id": mock_patient["caregiver_id"]})
        )

        mock_transcript_q = MagicMock()
        mock_transcript_q.insert.return_value.execute.return_value = (
            mock_supabase_response([{"id": "transcript-id"}])
        )

        def table_router(name):
            if name == "therapy_sessions":
                return mock_session_q
            if name == "patients":
                return mock_patient_q
            if name == "voice_transcripts":
                return mock_transcript_q
            return MagicMock()

        mock_supabase.table.side_effect = table_router

        response = client.post(
            f"/api/voice/transcript/{mock_therapy_session['id']}",
            json={
                "transcript": [{"role": "user", "text": "Tell me about this photo."}],
                "duration": 30,
                "word_count": 5,
            },
            headers={"Authorization": "Bearer fake-token"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert "id" in data

    def test_save_transcript_session_not_found(
        self, client, override_get_current_user, mock_supabase, mock_supabase_response
    ):
        """Test saving transcript for non-existent session."""
        mock_session_q = MagicMock()
        mock_session_q.select.return_value.eq.return_value.single.return_value.execute.return_value = (
            mock_supabase_response(None)
        )
        mock_supabase.table.side_effect = lambda name: mock_session_q if name == "therapy_sessions" else MagicMock()

        response = client.post(
            "/api/voice/transcript/non-existent-session",
            json={
                "transcript": [{"role": "user", "text": "Test"}],
                "duration": 10,
                "word_count": 1,
            },
            headers={"Authorization": "Bearer fake-token"},
        )

        assert response.status_code == 404

    def test_save_transcript_unauthorized(self, client, mock_supabase):
        """Test saving transcript without authentication."""
        response = client.post(
            "/api/voice/transcript/session-id",
            json={
                "transcript": [{"role": "user", "text": "Test"}],
                "duration": 10,
                "word_count": 1,
            },
        )

        assert response.status_code == 401

    def test_save_transcript_missing_transcript(
        self, client, override_get_current_user, mock_supabase, mock_supabase_response, mock_therapy_session
    ):
        """Test saving transcript with missing transcript field."""
        response = client.post(
            f"/api/voice/transcript/{mock_therapy_session['id']}",
            json={
                # Missing transcript and duration fields
            },
            headers={"Authorization": "Bearer fake-token"},
        )

        assert response.status_code == 422

    def test_save_transcript_supporter_forbidden(
        self,
        client,
        override_get_current_user_supporter,
        mock_supabase,
        mock_supabase_response,
        mock_therapy_session,
        mock_patient,
    ):
        """Test supporters cannot save transcripts."""
        # Endpoint checks caregiver_id against current user — supporter ID won't match
        mock_session_q = MagicMock()
        mock_session_q.select.return_value.eq.return_value.single.return_value.execute.return_value = (
            mock_supabase_response({"id": mock_therapy_session["id"], "patient_id": mock_patient["id"]})
        )

        mock_patient_q = MagicMock()
        mock_patient_q.select.return_value.eq.return_value.single.return_value.execute.return_value = (
            mock_supabase_response({"caregiver_id": mock_patient["caregiver_id"]})
        )

        def table_router(name):
            if name == "therapy_sessions":
                return mock_session_q
            if name == "patients":
                return mock_patient_q
            return MagicMock()

        mock_supabase.table.side_effect = table_router

        response = client.post(
            f"/api/voice/transcript/{mock_therapy_session['id']}",
            json={
                "transcript": [{"role": "user", "text": "Test"}],
                "duration": 10,
                "word_count": 1,
            },
            headers={"Authorization": "Bearer fake-token"},
        )

        assert response.status_code == 403


