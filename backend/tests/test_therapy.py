# tests/test_therapy.py
"""
Tests for therapy router (app/routers/therapy.py).

Coverage:
- Start therapy session (with/without voice)
- End therapy session with statistics
- Session history
- Schedule CRUD
- Session curation
"""

import pytest
from unittest.mock import MagicMock, AsyncMock
from datetime import datetime, timezone


@pytest.mark.integration
class TestTherapySessions:
    """Test therapy session endpoints."""

    def test_start_session_success(
        self, client, override_get_current_user, mock_supabase, mock_supabase_response, mock_patient, mocker
    ):
        """Test starting a therapy session."""
        session_data = {
            "id": "session-id",
            "patient_id": mock_patient["id"],
            "voice_enabled": False,
            "started_at": datetime.now(timezone.utc).isoformat(),
            "ended_at": None,
        }

        # Table routing: patients (.single()), therapy_sessions (insert), media, therapy_schedules
        mock_patients_q = MagicMock()
        mock_patients_q.select.return_value.eq.return_value.single.return_value.execute.return_value = (
            mock_supabase_response(mock_patient)
        )

        mock_sessions_q = MagicMock()
        mock_sessions_q.insert.return_value.execute.return_value = (
            mock_supabase_response([session_data])
        )

        mock_media_q = MagicMock()
        mock_media_q.select.return_value.eq.return_value.eq.return_value.execute.return_value = (
            mock_supabase_response([])
        )

        mock_schedules_q = MagicMock()
        mock_schedules_q.select.return_value.eq.return_value.limit.return_value.execute.return_value = (
            mock_supabase_response([])
        )

        def table_router(name):
            if name == "patients":
                return mock_patients_q
            if name == "therapy_sessions":
                return mock_sessions_q
            if name == "media":
                return mock_media_q
            if name == "therapy_schedules":
                return mock_schedules_q
            return MagicMock()

        mock_supabase.table.side_effect = table_router

        # Mock curate_session (imported directly in therapy.py)
        mocker.patch("app.routers.therapy.curate_session", new_callable=AsyncMock, return_value=[])

        response = client.post(
            "/api/therapy-sessions",
            json={
                "patient_id": mock_patient["id"],
                "voice_enabled": False,
            },
            headers={"Authorization": "Bearer fake-token"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["patient_id"] == mock_patient["id"]
        assert data["voice_enabled"] == False
        assert "id" in data

    def test_start_session_with_voice(
        self, client, override_get_current_user, mock_supabase, mock_supabase_response, mock_patient, mocker
    ):
        """Test starting session with voice therapy enabled."""
        session_data = {
            "id": "session-id",
            "patient_id": mock_patient["id"],
            "voice_enabled": True,
            "started_at": datetime.now(timezone.utc).isoformat(),
            "ended_at": None,
        }

        mock_patients_q = MagicMock()
        mock_patients_q.select.return_value.eq.return_value.single.return_value.execute.return_value = (
            mock_supabase_response(mock_patient)
        )

        mock_sessions_q = MagicMock()
        mock_sessions_q.insert.return_value.execute.return_value = (
            mock_supabase_response([session_data])
        )

        mock_media_q = MagicMock()
        mock_media_q.select.return_value.eq.return_value.eq.return_value.execute.return_value = (
            mock_supabase_response([])
        )

        mock_schedules_q = MagicMock()
        mock_schedules_q.select.return_value.eq.return_value.limit.return_value.execute.return_value = (
            mock_supabase_response([])
        )

        def table_router(name):
            if name == "patients":
                return mock_patients_q
            if name == "therapy_sessions":
                return mock_sessions_q
            if name == "media":
                return mock_media_q
            if name == "therapy_schedules":
                return mock_schedules_q
            return MagicMock()

        mock_supabase.table.side_effect = table_router
        mocker.patch("app.routers.therapy.curate_session", new_callable=AsyncMock, return_value=[])

        response = client.post(
            "/api/therapy-sessions",
            json={
                "patient_id": mock_patient["id"],
                "voice_enabled": True,
            },
            headers={"Authorization": "Bearer fake-token"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["voice_enabled"] == True

    def test_start_session_unauthorized(self, client, mock_supabase):
        """Test starting session without authentication."""
        response = client.post(
            "/api/therapy-sessions",
            json={
                "patient_id": "patient-id",
                "voice_enabled": False,
            },
        )

        assert response.status_code == 401

    def test_start_session_invalid_patient(
        self, client, override_get_current_user, mock_supabase, mock_supabase_response
    ):
        """Test starting session for non-existent patient."""
        # verify_patient_caregiver returns no data via .single()
        mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = (
            mock_supabase_response(None)
        )

        response = client.post(
            "/api/therapy-sessions",
            json={
                "patient_id": "invalid-patient-id",
                "voice_enabled": False,
            },
            headers={"Authorization": "Bearer fake-token"},
        )

        assert response.status_code in [403, 404]

    def test_end_session_success(
        self, client, override_get_current_user, mock_supabase, mock_supabase_response, mock_therapy_session, mock_patient
    ):
        """Test ending a therapy session with statistics."""
        # Endpoint calls .update().eq().execute() — no .single()
        ended_session = {
            "id": mock_therapy_session["id"],
            "patient_id": mock_patient["id"],
            "ended_at": datetime.now(timezone.utc).isoformat(),
            "photos_viewed": 15,
            "duration_seconds": 900,
            "completed_naturally": True,
        }
        mock_supabase.table.return_value.update.return_value.eq.return_value.execute.return_value = (
            mock_supabase_response([ended_session])
        )

        response = client.patch(
            f"/api/therapy-sessions/{mock_therapy_session['id']}/end",
            json={
                "photos_viewed": 15,
                "duration": 900,
                "completed_naturally": True,
            },
            headers={"Authorization": "Bearer fake-token"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["session"]["photos_viewed"] == 15
        assert data["session"]["duration_seconds"] == 900
        assert data["session"]["ended_at"] is not None

    def test_end_session_not_found(
        self, client, override_get_current_user, mock_supabase, mock_supabase_response
    ):
        """Test ending non-existent session."""
        # .update().eq().execute() returns empty
        mock_supabase.table.return_value.update.return_value.eq.return_value.execute.return_value = (
            mock_supabase_response([])
        )

        response = client.patch(
            "/api/therapy-sessions/non-existent-id/end",
            json={
                "photos_viewed": 10,
                "duration": 600,
                "completed_naturally": True,
            },
            headers={"Authorization": "Bearer fake-token"},
        )

        assert response.status_code == 404

    def test_get_session_history(
        self, client, override_get_current_user, mock_supabase, mock_supabase_response, mock_patient, mock_therapy_session
    ):
        """Test getting therapy session history for patient."""
        # Endpoint calls .select().eq().order().limit().execute()
        sessions = [
            mock_therapy_session,
            {
                **mock_therapy_session,
                "id": "session-2",
                "photos_shown": 20,
            }
        ]
        mock_supabase.table.return_value.select.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value = (
            mock_supabase_response(sessions)
        )

        response = client.get(
            f"/api/patients/{mock_patient['id']}/therapy-sessions",
            headers={"Authorization": "Bearer fake-token"},
        )

        assert response.status_code == 200
        data = response.json()
        assert "sessions" in data
        assert isinstance(data["sessions"], list)
        assert len(data["sessions"]) >= 2
        assert "stats" in data


@pytest.mark.integration
class TestTherapySchedules:
    """Test therapy schedule endpoints."""

    def test_create_schedule_success(
        self, client, override_get_current_user, mock_supabase, mock_supabase_response, mock_patient
    ):
        """Test creating a therapy schedule."""
        schedule_data = {
            "id": "schedule-id",
            "patient_id": mock_patient["id"],
            "session_duration": 20,
            "notification_minutes_before": 0,
            "sessions": [
                {"day_of_week": 1, "time_of_day": "14:00", "enabled": True}
            ],
        }
        mock_supabase.table.return_value.insert.return_value.execute.return_value = (
            mock_supabase_response([schedule_data])
        )

        response = client.post(
            "/api/therapy-schedules",
            json={
                "patient_id": mock_patient["id"],
                "session_duration": 20,
                "notification_minutes_before": 0,
                "sessions": [
                    {
                        "day_of_week": 1,
                        "time_of_day": "14:00",
                        "enabled": True,
                    }
                ],
            },
            headers={"Authorization": "Bearer fake-token"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["schedule"]["patient_id"] == mock_patient["id"]
        assert data["schedule"]["session_duration"] == 20

    @pytest.mark.xfail(reason="Endpoint missing access check — supporters should not create schedules")
    def test_create_schedule_supporter_forbidden(
        self, client, override_get_current_user_supporter, mock_supabase, mock_supabase_response, mock_patient
    ):
        """Test supporters cannot create therapy schedules."""
        schedule_data = {
            "id": "schedule-id",
            "patient_id": mock_patient["id"],
            "session_duration": 20,
            "sessions": [],
        }
        mock_supabase.table.return_value.insert.return_value.execute.return_value = (
            mock_supabase_response([schedule_data])
        )

        response = client.post(
            "/api/therapy-schedules",
            json={
                "patient_id": mock_patient["id"],
                "session_duration": 20,
                "sessions": [],
            },
            headers={"Authorization": "Bearer fake-token"},
        )

        assert response.status_code == 403

    def test_get_schedule_success(
        self, client, override_get_current_user, mock_supabase, mock_supabase_response, mock_patient
    ):
        """Test getting therapy schedule for patient."""
        schedule_data = {
            "id": "schedule-id",
            "patient_id": mock_patient["id"],
            "session_duration": 20,
        }
        # Endpoint uses .execute() (no .single()) and returns result.data[0]
        mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = (
            mock_supabase_response([schedule_data])
        )

        response = client.get(
            f"/api/patients/{mock_patient['id']}/therapy-schedule",
            headers={"Authorization": "Bearer fake-token"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["schedule"]["patient_id"] == mock_patient["id"]

    def test_get_schedule_not_found(
        self, client, override_get_current_user, mock_supabase, mock_supabase_response, mock_patient
    ):
        """Test getting schedule when none exists — returns null schedule."""
        mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = (
            mock_supabase_response([])
        )

        response = client.get(
            f"/api/patients/{mock_patient['id']}/therapy-schedule",
            headers={"Authorization": "Bearer fake-token"},
        )

        # Endpoint returns {"schedule": None} when no schedule exists
        assert response.status_code == 200
        data = response.json()
        assert data["schedule"] is None

    def test_update_schedule_success(
        self, client, override_get_current_user, mock_supabase, mock_supabase_response, mock_patient
    ):
        """Test updating therapy schedule."""
        mock_supabase.table.return_value.update.return_value.eq.return_value.execute.return_value = (
            mock_supabase_response([{"id": "schedule-id", "session_duration": 30}])
        )

        response = client.patch(
            "/api/therapy-schedules/schedule-id",
            json={"session_duration": 30},
            headers={"Authorization": "Bearer fake-token"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "Schedule updated"

    @pytest.mark.xfail(reason="Endpoint missing access check — supporters should not update schedules")
    def test_update_schedule_supporter_forbidden(
        self, client, override_get_current_user_supporter, mock_supabase, mock_supabase_response, mock_patient
    ):
        """Test supporters cannot update therapy schedules."""
        mock_supabase.table.return_value.update.return_value.eq.return_value.execute.return_value = (
            mock_supabase_response([{"id": "schedule-id"}])
        )

        response = client.patch(
            "/api/therapy-schedules/schedule-id",
            json={"session_duration": 30},
            headers={"Authorization": "Bearer fake-token"},
        )

        assert response.status_code == 403


@pytest.mark.integration
class TestSessionValidation:
    """Test session validation and business rules."""

    def test_start_session_missing_fields(
        self, client, override_get_current_user, mock_supabase
    ):
        """Test starting session with missing required fields."""
        response = client.post(
            "/api/therapy-sessions",
            json={
                # Missing patient_id
                "voice_enabled": False,
            },
            headers={"Authorization": "Bearer fake-token"},
        )

        assert response.status_code == 422

    def test_end_session_missing_stats(
        self, client, override_get_current_user, mock_supabase, mock_supabase_response, mock_therapy_session
    ):
        """Test ending session without statistics."""
        response = client.patch(
            f"/api/therapy-sessions/{mock_therapy_session['id']}/end",
            json={
                # Missing photos_viewed, duration, completed_naturally
            },
            headers={"Authorization": "Bearer fake-token"},
        )

        assert response.status_code == 422
