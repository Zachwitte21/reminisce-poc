# tests/test_auth.py
"""
Tests for authentication router (app/routers/auth.py).

Coverage:
- User registration (success, validation errors, duplicate email)
- User login (success, wrong password, non-existent user)
- Get current user profile
- Avatar upload
"""

import pytest
from unittest.mock import MagicMock


@pytest.mark.auth
class TestRegistration:
    """Test user registration endpoints."""

    def test_register_caregiver_success(self, client, mock_supabase, mock_supabase_response):
        """Test successful caregiver registration."""
        # Mock Supabase auth.sign_up response
        mock_auth_response = MagicMock()
        mock_auth_response.user = MagicMock(id="new-user-id", email="test@example.com")
        mock_supabase.auth.sign_up.return_value = mock_auth_response

        # Mock profile creation
        profile_data = {
            "id": "new-user-id",
            "email": "test@example.com",
            "full_name": "Test Caregiver",
            "role": "caregiver",
        }
        mock_supabase.table.return_value.insert.return_value.execute.return_value = (
            mock_supabase_response([profile_data])
        )

        # Make request
        response = client.post(
            "/api/auth/register",
            json={
                "email": "test@example.com",
                "password": "SecurePass123!",
                "full_name": "Test Caregiver",
                "role": "caregiver",
            },
        )

        # Assertions
        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "User registered successfully"
        assert data["user_id"] == "new-user-id"

    def test_register_supporter_success(self, client, mock_supabase, mock_supabase_response):
        """Test successful supporter registration."""
        mock_auth_response = MagicMock()
        mock_auth_response.user = MagicMock(id="supporter-id", email="supporter@example.com")
        mock_supabase.auth.sign_up.return_value = mock_auth_response

        profile_data = {
            "id": "supporter-id",
            "email": "supporter@example.com",
            "full_name": "Test Supporter",
            "role": "supporter",
        }
        mock_supabase.table.return_value.insert.return_value.execute.return_value = (
            mock_supabase_response([profile_data])
        )

        response = client.post(
            "/api/auth/register",
            json={
                "email": "supporter@example.com",
                "password": "SecurePass123!",
                "full_name": "Test Supporter",
                "role": "supporter",
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "User registered successfully"
        assert data["user_id"] == "supporter-id"

    def test_register_invalid_email(self, client, mock_supabase):
        """Test registration with invalid email format."""
        response = client.post(
            "/api/auth/register",
            json={
                "email": "not-an-email",
                "password": "SecurePass123!",
                "full_name": "Test User",
                "role": "caregiver",
            },
        )

        assert response.status_code == 422  # Validation error

    def test_register_weak_password(self, client, mock_supabase):
        """Test registration with weak password."""
        response = client.post(
            "/api/auth/register",
            json={
                "email": "test@example.com",
                "password": "123",  # Too short
                "full_name": "Test User",
                "role": "caregiver",
            },
        )

        assert response.status_code == 422

    def test_register_missing_fields(self, client, mock_supabase):
        """Test registration with missing required fields."""
        response = client.post(
            "/api/auth/register",
            json={
                "email": "test@example.com",
                # Missing password, full_name, role
            },
        )

        assert response.status_code == 422

    def test_register_invalid_role(self, client, mock_supabase):
        """Test registration with invalid role."""
        response = client.post(
            "/api/auth/register",
            json={
                "email": "test@example.com",
                "password": "SecurePass123!",
                "full_name": "Test User",
                "role": "admin",  # Invalid role
            },
        )

        assert response.status_code == 422

    def test_register_duplicate_email(self, client, mock_supabase):
        """Test registration with already registered email."""
        # Mock Supabase auth.sign_up to raise error
        mock_supabase.auth.sign_up.side_effect = Exception("User already registered")

        response = client.post(
            "/api/auth/register",
            json={
                "email": "existing@example.com",
                "password": "SecurePass123!",
                "full_name": "Test User",
                "role": "caregiver",
            },
        )

        assert response.status_code == 400


@pytest.mark.auth
class TestLogin:
    """Test user login endpoints."""

    def test_login_success(self, client, mock_supabase, mock_supabase_response, mock_caregiver_user):
        """Test successful login."""
        # Mock Supabase auth.sign_in_with_password
        mock_session = MagicMock()
        mock_session.access_token = "fake-jwt-token"

        mock_auth_response = MagicMock()
        mock_auth_response.session = mock_session
        mock_auth_response.user = MagicMock(
            id=mock_caregiver_user["id"],
            email=mock_caregiver_user["email"],
        )
        mock_supabase.auth.sign_in_with_password.return_value = mock_auth_response

        # Mock profile fetch
        mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = (
            mock_supabase_response(mock_caregiver_user)
        )

        response = client.post(
            "/api/auth/login",
            json={
                "email": mock_caregiver_user["email"],
                "password": "CorrectPassword123!",
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["access_token"] == "fake-jwt-token"
        assert data["token_type"] == "bearer"
        assert data["user"]["email"] == mock_caregiver_user["email"]
        assert data["user"]["role"] == "caregiver"

    def test_login_wrong_password(self, client, mock_supabase):
        """Test login with incorrect password."""
        mock_supabase.auth.sign_in_with_password.side_effect = Exception("Invalid credentials")

        response = client.post(
            "/api/auth/login",
            json={
                "email": "test@example.com",
                "password": "WrongPassword123!",
            },
        )

        assert response.status_code in [400, 401]

    def test_login_nonexistent_user(self, client, mock_supabase):
        """Test login with non-existent email."""
        mock_supabase.auth.sign_in_with_password.side_effect = Exception("User not found")

        response = client.post(
            "/api/auth/login",
            json={
                "email": "nonexistent@example.com",
                "password": "Password123!",
            },
        )

        assert response.status_code in [400, 401]

    def test_login_missing_email(self, client, mock_supabase):
        """Test login with missing email."""
        response = client.post(
            "/api/auth/login",
            json={
                "password": "Password123!",
            },
        )

        assert response.status_code == 422

    def test_login_missing_password(self, client, mock_supabase):
        """Test login with missing password."""
        response = client.post(
            "/api/auth/login",
            json={
                "email": "test@example.com",
            },
        )

        assert response.status_code == 422


@pytest.mark.auth
class TestGetProfile:
    """Test get current user profile endpoint."""

    def test_get_profile_success(
        self, client, override_get_current_user, mock_supabase, mock_supabase_response, mock_caregiver_user
    ):
        """Test getting current user profile."""
        # Mock profile fetch
        mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = (
            mock_supabase_response(mock_caregiver_user)
        )

        response = client.get(
            "/api/auth/me",
            headers={"Authorization": "Bearer fake-token"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["email"] == mock_caregiver_user["email"]
        assert data["role"] == "caregiver"

    def test_get_profile_unauthorized(self, client, mock_supabase):
        """Test getting profile without authentication."""
        response = client.get("/api/auth/me")

        assert response.status_code == 401


@pytest.mark.auth
class TestAvatarUpload:
    """Test user avatar upload endpoint."""

    def test_upload_avatar_success(
        self,
        client,
        override_get_current_user,
        mock_supabase,
        mock_supabase_response,
        mock_storage_service,
        fake_image_upload,
        mock_caregiver_user,
    ):
        """Test successful avatar upload."""
        # Mock storage upload
        avatar_path = f"profile/{mock_caregiver_user['id']}.jpg"

        # Mock profile update (upload_avatar calls .update().eq().execute())
        mock_supabase.table.return_value.update.return_value.eq.return_value.execute.return_value = (
            mock_supabase_response({"id": mock_caregiver_user["id"], "avatar_url": avatar_path})
        )

        # Mock profile fetch for get_me() which calls .select().eq().single().execute()
        updated_profile = {**mock_caregiver_user, "avatar_url": avatar_path}
        mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = (
            mock_supabase_response(updated_profile)
        )

        response = client.post(
            "/api/auth/avatar",
            files={"file": fake_image_upload},
            headers={"Authorization": "Bearer fake-token"},
        )

        assert response.status_code == 200
        data = response.json()
        assert "avatar_url" in data

    def test_upload_avatar_no_file(self, client, override_get_current_user, mock_supabase):
        """Test avatar upload without file."""
        response = client.post(
            "/api/auth/avatar",
            headers={"Authorization": "Bearer fake-token"},
        )

        assert response.status_code == 422

    def test_upload_avatar_unauthorized(self, client, mock_supabase):
        """Test avatar upload without authentication."""
        response = client.post(
            "/api/auth/avatar",
            files={"file": ("test.jpg", b"data", "image/jpeg")},
        )

        assert response.status_code == 401

    def test_upload_avatar_invalid_file_type(
        self, client, override_get_current_user, mock_supabase
    ):
        """Test avatar upload with invalid file type."""
        response = client.post(
            "/api/auth/avatar",
            files={"file": ("test.txt", b"text data", "text/plain")},
            headers={"Authorization": "Bearer fake-token"},
        )

        # Depending on implementation, this might be 400 or 422
        assert response.status_code in [400, 422]
