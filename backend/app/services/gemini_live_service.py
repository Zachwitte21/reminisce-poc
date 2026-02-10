"""
Gemini Live Service - Real-time bidirectional voice streaming with Google's Gemini Live API.

This service manages WebSocket connections to the Gemini Multimodal Live API for
voice-based reminiscence therapy sessions.

============================================================================
AUDIO FLOW
============================================================================

INCOMING (User → Gemini):
  Frontend WebSocket → voice.py → GeminiLiveSession.send_audio()
  Format: PCM 16-bit, 16kHz, mono

OUTGOING (Gemini → User):
  Gemini sends ~200ms chunks → passed through immediately to frontend
  Format: PCM 16-bit, 24kHz, mono
  Binary protocol: [type:1][seq:4][time:4][duration:4][audio:N]
  Frontend handles buffering and gapless playback scheduling.

============================================================================
"""

import asyncio
import logging
import time
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Callable, Optional

from google import genai
from google.genai import types

from app.config import settings

logger = logging.getLogger(__name__)

# System prompt for therapy-focused conversations
THERAPY_SYSTEM_PROMPT = """You are a warm, patient companion helping someone with memory challenges engage in reminiscence therapy by looking at photos from their life.

Guidelines:
- Speak slowly and clearly
- Use simple, short sentences
- Ask gentle, open-ended questions about the photo
- Never correct or contradict their memories
- Show genuine interest and warmth
- Be encouraging and supportive
- If they seem confused, gently redirect to the photo
- Celebrate any memories they share, no matter how small

The patient's name is {patient_name}. Address them by name occasionally to maintain connection.

When a new photo is presented, acknowledge it naturally and invite them to share what they see or remember about it."""


@dataclass
class TranscriptEntry:
    """A single entry in the conversation transcript."""
    role: str  # 'user', 'model', or 'system'
    text: str
    timestamp: str
    photo_id: Optional[str] = None


@dataclass
class GeminiLiveSession:
    """Manages a real-time voice session with Google's Gemini Live API."""

    patient_id: str
    session_id: str
    patient_name: str = "the patient"

    # Internal state
    _client: genai.Client = field(default=None, init=False, repr=False)
    _session: types.AsyncSession = field(default=None, init=False, repr=False)
    _session_context: Any = field(default=None, init=False, repr=False)  # Async context manager
    _transcript: list[TranscriptEntry] = field(default_factory=list, init=False)
    _current_photo_id: Optional[str] = field(default=None, init=False)
    _connected: bool = field(default=False, init=False)
    _start_time: Optional[datetime] = field(default=None, init=False)
    _sequence_number: int = field(default=0, init=False)

    # Callbacks
    _on_audio: Optional[Callable[[bytes, dict], None]] = field(default=None, init=False)
    _on_text: Optional[Callable[[str, str], None]] = field(default=None, init=False)
    _on_interrupted: Optional[Callable[[], None]] = field(default=None, init=False)
    _receive_task: Optional[asyncio.Task] = field(default=None, init=False)

    async def connect(
        self,
        on_audio: Callable[[bytes, dict], None],
        on_text: Callable[[str, str], None],
        on_interrupted: Callable[[], None]
    ) -> bool:
        """
        Establish connection to Gemini Live API with callbacks.

        Args:
            on_audio: Callback for audio data (consolidated PCM bytes at 24kHz with metadata)
            on_text: Callback for transcribed text (role, text)
            on_interrupted: Callback when model output is interrupted

        Returns:
            True if connection successful, False otherwise
        """
        self._on_audio = on_audio
        self._on_text = on_text
        self._on_interrupted = on_interrupted

        # Build list of models to try (primary + fallbacks)
        models_to_try = [settings.GEMINI_LIVE_MODEL]
        if settings.GEMINI_LIVE_FALLBACK_MODELS:
            models_to_try.extend(settings.GEMINI_LIVE_FALLBACK_MODELS.split(','))

        # Initialize client with API key
        self._client = genai.Client(api_key=settings.GEMINI_API_KEY)

        # Configure the live model with voice settings
        config = types.LiveConnectConfig(
            response_modalities=["AUDIO"],
            speech_config=types.SpeechConfig(
                voice_config=types.VoiceConfig(
                    prebuilt_voice_config=types.PrebuiltVoiceConfig(
                        voice_name="Charon"  # Sets the voice actor
                    )
                )
            ),
            system_instruction=types.Content(
                parts=[types.Part(text=THERAPY_SYSTEM_PROMPT.format(
                    patient_name=self.patient_name
                ))]
            )
        )

        # Try each model until one works
        last_error = None
        for model_name in models_to_try:
            model_name = model_name.strip()
            if not model_name:
                continue

            try:
                logger.info(f"Attempting to connect with model: {model_name}")

                # Connect to the live API (returns async context manager)
                self._session_context = self._client.aio.live.connect(
                    model=model_name,
                    config=config
                )
                self._session = await self._session_context.__aenter__()

                self._connected = True
                self._start_time = datetime.utcnow()

                # Start receiving responses in the background
                self._receive_task = asyncio.create_task(self._receive_loop())

                logger.info(f"Connected to Gemini Live API with model '{model_name}' for session {self.session_id}")

                # Send initial greeting prompt to start the conversation
                await self._send_initial_greeting()

                return True

            except Exception as e:
                last_error = e
                logger.warning(f"Failed to connect with model '{model_name}': {e}")
                # Clean up any partial connection state
                if self._session_context:
                    try:
                        await self._session_context.__aexit__(None, None, None)
                    except Exception:
                        pass
                    self._session_context = None
                    self._session = None
                continue

        # All models failed
        logger.error(f"Failed to connect to Gemini Live API with any model. Last error: {last_error}")
        self._connected = False
        return False

    async def _send_initial_greeting(self) -> None:
        """Send an initial prompt to get the model to greet the user."""
        if not self._connected or not self._session:
            return

        try:
            greeting_prompt = (
                f"Hello! Please greet {self.patient_name} warmly. "
                "We're about to look at some photos together. "
                "Introduce yourself briefly as a friendly companion here to help them "
                "enjoy looking at photos and sharing memories. Keep it short and warm."
            )
            logger.info("Sending initial greeting prompt to Gemini")
            await self._session.send_client_content(
                turns=[
                    types.Content(
                        role="user",
                        parts=[types.Part(text=greeting_prompt)]
                    )
                ],
                turn_complete=True
            )
        except Exception as e:
            logger.error(f"Error sending initial greeting: {e}")

    async def _receive_loop(self) -> None:
        """Background task to receive and process responses from Gemini."""
        try:
            while self._connected and self._session:
                async for response in self._session.receive():
                    if not self._connected:
                        break

                    # Handle server content (audio/text responses)
                    if response.server_content:
                        content = response.server_content

                        # Check for turn completion
                        if content.turn_complete:
                            continue

                        # Check if model was interrupted
                        if content.interrupted:
                            if self._on_interrupted:
                                self._on_interrupted()
                            continue

                        # Process model parts
                        if content.model_turn and content.model_turn.parts:
                            for part in content.model_turn.parts:
                                # Handle audio output - pass through immediately
                                if part.inline_data and part.inline_data.data:
                                    self._send_audio_chunk(part.inline_data.data)

                                # Handle text output (legacy format)
                                if part.text:
                                    self._add_transcript("model", part.text)
                                    if self._on_text:
                                        self._on_text("model", part.text)

                        # Handle output transcription from native audio model
                        if content.output_transcription and content.output_transcription.text:
                            self._add_transcript("model", content.output_transcription.text)
                            if self._on_text:
                                self._on_text("model", content.output_transcription.text)

        except asyncio.CancelledError:
            logger.info("Receive loop cancelled")
        except Exception as e:
            logger.error(f"Error in receive loop: {e}")

    def _send_audio_chunk(self, chunk: bytes) -> None:
        """
        Send a single audio chunk directly to the client with metadata.

        Each Gemini chunk is ~200ms at 24kHz 16-bit mono (~9600 bytes).
        The frontend handles buffering and gapless playback scheduling.
        """
        if not self._on_audio:
            return

        duration_ms = int((len(chunk) / (24000 * 2)) * 1000)
        metadata = {
            'sequence': self._sequence_number,
            'timestamp': int(time.time()),
            'duration_ms': duration_ms
        }
        self._sequence_number += 1

        try:
            self._on_audio(chunk, metadata)
        except Exception as e:
            logger.error(f"Error sending audio chunk: {e}")

    async def send_audio(self, audio_data: bytes) -> None:
        """
        Send raw PCM audio bytes to Gemini.

        Args:
            audio_data: PCM audio bytes (16-bit, 16kHz, mono)
        """
        if not self._connected or not self._session:
            logger.warning("Cannot send audio: not connected")
            return

        try:
            # Use the new send_realtime_input method (send() is deprecated)
            await self._session.send_realtime_input(
                media=types.Blob(
                    data=audio_data,
                    mime_type="audio/pcm;rate=16000"
                )
            )
        except Exception as e:
            logger.error(f"Error sending audio: {e}")

    async def send_text(self, text: str, is_user_speech: bool = False) -> None:
        """
        Send text content to Gemini.

        Args:
            text: The text to send
            is_user_speech: If True, records as user speech in transcript
        """
        if not self._connected or not self._session:
            logger.warning("Cannot send text: not connected")
            return

        try:
            # Add to transcript if it's user speech
            if is_user_speech:
                self._add_transcript("user", text)

            # Use the new send_client_content method (send() is deprecated)
            await self._session.send_client_content(
                turns=[
                    types.Content(
                        role="user" if is_user_speech else "model",
                        parts=[types.Part(text=text)]
                    )
                ],
                turn_complete=True
            )
        except Exception as e:
            logger.error(f"Error sending text: {e}")

    async def update_photo_context(
        self,
        photo_id: str,
        caption: Optional[str] = None,
        tags: Optional[list[str]] = None,
        date_taken: Optional[str] = None
    ) -> None:
        """
        Update the conversation context when user navigates to a new photo.

        Args:
            photo_id: The ID of the new photo
            caption: Photo caption if available
            tags: List of tags (people, places, events)
            date_taken: When the photo was taken
        """
        if not self._connected or not self._session:
            logger.warning("Cannot update photo context: not connected")
            return

        self._current_photo_id = photo_id

        # Build context message
        context_parts = ["The user is now viewing a new photo."]

        if caption:
            context_parts.append(f"Caption: {caption}")

        if tags:
            context_parts.append(f"This photo includes: {', '.join(tags)}")

        if date_taken:
            context_parts.append(f"This photo was taken: {date_taken}")

        if not caption and not tags:
            context_parts.append("No caption or tags are available for this photo.")

        context_parts.append(
            "Gently acknowledge the new photo and invite the patient to share "
            "what they see or remember about it."
        )

        context_message = " ".join(context_parts)

        # Add system message to transcript
        self._add_transcript("system", f"Photo changed to: {photo_id}", photo_id=photo_id)

        try:
            # Send as client content (context update) using new API
            await self._session.send_client_content(
                turns=[
                    types.Content(
                        role="user",
                        parts=[types.Part(text=context_message)]
                    )
                ],
                turn_complete=True
            )
            logger.info(f"Updated photo context to {photo_id}")
        except Exception as e:
            logger.error(f"Error updating photo context: {e}")

    async def disconnect(self) -> dict:
        """
        Close the connection and return the complete transcript.

        Returns:
            Dictionary containing transcript, duration, and word count
        """
        self._connected = False

        # Cancel receive task
        if self._receive_task:
            self._receive_task.cancel()
            try:
                await self._receive_task
            except asyncio.CancelledError:
                pass

        # Close session (exit the async context manager)
        if self._session_context:
            try:
                await self._session_context.__aexit__(None, None, None)
            except Exception as e:
                logger.warning(f"Error closing session: {e}")
            self._session = None
            self._session_context = None

        # Calculate duration
        duration_seconds = 0
        if self._start_time:
            duration_seconds = int((datetime.utcnow() - self._start_time).total_seconds())

        # Calculate word count
        word_count = sum(
            len(entry.text.split())
            for entry in self._transcript
            if entry.role in ("user", "model")
        )

        # Convert transcript to dict format
        transcript_data = [
            {
                "role": entry.role,
                "text": entry.text,
                "timestamp": entry.timestamp,
                "photo_id": entry.photo_id
            }
            for entry in self._transcript
        ]

        logger.info(
            f"Disconnected from Gemini Live API. "
            f"Duration: {duration_seconds}s, Words: {word_count}"
        )

        return {
            "transcript": transcript_data,
            "duration_seconds": duration_seconds,
            "word_count": word_count
        }

    def _add_transcript(
        self,
        role: str,
        text: str,
        photo_id: Optional[str] = None
    ) -> None:
        """Add an entry to the transcript."""
        entry = TranscriptEntry(
            role=role,
            text=text,
            timestamp=datetime.utcnow().isoformat(),
            photo_id=photo_id or self._current_photo_id
        )
        self._transcript.append(entry)

    @property
    def is_connected(self) -> bool:
        """Check if session is connected."""
        return self._connected

    @property
    def transcript(self) -> list[dict]:
        """Get current transcript as list of dicts."""
        return [
            {
                "role": entry.role,
                "text": entry.text,
                "timestamp": entry.timestamp,
                "photo_id": entry.photo_id
            }
            for entry in self._transcript
        ]
