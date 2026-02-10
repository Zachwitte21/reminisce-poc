# tests/services/test_storage_service.py
"""
Unit tests for storage service (app/services/storage_service.py).

Coverage:
- File upload to Supabase Storage
- Image compression (PIL-based JPEG compression)
- Signed URL generation
- File deletion
- Error handling
"""

import pytest
from unittest.mock import MagicMock, patch


@pytest.mark.unit
class TestFileUpload:
    """Test file upload functionality."""

    @patch("app.services.storage_service.supabase_admin")
    async def test_upload_file_success(self, mock_supabase):
        """Test successful file upload to storage."""
        from app.services.storage_service import upload_file

        # Mock storage upload (returns None on success)
        mock_supabase.storage.from_.return_value.upload.return_value = None

        result = await upload_file(
            file_content=b"fake_image_data",
            patient_id="patient-id",
            filename="photo.jpg",
            content_type="image/jpeg",
        )

        assert "storage_path" in result
        assert "filename" in result
        assert result["storage_path"].startswith("media/patient-id/originals/")
        assert result["filename"].endswith(".jpg")
        mock_supabase.storage.from_.assert_called_with("patient-media")

    @patch("app.services.storage_service.supabase_admin")
    async def test_upload_file_error(self, mock_supabase):
        """Test file upload error handling."""
        from app.services.storage_service import upload_file

        mock_supabase.storage.from_.return_value.upload.side_effect = Exception("Storage quota exceeded")

        with pytest.raises(Exception) as exc_info:
            await upload_file(
                file_content=b"data",
                patient_id="patient-id",
                filename="file.jpg",
                content_type="image/jpeg",
            )

        assert "quota" in str(exc_info.value).lower()

    @patch("app.services.storage_service.supabase_admin")
    async def test_upload_file_invalid_bucket(self, mock_supabase):
        """Test upload when storage bucket errors."""
        from app.services.storage_service import upload_file

        mock_supabase.storage.from_.return_value.upload.side_effect = Exception("Bucket not found")

        with pytest.raises(Exception) as exc_info:
            await upload_file(
                file_content=b"data",
                patient_id="patient-id",
                filename="file.jpg",
                content_type="image/jpeg",
            )

        assert "bucket" in str(exc_info.value).lower()


@pytest.mark.unit
class TestImageCompression:
    """Test image compression functionality."""

    @patch("app.services.storage_service.Image")
    async def test_compress_image_large_file(self, mock_image_class):
        """Test compression of large image."""
        from app.services.storage_service import compress_image

        mock_image = MagicMock()
        mock_image.mode = "RGB"
        mock_image_class.open.return_value = mock_image

        def mock_save(buffer, format=None, quality=None):
            buffer.write(b"compressed_data")

        mock_image.save.side_effect = mock_save

        result = await compress_image(b"x" * (6 * 1024 * 1024))

        assert isinstance(result, bytes)
        assert len(result) > 0
        mock_image_class.open.assert_called_once()

    @patch("app.services.storage_service.Image")
    async def test_compress_image_small_file(self, mock_image_class):
        """Test compression of small image -- all images go through compression."""
        from app.services.storage_service import compress_image

        mock_image = MagicMock()
        mock_image.mode = "RGB"
        mock_image_class.open.return_value = mock_image

        def mock_save(buffer, format=None, quality=None):
            buffer.write(b"small_output")

        mock_image.save.side_effect = mock_save

        result = await compress_image(b"small_image_data" * 100)

        assert isinstance(result, bytes)
        assert len(result) > 0

    @patch("app.services.storage_service.Image")
    async def test_compress_image_invalid_format(self, mock_image_class):
        """Test compression of invalid image format."""
        from app.services.storage_service import compress_image

        mock_image_class.open.side_effect = Exception("Cannot identify image file")

        with pytest.raises(Exception) as exc_info:
            await compress_image(b"not_an_image")

        assert "image" in str(exc_info.value).lower()


@pytest.mark.unit
class TestSignedURLs:
    """Test signed URL generation."""

    @patch("app.services.storage_service.supabase_admin")
    def test_get_signed_url_success(self, mock_supabase):
        """Test generating signed URL for file."""
        from app.services.storage_service import get_signed_url

        mock_supabase.storage.from_.return_value.create_signed_url.return_value = {
            "signedURL": "https://example.com/signed/file.jpg?token=xyz"
        }

        result = get_signed_url(
            storage_path="media/patient-id/file.jpg",
            expires_in=3600,
        )

        assert result.startswith("https://")
        assert "signed" in result
        mock_supabase.storage.from_.assert_called_once_with("patient-media")

    @patch("app.services.storage_service.supabase_admin")
    def test_get_signed_url_default_expiry(self, mock_supabase):
        """Test signed URL with default expiration time."""
        from app.services.storage_service import get_signed_url

        mock_supabase.storage.from_.return_value.create_signed_url.return_value = {
            "signedURL": "https://example.com/signed/file.jpg"
        }

        # Call without expires_in (should use default of 3600)
        result = get_signed_url(storage_path="media/file.jpg")

        assert isinstance(result, str)
        assert result.startswith("https://")

    @patch("app.services.storage_service.supabase_admin")
    def test_get_signed_url_file_not_found(self, mock_supabase):
        """Test signed URL for non-existent file."""
        from app.services.storage_service import get_signed_url

        mock_supabase.storage.from_.return_value.create_signed_url.side_effect = Exception("File not found")

        with pytest.raises(Exception) as exc_info:
            get_signed_url(storage_path="nonexistent.jpg")

        assert "not found" in str(exc_info.value).lower()


@pytest.mark.unit
class TestFileDelete:
    """Test file deletion functionality."""

    @patch("app.services.storage_service.supabase_admin")
    async def test_delete_file_success(self, mock_supabase):
        """Test successful file deletion."""
        from app.services.storage_service import delete_file

        mock_supabase.storage.from_.return_value.remove.return_value = None

        result = await delete_file(storage_path="media/patient-id/file.jpg")

        assert result is True
        mock_supabase.storage.from_.assert_called_once_with("patient-media")
        mock_supabase.storage.from_.return_value.remove.assert_called_once_with(
            ["media/patient-id/file.jpg"]
        )

    @patch("app.services.storage_service.supabase_admin")
    async def test_delete_file_not_found(self, mock_supabase):
        """Test deleting non-existent file -- returns False."""
        from app.services.storage_service import delete_file

        mock_supabase.storage.from_.return_value.remove.side_effect = Exception("File not found")

        # delete_file catches all exceptions and returns False
        result = await delete_file(storage_path="nonexistent.jpg")

        assert result is False

    @patch("app.services.storage_service.supabase_admin")
    async def test_delete_file_permission_error(self, mock_supabase):
        """Test deletion when storage raises permission error -- returns False."""
        from app.services.storage_service import delete_file

        mock_supabase.storage.from_.return_value.remove.side_effect = Exception("Permission denied")

        # delete_file catches all exceptions and returns False
        result = await delete_file(storage_path="file.jpg")

        assert result is False


