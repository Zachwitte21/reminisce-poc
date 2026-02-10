# tests/conftest.py
"""
Shared pytest fixtures for Reminisce Backend tests.

This module provides fixtures for:
- FastAPI app and test client
- Mock Supabase client and responses
- Mock authenticated users (caregivers, supporters)
- Mock database records (patients, media, sessions)
- Mock external services (Gemini AI, Storage, Email)
"""

import io
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List
from unittest.mock import MagicMock, AsyncMock

import pytest
from fastapi.testclient import TestClient
from faker import Faker

from app.main import app
from app.models.schemas import UserRole, MediaStatus, TagType

# Initialize Faker for test data generation
fake = Faker()


# ============================================================================
# Application Fixtures
# ============================================================================

@pytest.fixture
def test_app():
    """FastAPI application instance for testing."""
    return app


@pytest.fixture
def client(test_app):
    """TestClient for making HTTP requests to the app."""
    return TestClient(test_app)


# ============================================================================
# Mock User Fixtures
# ============================================================================

@pytest.fixture
def mock_caregiver_user() -> Dict[str, Any]:
    """Mock authenticated caregiver user."""
    user_id = str(uuid.uuid4())
    return {
        "id": user_id,
        "email": fake.email(),
        "full_name": fake.name(),
        "role": UserRole.caregiver.value,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }


@pytest.fixture
def mock_supporter_user() -> Dict[str, Any]:
    """Mock authenticated supporter user."""
    user_id = str(uuid.uuid4())
    return {
        "id": user_id,
        "email": fake.email(),
        "full_name": fake.name(),
        "role": UserRole.supporter.value,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }


@pytest.fixture
def mock_auth_user(mock_caregiver_user) -> MagicMock:
    """Mock Supabase auth user object (default: caregiver)."""
    mock_user = MagicMock()
    mock_user.id = mock_caregiver_user["id"]
    mock_user.email = mock_caregiver_user["email"]
    return mock_user


# ============================================================================
# Mock Database Record Fixtures
# ============================================================================

@pytest.fixture
def mock_patient(mock_caregiver_user) -> Dict[str, Any]:
    """Mock patient record."""
    patient_id = str(uuid.uuid4())
    return {
        "id": patient_id,
        "caregiver_id": mock_caregiver_user["id"],
        "first_name": fake.first_name(),
        "last_name": fake.last_name(),
        "birth_date": "1945-06-15",
        "relationship": "Mother",
        "photo_url": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }


@pytest.fixture
def mock_patient_settings(mock_patient) -> Dict[str, Any]:
    """Mock patient settings record."""
    return {
        "patient_id": mock_patient["id"],
        "require_photo_approval": True,
        "voice_therapy_enabled": False,
        "voice_speed": "normal",
        "settings_pin": "1234",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }


@pytest.fixture
def mock_media(mock_patient, mock_caregiver_user) -> Dict[str, Any]:
    """Mock media record."""
    media_id = str(uuid.uuid4())
    return {
        "id": media_id,
        "patient_id": mock_patient["id"],
        "uploaded_by": mock_caregiver_user["id"],
        "file_path": f"media/{mock_patient['id']}/{media_id}.jpg",
        "file_type": "image/jpeg",
        "file_size": 1024000,  # 1MB
        "caption": "Family gathering",
        "taken_date": "2020-05-15",
        "status": MediaStatus.approved.value,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }


@pytest.fixture
def mock_media_tag(mock_media) -> Dict[str, Any]:
    """Mock media tag record."""
    tag_id = str(uuid.uuid4())
    return {
        "id": tag_id,
        "media_id": mock_media["id"],
        "type": TagType.person.value,
        "value": "John Smith",
        "confidence": 0.95,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }


@pytest.fixture
def mock_therapy_session(mock_patient, mock_caregiver_user) -> Dict[str, Any]:
    """Mock therapy session record."""
    session_id = str(uuid.uuid4())
    return {
        "id": session_id,
        "patient_id": mock_patient["id"],
        "started_by": mock_caregiver_user["id"],
        "voice_enabled": False,
        "started_at": datetime.now(timezone.utc).isoformat(),
        "ended_at": None,
        "photos_shown": 0,
        "session_duration_seconds": 0,
    }


@pytest.fixture
def mock_invitation(mock_patient, mock_caregiver_user) -> Dict[str, Any]:
    """Mock invitation record."""
    invitation_id = str(uuid.uuid4())
    return {
        "id": invitation_id,
        "patient_id": mock_patient["id"],
        "created_by": mock_caregiver_user["id"],
        "code": fake.bothify(text="????-????-????").upper(),
        "email": fake.email(),
        "personal_message": "Please join to share photos!",
        "used": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }


# ============================================================================
# Mock Supabase Client
# ============================================================================

@pytest.fixture
def mock_supabase_response():
    """Factory for creating mock Supabase query responses."""
    def _create_response(data: Any = None, error: Any = None):
        """Create a mock Supabase response object."""
        response = MagicMock()
        response.data = data if data is not None else []
        response.error = error
        return response
    return _create_response


@pytest.fixture
def mock_supabase(mocker, mock_supabase_response):
    """
    Mock Supabase admin client.

    Provides mocked responses for common query patterns:
    - table().select().eq().execute()
    - table().insert().execute()
    - table().update().eq().execute()
    - table().delete().eq().execute()
    - auth.get_user()
    - storage.from_().upload()
    - storage.from_().create_signed_url()
    """
    mock_client = MagicMock()

    # Mock query builder chain
    mock_query = MagicMock()
    mock_query.select.return_value = mock_query
    mock_query.insert.return_value = mock_query
    mock_query.update.return_value = mock_query
    mock_query.delete.return_value = mock_query
    mock_query.eq.return_value = mock_query
    mock_query.neq.return_value = mock_query
    mock_query.in_.return_value = mock_query
    mock_query.is_.return_value = mock_query
    mock_query.gte.return_value = mock_query
    mock_query.lte.return_value = mock_query
    mock_query.order.return_value = mock_query
    mock_query.limit.return_value = mock_query
    mock_query.single.return_value = mock_query
    mock_query.execute.return_value = mock_supabase_response([])

    # Mock table() method
    mock_client.table.return_value = mock_query

    # Mock auth
    mock_auth = MagicMock()
    mock_auth.get_user.return_value = MagicMock(user=None)
    mock_auth.sign_up.return_value = mock_supabase_response()
    mock_auth.sign_in_with_password.return_value = mock_supabase_response()
    mock_client.auth = mock_auth

    # Mock storage
    mock_storage_bucket = MagicMock()
    mock_storage_bucket.upload.return_value = mock_supabase_response()
    mock_storage_bucket.download.return_value = b"fake_file_data"
    mock_storage_bucket.remove.return_value = mock_supabase_response()
    mock_storage_bucket.create_signed_url.return_value = {
        "signedURL": f"https://example.com/signed-url/{uuid.uuid4()}"
    }

    mock_storage = MagicMock()
    mock_storage.from_.return_value = mock_storage_bucket
    mock_client.storage = mock_storage

    # Patch the global supabase_admin client
    mocker.patch("app.dependencies.supabase_admin", mock_client)

    # Patch routers that directly import supabase_admin
    # Note: Not all routers import it directly - some use services
    try:
        mocker.patch("app.routers.auth.supabase_admin", mock_client)
    except AttributeError:
        pass

    try:
        mocker.patch("app.routers.patients.supabase_admin", mock_client)
    except AttributeError:
        pass

    try:
        mocker.patch("app.routers.media.supabase_admin", mock_client)
    except AttributeError:
        pass

    try:
        mocker.patch("app.routers.therapy.supabase_admin", mock_client)
    except AttributeError:
        pass

    try:
        mocker.patch("app.routers.voice.supabase_admin", mock_client)
    except AttributeError:
        pass

    # Also patch services that use supabase_admin
    mocker.patch("app.services.invitations_service.supabase_admin", mock_client)
    mocker.patch("app.services.storage_service.supabase_admin", mock_client)

    return mock_client


# ============================================================================
# Authentication Dependency Overrides
# ============================================================================

@pytest.fixture
def override_get_current_user(test_app, mock_caregiver_user):
    """
    Override get_current_user dependency to return mock user.

    Usage in tests:
        def test_protected_endpoint(client, override_get_current_user):
            response = client.get("/api/protected")
            assert response.status_code == 200
    """
    from app.dependencies import get_current_user

    async def _override():
        # Return a mock user object with the same structure as Supabase user
        mock_user = MagicMock()
        mock_user.id = mock_caregiver_user["id"]
        mock_user.email = mock_caregiver_user["email"]
        mock_user.user_metadata = {"role": "caregiver"}
        return mock_user

    test_app.dependency_overrides[get_current_user] = _override

    yield _override

    # Cleanup
    test_app.dependency_overrides.clear()


@pytest.fixture
def override_get_current_user_supporter(test_app, mock_supporter_user):
    """Override get_current_user to return a supporter user."""
    from app.dependencies import get_current_user

    async def _override():
        mock_user = MagicMock()
        mock_user.id = mock_supporter_user["id"]
        mock_user.email = mock_supporter_user["email"]
        mock_user.user_metadata = {"role": "supporter"}
        return mock_user

    test_app.dependency_overrides[get_current_user] = _override

    yield _override

    test_app.dependency_overrides.clear()


# ============================================================================
# Mock External Services
# ============================================================================

@pytest.fixture
def mock_gemini_client(mocker):
    """
    Mock Google Gemini AI client.

    Mocks:
    - google.generativeai.configure()
    - google.generativeai.GenerativeModel()
    - model.generate_content()
    """
    mock_model = MagicMock()
    mock_response = MagicMock()
    mock_response.text = "person: Family member (0.95), place: Park (0.85)"
    mock_model.generate_content.return_value = mock_response

    mock_genai = mocker.patch("app.services.ai_service.genai")
    mock_genai.configure.return_value = None
    mock_genai.GenerativeModel.return_value = mock_model

    return mock_model


@pytest.fixture
def mock_storage_service(mocker):
    """
    Mock storage service functions.

    Mocks:
    - upload_file()
    - get_signed_url()
    - delete_file()
    - compress_image()
    """
    mock_upload = mocker.patch("app.services.storage_service.upload_file")
    mock_upload.return_value = f"media/{uuid.uuid4()}/file.jpg"

    mock_signed_url = mocker.patch("app.services.storage_service.get_signed_url")
    mock_signed_url.return_value = f"https://example.com/signed/{uuid.uuid4()}"

    mock_delete = mocker.patch("app.services.storage_service.delete_file")
    mock_delete.return_value = None

    mock_compress = mocker.patch("app.services.storage_service.compress_image")
    mock_compress.return_value = b"compressed_image_data"

    return {
        "upload_file": mock_upload,
        "get_signed_url": mock_signed_url,
        "delete_file": mock_delete,
        "compress_image": mock_compress,
    }


@pytest.fixture
def mock_email_service(mocker):
    """
    Mock Resend email service.

    Mocks:
    - resend.Emails.send()
    """
    mock_send = mocker.patch("app.services.email_service.resend.Emails.send")
    mock_send.return_value = {"id": f"email-{uuid.uuid4()}"}

    return mock_send


# ============================================================================
# Fake File Data Fixtures
# ============================================================================

@pytest.fixture
def fake_image_file():
    """Generate a fake image file for upload testing."""
    return io.BytesIO(b"fake_image_data" * 1000)  # ~15KB


@pytest.fixture
def fake_large_image_file():
    """Generate a fake large image file (>5MB) for compression testing."""
    return io.BytesIO(b"x" * (6 * 1024 * 1024))  # 6MB


@pytest.fixture
def fake_image_upload():
    """Generate a file upload tuple for multipart/form-data."""
    return ("test_photo.jpg", b"fake_image_data" * 1000, "image/jpeg")


# ============================================================================
# Utility Fixtures
# ============================================================================

@pytest.fixture
def valid_uuid():
    """Generate a valid UUID string."""
    return str(uuid.uuid4())


@pytest.fixture
def invalid_uuid():
    """Return an invalid UUID string."""
    return "not-a-valid-uuid"


@pytest.fixture
def fake_jwt_token():
    """Generate a fake JWT token string."""
    return "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.fake.signature"
