import random
import logging
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from gotrue.types import User

from app.dependencies import get_current_user, supabase_admin, verify_patient_caregiver
from app.services.ai_service import curate_session
from app.models.schemas import (
    TherapyScheduleCreate,
    TherapyScheduleUpdate,
    TherapySessionCreate,
    TherapySessionEnd,
    TherapySessionResponse,
    MediaFilterRequest,
)
from app.utils.storage import get_signed_url

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/therapy-sessions", response_model=TherapySessionResponse)
async def start_therapy_session(
    session: TherapySessionCreate,
    current_user: User = Depends(get_current_user)
) -> dict[str, Any]:
    logger.info(f"Starting therapy session for patient {session.patient_id}...")
    await verify_patient_caregiver(session.patient_id, current_user.id)
    logger.info("Access verified")

    result = supabase_admin.table('therapy_sessions').insert({
        "patient_id": session.patient_id,
        "voice_enabled": session.voice_enabled,
        "started_at": datetime.utcnow().isoformat()
    }).execute()

    if not result.data:
        logger.error("Failed to insert therapy session into database")
        raise HTTPException(status_code=500, detail="Failed to create therapy session")

    session_data = result.data[0]
    logger.info(f"Session created with ID: {session_data['id']}")

    media_query = supabase_admin.table('media').select("*, tags:media_tags(*)").eq(
        "patient_id", session.patient_id
    ).eq("status", "approved")

    if session.media_filter:
        logger.info(f"Applying media filter: {session.media_filter}")
        if session.media_filter.start_date:
            media_query = media_query.gte("date_taken", session.media_filter.start_date.isoformat())
        if session.media_filter.end_date:
            media_query = media_query.lte("date_taken", session.media_filter.end_date.isoformat())

    media_result = media_query.execute()
    media_pool = media_result.data or []
    logger.info(f"Found {len(media_pool)} approved photos in pool")

    if not media_pool:
        return {**session_data, "media_queue": []}

    # Determine target count (1 photo per minute of session duration)
    # Using order().limit(1) instead of single() to avoid raising an error if no schedule exists
    schedule_res = supabase_admin.table('therapy_schedules').select("session_duration").eq(
        "patient_id", session.patient_id
    ).limit(1).execute()
    
    target_count = 15 # Default
    if schedule_res.data and len(schedule_res.data) > 0:
        target_count = schedule_res.data[0].get("session_duration", 15)

    # Use AI Curation
    selected_ids = await curate_session(media_pool, target_count)

    if selected_ids:
        # Re-order the media pool based on AI selection
        id_map = {item["id"]: item for item in media_pool}
        media_queue = [id_map[mid] for mid in selected_ids if mid in id_map]
    else:
        # Fallback to random shuffle
        media_queue = media_pool
        random.shuffle(media_queue)
        media_queue = media_queue[:target_count]

    # Add signed URLs to the queue
    for item in media_queue:
        item['url'] = get_signed_url(item['storage_path'])

    return {
        **session_data,
        "media_queue": media_queue
    }

@router.patch("/therapy-sessions/{session_id}/end")
async def end_therapy_session(
    session_id: str,
    end_data: TherapySessionEnd,
    current_user: User = Depends(get_current_user)
) -> dict[str, Any]:
    result = supabase_admin.table('therapy_sessions').update({
        "ended_at": datetime.utcnow().isoformat(),
        "photos_viewed": end_data.photos_viewed,
        "duration_seconds": end_data.duration,
        "completed_naturally": end_data.completed_naturally
    }).eq("id", session_id).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Session not found")

    return {"session": result.data[0]}

@router.get("/patients/{patient_id}/therapy-sessions")
async def get_session_history(
    patient_id: str,
    limit: int = 20,
    current_user: User = Depends(get_current_user)
) -> dict[str, Any]:
    result = supabase_admin.table('therapy_sessions').select("*").eq(
        "patient_id", patient_id
    ).order("started_at", desc=True).limit(limit).execute()

    sessions = result.data or []
    total = len(sessions)
    total_duration = sum(s.get("duration_seconds") or 0 for s in sessions)
    avg_duration = total_duration / total if total > 0 else 0

    return {
        "sessions": sessions,
        "stats": {
            "total_sessions": total,
            "average_duration": round(avg_duration),
        }
    }

@router.post("/therapy-schedules")
async def create_schedule(
    schedule: TherapyScheduleCreate,
    current_user: User = Depends(get_current_user)
) -> dict[str, Any]:
    sessions_json = [
        {"day_of_week": s.day_of_week, "time_of_day": s.time_of_day, "enabled": s.enabled}
        for s in schedule.sessions
    ]
    result = supabase_admin.table('therapy_schedules').insert({
        "patient_id": schedule.patient_id,
        "session_duration": schedule.session_duration,
        "notification_minutes_before": schedule.notification_minutes_before,
        "sessions": sessions_json,
    }).execute()

    return {"schedule": result.data[0]}

@router.get("/patients/{patient_id}/therapy-schedule")
async def get_schedule(patient_id: str, current_user: User = Depends(get_current_user)) -> dict[str, Any]:
    result = supabase_admin.table('therapy_schedules').select("*").eq(
        "patient_id", patient_id
    ).execute()

    if not result.data:
        return {"schedule": None}

    return {"schedule": result.data[0]}

@router.patch("/therapy-schedules/{schedule_id}")
async def update_schedule(
    schedule_id: str,
    updates: TherapyScheduleUpdate,
    current_user: User = Depends(get_current_user)
) -> dict[str, str]:
    update_data = updates.model_dump(exclude_unset=True)

    if "sessions" in update_data and update_data["sessions"] is not None:
        update_data["sessions"] = [
            {"day_of_week": s["day_of_week"], "time_of_day": s["time_of_day"], "enabled": s["enabled"]}
            for s in update_data["sessions"]
        ]

    if update_data:
        supabase_admin.table('therapy_schedules').update(update_data).eq(
            "id", schedule_id
        ).execute()

    return {"message": "Schedule updated"}