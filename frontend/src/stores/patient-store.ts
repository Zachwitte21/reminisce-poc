import { create } from 'zustand';
import { api } from '../services/api';
import { Patient, PatientSettings, Media } from '../types/api';

interface PatientState {
  patient: Patient | null;
  settings: PatientSettings | null;
  media: Media[];
  pendingMedia: Media[];
  isLoading: boolean;

  fetchPatient: (patientId?: string) => Promise<void>;
  fetchSettings: (patientId: string) => Promise<void>;
  fetchMedia: (patientId: string, status?: string) => Promise<void>;
  fetchPendingMedia: (patientId: string) => Promise<void>;
  updateSettings: (patientId: string, settings: Partial<PatientSettings>) => Promise<void>;
  setPatient: (patient: Patient | null) => void;
  clearPatient: () => void;
}

export const usePatientStore = create<PatientState>((set, get) => ({
  patient: null,
  settings: null,
  media: [],
  pendingMedia: [],
  isLoading: false,

  fetchPatient: async (patientId?: string) => {
    set({ isLoading: true });
    try {
      let patient;
      if (patientId) {
        patient = await api.getPatient(patientId);
      } else {
        patient = await api.getMyPatient();
      }

      let settings = null;
      try {
        const settingsResponse = await api.getPatientSettings(patient.id);
        settings = settingsResponse.settings;
      } catch (e) {
        console.log('[PatientStore] Could not fetch settings (may be supporter role)');
      }

      set({ patient, settings, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  fetchSettings: async (patientId: string) => {
    try {
      const response = await api.getPatientSettings(patientId);
      set({ settings: response.settings });
    } catch {
      // Settings fetch failure is non-critical
    }
  },

  fetchMedia: async (patientId: string, status?: string) => {
    try {
      const media = await api.getPatientMedia(patientId, status);
      set({ media });
    } catch {
      // Media fetch failure is non-critical
    }
  },

  fetchPendingMedia: async (patientId: string) => {
    try {
      const pendingMedia = await api.getPatientMedia(patientId, 'pending');
      set({ pendingMedia });
    } catch {
      // Pending media fetch failure is non-critical
    }
  },

  updateSettings: async (patientId: string, settings: Partial<PatientSettings>) => {
    const response = await api.updatePatientSettings(patientId, settings);
    set({ settings: response.settings });
  },

  setPatient: (patient: Patient | null) => set({ patient }),

  clearPatient: () => set({
    patient: null,
    settings: null,
    media: [],
    pendingMedia: [],
  }),
}));
