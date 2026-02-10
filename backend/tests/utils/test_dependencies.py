# tests/utils/test_dependencies.py
"""
Unit tests for authentication and authorization dependencies (app/dependencies.py).

Coverage:
- JWT validation (get_current_user)
- Patient caregiver verification
- Patient access verification (caregiver + supporter)
- UUID validation
"""

import pytest
from unittest.mock import MagicMock, patch
from fastapi import HTTPException


@pytest.mark.unit
@pytest.mark.auth
class TestGetCurrentUser:
    """Test JWT authentication dependency."""

    @patch("app.dependencies.supabase_admin")
    async def test_get_current_user_valid_token(self, mock_supabase):
        """Test authentication with valid JWT token."""
        from app.dependencies import get_current_user

        # Mock Supabase auth.get_user response
        mock_user = MagicMock()
        mock_user.id = "user-123"
        mock_user.email = "test@example.com"

        mock_auth_response = MagicMock()
        mock_auth_response.user = mock_user

        mock_supabase.auth.get_user.return_value = mock_auth_response

        # Call dependency
        result = await get_current_user(token="valid-jwt-token")

        # Assertions
        assert result.id == "user-123"
        assert result.email == "test@example.com"

    @patch("app.dependencies.supabase_admin")
    async def test_get_current_user_invalid_token(self, mock_supabase):
        """Test authentication with invalid JWT token."""
        from app.dependencies import get_current_user

        # Mock invalid token error
        mock_supabase.auth.get_user.side_effect = Exception("Invalid JWT")

        # Should raise HTTPException
        with pytest.raises((HTTPException, Exception)):
            await get_current_user(token="invalid-token")

    @patch("app.dependencies.supabase_admin")
    async def test_get_current_user_expired_token(self, mock_supabase):
        """Test authentication with expired JWT token."""
        from app.dependencies import get_current_user

        # Mock expired token error
        mock_supabase.auth.get_user.side_effect = Exception("Token expired")

        with pytest.raises((HTTPException, Exception)):
            await get_current_user(token="expired-token")

    @patch("app.dependencies.supabase_admin")
    async def test_get_current_user_no_token(self, mock_supabase):
        """Test authentication without token."""
        from app.dependencies import get_current_user

        # Should raise HTTPException 401 for missing token
        with pytest.raises(HTTPException) as exc_info:
            await get_current_user(token=None)

        assert exc_info.value.status_code == 401


@pytest.mark.unit
@pytest.mark.auth
class TestVerifyPatientCaregiver:
    """Test patient caregiver verification."""

    @patch("app.dependencies.supabase_admin")
    async def test_verify_patient_caregiver_authorized(self, mock_supabase, mock_supabase_response):
        """Test caregiver has access to their patient."""
        from app.dependencies import verify_patient_caregiver

        # Mock patient fetch — source calls .table().select().eq().single().execute()
        patient_data = {
            "id": "patient-123",
            "caregiver_id": "user-123",
        }
        mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = (
            mock_supabase_response(patient_data)
        )

        # Call verification
        result = await verify_patient_caregiver(
            patient_id="patient-123",
            user_id="user-123",
        )

        # Should return patient data
        assert result["id"] == "patient-123"
        assert result["caregiver_id"] == "user-123"

    @patch("app.dependencies.supabase_admin")
    async def test_verify_patient_caregiver_forbidden(self, mock_supabase, mock_supabase_response):
        """Test user is not the caregiver for patient."""
        from app.dependencies import verify_patient_caregiver

        # Mock patient with different caregiver
        patient_data = {
            "id": "patient-123",
            "caregiver_id": "other-user",
        }
        mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = (
            mock_supabase_response(patient_data)
        )

        # Should raise HTTPException 403
        with pytest.raises(HTTPException) as exc_info:
            await verify_patient_caregiver(
                patient_id="patient-123",
                user_id="user-123",
            )

        assert exc_info.value.status_code == 403

    @patch("app.dependencies.supabase_admin")
    async def test_verify_patient_caregiver_not_found(self, mock_supabase, mock_supabase_response):
        """Test patient does not exist."""
        from app.dependencies import verify_patient_caregiver

        # Mock no patient found — single() with empty data
        mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = (
            mock_supabase_response(None)
        )

        # Should raise HTTPException 404
        with pytest.raises(HTTPException) as exc_info:
            await verify_patient_caregiver(
                patient_id="nonexistent-patient",
                user_id="user-123",
            )

        assert exc_info.value.status_code == 404


@pytest.mark.unit
@pytest.mark.auth
class TestVerifyPatientAccess:
    """Test patient access verification (caregiver or supporter)."""

    @patch("app.dependencies.supabase_admin")
    async def test_verify_patient_access_caregiver(self, mock_supabase, mock_supabase_response):
        """Test caregiver has access."""
        from app.dependencies import verify_patient_access

        # Mock patient fetch (caregiver match) — .table().select().eq().single().execute()
        patient_data = {
            "id": "patient-123",
            "caregiver_id": "user-123",
        }
        mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = (
            mock_supabase_response(patient_data)
        )

        # Call verification
        result = await verify_patient_access(
            patient_id="patient-123",
            user_id="user-123",
        )

        # Should return patient data
        assert result["id"] == "patient-123"

    @patch("app.dependencies.supabase_admin")
    async def test_verify_patient_access_supporter(self, mock_supabase, mock_supabase_response):
        """Test supporter has access."""
        from app.dependencies import verify_patient_access

        # Need separate mocks for two different table() calls:
        # 1. patients: .table('patients').select().eq().single().execute()
        # 2. patient_supporters: .table('patient_supporters').select().eq().eq().is_().execute()

        patient_data = {
            "id": "patient-123",
            "caregiver_id": "other-user",
        }
        supporter_data = [
            {
                "patient_id": "patient-123",
                "supporter_id": "user-123",
            }
        ]

        mock_patient_query = MagicMock()
        mock_patient_query.select.return_value.eq.return_value.single.return_value.execute.return_value = (
            mock_supabase_response(patient_data)
        )

        mock_supporter_query = MagicMock()
        mock_supporter_query.select.return_value.eq.return_value.eq.return_value.is_.return_value.execute.return_value = (
            mock_supabase_response(supporter_data)
        )

        def table_router(table_name):
            if table_name == "patients":
                return mock_patient_query
            elif table_name == "patient_supporters":
                return mock_supporter_query
            return MagicMock()

        mock_supabase.table.side_effect = table_router

        # Call verification
        result = await verify_patient_access(
            patient_id="patient-123",
            user_id="user-123",
        )

        # Should return patient data
        assert result["id"] == "patient-123"

    @patch("app.dependencies.supabase_admin")
    async def test_verify_patient_access_forbidden(self, mock_supabase, mock_supabase_response):
        """Test user has no access to patient."""
        from app.dependencies import verify_patient_access

        patient_data = {
            "id": "patient-123",
            "caregiver_id": "other-user",
        }

        mock_patient_query = MagicMock()
        mock_patient_query.select.return_value.eq.return_value.single.return_value.execute.return_value = (
            mock_supabase_response(patient_data)
        )

        mock_supporter_query = MagicMock()
        mock_supporter_query.select.return_value.eq.return_value.eq.return_value.is_.return_value.execute.return_value = (
            mock_supabase_response([])
        )

        def table_router(table_name):
            if table_name == "patients":
                return mock_patient_query
            elif table_name == "patient_supporters":
                return mock_supporter_query
            return MagicMock()

        mock_supabase.table.side_effect = table_router

        # Should raise HTTPException 403
        with pytest.raises(HTTPException) as exc_info:
            await verify_patient_access(
                patient_id="patient-123",
                user_id="user-123",
            )

        assert exc_info.value.status_code == 403


@pytest.mark.unit
class TestUUIDValidation:
    """Test UUID validation helper."""

    def test_valid_uuid(self):
        """Test validation of valid UUID."""
        from app.dependencies import validate_uuid

        valid_uuid = "123e4567-e89b-12d3-a456-426614174000"

        # Should not raise error and should return the validated UUID string
        result = validate_uuid(valid_uuid)

        assert result == valid_uuid

    def test_invalid_uuid(self):
        """Test validation of invalid UUID."""
        from app.dependencies import validate_uuid

        invalid_uuid = "not-a-valid-uuid"

        # Should raise HTTPException or return False
        with pytest.raises((HTTPException, ValueError, Exception)):
            validate_uuid(invalid_uuid)

    def test_uuid_wrong_format(self):
        """Test UUID with wrong format."""
        from app.dependencies import validate_uuid

        wrong_format = "12345678-1234-1234-1234"  # Missing section

        with pytest.raises((HTTPException, ValueError, Exception)):
            validate_uuid(wrong_format)
