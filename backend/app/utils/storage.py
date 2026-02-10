import logging
from app.dependencies import supabase_admin

logger = logging.getLogger(__name__)

def get_signed_url(storage_path: str, bucket: str = "patient-photos", expires_in: int = 3600) -> str | None:
    """Get a signed URL for a storage path, handling different response formats."""
    try:
        signed_url_res = supabase_admin.storage.from_(bucket).create_signed_url(storage_path, expires_in)

        if isinstance(signed_url_res, dict):
            return signed_url_res.get('signedURL') or signed_url_res.get('signedUrl')
        return signed_url_res
    except Exception as e:
        logger.error(f"Failed to create signed URL for {storage_path} in bucket {bucket}: {e}")
        return None
