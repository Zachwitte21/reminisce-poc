import logging
from typing import Any

from fastapi import APIRouter, HTTPException, Depends, File, UploadFile, Request

from app.dependencies import supabase_admin, get_current_user
from app.models.schemas import UserLogin, UserRegister, UserResponse
from app.utils.storage import get_signed_url
from app.middleware.rate_limit import limiter, RATE_LIMITS
from gotrue.types import User as GotrueUser

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/register")
@limiter.limit(RATE_LIMITS["auth_register"])
async def register(request: Request, user: UserRegister) -> dict[str, Any]:
    try:
        auth_response = supabase_admin.auth.sign_up({
            "email": user.email,
            "password": user.password,
        })

        if not auth_response.user:
            raise HTTPException(status_code=400, detail="Registration failed")

        user_id = auth_response.user.id

        supabase_admin.table('profiles').insert({
            "id": user_id,
            "full_name": user.full_name,
            "email": user.email,
            "role": user.role
        }).execute()

        return {"message": "User registered successfully", "user_id": user_id}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Registration error: {e}")
        raise HTTPException(status_code=400, detail=f"Registration failed: {e}")

@router.get("/me", response_model=UserResponse)
async def get_me(current_user: GotrueUser = Depends(get_current_user)) -> UserResponse:
    profile_response = supabase_admin.table('profiles').select('*').eq(
        'id', current_user.id
    ).single().execute()
    profile = profile_response.data

    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        full_name=profile.get('full_name'),
        role=profile.get('role'),
        avatar_url=get_signed_url(profile.get('avatar_url'), bucket="avatars") if profile.get('avatar_url') else None
    )

@router.post("/avatar", response_model=UserResponse)
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: GotrueUser = Depends(get_current_user)
) -> UserResponse:
    allowed_types = {"image/jpeg", "image/png", "image/webp", "image/heic"}
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail=f"Invalid file type '{file.content_type}'.")

    file_ext = file.filename.split('.')[-1]
    storage_path = f"profile/{current_user.id}.{file_ext}"
    
    file_content = await file.read()
    
    # Upload to 'avatars' bucket
    supabase_admin.storage.from_("avatars").upload(
        storage_path,
        file_content,
        {"content-type": file.content_type, "upsert": "true"}
    )
    
    # Update profile
    supabase_admin.table('profiles').update(
        {"avatar_url": storage_path}
    ).eq("id", current_user.id).execute()
    
    return await get_me(current_user)

@router.post("/login")
@limiter.limit(RATE_LIMITS["auth_login"])
async def login(request: Request, user: UserLogin) -> dict[str, Any]:
    try:
        response = supabase_admin.auth.sign_in_with_password({
            "email": user.email,
            "password": user.password,
        })

        profile_response = supabase_admin.table('profiles').select('*').eq(
            'id', response.user.id
        ).single().execute()
        profile = profile_response.data

        return {
            "access_token": response.session.access_token,
            "token_type": "bearer",
            "user": {
                "id": response.user.id,
                "email": response.user.email,
                "full_name": profile.get('full_name'),
                "role": profile.get('role'),
                "avatar_url": get_signed_url(profile.get('avatar_url'), bucket="avatars") if profile.get('avatar_url') else None
            }
        }
    except Exception as e:
        logger.error(f"Login error: {e}")
        raise HTTPException(status_code=401, detail="Invalid credentials")
