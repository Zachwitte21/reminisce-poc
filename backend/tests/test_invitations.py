# tests/test_invitations.py
"""
Tests for invitations router (app/routers/invitations.py).

Coverage:
- Create invitation (caregiver only)
- Accept invitation (supporter joins)
- Invitation code validation
- Email integration
"""

import pytest
from unittest.mock import MagicMock
from datetime import datetime, timedelta, timezone


@pytest.mark.integration
class TestCreateInvitation:
    """Test invitation creation endpoints."""

    def test_create_invitation_success(
        self,
        client,
        override_get_current_user,
        mock_supabase,
        mock_supabase_response,
        mock_email_service,
        mock_patient,
    ):
        """Test caregiver creating invitation for supporter."""
        # Service calls verify_patient_caregiver (.single()) then inserts invitation
        invitation_data = {
            "id": "invitation-id",
            "patient_id": mock_patient["id"],
            "email": "supporter@example.com",
            "invite_code": "ABCD-EFGH-IJKL",
            "personal_message": "Please join!",
            "status": "pending",
            "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

        mock_patients_q = MagicMock()
        mock_patients_q.select.return_value.eq.return_value.single.return_value.execute.return_value = (
            mock_supabase_response(mock_patient)
        )

        mock_invitations_q = MagicMock()
        mock_invitations_q.insert.return_value.execute.return_value = (
            mock_supabase_response([invitation_data])
        )

        def table_router(name):
            if name == "patients":
                return mock_patients_q
            if name == "invitations":
                return mock_invitations_q
            return MagicMock()

        mock_supabase.table.side_effect = table_router

        response = client.post(
            "/api/invitations/",
            json={
                "patient_id": mock_patient["id"],
                "email": "supporter@example.com",
                "personal_message": "Please join!",
            },
            headers={"Authorization": "Bearer fake-token"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["email"] == "supporter@example.com"
        assert "invite_code" in data

    def test_create_invitation_supporter_forbidden(
        self, client, override_get_current_user_supporter, mock_supabase, mock_supabase_response, mock_patient
    ):
        """Test supporters cannot create invitations — verify_patient_caregiver rejects them."""
        # verify_patient_caregiver checks caregiver_id match; supporter's ID won't match
        mock_patients_q = MagicMock()
        mock_patients_q.select.return_value.eq.return_value.single.return_value.execute.return_value = (
            mock_supabase_response(mock_patient)
        )

        mock_supabase.table.side_effect = lambda name: mock_patients_q if name == "patients" else MagicMock()

        response = client.post(
            "/api/invitations/",
            json={
                "patient_id": mock_patient["id"],
                "email": "another@example.com",
            },
            headers={"Authorization": "Bearer fake-token"},
        )

        assert response.status_code == 403

    def test_create_invitation_missing_fields(
        self, client, override_get_current_user, mock_supabase
    ):
        """Test creating invitation with missing required fields."""
        response = client.post(
            "/api/invitations/",
            json={
                # Missing patient_id, email
                "personal_message": "Join us!",
            },
            headers={"Authorization": "Bearer fake-token"},
        )

        assert response.status_code == 422

    def test_create_invitation_invalid_email(
        self, client, override_get_current_user, mock_supabase, mock_supabase_response, mock_patient
    ):
        """Test creating invitation with invalid email format."""
        response = client.post(
            "/api/invitations/",
            json={
                "patient_id": mock_patient["id"],
                "email": "not-an-email",
            },
            headers={"Authorization": "Bearer fake-token"},
        )

        assert response.status_code == 422

    def test_create_invitation_invalid_patient(
        self, client, override_get_current_user, mock_supabase, mock_supabase_response
    ):
        """Test creating invitation for non-existent patient."""
        # verify_patient_caregiver returns no data
        mock_patients_q = MagicMock()
        mock_patients_q.select.return_value.eq.return_value.single.return_value.execute.return_value = (
            mock_supabase_response(None)
        )
        mock_supabase.table.side_effect = lambda name: mock_patients_q if name == "patients" else MagicMock()

        response = client.post(
            "/api/invitations/",
            json={
                "patient_id": "invalid-patient-id",
                "email": "supporter@example.com",
            },
            headers={"Authorization": "Bearer fake-token"},
        )

        assert response.status_code in [403, 404]


@pytest.mark.integration
class TestAcceptInvitation:
    """Test invitation acceptance endpoints."""

    def test_accept_invitation_success(
        self,
        client,
        mock_supabase,
        mock_supabase_response,
        mock_invitation,
    ):
        """Test accepting invitation — creates new supporter account."""
        # Add required fields for the service
        invitation_with_expiry = {
            **mock_invitation,
            "invite_code": mock_invitation["code"],
            "status": "pending",
            "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        }

        # Table routing for the complex accept flow
        mock_invitations_q = MagicMock()
        # select().eq().eq().execute() — service queries by invite_code and status
        mock_invitations_q.select.return_value.eq.return_value.eq.return_value.execute.return_value = (
            mock_supabase_response([invitation_with_expiry])
        )
        # update().eq().execute() — mark as accepted
        mock_invitations_q.update.return_value.eq.return_value.execute.return_value = (
            mock_supabase_response([{**invitation_with_expiry, "status": "accepted"}])
        )

        mock_profiles_q = MagicMock()
        mock_profiles_q.select.return_value.eq.return_value.execute.return_value = (
            mock_supabase_response([])
        )
        mock_profiles_q.insert.return_value.execute.return_value = (
            mock_supabase_response([{"id": "new-user-id"}])
        )

        mock_supporters_q = MagicMock()
        mock_supporters_q.select.return_value.eq.return_value.eq.return_value.execute.return_value = (
            mock_supabase_response([])
        )
        mock_supporters_q.insert.return_value.execute.return_value = (
            mock_supabase_response([{"patient_id": mock_invitation["patient_id"], "supporter_id": "new-user-id"}])
        )

        def table_router(name):
            if name == "invitations":
                return mock_invitations_q
            if name == "profiles":
                return mock_profiles_q
            if name == "patient_supporters":
                return mock_supporters_q
            return MagicMock()

        mock_supabase.table.side_effect = table_router

        # Mock auth.sign_up for new account creation
        mock_auth_response = MagicMock()
        mock_auth_response.user = MagicMock(id="new-user-id")
        mock_supabase.auth.sign_up.return_value = mock_auth_response

        response = client.post(
            f"/api/invitations/{mock_invitation['code']}/accept",
            json={
                "email": "newsupporter@example.com",
                "password": "SecurePass123!",
                "full_name": "New Supporter",
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "Invitation accepted"
        assert "user_id" in data

    def test_accept_invitation_not_found(
        self, client, mock_supabase, mock_supabase_response
    ):
        """Test accepting non-existent invitation code."""
        # Invitations query returns empty
        mock_invitations_q = MagicMock()
        mock_invitations_q.select.return_value.eq.return_value.eq.return_value.execute.return_value = (
            mock_supabase_response([])
        )
        mock_supabase.table.side_effect = lambda name: mock_invitations_q if name == "invitations" else MagicMock()

        response = client.post(
            "/api/invitations/INVALID-CODE/accept",
            json={
                "email": "test@example.com",
                "password": "SecurePass123!",
                "full_name": "Test User",
            },
        )

        assert response.status_code == 404

    def test_accept_invitation_already_used(
        self,
        client,
        mock_supabase,
        mock_supabase_response,
        mock_invitation,
    ):
        """Test accepting already used invitation — query filters by status=pending so returns empty."""
        # The service queries .eq("status", "pending") — used invitations have status "accepted"
        mock_invitations_q = MagicMock()
        mock_invitations_q.select.return_value.eq.return_value.eq.return_value.execute.return_value = (
            mock_supabase_response([])
        )
        mock_supabase.table.side_effect = lambda name: mock_invitations_q if name == "invitations" else MagicMock()

        response = client.post(
            f"/api/invitations/{mock_invitation['code']}/accept",
            json={
                "email": "test@example.com",
                "password": "SecurePass123!",
                "full_name": "Test User",
            },
        )

        # Returns 404 because the pending-status filter returns no results
        assert response.status_code == 404

    def test_accept_invitation_no_auth_required(self, client, mock_supabase, mock_supabase_response):
        """Test accept endpoint works without auth (returns 404 for invalid code, not 401)."""
        mock_invitations_q = MagicMock()
        mock_invitations_q.select.return_value.eq.return_value.eq.return_value.execute.return_value = (
            mock_supabase_response([])
        )
        mock_supabase.table.side_effect = lambda name: mock_invitations_q if name == "invitations" else MagicMock()

        response = client.post(
            "/api/invitations/ABCD-EFGH-IJKL/accept",
            json={
                "email": "test@example.com",
                "password": "SecurePass123!",
                "full_name": "Test User",
            },
        )

        # Endpoint does not require auth — invalid code returns 404, not 401
        assert response.status_code == 404

    def test_accept_invitation_invalid_code_with_auth(
        self, client, override_get_current_user, mock_supabase, mock_supabase_response, mock_invitation
    ):
        """Test accepting invitation with invalid code returns 404 regardless of auth state."""
        mock_invitations_q = MagicMock()
        mock_invitations_q.select.return_value.eq.return_value.eq.return_value.execute.return_value = (
            mock_supabase_response([])
        )
        mock_supabase.table.side_effect = lambda name: mock_invitations_q if name == "invitations" else MagicMock()

        response = client.post(
            f"/api/invitations/{mock_invitation['code']}/accept",
            json={
                "email": "caregiver@example.com",
                "password": "SecurePass123!",
                "full_name": "Caregiver Name",
            },
        )

        assert response.status_code == 404


@pytest.mark.integration
class TestInvitationValidation:
    """Test invitation validation and business rules."""

    def test_invitation_code_format(
        self, client, override_get_current_user, mock_supabase, mock_supabase_response, mock_patient, mock_email_service
    ):
        """Test invitation code is generated in correct format."""
        invitation_data = {
            "id": "invitation-id",
            "patient_id": mock_patient["id"],
            "email": "test@example.com",
            "invite_code": "ABCD-EFGH-IJKL",
            "status": "pending",
            "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

        mock_patients_q = MagicMock()
        mock_patients_q.select.return_value.eq.return_value.single.return_value.execute.return_value = (
            mock_supabase_response(mock_patient)
        )

        mock_invitations_q = MagicMock()
        mock_invitations_q.insert.return_value.execute.return_value = (
            mock_supabase_response([invitation_data])
        )

        def table_router(name):
            if name == "patients":
                return mock_patients_q
            if name == "invitations":
                return mock_invitations_q
            return MagicMock()

        mock_supabase.table.side_effect = table_router

        response = client.post(
            "/api/invitations/",
            json={
                "patient_id": mock_patient["id"],
                "email": "test@example.com",
            },
            headers={"Authorization": "Bearer fake-token"},
        )

        assert response.status_code == 200
        data = response.json()
        # invite_code should be present (generated by service)
        assert "invite_code" in data
        assert len(data["invite_code"]) >= 8

    def test_create_multiple_invitations_same_patient(
        self,
        client,
        override_get_current_user,
        mock_supabase,
        mock_supabase_response,
        mock_patient,
        mock_email_service,
    ):
        """Test creating multiple invitations for same patient is allowed."""
        mock_patients_q = MagicMock()
        mock_patients_q.select.return_value.eq.return_value.single.return_value.execute.return_value = (
            mock_supabase_response(mock_patient)
        )

        invitation1 = {
            "id": "inv-1",
            "patient_id": mock_patient["id"],
            "email": "user1@example.com",
            "invite_code": "CODE-ONE-XXXX",
            "status": "pending",
            "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        invitation2 = {
            "id": "inv-2",
            "patient_id": mock_patient["id"],
            "email": "user2@example.com",
            "invite_code": "CODE-TWO-YYYY",
            "status": "pending",
            "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

        mock_invitations_q = MagicMock()

        def table_router(name):
            if name == "patients":
                return mock_patients_q
            if name == "invitations":
                return mock_invitations_q
            return MagicMock()

        mock_supabase.table.side_effect = table_router

        # First invitation
        mock_invitations_q.insert.return_value.execute.return_value = (
            mock_supabase_response([invitation1])
        )

        response1 = client.post(
            "/api/invitations/",
            json={
                "patient_id": mock_patient["id"],
                "email": "user1@example.com",
            },
            headers={"Authorization": "Bearer fake-token"},
        )
        assert response1.status_code == 200

        # Second invitation
        mock_invitations_q.insert.return_value.execute.return_value = (
            mock_supabase_response([invitation2])
        )

        response2 = client.post(
            "/api/invitations/",
            json={
                "patient_id": mock_patient["id"],
                "email": "user2@example.com",
            },
            headers={"Authorization": "Bearer fake-token"},
        )
        assert response2.status_code == 200

        # Both should have invite_code
        assert "invite_code" in response1.json()
        assert "invite_code" in response2.json()
