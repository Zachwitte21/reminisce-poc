import asyncio
import json
import logging
import struct
from typing import Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status, Depends, HTTPException
from gotrue.types import User

from app.dependencies import supabase_admin, get_current_user
from app.services.gemini_live_service import GeminiLiveSession
from app.models.schemas import VoiceTranscriptSave

logger = logging.getLogger(__name__)

router = APIRouter()


# ============================================================================
# REST ENDPOINT: Transcript Persistence
# ============================================================================

@router.post("/transcript/{session_id}")
async def save_session_transcript(
    session_id: str,
    data: VoiceTranscriptSave,
    current_user: User = Depends(get_current_user)
):
    """
    Save a voice therapy session transcript to the database.

    Called by: Frontend useVoiceSession.saveTranscriptToBackend()
    When: Voice session ends (disconnect() is called)

    Request Body (VoiceTranscriptSave):
    {
        "transcript": [
            {"role": "model", "text": "Hello!", "timestamp": "..."},
            {"role": "system", "text": "Viewed photo abc123", "timestamp": "...", "photo_id": "abc123"},
            ...
        ],
        "duration": 300,      // Session duration in seconds
        "word_count": 150     // Total words spoken
    }

    Response:
    {
        "success": true,
        "id": "uuid-of-saved-transcript"
    }

    Authorization:
    - Requires valid JWT token in Authorization header
    - User must be the caregiver for the patient associated with this session

    FUTURE IMPROVEMENTS:
    - [ ] Allow supporters to save transcripts (with appropriate RLS)
    - [ ] Add validation for transcript structure
    - [ ] Implement idempotency (prevent duplicate saves)
    - [ ] Add compression for large transcripts
    """
    try:
        # --------------------------------------------------------------------
        # STEP 1: Verify the therapy session exists
        # --------------------------------------------------------------------
        session_result = supabase_admin.table('therapy_sessions').select(
            "id, patient_id"
        ).eq("id", session_id).single().execute()

        if not session_result.data:
            raise HTTPException(status_code=404, detail="Session not found")

        patient_id = session_result.data["patient_id"]

        # --------------------------------------------------------------------
        # STEP 2: Verify user is the caregiver for this patient
        #
        # Note: We check caregiver_id directly rather than using RLS because
        # the admin client bypasses RLS. In a future refactor, consider using
        # a user-context client with RLS for automatic authorization.
        # --------------------------------------------------------------------
        patient_result = supabase_admin.table('patients').select(
            "caregiver_id"
        ).eq("id", patient_id).single().execute()

        if not patient_result.data or patient_result.data["caregiver_id"] != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized to save transcript for this session")

        # --------------------------------------------------------------------
        # STEP 3: Insert transcript into database
        #
        # The transcript is stored as JSONB for flexible querying.
        # Duration and word_count are denormalized for quick analytics.
        # --------------------------------------------------------------------
        result = supabase_admin.table('voice_transcripts').insert({
            "therapy_session_id": session_id,
            "transcript": data.transcript,
            "duration_seconds": data.duration,
            "word_count": data.word_count
        }).execute()

        logger.info(f"Saved transcript for session {session_id}: {len(data.transcript)} entries, {data.word_count} words")
        return {"success": True, "id": result.data[0]["id"] if result.data else None}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error saving transcript: {e}")
        raise HTTPException(status_code=500, detail="Failed to save transcript")


# ============================================================================
# WEBSOCKET HELPERS (Used when WebSocket endpoint is active)
# ============================================================================

async def verify_token_and_access(token: str, patient_id: str) -> Optional[dict]:
    """
    Validate JWT and verify user has access to the patient.

    Used by: WebSocket endpoint for authentication

    Returns:
        dict with user_id, patient_id, patient_name, role if authorized
        None if not authorized

    Authorization Logic:
    1. Verify JWT token is valid
    2. Check if user is the caregiver for the patient
    3. If not caregiver, check if user is an active supporter

    FUTURE IMPROVEMENTS:
    - [ ] Cache token validation results
    - [ ] Add rate limiting for failed auth attempts
    """
    try:
        # Verify JWT token
        user_response = supabase_admin.auth.get_user(token)
        if not user_response or not user_response.user:
            logger.warning("Invalid token provided for voice session")
            return None

        user_id = user_response.user.id

        # Check if user is caregiver
        patient_result = supabase_admin.table('patients').select(
            "id, first_name, caregiver_id"
        ).eq("id", patient_id).single().execute()

        if not patient_result.data:
            logger.warning(f"Patient not found: {patient_id}")
            return None

        patient = patient_result.data

        if patient["caregiver_id"] == user_id:
            return {
                "user_id": user_id,
                "patient_id": patient_id,
                "patient_name": patient["first_name"],
                "role": "caregiver"
            }

        # Check if user is supporter
        supporter_result = supabase_admin.table('patient_supporters').select(
            "id"
        ).eq("patient_id", patient_id).eq(
            "supporter_id", user_id
        ).is_("revoked_at", "null").execute()

        if supporter_result.data:
            return {
                "user_id": user_id,
                "patient_id": patient_id,
                "patient_name": patient["first_name"],
                "role": "supporter"
            }

        logger.warning(f"User {user_id} denied access to patient {patient_id}")
        return None

    except Exception as e:
        logger.error(f"Error verifying token/access: {e}")
        return None


async def get_photo_metadata(photo_id: str, patient_id: str) -> Optional[dict]:
    """
    Fetch photo caption, tags, and date from database.

    Used by: WebSocket endpoint when client sends photo_change message

    Returns:
        dict with photo_id, caption, tags, date_taken if found
        None if photo not found or access denied

    Note: This provides context to the AI model about the current photo
    without needing to send the actual image (text-only context).

    FUTURE IMPROVEMENTS:
    - [ ] Cache frequently accessed photo metadata
    - [ ] Include AI-generated image descriptions
    - [ ] Add emotional context tags
    """
    try:
        # Get photo metadata
        media_result = supabase_admin.table('media').select(
            "id, caption, date_taken"
        ).eq("id", photo_id).eq("patient_id", patient_id).single().execute()

        if not media_result.data:
            logger.warning(f"Photo not found: {photo_id}")
            return None

        media = media_result.data

        # Get tags for this photo
        tags_result = supabase_admin.table('media_tags').select(
            "tag_value"
        ).eq("media_id", photo_id).execute()

        tags = [tag["tag_value"] for tag in (tags_result.data or [])]

        return {
            "photo_id": photo_id,
            "caption": media.get("caption"),
            "tags": tags,
            "date_taken": str(media["date_taken"]) if media.get("date_taken") else None
        }

    except Exception as e:
        logger.error(f"Error fetching photo metadata: {e}")
        return None


async def save_transcript(
    therapy_session_id: str,
    transcript_data: list[dict],
    duration_seconds: int,
    word_count: int
) -> bool:
    """
    Persist transcript to voice_transcripts table.

    Used by: WebSocket endpoint on disconnect (finally block)

    This is the WebSocket version of transcript saving. The REST endpoint
    above is used by the frontend's direct Gemini connection.

    Returns:
        True if saved successfully, False otherwise

    Note: This function is called from the WebSocket finally block,
    so it should not raise exceptions (they would be silently ignored).
    """
    try:
        result = supabase_admin.table('voice_transcripts').insert({
            "therapy_session_id": therapy_session_id,
            "transcript": transcript_data,
            "duration_seconds": duration_seconds,
            "word_count": word_count
        }).execute()

        if result.data:
            logger.info(f"Saved transcript for session {therapy_session_id}")
            return True

        return False

    except Exception as e:
        logger.error(f"Error saving transcript: {e}")
        return False


# ============================================================================
# WEBSOCKET ENDPOINT (Alternative to Direct Gemini Connection)
# ============================================================================

@router.websocket("/ws/voice/{session_id}")
async def voice_websocket(
    websocket: WebSocket,
    session_id: str,
    patient_id: str,
    token: str
) -> None:
    # ------------------------------------------------------------------------
    # AUTHENTICATION
    # ------------------------------------------------------------------------
    access_data = await verify_token_and_access(token, patient_id)

    if not access_data:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    # Accept the WebSocket connection
    await websocket.accept()

    # ------------------------------------------------------------------------
    # GEMINI SESSION SETUP
    # ------------------------------------------------------------------------
    gemini_session = GeminiLiveSession(
        patient_id=patient_id,
        session_id=session_id,
        patient_name=access_data["patient_name"]
    )

    # ------------------------------------------------------------------------
    # CALLBACK DEFINITIONS
    #
    # These callbacks are invoked by GeminiLiveSession when events occur.
    # They forward data from Gemini to the client WebSocket.
    # ------------------------------------------------------------------------

    async def on_audio(audio_data: bytes, metadata: dict) -> None:
        """
        Forward consolidated audio with metadata to client.

        Binary Protocol:
        - Byte 0: Message type (0x01 = audio chunk)
        - Bytes 1-4: Sequence number (uint32, big-endian)
        - Bytes 5-8: Timestamp in ms (uint32, big-endian)
        - Bytes 9-12: Duration in ms (uint32, big-endian)
        - Bytes 13+: PCM audio data (16-bit, 24kHz, mono)
        """
        try:
            # Pack metadata into binary header
            header = struct.pack(
                '>BIII',  # Big-endian: byte + 3 uint32s
                0x01,  # Message type: audio chunk
                metadata['sequence'],
                metadata['timestamp'],
                metadata['duration_ms']
            )
            message = header + audio_data
            await websocket.send_bytes(message)
            logger.info(
                f"Sent audio to client: {metadata['duration_ms']}ms, "
                f"{len(audio_data)} bytes (seq {metadata['sequence']})"
            )
        except Exception as e:
            logger.error(f"Error sending audio to client: {e}")

    async def on_text(role: str, text: str) -> None:
        """Forward transcript to client for display."""
        try:
            await websocket.send_json({
                "type": "transcript",
                "role": role,
                "text": text
            })
        except Exception as e:
            logger.error(f"Error sending transcript to client: {e}")

    async def on_interrupted() -> None:
        """Notify client that model output was interrupted by user speech."""
        try:
            await websocket.send_json({"type": "interrupted"})
        except Exception as e:
            logger.error(f"Error sending interrupted to client: {e}")

    # ------------------------------------------------------------------------
    # MAIN SESSION LOOP
    # ------------------------------------------------------------------------
    try:
        # Connect to Gemini with callbacks
        connected = await gemini_session.connect(
            on_audio=lambda data, metadata: asyncio.create_task(on_audio(data, metadata)),
            on_text=lambda role, text: asyncio.create_task(on_text(role, text)),
            on_interrupted=lambda: asyncio.create_task(on_interrupted())
        )

        if not connected:
            await websocket.send_json({
                "type": "error",
                "message": "Failed to connect to AI service"
            })
            await websocket.close()
            return

        # Send connection confirmation to client
        await websocket.send_json({
            "type": "connected",
            "session_id": session_id
        })

        logger.info(f"Voice session started: {session_id} for patient {patient_id}")

        # --------------------------------------------------------------------
        # MESSAGE LOOP
        #
        # Continuously receive messages from client and forward to Gemini.
        # Runs until client disconnects or error occurs.
        # --------------------------------------------------------------------
        while True:
            message = await websocket.receive()

            # Binary audio data → Gemini
            if "bytes" in message:
                audio_bytes = message["bytes"]

                # Check for WebM header (EBML signature) - indicates wrong format from web
                if len(audio_bytes) > 4 and audio_bytes[:4] == b'\x1a\x45\xdf\xa3':
                    logger.warning("Received WebM audio - need raw PCM. Check WebAudioRecorder.")
                else:
                    # Forward PCM audio to Gemini
                    await gemini_session.send_audio(audio_bytes)

            # JSON control messages
            elif "text" in message:
                try:
                    data = json.loads(message["text"])
                    msg_type = data.get("type")

                    # Photo change → Update context in Gemini
                    if msg_type == "photo_change":
                        photo_id = data.get("photo_id")
                        if photo_id:
                            metadata = await get_photo_metadata(photo_id, patient_id)
                            if metadata:
                                await gemini_session.update_photo_context(
                                    photo_id=photo_id,
                                    caption=metadata.get("caption"),
                                    tags=metadata.get("tags"),
                                    date_taken=metadata.get("date_taken")
                                )
                            else:
                                await gemini_session.update_photo_context(photo_id=photo_id)

                            await websocket.send_json({
                                "type": "photo_context_updated",
                                "photo_id": photo_id
                            })

                    # Text input → Send to Gemini as user speech
                    elif msg_type == "text":
                        text = data.get("text")
                        if text:
                            logger.info(f"Received text from client: {text[:100]}...")
                            await gemini_session.send_text(text, is_user_speech=True)

                except json.JSONDecodeError:
                    logger.warning("Received invalid JSON message")

    except WebSocketDisconnect:
        logger.info(f"Client disconnected from voice session: {session_id}")

    except Exception as e:
        logger.error(f"Error in voice WebSocket: {e}")
        try:
            await websocket.send_json({
                "type": "error",
                "message": "An unexpected error occurred"
            })
        except Exception:
            pass

    finally:
        # --------------------------------------------------------------------
        # CLEANUP: Disconnect from Gemini and save transcript
        #
        # This runs regardless of how the session ended (normal disconnect,
        # error, or client disconnect).
        # --------------------------------------------------------------------
        transcript_result = await gemini_session.disconnect()

        # Save transcript to database for analytics and review
        if transcript_result["transcript"]:
            await save_transcript(
                therapy_session_id=session_id,
                transcript_data=transcript_result["transcript"],
                duration_seconds=transcript_result["duration_seconds"],
                word_count=transcript_result["word_count"]
            )

        logger.info(f"Voice session ended: {session_id}")
