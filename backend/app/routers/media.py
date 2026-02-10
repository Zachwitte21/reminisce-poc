import logging
import uuid
from typing import Any

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, Request
from gotrue.types import User

from app.dependencies import get_current_user, supabase_admin, validate_uuid
from app.models.schemas import MediaUpdateRequest, MediaTagCreate
from app.services.ai_service import analyze_image
from app.services.storage_service import compress_image
from app.middleware.rate_limit import limiter, RATE_LIMITS, get_user_id_or_ip

logger = logging.getLogger(__name__)

router = APIRouter()

# File validation constants
ALLOWED_MIME_TYPES = {'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif'}
ALLOWED_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.heif'}


def validate_file_type(file: UploadFile) -> None:
    """Validate file MIME type and extension."""
    if file.filename:
        ext = ('.' + file.filename.rsplit('.', 1)[-1].lower()) if '.' in file.filename else ''
        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(400, f"File type not allowed. Allowed: {', '.join(ALLOWED_EXTENSIONS)}")
    if file.content_type and file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(400, f"MIME type not allowed: {file.content_type}")

MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB

@router.post("/upload")
@limiter.limit(RATE_LIMITS["media_upload"], key_func=get_user_id_or_ip)
async def upload_media(
    request: Request,
    files: list[UploadFile] = File(...),
    patient_id: str = Form(...),
    current_user: User = Depends(get_current_user)
) -> dict[str, Any]:
    # Validate all files before processing
    for file in files:
        validate_file_type(file)
    results = []
    errors = []

    for file in files:
        upload_result = await _process_file_upload(file, patient_id, current_user.id)
        if upload_result.get("success"):
            results.append(upload_result["data"])
        else:
            errors.append(upload_result["error"])

    if not results and errors:
        raise HTTPException(
            status_code=400,
            detail={"message": "All uploads failed", "errors": errors}
        )

    return {"uploaded": results, "errors": errors}


async def _process_file_upload(
    file: UploadFile,
    patient_id: str,
    user_id: str
) -> dict[str, Any]:
    """Process a single file upload, returning success status and data or error."""
    try:
        file_content = await file.read()

        if len(file_content) > MAX_FILE_SIZE:
            logger.info(f"Compressing {file.filename}: {len(file_content) / 1024 / 1024:.2f}MB")
            file_content = await compress_image(file_content, MAX_FILE_SIZE)
            logger.info(f"Compressed to: {len(file_content) / 1024 / 1024:.2f}MB")

            if len(file_content) > MAX_FILE_SIZE:
                return {
                    "success": False,
                    "error": {
                        "filename": file.filename,
                        "error": f"File still too large after compression ({len(file_content) / 1024 / 1024:.1f}MB). Max is 5MB."
                    }
                }

        # Generate unique filename to avoid conflicts and RLS issues with upsert
        file_ext = file.filename.rsplit('.', 1)[-1] if '.' in file.filename else 'jpg'
        unique_filename = f"{uuid.uuid4()}.{file_ext}"
        file_path = f"media/{patient_id}/{unique_filename}"

        supabase_admin.storage.from_("patient-photos").upload(
            path=file_path,
            file=file_content,
            file_options={"content-type": "image/jpeg"}
        )

        db_record = supabase_admin.table('media').insert({
            "patient_id": patient_id,
            "uploaded_by": user_id,
            "type": "photo",
            "storage_path": file_path,
            "status": "pending"
        }).execute()

        return {"success": True, "data": db_record.data[0]}

    except Exception as e:
        logger.error(f"Failed to upload {file.filename}: {e}")
        return {
            "success": False,
            "error": {"filename": file.filename, "error": str(e)}
        }

@router.post("/{media_id}/ai-tag")
@limiter.limit(RATE_LIMITS["ai_tag"], key_func=get_user_id_or_ip)
async def ai_auto_tag(request: Request, media_id: str, current_user: User = Depends(get_current_user)) -> dict[str, Any]:
    validate_uuid(media_id, "media_id")
    media_response = supabase_admin.table('media').select("*").eq("id", media_id).single().execute()
    media_item = media_response.data

    if not media_item:
        raise HTTPException(status_code=404, detail="Media not found")

    try:
        image_bytes = supabase_admin.storage.from_("patient-photos").download(media_item['storage_path'])
        suggestions = await analyze_image(image_bytes)
    except Exception as e:
        logger.error(f"AI tagging failed for media {media_id}: {e}")
        raise HTTPException(status_code=500, detail="AI tagging failed")

    return {"suggestions": suggestions}

@router.patch("/{media_id}")
async def update_media(
    media_id: str,
    updates: MediaUpdateRequest,
    current_user: User = Depends(get_current_user)
) -> dict[str, Any]:
    validate_uuid(media_id, "media_id")
    update_data = updates.model_dump(exclude_unset=True)
    if not update_data:
        return {}
    result = supabase_admin.table('media').update(update_data).eq("id", media_id).execute()
    return result.data[0] if result.data else {}

@router.post("/{media_id}/tags")
async def add_media_tag(
    media_id: str,
    tag: MediaTagCreate,
    current_user: User = Depends(get_current_user)
) -> dict[str, Any]:
    validate_uuid(media_id, "media_id")
    logger.info(f"Adding tag to media {media_id}: {tag}")
    try:
        result = supabase_admin.table('media_tags').insert({
            "media_id": media_id,
            "tag_type": tag.tag_type.value,
            "tag_value": tag.tag_value,
            "source": "manual"
        }).execute()
        return result.data[0] if result.data else {}
    except Exception as e:
        logger.error(f"Failed to add tag: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to add tag: {str(e)}")

@router.delete("/{media_id}/tags/{tag_id}")
async def delete_media_tag(
    media_id: str,
    tag_id: str,
    current_user: User = Depends(get_current_user)
) -> dict[str, str]:
    validate_uuid(media_id, "media_id")
    validate_uuid(tag_id, "tag_id")
    supabase_admin.table('media_tags').delete().eq("id", tag_id).eq("media_id", media_id).execute()
    return {"message": "Tag deleted"}

@router.delete("/{media_id}")
async def delete_media(
    media_id: str,
    current_user: User = Depends(get_current_user)
) -> dict[str, str]:
    validate_uuid(media_id, "media_id")
    # Get media record
    media_res = supabase_admin.table('media').select("*").eq("id", media_id).single().execute()
    if not media_res.data:
        raise HTTPException(status_code=404, detail="Media not found")
    
    media_item = media_res.data
    
    # Verify access - only uploader or patient's caregiver can delete
    patient_res = supabase_admin.table('patients').select("caregiver_id").eq("id", media_item["patient_id"]).single().execute()
    if not patient_res.data:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    if media_item["uploaded_by"] != current_user.id and patient_res.data["caregiver_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this media")
    
    # Delete from DB
    # Note: media_tags are automatically deleted via ON DELETE CASCADE in the database schema
    supabase_admin.table('media').delete().eq("id", media_id).execute()

    
    # Delete from storage
    try:
        supabase_admin.storage.from_("patient-photos").remove([media_item["storage_path"]])
    except Exception as e:
        logger.error(f"Failed to delete storage file {media_item['storage_path']}: {e}")
        
    return {"message": "Media deleted successfully"}
