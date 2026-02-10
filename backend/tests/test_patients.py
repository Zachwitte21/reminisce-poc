# tests/test_patients.py
"""
Tests for patients router (app/routers/patients.py).

Coverage:
- Create patient (caregiver only, one patient limit)
- Get patient (access control)
- Update patient (caregiver only)
- Patient settings CRUD
- Supporters list/revoke
- Patient photo upload
"""

import pytest
from unittest.mock import MagicMock, AsyncMock
from datetime import datetime, timezone


def _make_patients_select_mock(mock_supabase_response, data):
    """Create a mock query for patients table select operations."""
    q = MagicMock()
    q.select.return_value = q
    q.eq.return_value = q
    q.single.return_value = q
    q.limit.return_value = q
    q.execute.return_value = mock_supabase_response(data)
    return q


@pytest.mark.integration
class TestCreatePatient:
    """Test patient creation endpoints."""

    def test_create_patient_success(
        self, client, override_get_current_user, mock_supabase, mock_supabase_response, mock_caregiver_user, mocker
    ):
        """Test successful patient creation by caregiver."""
        patient_data = {
            "id": "patient-id",
            "caregiver_id": mock_caregiver_user["id"],
            "first_name": "Mary",
            "last_name": "Smith",
            "birth_date": "1945-06-15",
            "relationship": "Mother",
            "photo_url": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

        # Table routing: patients (select→empty existing, insert→data), patient_settings (insert), media (select for _sign_patient_photo)
        mock_patients_q = MagicMock()
        # select("id").eq("caregiver_id",...).execute() for existing check → empty
        mock_patients_q.select.return_value.eq.return_value.execute.return_value = (
            mock_supabase_response([])
        )
        # insert({...}).execute() → patient data
        mock_patients_q.insert.return_value.execute.return_value = (
            mock_supabase_response([patient_data])
        )

        mock_settings_q = MagicMock()
        mock_settings_q.insert.return_value.execute.return_value = (
            mock_supabase_response([{"patient_id": "patient-id"}])
        )

        mock_media_q = MagicMock()
        mock_media_q.select.return_value.eq.return_value.eq.return_value.limit.return_value.execute.return_value = (
            mock_supabase_response([])
        )

        def table_router(name):
            if name == "patients":
                return mock_patients_q
            if name == "patient_settings":
                return mock_settings_q
            if name == "media":
                return mock_media_q
            return MagicMock()

        mock_supabase.table.side_effect = table_router

        # Mock get_signed_url used by _sign_patient_photo
        mocker.patch("app.routers.patients.get_signed_url", return_value="https://example.com/signed")

        response = client.post(
            "/api/patients/",
            json={
                "first_name": "Mary",
                "last_name": "Smith",
                "birth_date": "1945-06-15",
                "relationship": "Mother",
            },
            headers={"Authorization": "Bearer fake-token"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["first_name"] == "Mary"
        assert data["last_name"] == "Smith"
        assert data["caregiver_id"] == mock_caregiver_user["id"]

    def test_create_patient_unauthorized(self, client, mock_supabase):
        """Test patient creation without authentication."""
        response = client.post(
            "/api/patients/",
            json={
                "first_name": "Mary",
                "last_name": "Smith",
                "birth_date": "1945-06-15",
                "relationship": "Mother",
            },
        )

        assert response.status_code == 401

    @pytest.mark.xfail(reason="Endpoint missing role check — supporters should not create patients")
    def test_create_patient_supporter_forbidden(
        self, client, override_get_current_user_supporter, mock_supabase, mock_supabase_response, mocker
    ):
        """Test supporters cannot create patients."""
        patient_data = {
            "id": "patient-id",
            "caregiver_id": "supporter-id",
            "first_name": "Mary",
            "last_name": "Smith",
            "birth_date": "1945-06-15",
            "relationship": "Mother",
            "photo_url": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

        mock_patients_q = MagicMock()
        mock_patients_q.select.return_value.eq.return_value.execute.return_value = (
            mock_supabase_response([])
        )
        mock_patients_q.insert.return_value.execute.return_value = (
            mock_supabase_response([patient_data])
        )

        mock_settings_q = MagicMock()
        mock_settings_q.insert.return_value.execute.return_value = (
            mock_supabase_response([{"patient_id": "patient-id"}])
        )

        mock_media_q = MagicMock()
        mock_media_q.select.return_value.eq.return_value.eq.return_value.limit.return_value.execute.return_value = (
            mock_supabase_response([])
        )

        def table_router(name):
            if name == "patients":
                return mock_patients_q
            if name == "patient_settings":
                return mock_settings_q
            if name == "media":
                return mock_media_q
            return MagicMock()

        mock_supabase.table.side_effect = table_router
        mocker.patch("app.routers.patients.get_signed_url", return_value="https://example.com/signed")

        response = client.post(
            "/api/patients/",
            json={
                "first_name": "Mary",
                "last_name": "Smith",
                "birth_date": "1945-06-15",
                "relationship": "Mother",
            },
            headers={"Authorization": "Bearer fake-token"},
        )

        assert response.status_code == 403

    def test_create_patient_missing_fields(
        self, client, override_get_current_user, mock_supabase
    ):
        """Test patient creation with missing required fields."""
        response = client.post(
            "/api/patients/",
            json={
                "first_name": "Mary",
                # Missing last_name, birth_date, relationship
            },
            headers={"Authorization": "Bearer fake-token"},
        )

        assert response.status_code == 422

    def test_create_patient_invalid_birth_date(
        self, client, override_get_current_user, mock_supabase
    ):
        """Test patient creation with invalid birth date format."""
        response = client.post(
            "/api/patients/",
            json={
                "first_name": "Mary",
                "last_name": "Smith",
                "birth_date": "not-a-date",
                "relationship": "Mother",
            },
            headers={"Authorization": "Bearer fake-token"},
        )

        assert response.status_code == 422


@pytest.mark.integration
class TestGetPatient:
    """Test get patient endpoints."""

    def test_get_my_patient_success(
        self, client, override_get_current_user, mock_supabase, mock_supabase_response, mock_patient, mocker
    ):
        """Test caregiver getting their patient."""
        # get_my_patient uses current_user.user_metadata.get('role') → 'caregiver'
        # Then queries patients.select("*").eq("caregiver_id",...).execute() → list result
        mock_patients_q = MagicMock()
        mock_patients_q.select.return_value.eq.return_value.execute.return_value = (
            mock_supabase_response([mock_patient])
        )

        mock_media_q = MagicMock()
        mock_media_q.select.return_value.eq.return_value.eq.return_value.limit.return_value.execute.return_value = (
            mock_supabase_response([])
        )

        def table_router(name):
            if name == "patients":
                return mock_patients_q
            if name == "media":
                return mock_media_q
            return MagicMock()

        mock_supabase.table.side_effect = table_router
        mocker.patch("app.routers.patients.get_signed_url", return_value="https://example.com/signed")

        response = client.get(
            "/api/patients/me",
            headers={"Authorization": "Bearer fake-token"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == mock_patient["id"]
        assert data["first_name"] == mock_patient["first_name"]

    def test_get_my_patient_not_found(
        self, client, override_get_current_user, mock_supabase, mock_supabase_response
    ):
        """Test getting patient when caregiver has no patient."""
        # All table queries return empty
        mock_patients_q = MagicMock()
        mock_patients_q.select.return_value.eq.return_value.execute.return_value = (
            mock_supabase_response([])
        )

        mock_supporters_q = MagicMock()
        mock_supporters_q.select.return_value.eq.return_value.is_.return_value.execute.return_value = (
            mock_supabase_response([])
        )

        mock_profiles_q = MagicMock()
        mock_profiles_q.select.return_value.eq.return_value.single.return_value.execute.return_value = (
            mock_supabase_response(None)
        )

        def table_router(name):
            if name == "patients":
                return mock_patients_q
            if name == "patient_supporters":
                return mock_supporters_q
            if name == "profiles":
                return mock_profiles_q
            return MagicMock()

        mock_supabase.table.side_effect = table_router

        response = client.get(
            "/api/patients/me",
            headers={"Authorization": "Bearer fake-token"},
        )

        assert response.status_code == 404

    def test_get_patient_by_id_success(
        self, client, override_get_current_user, mock_supabase, mock_supabase_response, mock_patient, mocker
    ):
        """Test getting patient by ID (with access)."""
        # verify_patient_access uses .single() → returns dict
        mock_patients_q = MagicMock()
        mock_patients_q.select.return_value.eq.return_value.single.return_value.execute.return_value = (
            mock_supabase_response(mock_patient)
        )

        mock_media_q = MagicMock()
        mock_media_q.select.return_value.eq.return_value.eq.return_value.limit.return_value.execute.return_value = (
            mock_supabase_response([])
        )

        def table_router(name):
            if name == "patients":
                return mock_patients_q
            if name == "media":
                return mock_media_q
            return MagicMock()

        mock_supabase.table.side_effect = table_router
        mocker.patch("app.routers.patients.get_signed_url", return_value="https://example.com/signed")

        response = client.get(
            f"/api/patients/{mock_patient['id']}",
            headers={"Authorization": "Bearer fake-token"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == mock_patient["id"]

    def test_get_patient_forbidden(
        self, client, override_get_current_user_supporter, mock_supabase, mock_supabase_response
    ):
        """Test supporter cannot access patient they don't support."""
        # verify_patient_access: patient found but caregiver_id doesn't match, then supporter check fails
        mock_patients_q = MagicMock()
        mock_patients_q.select.return_value.eq.return_value.single.return_value.execute.return_value = (
            mock_supabase_response({"id": "some-patient-id", "caregiver_id": "other-user"})
        )

        mock_supporters_q = MagicMock()
        mock_supporters_q.select.return_value.eq.return_value.eq.return_value.is_.return_value.execute.return_value = (
            mock_supabase_response([])
        )

        def table_router(name):
            if name == "patients":
                return mock_patients_q
            if name == "patient_supporters":
                return mock_supporters_q
            return MagicMock()

        mock_supabase.table.side_effect = table_router

        response = client.get(
            "/api/patients/some-patient-id",
            headers={"Authorization": "Bearer fake-token"},
        )

        assert response.status_code in [403, 404]


@pytest.mark.integration
class TestUpdatePatient:
    """Test patient update endpoints."""

    def test_update_patient_success(
        self, client, override_get_current_user, mock_supabase, mock_supabase_response, mock_patient, mock_caregiver_user, mocker
    ):
        """Test caregiver updating their patient."""
        updated_patient = {**mock_patient, "first_name": "Jane"}

        # verify_patient_caregiver uses patients.select().eq().single().execute()
        # then update uses patients.update().eq().execute()
        mock_patients_q = MagicMock()
        mock_patients_q.select.return_value.eq.return_value.single.return_value.execute.return_value = (
            mock_supabase_response(mock_patient)
        )
        mock_patients_q.update.return_value.eq.return_value.execute.return_value = (
            mock_supabase_response([updated_patient])
        )

        mock_media_q = MagicMock()
        mock_media_q.select.return_value.eq.return_value.eq.return_value.limit.return_value.execute.return_value = (
            mock_supabase_response([])
        )

        def table_router(name):
            if name == "patients":
                return mock_patients_q
            if name == "media":
                return mock_media_q
            return MagicMock()

        mock_supabase.table.side_effect = table_router
        mocker.patch("app.routers.patients.get_signed_url", return_value="https://example.com/signed")

        response = client.patch(
            f"/api/patients/{mock_patient['id']}",
            json={"first_name": "Jane"},
            headers={"Authorization": "Bearer fake-token"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["first_name"] == "Jane"

    def test_update_patient_supporter_forbidden(
        self, client, override_get_current_user_supporter, mock_supabase, mock_supabase_response, mock_patient
    ):
        """Test supporters cannot update patient — verify_patient_caregiver rejects them."""
        mock_patients_q = MagicMock()
        mock_patients_q.select.return_value.eq.return_value.single.return_value.execute.return_value = (
            mock_supabase_response(mock_patient)
        )
        mock_supabase.table.side_effect = lambda name: mock_patients_q if name == "patients" else MagicMock()

        response = client.patch(
            f"/api/patients/{mock_patient['id']}",
            json={"first_name": "Jane"},
            headers={"Authorization": "Bearer fake-token"},
        )

        assert response.status_code == 403


@pytest.mark.integration
class TestPatientSettings:
    """Test patient settings endpoints."""

    def test_get_patient_settings_success(
        self, client, override_get_current_user, mock_supabase, mock_supabase_response, mock_patient, mock_patient_settings
    ):
        """Test getting patient settings."""
        # verify_patient_caregiver on patients table, then settings query on patient_settings table
        mock_patients_q = MagicMock()
        mock_patients_q.select.return_value.eq.return_value.single.return_value.execute.return_value = (
            mock_supabase_response(mock_patient)
        )

        mock_settings_q = MagicMock()
        mock_settings_q.select.return_value.eq.return_value.single.return_value.execute.return_value = (
            mock_supabase_response(mock_patient_settings)
        )

        def table_router(name):
            if name == "patients":
                return mock_patients_q
            if name == "patient_settings":
                return mock_settings_q
            return MagicMock()

        mock_supabase.table.side_effect = table_router

        response = client.get(
            f"/api/patients/{mock_patient['id']}/settings",
            headers={"Authorization": "Bearer fake-token"},
        )

        assert response.status_code == 200
        data = response.json()
        # Endpoint returns {"settings": data}
        assert data["settings"]["require_photo_approval"] == True
        assert data["settings"]["voice_therapy_enabled"] == False

    def test_update_patient_settings_success(
        self, client, override_get_current_user, mock_supabase, mock_supabase_response, mock_patient, mock_patient_settings
    ):
        """Test updating patient settings."""
        updated_settings = {**mock_patient_settings, "voice_therapy_enabled": True}

        mock_patients_q = MagicMock()
        mock_patients_q.select.return_value.eq.return_value.single.return_value.execute.return_value = (
            mock_supabase_response(mock_patient)
        )

        mock_settings_q = MagicMock()
        mock_settings_q.update.return_value.eq.return_value.execute.return_value = (
            mock_supabase_response([updated_settings])
        )

        def table_router(name):
            if name == "patients":
                return mock_patients_q
            if name == "patient_settings":
                return mock_settings_q
            return MagicMock()

        mock_supabase.table.side_effect = table_router

        response = client.patch(
            f"/api/patients/{mock_patient['id']}/settings",
            json={"voice_therapy_enabled": True},
            headers={"Authorization": "Bearer fake-token"},
        )

        assert response.status_code == 200
        data = response.json()
        # Endpoint returns {"settings": data}
        assert data["settings"]["voice_therapy_enabled"] == True

    def test_update_patient_settings_supporter_forbidden(
        self, client, override_get_current_user_supporter, mock_supabase, mock_supabase_response, mock_patient
    ):
        """Test supporters cannot update settings — verify_patient_caregiver rejects them."""
        mock_patients_q = MagicMock()
        mock_patients_q.select.return_value.eq.return_value.single.return_value.execute.return_value = (
            mock_supabase_response(mock_patient)
        )
        mock_supabase.table.side_effect = lambda name: mock_patients_q if name == "patients" else MagicMock()

        response = client.patch(
            f"/api/patients/{mock_patient['id']}/settings",
            json={"voice_therapy_enabled": True},
            headers={"Authorization": "Bearer fake-token"},
        )

        assert response.status_code == 403


@pytest.mark.integration
class TestPatientSupporters:
    """Test patient supporters endpoints."""

    def test_list_supporters_success(
        self, client, override_get_current_user, mock_supabase, mock_supabase_response, mock_patient, mock_supporter_user
    ):
        """Test caregiver listing patient supporters."""
        # InvitationsService.list_supporters calls verify_patient_caregiver, then queries patient_supporters
        mock_patients_q = MagicMock()
        mock_patients_q.select.return_value.eq.return_value.single.return_value.execute.return_value = (
            mock_supabase_response(mock_patient)
        )

        supporters_data = [
            {
                "id": "link-id",
                "supporter_id": mock_supporter_user["id"],
                "patient_id": mock_patient["id"],
                "created_at": datetime.now(timezone.utc).isoformat(),
                "revoked_at": None,
                "profiles": {
                    "full_name": mock_supporter_user["full_name"],
                    "email": mock_supporter_user["email"],
                },
            }
        ]
        mock_supporters_q = MagicMock()
        mock_supporters_q.select.return_value.eq.return_value.is_.return_value.execute.return_value = (
            mock_supabase_response(supporters_data)
        )

        def table_router(name):
            if name == "patients":
                return mock_patients_q
            if name == "patient_supporters":
                return mock_supporters_q
            return MagicMock()

        mock_supabase.table.side_effect = table_router

        response = client.get(
            f"/api/patients/{mock_patient['id']}/supporters",
            headers={"Authorization": "Bearer fake-token"},
        )

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    def test_revoke_supporter_success(
        self, client, override_get_current_user, mock_supabase, mock_supabase_response, mock_patient, mock_supporter_user
    ):
        """Test caregiver revoking supporter access."""
        # InvitationsService.revoke_access calls verify_patient_caregiver, then updates patient_supporters
        mock_patients_q = MagicMock()
        mock_patients_q.select.return_value.eq.return_value.single.return_value.execute.return_value = (
            mock_supabase_response(mock_patient)
        )

        mock_supporters_q = MagicMock()
        mock_supporters_q.update.return_value.eq.return_value.eq.return_value.execute.return_value = (
            mock_supabase_response([{"id": "link-id", "revoked_at": datetime.now(timezone.utc).isoformat()}])
        )

        def table_router(name):
            if name == "patients":
                return mock_patients_q
            if name == "patient_supporters":
                return mock_supporters_q
            return MagicMock()

        mock_supabase.table.side_effect = table_router

        response = client.delete(
            f"/api/patients/{mock_patient['id']}/supporters/{mock_supporter_user['id']}",
            headers={"Authorization": "Bearer fake-token"},
        )

        assert response.status_code in [200, 204]

    def test_revoke_supporter_forbidden(
        self, client, override_get_current_user_supporter, mock_supabase, mock_supabase_response, mock_patient
    ):
        """Test supporters cannot revoke other supporters — verify_patient_caregiver rejects them."""
        mock_patients_q = MagicMock()
        mock_patients_q.select.return_value.eq.return_value.single.return_value.execute.return_value = (
            mock_supabase_response(mock_patient)
        )
        mock_supabase.table.side_effect = lambda name: mock_patients_q if name == "patients" else MagicMock()

        response = client.delete(
            f"/api/patients/{mock_patient['id']}/supporters/other-supporter-id",
            headers={"Authorization": "Bearer fake-token"},
        )

        assert response.status_code == 403


@pytest.mark.integration
class TestPatientPhotoUpload:
    """Test patient photo upload endpoint."""

    def test_upload_patient_photo_success(
        self,
        client,
        override_get_current_user,
        mock_supabase,
        mock_supabase_response,
        mock_patient,
        fake_image_upload,
        mocker,
    ):
        """Test uploading patient avatar photo."""
        updated_patient = {**mock_patient, "photo_url": f"profile/photo_{mock_patient['id']}.jpg"}

        # verify_patient_caregiver on patients, compress_image, storage upload, patients update
        mock_patients_q = MagicMock()
        mock_patients_q.select.return_value.eq.return_value.single.return_value.execute.return_value = (
            mock_supabase_response(mock_patient)
        )
        mock_patients_q.update.return_value.eq.return_value.execute.return_value = (
            mock_supabase_response([updated_patient])
        )

        mock_media_q = MagicMock()
        mock_media_q.select.return_value.eq.return_value.eq.return_value.limit.return_value.execute.return_value = (
            mock_supabase_response([])
        )

        def table_router(name):
            if name == "patients":
                return mock_patients_q
            if name == "media":
                return mock_media_q
            return MagicMock()

        mock_supabase.table.side_effect = table_router

        # Mock compress_image (imported directly in patients.py)
        mocker.patch("app.routers.patients.compress_image", new_callable=AsyncMock, return_value=b"compressed")
        mocker.patch("app.routers.patients.get_signed_url", return_value=f"https://example.com/signed/{mock_patient['id']}")

        response = client.post(
            f"/api/patients/{mock_patient['id']}/photo",
            files={"file": fake_image_upload},
            headers={"Authorization": "Bearer fake-token"},
        )

        assert response.status_code == 200
        data = response.json()
        assert "photo_url" in data

    def test_upload_patient_photo_supporter_forbidden(
        self, client, override_get_current_user_supporter, mock_supabase, mock_supabase_response, mock_patient
    ):
        """Test supporters cannot upload patient photo — verify_patient_caregiver rejects them."""
        mock_patients_q = MagicMock()
        mock_patients_q.select.return_value.eq.return_value.single.return_value.execute.return_value = (
            mock_supabase_response(mock_patient)
        )
        mock_supabase.table.side_effect = lambda name: mock_patients_q if name == "patients" else MagicMock()

        response = client.post(
            f"/api/patients/{mock_patient['id']}/photo",
            files={"file": ("test.jpg", b"data", "image/jpeg")},
            headers={"Authorization": "Bearer fake-token"},
        )

        assert response.status_code == 403
