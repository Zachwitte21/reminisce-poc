# tests/test_media.py
"""
Tests for media router (app/routers/media.py).

Coverage:
- Media upload (single/multiple files, validation, compression)
- AI tagging (success, errors)
- Update media metadata
- Tag management (add, delete)
- Delete media
- File type validation
"""

import uuid

import pytest
from unittest.mock import AsyncMock, MagicMock


@pytest.mark.media
class TestMediaUpload:
    """Test media upload endpoints."""

    def test_upload_single_photo_success(
        self,
        client,
        override_get_current_user,
        mock_supabase,
        mock_supabase_response,
        mock_storage_service,
        mock_patient,
        fake_image_upload,
    ):
        """Test uploading a single photo."""
        # Mock patient access verification
        mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = (
            mock_supabase_response([mock_patient])
        )

        # Mock storage upload
        file_path = f"media/{mock_patient['id']}/photo.jpg"
        mock_storage_service["upload_file"].return_value = file_path

        # Mock media record creation
        media_data = {
            "id": "media-id",
            "patient_id": mock_patient["id"],
            "file_path": file_path,
            "file_type": "image/jpeg",
            "status": "pending",
        }
        mock_supabase.table.return_value.insert.return_value.execute.return_value = (
            mock_supabase_response([media_data])
        )

        response = client.post(
            "/api/media/upload",
            files={"files": fake_image_upload},
            data={"patient_id": mock_patient["id"]},
            headers={"Authorization": "Bearer fake-token"},
        )

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data["uploaded"], list)
        assert len(data["uploaded"]) > 0

    def test_upload_multiple_photos_success(
        self,
        client,
        override_get_current_user,
        mock_supabase,
        mock_supabase_response,
        mock_storage_service,
        mock_patient,
    ):
        """Test uploading multiple photos at once."""
        # Mock patient access
        mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = (
            mock_supabase_response([mock_patient])
        )

        # Mock storage upload
        mock_storage_service["upload_file"].return_value = f"media/{mock_patient['id']}/photo.jpg"

        # Mock media record creation
        media_data = [
            {"id": "media-1", "patient_id": mock_patient["id"], "file_path": "path1.jpg"},
            {"id": "media-2", "patient_id": mock_patient["id"], "file_path": "path2.jpg"},
        ]
        mock_supabase.table.return_value.insert.return_value.execute.return_value = (
            mock_supabase_response(media_data)
        )

        files = [
            ("files", ("photo1.jpg", b"image1", "image/jpeg")),
            ("files", ("photo2.jpg", b"image2", "image/jpeg")),
        ]

        response = client.post(
            "/api/media/upload",
            files=files,
            data={"patient_id": mock_patient["id"]},
            headers={"Authorization": "Bearer fake-token"},
        )

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data["uploaded"], list)
        assert len(data["uploaded"]) >= 2

    def test_upload_photo_unauthorized(self, client, mock_supabase):
        """Test uploading photo without authentication."""
        response = client.post(
            "/api/media/upload",
            files={"files": ("test.jpg", b"data", "image/jpeg")},
            data={"patient_id": "patient-id"},
        )

        assert response.status_code == 401

    def test_upload_photo_invalid_patient(
        self, client, override_get_current_user, mock_supabase, mock_supabase_response
    ):
        """Test uploading photo for non-existent patient."""
        # Mock no access
        mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = (
            mock_supabase_response([])
        )

        response = client.post(
            "/api/media/upload",
            files={"files": ("test.jpg", b"data", "image/jpeg")},
            data={"patient_id": "invalid-patient-id"},
            headers={"Authorization": "Bearer fake-token"},
        )

        assert response.status_code == 400

    def test_upload_photo_missing_patient_id(
        self, client, override_get_current_user, mock_supabase
    ):
        """Test uploading photo without patient_id."""
        response = client.post(
            "/api/media/upload",
            files={"files": ("test.jpg", b"data", "image/jpeg")},
            headers={"Authorization": "Bearer fake-token"},
        )

        assert response.status_code == 422

    def test_upload_photo_invalid_file_type(
        self, client, override_get_current_user, mock_supabase, mock_supabase_response, mock_patient
    ):
        """Test uploading invalid file type."""
        # Mock patient access
        mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = (
            mock_supabase_response([mock_patient])
        )

        response = client.post(
            "/api/media/upload",
            files={"files": ("test.exe", b"binary", "application/exe")},
            data={"patient_id": mock_patient["id"]},
            headers={"Authorization": "Bearer fake-token"},
        )

        # Depending on validation, might be 400 or 422
        assert response.status_code in [400, 422]

    def test_upload_large_photo_compression(
        self,
        client,
        override_get_current_user,
        mock_supabase,
        mock_supabase_response,
        mock_patient,
        fake_large_image_file,
        mocker,
    ):
        """Test large photo triggers compression."""
        # Mock compress_image at the import location in media.py (it's imported directly)
        mock_compress = mocker.patch(
            "app.routers.media.compress_image", new_callable=AsyncMock
        )
        mock_compress.return_value = b"compressed"

        # Mock media record creation
        mock_supabase.table.return_value.insert.return_value.execute.return_value = (
            mock_supabase_response([{"id": "media-id", "status": "pending"}])
        )

        response = client.post(
            "/api/media/upload",
            files={"files": ("large.jpg", fake_large_image_file.read(), "image/jpeg")},
            data={"patient_id": mock_patient["id"]},
            headers={"Authorization": "Bearer fake-token"},
        )

        # Should succeed after compression
        assert response.status_code == 200
        mock_compress.assert_called_once()


@pytest.mark.ai
class TestAITagging:
    """Test AI-powered photo tagging."""

    def test_ai_tag_photo_success(
        self,
        client,
        override_get_current_user,
        mock_supabase,
        mock_supabase_response,
        mock_media,
        mocker,
    ):
        """Test successful AI tagging of photo."""
        # Mock media query — endpoint uses .single()
        media_with_path = {**mock_media, "storage_path": mock_media["file_path"]}
        mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = (
            mock_supabase_response(media_with_path)
        )

        # Mock analyze_image at the import location in media.py
        mock_analyze = mocker.patch(
            "app.routers.media.analyze_image", new_callable=AsyncMock
        )
        mock_analyze.return_value = {"people": ["Family member"], "setting": "Park"}

        response = client.post(
            f"/api/media/{mock_media['id']}/ai-tag",
            headers={"Authorization": "Bearer fake-token"},
        )

        assert response.status_code == 200
        data = response.json()
        assert "suggestions" in data

    def test_ai_tag_photo_not_found(
        self, client, override_get_current_user, mock_supabase, mock_supabase_response
    ):
        """Test AI tagging non-existent photo."""
        nonexistent_id = str(uuid.uuid4())

        # Mock no media found — endpoint uses .single()
        mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = (
            mock_supabase_response(None)
        )

        response = client.post(
            f"/api/media/{nonexistent_id}/ai-tag",
            headers={"Authorization": "Bearer fake-token"},
        )

        assert response.status_code == 404

    def test_ai_tag_photo_api_error(
        self,
        client,
        override_get_current_user,
        mock_supabase,
        mock_supabase_response,
        mock_media,
        mocker,
    ):
        """Test AI tagging when Gemini API fails."""
        # Mock media query — endpoint uses .single()
        media_with_path = {**mock_media, "storage_path": mock_media["file_path"]}
        mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = (
            mock_supabase_response(media_with_path)
        )

        # Mock analyze_image to raise
        mock_analyze = mocker.patch(
            "app.routers.media.analyze_image", new_callable=AsyncMock
        )
        mock_analyze.side_effect = Exception("API rate limit exceeded")

        response = client.post(
            f"/api/media/{mock_media['id']}/ai-tag",
            headers={"Authorization": "Bearer fake-token"},
        )

        assert response.status_code in [500, 503]


@pytest.mark.integration
class TestUpdateMedia:
    """Test media update endpoints."""

    def test_update_media_success(
        self, client, override_get_current_user, mock_supabase, mock_supabase_response, mock_media
    ):
        """Test updating media metadata."""
        updated_media = {**mock_media, "caption": "Updated caption"}

        # Endpoint only queries media table: .update().eq().execute()
        mock_media_q = MagicMock()
        mock_media_q.update.return_value.eq.return_value.execute.return_value = (
            mock_supabase_response([updated_media])
        )

        mock_supabase.table.side_effect = lambda name: mock_media_q if name == "media" else MagicMock()

        response = client.patch(
            f"/api/media/{mock_media['id']}",
            json={"caption": "Updated caption"},
            headers={"Authorization": "Bearer fake-token"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["caption"] == "Updated caption"

    def test_update_media_status_approval(
        self, client, override_get_current_user, mock_supabase, mock_supabase_response, mock_media
    ):
        """Test caregiver approving pending media."""
        approved_media = {**mock_media, "status": "approved"}

        # Endpoint only queries media table: .update().eq().execute()
        mock_media_q = MagicMock()
        mock_media_q.update.return_value.eq.return_value.execute.return_value = (
            mock_supabase_response([approved_media])
        )

        mock_supabase.table.side_effect = lambda name: mock_media_q if name == "media" else MagicMock()

        response = client.patch(
            f"/api/media/{mock_media['id']}",
            json={"status": "approved"},
            headers={"Authorization": "Bearer fake-token"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "approved"


@pytest.mark.integration
class TestMediaTags:
    """Test media tag management."""

    def test_add_tag_success(
        self, client, override_get_current_user, mock_supabase, mock_supabase_response, mock_media
    ):
        """Test adding manual tag to media."""
        tag_data = {
            "id": "tag-id",
            "media_id": mock_media["id"],
            "tag_type": "person",
            "tag_value": "John Doe",
            "source": "manual",
        }

        # Endpoint only queries media_tags table: .insert().execute()
        mock_tags_q = MagicMock()
        mock_tags_q.insert.return_value.execute.return_value = (
            mock_supabase_response([tag_data])
        )

        mock_supabase.table.side_effect = lambda name: mock_tags_q if name == "media_tags" else MagicMock()

        response = client.post(
            f"/api/media/{mock_media['id']}/tags",
            json={"tag_type": "person", "tag_value": "John Doe"},
            headers={"Authorization": "Bearer fake-token"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["tag_value"] == "John Doe"
        assert data["tag_type"] == "person"

    def test_delete_tag_success(
        self, client, override_get_current_user, mock_supabase, mock_supabase_response, mock_media, mock_media_tag
    ):
        """Test deleting tag from media."""
        # Endpoint only queries media_tags table: .delete().eq().eq().execute()
        mock_tags_q = MagicMock()
        mock_tags_q.delete.return_value.eq.return_value.eq.return_value.execute.return_value = (
            mock_supabase_response([])
        )

        mock_supabase.table.side_effect = lambda name: mock_tags_q if name == "media_tags" else MagicMock()

        response = client.delete(
            f"/api/media/{mock_media['id']}/tags/{mock_media_tag['id']}",
            headers={"Authorization": "Bearer fake-token"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "Tag deleted"


@pytest.mark.integration
class TestDeleteMedia:
    """Test media deletion."""

    def test_delete_media_success(
        self,
        client,
        override_get_current_user,
        mock_supabase,
        mock_supabase_response,
        mock_media,
        mock_patient,
    ):
        """Test deleting media and storage file."""
        # Endpoint queries two tables with .single(): media and patients
        media_data = {**mock_media, "storage_path": mock_media["file_path"]}

        mock_media_query = MagicMock()
        mock_media_query.select.return_value.eq.return_value.single.return_value.execute.return_value = (
            mock_supabase_response(media_data)
        )
        mock_media_query.delete.return_value.eq.return_value.execute.return_value = (
            mock_supabase_response(None)
        )

        mock_patient_query = MagicMock()
        mock_patient_query.select.return_value.eq.return_value.single.return_value.execute.return_value = (
            mock_supabase_response({"caregiver_id": mock_patient["caregiver_id"]})
        )

        def table_router(table_name):
            if table_name == "media":
                return mock_media_query
            elif table_name == "patients":
                return mock_patient_query
            return MagicMock()

        mock_supabase.table.side_effect = table_router

        response = client.delete(
            f"/api/media/{mock_media['id']}",
            headers={"Authorization": "Bearer fake-token"},
        )

        assert response.status_code == 200

    def test_delete_media_supporter_forbidden(
        self, client, override_get_current_user_supporter, mock_supabase, mock_supabase_response, mock_media, mock_patient
    ):
        """Test supporters cannot delete media."""
        # Endpoint queries two tables with .single(): media and patients
        media_data = {**mock_media, "storage_path": mock_media["file_path"]}

        mock_media_query = MagicMock()
        mock_media_query.select.return_value.eq.return_value.single.return_value.execute.return_value = (
            mock_supabase_response(media_data)
        )

        mock_patient_query = MagicMock()
        mock_patient_query.select.return_value.eq.return_value.single.return_value.execute.return_value = (
            mock_supabase_response({"caregiver_id": mock_patient["caregiver_id"]})
        )

        def table_router(table_name):
            if table_name == "media":
                return mock_media_query
            elif table_name == "patients":
                return mock_patient_query
            return MagicMock()

        mock_supabase.table.side_effect = table_router

        response = client.delete(
            f"/api/media/{mock_media['id']}",
            headers={"Authorization": "Bearer fake-token"},
        )

        assert response.status_code == 403
