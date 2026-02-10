import { create } from 'zustand';
import { api } from '../services/api';
import { TherapySchedule } from '../types/api';
import { scheduleWeeklyReminders } from '../services/notifications';

interface ScheduleState {
  schedule: TherapySchedule | null;
  isLoading: boolean;
  isSaving: boolean;

  fetchSchedule: (patientId: string) => Promise<void>;
  saveSchedule: (patientId: string, data: Omit<TherapySchedule, 'id'>, patientName: string) => Promise<void>;
  updateSchedule: (scheduleId: string, data: Partial<TherapySchedule>, patientName: string) => Promise<void>;
  clearSchedule: () => void;
}

export const useScheduleStore = create<ScheduleState>((set, get) => ({
  schedule: null,
  isLoading: false,
  isSaving: false,

  fetchSchedule: async (patientId: string) => {
    set({ isLoading: true });
    try {
      const { schedule } = await api.getSchedule(patientId);
      set({ schedule, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  saveSchedule: async (patientId: string, data: Omit<TherapySchedule, 'id'>, patientName: string) => {
    set({ isSaving: true });
    try {
      await api.createSchedule(data);
      // Re-fetch to get the full schedule with sessions populated
      const { schedule } = await api.getSchedule(patientId);
      set({ schedule, isSaving: false });
      if (schedule?.sessions) {
        scheduleWeeklyReminders(schedule.sessions, patientName, schedule.notification_minutes_before);
      }
    } catch {
      set({ isSaving: false });
      throw new Error('Failed to save schedule');
    }
  },

  updateSchedule: async (scheduleId: string, data: Partial<TherapySchedule>, patientName: string) => {
    set({ isSaving: true });
    try {
      await api.updateSchedule(scheduleId, data);
      // Re-fetch to get the full updated schedule with session IDs
      const currentSchedule = get().schedule;
      if (currentSchedule) {
        const { schedule } = await api.getSchedule(currentSchedule.patient_id);
        set({ schedule, isSaving: false });
        if (schedule) {
          scheduleWeeklyReminders(schedule.sessions, patientName, schedule.notification_minutes_before);
        }
      } else {
        set({ isSaving: false });
      }
    } catch {
      set({ isSaving: false });
      throw new Error('Failed to update schedule');
    }
  },

  clearSchedule: () => set({ schedule: null }),
}));
