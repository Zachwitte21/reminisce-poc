import logging
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, File, UploadFile
from gotrue.types import User

from app.dependencies import (
    get_current_user,
    supabase_admin,
    verify_patient_access,
    verify_patient_caregiver,
)
from app.utils.storage import get_signed_url
from app.services.storage_service import compress_image
from app.models.schemas import (
    PatientCreate,
    PatientResponse,
    PatientSettingsUpdate,
    PatientUpdate,
    SupporterResponse,
)
from app.services.invitations_service import InvitationsService

logger = logging.getLogger(__name__)

router = APIRouter()

import random

def _sign_patient_photo(patient: dict[str, Any]) -> dict[str, Any]:
    """Sign the patient photo URL."""

    # Handle Photo (Random or Static)
    photo_url = patient.get("photo_url")

    if not photo_url or photo_url == "random":
        # Pick a random image from all patient photos
        try:
            # We can't do random efficiently in Supabase without rpc, so fetch IDs
            # Limit to 50 latest to keep it fresh? Or just fetch all IDs?
            media_res = supabase_admin.table('media').select("storage_path").eq(
                "patient_id", patient["id"]
            ).eq("type", "photo").limit(50).execute()

            items = media_res.data
            if items:
                random_item = random.choice(items)
                patient["photo_url"] = get_signed_url(random_item["storage_path"])
            else:
                patient["photo_url"] = None  # No content yet
        except Exception as e:
            logger.error(f"Error fetching random photo: {e}")
            patient["photo_url"] = None
    elif photo_url and not photo_url.startswith("http"):
         # It's a specific path
        patient["photo_url"] = get_signed_url(photo_url)

    return patient

@router.post("/", response_model=PatientResponse)
async def create_patient(patient: PatientCreate, current_user: User = Depends(get_current_user)) -> PatientResponse:
    # Check if caregiver already has a patient (v1.0 limit)
    existing = supabase_admin.table('patients').select("id").eq(
        "caregiver_id", current_user.id
    ).execute()

    if existing.data:
        raise HTTPException(status_code=400, detail="Caregiver already has a patient")

    # Create patient
    result = supabase_admin.table('patients').insert({
        "caregiver_id": current_user.id,
        "first_name": patient.first_name,
        "last_name": patient.last_name,
        "birth_date": patient.birth_date.isoformat() if patient.birth_date else None,
        "relationship": patient.relationship
    }).execute()

    patient_data = result.data[0]

    # Create default settings
    supabase_admin.table('patient_settings').insert({
        "patient_id": patient_data["id"],
        "require_photo_approval": True,
        "voice_therapy_enabled": True,
        "voice_speed": "slow"
    }).execute()

    return _sign_patient_photo(patient_data)

@router.get("/me", response_model=PatientResponse)
async def get_my_patient(current_user: User = Depends(get_current_user)) -> PatientResponse:
    """Get the patient profile associated with the current caregiver or supporter."""
    user_id = current_user.id
    role = current_user.user_metadata.get('role', 'unknown')
    
    # If metadata is missing role, check profiles table
    if role == 'unknown':
        try:
            profile = supabase_admin.table('profiles').select("role").eq("id", user_id).single().execute()
            if profile.data:
                role = profile.data['role']
                logger.info(f"[PatientsRouter] Role resolved from profile: {role}")
        except:
            pass

    logger.info(f"[PatientsRouter] get_my_patient for user: {user_id} (Role: {role})")
    
    try:
        # 1. Path for caregivers
        if role == 'caregiver':
            result = supabase_admin.table('patients').select("*").eq(
                "caregiver_id", current_user.id
            ).execute()
            
            if result.data:
                logger.info(f"[PatientsRouter] Found patient as caregiver: {result.data[0]['id']}")
                return _sign_patient_photo(result.data[0])

        # 2. Path for supporters (or fallback)
        supporter_link = supabase_admin.table('patient_supporters').select("patient_id").eq(
            "supporter_id", current_user.id
        ).is_("revoked_at", "null").execute()

        if supporter_link.data:
            patient_id = supporter_link.data[0]["patient_id"]
            logger.info(f"[PatientsRouter] Found patient as supporter: {patient_id}")
            
            patient_result = supabase_admin.table('patients').select("*").eq(
                "id", patient_id
            ).execute()
            
            if patient_result.data:
                return _sign_patient_photo(patient_result.data[0])

        # 3. Last chance fallback: check caregiver again if role was missing
        if role != 'caregiver':
            result = supabase_admin.table('patients').select("*").eq(
                "caregiver_id", current_user.id
            ).execute()
            if result.data:
                return _sign_patient_photo(result.data[0])

        logger.warning(f"[PatientsRouter] No patient found for user {user_id}")
        raise HTTPException(status_code=404, detail="Patient profile not found for this user")
    except Exception as e:
        logger.error(f"[PatientsRouter] Error in get_my_patient: {str(e)}", exc_info=True)
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"Internal error retrieving patient: {str(e)}")

@router.get("/{patient_id}", response_model=PatientResponse)
async def get_patient(patient_id: str, current_user: User = Depends(get_current_user)) -> PatientResponse:
    patient = await verify_patient_access(patient_id, current_user.id)
    return _sign_patient_photo(patient)

@router.patch("/{patient_id}", response_model=PatientResponse)
async def update_patient(
    patient_id: str,
    updates: PatientUpdate,
    current_user: User = Depends(get_current_user)
) -> PatientResponse:
    await verify_patient_caregiver(patient_id, current_user.id)

    update_data = updates.model_dump(exclude_unset=True)
    if "birth_date" in update_data and update_data["birth_date"]:
        update_data["birth_date"] = update_data["birth_date"].isoformat()

    result = supabase_admin.table('patients').update(update_data).eq(
        "id", patient_id
    ).execute()

    return _sign_patient_photo(result.data[0])

@router.post("/{patient_id}/photo", response_model=PatientResponse)
async def upload_patient_photo(
    patient_id: str,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
) -> PatientResponse:
    await verify_patient_caregiver(patient_id, current_user.id)
    
    logger.info(f"Received avatar upload request for patient {patient_id}. Filename: {file.filename}, Content-Type: {file.content_type}")

    # Read and compress
    content = await file.read()
    logger.info(f"Read {len(content)} bytes from file")
    
    compressed_content = await compress_image(content)
    logger.info(f"Compressed content size: {len(compressed_content)}")
    
    # Save as patient photo
    file_path = f"profile/photo_{patient_id}.jpg"
    
    # Upload (overwrite with upsert=true)
    try:
        logger.info(f"Uploading to Supabase storage: {file_path}")
        supabase_admin.storage.from_("patient-photos").upload(
            path=file_path,
            file=compressed_content,
            file_options={"content-type": "image/jpeg", "upsert": "true"}
        )
        
        # Update patient record with the storage path (to photo_url)
        logger.info(f"Updating patient record for {patient_id} with photo_url: {file_path}")
        result = supabase_admin.table('patients').update({
            "photo_url": file_path
        }).eq("id", patient_id).execute()
        logger.info(f"Update Result: {result}")
        
        return _sign_patient_photo(result.data[0])
    except Exception as e:
        logger.error(f"Error uploading photo: {e}")
        raise HTTPException(status_code=422, detail=str(e))

@router.patch("/{patient_id}/settings")
async def update_patient_settings(
    patient_id: str,
    settings: PatientSettingsUpdate,
    current_user: User = Depends(get_current_user)
) -> dict[str, Any]:
    await verify_patient_caregiver(patient_id, current_user.id)

    update_data = settings.model_dump(exclude_unset=True)
    result = supabase_admin.table('patient_settings').update(update_data).eq(
        "patient_id", patient_id
    ).execute()

    return {"settings": result.data[0] if result.data else {}}

@router.get("/{patient_id}/settings")
async def get_patient_settings(
    patient_id: str,
    current_user: User = Depends(get_current_user)
) -> dict[str, Any]:
    await verify_patient_caregiver(patient_id, current_user.id)

    settings = supabase_admin.table('patient_settings').select("*").eq(
        "patient_id", patient_id
    ).single().execute()

    return {"settings": settings.data or {}}


@router.get("/{patient_id}/supporters", response_model=list[SupporterResponse])
async def list_supporters(
    patient_id: str,
    current_user: User = Depends(get_current_user)
) -> list[SupporterResponse]:
    """List all supporters for a patient. Only the caregiver can list supporters."""
    return await InvitationsService.list_supporters(patient_id, current_user.id)

@router.delete("/{patient_id}/supporters/{supporter_id}")
async def revoke_supporter_access(
    patient_id: str,
    supporter_id: str,
    current_user: User = Depends(get_current_user)
) -> dict[str, str]:
    """Revoke access for a supporter. Only the caregiver can revoke access."""
    return await InvitationsService.revoke_access(patient_id, supporter_id, current_user.id)

@router.get("/{patient_id}/media", response_model=list[Any])
async def list_patient_media(
    patient_id: str,
    status: Optional[str] = None,
    current_user: User = Depends(get_current_user)
) -> list[Any]:
    await verify_patient_access(patient_id, current_user.id)

    query = supabase_admin.table('media').select("*").eq("patient_id", patient_id)
    if status:
        query = query.eq("status", status)

    media_res = query.order("created_at", desc=True).execute()
    media_items = media_res.data or []

    for item in media_items:
        item['url'] = get_signed_url(item['storage_path'])
        tags_res = supabase_admin.table('media_tags').select("*").eq("media_id", item['id']).execute()
        item['tags'] = tags_res.data or []

    return media_items


