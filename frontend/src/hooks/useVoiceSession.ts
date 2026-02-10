/**
 * useVoiceSession Hook
 *
 * Manages real-time bidirectional voice streaming with Gemini Live API.
 * Audio: User mic -> WebSocket -> Backend -> Gemini -> Backend -> WebSocket -> Speaker
 *
 * Playback uses AudioPlaybackEngine for gapless streaming (no expo-av Sound objects).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { Audio } from 'expo-av';
import { useAuthStore } from '../stores/auth-store';
import { useTherapyStore } from '../stores/therapy-store';
import { VoiceSessionState, VoiceSessionMessage, VoiceTranscriptEntry } from '../types/api';
import { getWebAudioRecorder, WebAudioRecorder } from '../services/webAudioRecorder';
import { AudioPlaybackEngine, createPlaybackEngine } from '../services/audioPlayback';

import { CONFIG } from '../config';
import { logger } from '../utils/logger';

const GEMINI_API_KEY = CONFIG.GEMINI_API_KEY;
const API_BASE_URL = CONFIG.API_BASE_URL;

const THERAPY_SYSTEM_PROMPT = `You are a warm, patient companion helping someone with memory challenges engage in reminiscence therapy by looking at photos from their life.

Guidelines:
- Speak slowly and clearly
- Use simple, short sentences
- Ask gentle, open-ended questions about the photo
- Never correct or contradict their memories
- Show genuine interest and warmth
- Be encouraging and supportive
- If they seem confused, gently redirect to the photo
- Celebrate any memories they share, no matter how small

When a new photo is presented, acknowledge it naturally and invite them to share what they see or remember about it.`;

export interface PhotoContext {
  id: string;
  caption?: string;
  tags?: Array<{ tag_type: string; tag_value: string }>;
  date_taken?: string;
}

export interface UseVoiceSessionOptions {
  sessionId: string;
  patientId: string;
  initialPhoto?: PhotoContext;
}

export interface UseVoiceSessionReturn {
  state: VoiceSessionState;
  isConnected: boolean;
  isListening: boolean;
  isSpeaking: boolean;
  transcript: VoiceTranscriptEntry[];
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  sendPhotoChange: (photo: PhotoContext) => void;
  toggleListening: () => Promise<void>;
}

function buildPhotoDescription(photo: PhotoContext): string {
  const parts: string[] = [];

  if (photo.caption) {
    parts.push(`Caption: "${photo.caption}"`);
  }

  if (photo.tags && photo.tags.length > 0) {
    const people = photo.tags.filter(t => t.tag_type === 'person').map(t => t.tag_value);
    const places = photo.tags.filter(t => t.tag_type === 'place').map(t => t.tag_value);
    const events = photo.tags.filter(t => t.tag_type === 'event').map(t => t.tag_value);

    if (people.length > 0) parts.push(`People in photo: ${people.join(', ')}`);
    if (places.length > 0) parts.push(`Location: ${places.join(', ')}`);
    if (events.length > 0) parts.push(`Event: ${events.join(', ')}`);
  }

  if (photo.date_taken) {
    parts.push(`Date taken: ${photo.date_taken}`);
  }

  return parts.length > 0 ? parts.join('. ') : 'No additional context available for this photo.';
}

export function useVoiceSession({
  sessionId,
  patientId,
  initialPhoto,
}: UseVoiceSessionOptions): UseVoiceSessionReturn {
  const token = useAuthStore((state) => state.token);
  const { currentTranscript, addTranscriptEntry, clearTranscript } = useTherapyStore();

  const [state, _setState] = useState<VoiceSessionState>('disconnected');
  const stateRef = useRef<VoiceSessionState>('disconnected');
  const [error, setError] = useState<string | null>(null);

  // Wrapper that keeps ref in sync so callbacks always read current state
  const setState = useCallback((newState: VoiceSessionState) => {
    stateRef.current = newState;
    _setState(newState);
  }, []);

  const wsRef = useRef<WebSocket | null>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const audioModeSetRef = useRef(false);
  const transcriptRef = useRef<VoiceTranscriptEntry[]>([]);
  const initialPhotoRef = useRef<PhotoContext | undefined>(initialPhoto);
  const webRecorderRef = useRef<WebAudioRecorder | null>(null);
  const isWebRecordingRef = useRef(false);
  const playbackEngineRef = useRef<AudioPlaybackEngine | null>(null);

  useEffect(() => {
    if (initialPhoto) {
      initialPhotoRef.current = initialPhoto;
    }
  }, [initialPhoto]);

  useEffect(() => {
    transcriptRef.current = currentTranscript;
  }, [currentTranscript]);

  const isConnected = state === 'connected' || state === 'listening' || state === 'speaking' || state === 'processing';
  const isListening = state === 'listening';
  const isSpeaking = state === 'speaking';

  const setupAudioMode = useCallback(async () => {
    if (audioModeSetRef.current) return;
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false,
        interruptionModeIOS: 1,
        interruptionModeAndroid: 1,
      });
      audioModeSetRef.current = true;
    } catch (err) {
      logger.error('[VoiceSession] Failed to set audio mode:', err);
    }
  }, []);

  const handleMessage = useCallback(async (event: MessageEvent) => {
    // Handle binary audio messages
    if (event.data instanceof ArrayBuffer) {
      const view = new DataView(event.data);
      const messageType = view.getUint8(0);

      if (messageType === 0x01) {
        const pcmData = event.data.slice(13);
        if (playbackEngineRef.current) {
          if (stateRef.current !== 'speaking') {
            setState('speaking');
          }
          playbackEngineRef.current.enqueue(pcmData);
        }
      }
      return;
    }

    // Handle JSON messages
    if (typeof event.data === 'string') {
      let messageData;
      try {
        messageData = JSON.parse(event.data);
      } catch {
        console.warn('[VoiceSession] Received unparseable JSON');
        return;
      }

      if (messageData.type === 'connected') {
        logger.info('[VoiceSession] Backend confirmed connection');
        setState('connected');

        // Send initial greeting with photo context
        if (wsRef.current?.readyState === WebSocket.OPEN && initialPhotoRef.current) {
          const greetingMessage = {
            type: 'text',
            text: `Hello! I'm looking at some photos and would love to share memories with you. ${buildPhotoDescription(initialPhotoRef.current)}\n\nPlease greet me warmly and gently ask if I recognize anything in this photo.`
          };
          wsRef.current.send(JSON.stringify(greetingMessage));
        }
        return;
      }

      if (messageData.type === 'transcript') {
        const entry: VoiceTranscriptEntry = {
          role: messageData.role,
          text: messageData.text,
          timestamp: new Date().toISOString(),
        };
        addTranscriptEntry(entry);
        return;
      }

      if (messageData.type === 'interrupted') {
        if (playbackEngineRef.current) {
          playbackEngineRef.current.clear();
        }
        setState('connected');
        return;
      }

      if (messageData.type === 'photo_context_updated') {
        logger.info(`[VoiceSession] Photo context updated: ${messageData.photo_id}`);
        return;
      }

      if (messageData.type === 'error') {
        logger.error(`[VoiceSession] Backend error: ${messageData.message}`);
        setError(messageData.message);
        return;
      }
    }
  }, [addTranscriptEntry, setState]);

  const connect = useCallback(async () => {
    if (!sessionId || !patientId || !GEMINI_API_KEY) {
      setError('Missing session ID, patient ID, or Gemini API Key');
      setState('error');
      return;
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    setState('connecting');
    setError(null);
    clearTranscript();

    try {
      await setupAudioMode();
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        setError('Microphone permission denied');
        setState('error');
        return;
      }

      // Initialize playback engine
      const engine = createPlaybackEngine();
      engine.init();
      engine.onDrained(() => {
        if (stateRef.current === 'speaking') {
          setState('connected');
        }
      });
      playbackEngineRef.current = engine;

      const wsUrl = `${API_BASE_URL.replace('http', 'ws')}/api/voice/ws/voice/${sessionId}?patient_id=${patientId}&token=${token}`;
      const ws = new WebSocket(wsUrl);
      ws.binaryType = 'arraybuffer';

      ws.onopen = () => {
        console.log('[VoiceSession] WebSocket connected');
      };

      ws.onmessage = handleMessage;

      ws.onerror = (event) => {
        const errorMessage = (event as any).message || 'Unknown error';
        logger.error('[VoiceSession] WebSocket error:', errorMessage);
        setError('Connection error');
        setState('error');
      };

      ws.onclose = (event) => {
        logger.info(`[VoiceSession] WebSocket closed. Code: ${event.code}`);
        wsRef.current = null;
        if (stateRef.current !== 'error') {
          setState('disconnected');
        }
      };

      wsRef.current = ws;
    } catch (err) {
      logger.error('[VoiceSession] Connection failed:', err);
      setError('Failed to connect');
      setState('error');
    }
  }, [sessionId, patientId, handleMessage, clearTranscript, setupAudioMode, setState]);

  const saveTranscriptToBackend = async () => {
    if (transcriptRef.current.length === 0) return;

    try {
      const start = new Date(transcriptRef.current[0].timestamp).getTime();
      const duration = Math.floor((Date.now() - start) / 1000);
      const wordCount = transcriptRef.current.reduce((acc, t) => acc + t.text.split(' ').length, 0);

      await fetch(`${API_BASE_URL}/api/voice/transcript/${sessionId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          transcript: transcriptRef.current,
          duration: duration > 0 ? duration : 0,
          word_count: wordCount
        })
      });
      console.log('[VoiceSession] Transcript saved');
    } catch (e) {
      logger.error('[VoiceSession] Failed to save transcript', e);
    }
  };

  const disconnect = useCallback(async () => {
    if (webRecorderRef.current) {
      try { await webRecorderRef.current.stop(); } catch { }
      webRecorderRef.current = null;
      isWebRecordingRef.current = false;
    }

    if (recordingRef.current) {
      try { await recordingRef.current.stopAndUnloadAsync(); } catch { }
      recordingRef.current = null;
    }

    if (playbackEngineRef.current) {
      playbackEngineRef.current.destroy();
      playbackEngineRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setState('disconnected');
    setError(null);
    await saveTranscriptToBackend();
  }, [sessionId, token]);

  const sendPhotoChange = useCallback((photo: PhotoContext) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const message = {
        type: 'photo_change',
        photo_id: photo.id,
        caption: photo.caption,
        tags: photo.tags?.map(t => t.tag_value),
        date_taken: photo.date_taken
      };
      wsRef.current.send(JSON.stringify(message));

      addTranscriptEntry({
        role: 'system',
        text: `Viewed photo ${photo.id}`,
        timestamp: new Date().toISOString(),
        photo_id: photo.id
      });
    }
  }, [addTranscriptEntry]);

  const toggleListening = useCallback(async () => {
    if (!isConnected) {
      return;
    }

    // Web platform: WebAudioRecorder for raw PCM capture
    if (Platform.OS === 'web') {
      if (isListening) {
        if (webRecorderRef.current) {
          await webRecorderRef.current.stop();
          webRecorderRef.current = null;
        }
        isWebRecordingRef.current = false;
        setState('connected');
      } else {
        try {
          const recorder = getWebAudioRecorder();

          // Recorder singleton is already capturing — just sync state
          if (recorder.isRecording) {
            webRecorderRef.current = recorder;
            isWebRecordingRef.current = true;
            setState('listening');
            return;
          }

          webRecorderRef.current = recorder;

          const started = await recorder.start((pcmData: ArrayBuffer) => {
            if (wsRef.current?.readyState === WebSocket.OPEN) {
              wsRef.current.send(pcmData);
            }
          });

          if (started) {
            isWebRecordingRef.current = true;
            setState('listening');
          } else {
            setError('Failed to access microphone');
            setState('error');
          }
        } catch (err) {
          logger.error('[VoiceSession] Recording error:', err);
          setError('Microphone error');
          setState('error');
        }
      }
      return;
    }

    // Native platform (iOS/Android): expo-av
    if (isListening) {
      if (recordingRef.current) {
        try { await recordingRef.current.stopAndUnloadAsync(); } catch { }
        recordingRef.current = null;
      }
      setState('connected');
    } else {
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });

        const recording = new Audio.Recording();
        await recording.prepareToRecordAsync({
          isMeteringEnabled: false,
          android: {
            extension: '.pcm',
            outputFormat: Audio.AndroidOutputFormat.DEFAULT,
            audioEncoder: Audio.AndroidAudioEncoder.DEFAULT,
            sampleRate: 16000,
            numberOfChannels: 1,
            bitRate: 256000,
          },
          ios: {
            extension: '.pcm',
            outputFormat: Audio.IOSOutputFormat.LINEARPCM,
            audioQuality: Audio.IOSAudioQuality.HIGH,
            sampleRate: 16000,
            numberOfChannels: 1,
            bitRate: 256000,
            linearPCMBitDepth: 16,
            linearPCMIsBigEndian: false,
            linearPCMIsFloat: false,
          },
          web: {
            mimeType: 'audio/webm',
            bitsPerSecond: 256000,
          },
        });

        await recording.startAsync();
        recordingRef.current = recording;
        setState('listening');

        // Record for 5 seconds then send
        setTimeout(async () => {
          if (recordingRef.current) {
            try {
              await recordingRef.current.stopAndUnloadAsync();
              const uri = recordingRef.current.getURI();
              recordingRef.current = null;

              if (uri && wsRef.current?.readyState === WebSocket.OPEN) {
                const response = await fetch(uri);
                const blob = await response.blob();
                const arrayBuffer = await blob.arrayBuffer();
                wsRef.current.send(arrayBuffer);
              }

              setState('processing');
              setTimeout(() => {
                if (stateRef.current !== 'speaking') setState('connected');
              }, 1000);

            } catch (e) {
              logger.error('[VoiceSession] Error sending audio', e);
              setState('connected');
            }
          }
        }, 5000);
      } catch (err) {
        logger.error('[VoiceSession] Error starting recording', err);
        setState('error');
      }
    }
  }, [isConnected, isListening, setState]);

  useEffect(() => {
    return () => {
      if (webRecorderRef.current) {
        webRecorderRef.current.stop().catch(() => { });
        webRecorderRef.current = null;
      }
      if (playbackEngineRef.current) {
        playbackEngineRef.current.destroy();
        playbackEngineRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  return {
    state,
    isConnected,
    isListening,
    isSpeaking,
    transcript: currentTranscript,
    error,
    connect,
    disconnect,
    sendPhotoChange,
    toggleListening,
  };
}
