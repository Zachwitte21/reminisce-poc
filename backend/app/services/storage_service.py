import io
import uuid
from typing import Any

from PIL import Image

from app.dependencies import supabase_admin

THUMBNAIL_SIZE = (400, 400)
MAX_IMAGE_SIZE = 2 * 1024 * 1024  # 2MB
JPEG_QUALITY = 85


async def upload_file(
    file_content: bytes,
    patient_id: str,
    filename: str,
    content_type: str
) -> dict[str, Any]:
    """Upload a file to Supabase Storage."""
    file_ext = filename.split('.')[-1].lower()
    unique_filename = f"{uuid.uuid4()}.{file_ext}"
    storage_path = f"media/{patient_id}/originals/{unique_filename}"

    supabase_admin.storage.from_("patient-photos").upload(
        path=storage_path,
        file=file_content,
        file_options={"content-type": content_type}
    )

    return {"storage_path": storage_path, "filename": unique_filename}


async def generate_thumbnail(
    image_bytes: bytes,
    patient_id: str,
    filename: str
) -> str:
    """Generate and upload a thumbnail for an image."""
    image = Image.open(io.BytesIO(image_bytes))
    image.thumbnail(THUMBNAIL_SIZE, Image.Resampling.LANCZOS)
    image = _convert_to_rgb(image)

    thumb_buffer = io.BytesIO()
    image.save(thumb_buffer, format='JPEG', quality=JPEG_QUALITY)
    thumb_bytes = thumb_buffer.getvalue()

    thumb_filename = filename.rsplit('.', 1)[0] + '.jpg'
    thumb_path = f"media/{patient_id}/thumbnails/{thumb_filename}"

    supabase_admin.storage.from_("patient-photos").upload(
        path=thumb_path,
        file=thumb_bytes,
        file_options={"content-type": "image/jpeg"}
    )

    return thumb_path

async def download_file(storage_path: str) -> bytes:
    """Download a file from Supabase Storage."""
    return supabase_admin.storage.from_("patient-photos").download(storage_path)

def get_public_url(storage_path: str) -> str:
    """Get a public URL for a file."""
    return supabase_admin.storage.from_("patient-photos").get_public_url(storage_path)

def get_signed_url(storage_path: str, expires_in: int = 3600) -> str:
    """Get a signed URL for private file access."""
    response = supabase_admin.storage.from_("patient-photos").create_signed_url(
        storage_path, expires_in
    )
    return response.get("signedURL", "")

async def delete_file(storage_path: str) -> bool:
    """Delete a file from Supabase Storage."""
    try:
        supabase_admin.storage.from_("patient-photos").remove([storage_path])
        return True
    except Exception:
        return False

async def compress_image(image_bytes: bytes, max_size: int = MAX_IMAGE_SIZE) -> bytes:
    """Compress an image to meet size requirements."""
    image = Image.open(io.BytesIO(image_bytes))
    image = _convert_to_rgb(image)

    quality = JPEG_QUALITY
    output = io.BytesIO()

    while quality > 20:
        output.seek(0)
        output.truncate()
        image.save(output, format='JPEG', quality=quality)

        if output.tell() <= max_size:
            break
        quality -= 10

    return output.getvalue()


def _convert_to_rgb(image: Image.Image) -> Image.Image:
    """Convert image to RGB mode if necessary (for RGBA/P modes)."""
    if image.mode in ('RGBA', 'P'):
        return image.convert('RGB')
    return image
