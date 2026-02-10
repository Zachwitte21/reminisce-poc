import uuid as uuid_module
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from gotrue.types import User
from supabase import Client, create_client

from app.config import settings


def validate_uuid(value: str, param_name: str = "id") -> str:
    """Validate UUID format."""
    try:
        uuid_module.UUID(value)
        return value
    except ValueError:
        raise HTTPException(400, f"Invalid {param_name} format. Must be a valid UUID.")

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")

supabase_admin: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SECRET_KEY)


async def get_current_user(token: str = Depends(oauth2_scheme)) -> User:
    """Verify JWT and return the authenticated user."""
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token is required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        user = supabase_admin.auth.get_user(token)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return user.user
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication failed"
        )


async def verify_patient_caregiver(patient_id: str, user_id: str) -> dict:
    """
    Verify that the user is the caregiver for the given patient.
    Returns the patient data if authorized, raises HTTPException if not.
    """
    result = supabase_admin.table('patients').select("*").eq(
        "id", patient_id
    ).single().execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Patient not found")

    if result.data["caregiver_id"] != user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    return result.data


async def verify_patient_access(patient_id: str, user_id: str) -> dict:
    """
    Verify that the user has access to the patient (as caregiver or supporter).
    Returns the patient data if authorized, raises HTTPException if not.
    """
    result = supabase_admin.table('patients').select("*").eq(
        "id", patient_id
    ).single().execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Patient not found")

    if result.data["caregiver_id"] == user_id:
        return result.data

    supporter = supabase_admin.table('patient_supporters').select("id").eq(
        "patient_id", patient_id
    ).eq("supporter_id", user_id).is_("revoked_at", "null").execute()

    if not supporter.data:
        raise HTTPException(status_code=403, detail="Access denied")

    return result.data