import { create } from 'zustand';
import { api } from '../services/api';
import { Media, TherapySession, VoiceTranscriptEntry } from '../types/api';
import { logger } from '../utils/logger';

interface TherapyState {
  currentSession: TherapySession | null;
  mediaQueue: Media[];
  currentIndex: number;
  isPaused: boolean;
  photosViewed: number;
  sessionStartTime: number | null;

  // Voice session state
  voiceSessionActive: boolean;
  currentTranscript: VoiceTranscriptEntry[];

  startSession: (patientId: string, voiceEnabled?: boolean) => Promise<void>;
  endSession: (completedNaturally: boolean) => Promise<void>;
  nextPhoto: () => void;
  previousPhoto: () => void;
  goToPhoto: (index: number) => void;
  togglePause: () => void;
  reset: () => void;

  // Voice session actions
  setVoiceSessionActive: (active: boolean) => void;
  addTranscriptEntry: (entry: VoiceTranscriptEntry) => void;
  clearTranscript: () => void;
}

export const useTherapyStore = create<TherapyState>((set, get) => ({
  currentSession: null,
  mediaQueue: [],
  currentIndex: 0,
  isPaused: false,
  photosViewed: 0,
  sessionStartTime: null,

  // Voice session state
  voiceSessionActive: false,
  currentTranscript: [],

  startSession: async (patientId: string, voiceEnabled = false) => {
    logger.info("[TherapyStore] startSession called for patient:", patientId);
    try {
      const response = await api.startTherapySession(patientId, voiceEnabled);
      logger.info("[TherapyStore] API responded with session:", response.id);
      logger.info("[TherapyStore] Media queue size:", response.media_queue?.length || 0);

      set({
        currentSession: response,
        mediaQueue: response.media_queue || [],
        currentIndex: 0,
        isPaused: false,
        photosViewed: 0,
        sessionStartTime: Date.now(),
        voiceSessionActive: voiceEnabled,
        currentTranscript: [],
      });
      logger.info("[TherapyStore] State updated with new session");
    } catch (error) {
      logger.error("[TherapyStore] Error starting session:", error);
      set({
        currentSession: null,
        mediaQueue: [],
        currentIndex: 0,
        isPaused: false,
        photosViewed: 0,
        sessionStartTime: null,
        voiceSessionActive: false,
        currentTranscript: [],
      });
      throw error;
    }
  },

  endSession: async (completedNaturally: boolean) => {
    const { currentSession, photosViewed, sessionStartTime } = get();

    if (currentSession?.id && sessionStartTime) {
      const duration = Math.floor((Date.now() - sessionStartTime) / 1000);
      try {
        await api.endTherapySession(currentSession.id, {
          photos_viewed: photosViewed,
          duration,
          completed_naturally: completedNaturally,
        });
      } catch {
        // Session end failure is non-critical
      }
    }

    set({
      currentSession: null,
      mediaQueue: [],
      currentIndex: 0,
      isPaused: false,
      photosViewed: 0,
      sessionStartTime: null,
      voiceSessionActive: false,
      currentTranscript: [],
    });
  },

  nextPhoto: () => {
    const { currentIndex, mediaQueue, photosViewed } = get();
    if (currentIndex < mediaQueue.length - 1) {
      set({
        currentIndex: currentIndex + 1,
        photosViewed: photosViewed + 1,
      });
    }
  },

  previousPhoto: () => {
    const { currentIndex } = get();
    if (currentIndex > 0) {
      set({ currentIndex: currentIndex - 1 });
    }
  },

  goToPhoto: (index: number) => {
    const { mediaQueue } = get();
    if (index >= 0 && index < mediaQueue.length) {
      set({ currentIndex: index });
    }
  },

  togglePause: () => {
    set((state) => ({ isPaused: !state.isPaused }));
  },

  reset: () => {
    set({
      currentSession: null,
      mediaQueue: [],
      currentIndex: 0,
      isPaused: false,
      photosViewed: 0,
      sessionStartTime: null,
      voiceSessionActive: false,
      currentTranscript: [],
    });
  },

  // Voice session actions
  setVoiceSessionActive: (active: boolean) => {
    set({ voiceSessionActive: active });
  },

  addTranscriptEntry: (entry: VoiceTranscriptEntry) => {
    set((state) => ({
      currentTranscript: [...state.currentTranscript, entry],
    }));
  },

  clearTranscript: () => {
    set({ currentTranscript: [] });
  },
}));
