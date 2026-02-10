import {
  AuthResponse,
  LoginRequest,
  RegisterRequest,
  Patient,
  PatientCreate,
  PatientSettings,
  Media,
  Tag,
  TherapySession,
  TherapySchedule,
  Invitation,
  Supporter,
} from '../types/api';
import { Platform } from 'react-native';

import { CONFIG } from '../config';

const API_BASE_URL = CONFIG.API_BASE_URL;


class ApiService {
  private token: string | null = null;

  setToken(token: string | null): void {
    this.token = token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Request failed' }));
      throw new Error(error.detail || 'Request failed');
    }

    return response.json();
  }

  // Auth
  async register(data: RegisterRequest): Promise<{ message: string; user_id: string }> {
    return this.request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async login(data: LoginRequest): Promise<AuthResponse> {
    return this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async uploadAvatar(photo: { uri: string; type?: string; fileName?: string | null }): Promise<AuthResponse['user']> {
    const formData = new FormData();

    if (Platform.OS === 'web') {
      const response = await fetch(photo.uri);
      const blob = await response.blob();
      formData.append('file', blob, photo.fileName || 'profile.jpg');
    } else {
      formData.append('file', {
        uri: photo.uri,
        name: photo.fileName || 'profile.jpg',
        type: photo.type || 'image/jpeg',
      } as any);
    }

    const headers: HeadersInit = {};
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${API_BASE_URL}/api/auth/avatar`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Upload failed' }));
      throw new Error(error.detail || 'Upload failed');
    }

    return response.json();
  }

  // Patients
  async createPatient(data: PatientCreate): Promise<Patient> {
    return this.request('/api/patients/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getMyPatient(): Promise<Patient> {
    return this.request('/api/patients/me');
  }

  async getPatient(patientId: string): Promise<Patient> {
    return this.request(`/api/patients/${patientId}`);
  }

  async getPatientSettings(patientId: string): Promise<{ settings: PatientSettings }> {
    return this.request(`/api/patients/${patientId}/settings`);
  }

  async updatePatient(patientId: string, data: Partial<Patient>): Promise<Patient> {
    return this.request(`/api/patients/${patientId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async uploadPatientPhoto(patientId: string, photo: { uri: string; type?: string; fileName?: string | null }): Promise<Patient> {
    const formData = new FormData();

    if (Platform.OS === 'web') {
      const response = await fetch(photo.uri);
      const blob = await response.blob();
      formData.append('file', blob, photo.fileName || 'photo.jpg');
    } else {
      formData.append('file', {
        uri: photo.uri,
        name: photo.fileName || 'photo.jpg',
        type: photo.type || 'image/jpeg',
      } as any);
    }

    // We manually construct the fetch here because we need FormData handling without Content-Type: application/json
    const headers: HeadersInit = {};
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${API_BASE_URL}/api/patients/${patientId}/photo`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Upload failed' }));
      throw new Error(error.detail || 'Upload failed');
    }

    return response.json();
  }

  async updatePatientSettings(patientId: string, data: Partial<PatientSettings>): Promise<{ settings: PatientSettings }> {
    return this.request(`/api/patients/${patientId}/settings`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  // Media
  async uploadMedia(
    patientId: string,
    files: Array<{ uri: string; type?: string; fileName?: string | null } | File>
  ): Promise<{ uploaded: Media[] }> {
    const formData = new FormData();
    formData.append('patient_id', patientId);

    for (const file of files) {
      if (Platform.OS === 'web') {
        // On web, if it's already a File/Blob, use it directly
        // Otherwise, fetch the blob from the URI
        if (file instanceof File || file instanceof Blob) {
          formData.append('files', file);
        } else {
          const response = await fetch(file.uri);
          const blob = await response.blob();
          formData.append('files', blob, file.fileName || `upload_${Date.now()}.jpg`);
        }
      } else {
        // On native, use the React Native format
        formData.append('files', {
          uri: (file as any).uri,
          name: (file as any).fileName || `upload_${Date.now()}.jpg`,
          type: (file as any).type || 'image/jpeg',
        } as any);
      }
    }

    const headers: HeadersInit = {};
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${API_BASE_URL}/api/media/upload`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Upload failed' }));
      throw new Error(error.detail);
    }

    return response.json();
  }

  async getPatientMedia(patientId: string, status?: string): Promise<Media[]> {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request(`/api/patients/${patientId}/media${query}`);
  }

  async aiTagMedia(mediaId: string): Promise<{ suggestions: Record<string, unknown> }> {
    return this.request(`/api/media/${mediaId}/ai-tag`, { method: 'POST' });
  }

  async reviewMedia(mediaId: string, action: 'approve' | 'reject', reason?: string): Promise<Media> {
    return this.request(`/api/media/${mediaId}/review`, {
      method: 'POST',
      body: JSON.stringify({ action, rejection_reason: reason }),
    });
  }

  async updateMedia(mediaId: string, updates: Partial<Media>): Promise<Media> {
    return this.request(`/api/media/${mediaId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  async addMediaTag(mediaId: string, tagType: string, tagValue: string): Promise<Tag> {
    return this.request(`/api/media/${mediaId}/tags`, {
      method: 'POST',
      body: JSON.stringify({ tag_type: tagType, tag_value: tagValue }),
    });
  }

  async deleteMediaTag(mediaId: string, tagId: string): Promise<{ message: string }> {
    return this.request(`/api/media/${mediaId}/tags/${tagId}`, {
      method: 'DELETE',
    });
  }

  async deleteMedia(mediaId: string): Promise<{ message: string }> {
    return this.request(`/api/media/${mediaId}`, {
      method: 'DELETE',
    });
  }

  // Therapy Sessions
  async startTherapySession(patientId: string, voiceEnabled: boolean = false): Promise<TherapySession & { media_queue: Media[] }> {
    return this.request('/api/therapy-sessions', {
      method: 'POST',
      body: JSON.stringify({ patient_id: patientId, voice_enabled: voiceEnabled }),
    });
  }

  async endTherapySession(sessionId: string, data: { photos_viewed: number; duration: number; completed_naturally: boolean }): Promise<{ session: TherapySession }> {
    return this.request(`/api/therapy-sessions/${sessionId}/end`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async getSessionHistory(patientId: string, limit: number = 20): Promise<{ sessions: TherapySession[]; stats: { total_sessions: number; average_duration: number } }> {
    return this.request(`/api/patients/${patientId}/therapy-sessions?limit=${limit}`);
  }

  // Schedules
  async getSchedule(patientId: string): Promise<{ schedule: TherapySchedule | null }> {
    return this.request(`/api/patients/${patientId}/therapy-schedule`);
  }

  async createSchedule(data: Omit<TherapySchedule, 'id'>): Promise<{ schedule: TherapySchedule }> {
    return this.request('/api/therapy-schedules', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateSchedule(scheduleId: string, data: Partial<TherapySchedule>): Promise<{ message: string }> {
    return this.request(`/api/therapy-schedules/${scheduleId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  // Invitations
  async sendInvitation(patientId: string, email: string, message?: string): Promise<Invitation> {
    return this.request('/api/invitations', {
      method: 'POST',
      body: JSON.stringify({ patient_id: patientId, email, personal_message: message }),
    });
  }

  async acceptInvitation(inviteCode: string, data: RegisterRequest): Promise<{ message: string; user_id: string }> {
    return this.request(`/api/invitations/${inviteCode}/accept`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getSupporters(patientId: string): Promise<Supporter[]> {
    return this.request(`/api/patients/${patientId}/supporters`);
  }

  async removeSupporter(patientId: string, supporterId: string): Promise<{ message: string }> {
    return this.request(`/api/patients/${patientId}/supporters/${supporterId}`, {
      method: 'DELETE',
    });
  }
}

export const api = new ApiService();
