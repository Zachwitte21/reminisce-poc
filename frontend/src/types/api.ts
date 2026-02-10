// User & Auth Types
export type UserRole = 'caregiver' | 'supporter';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  avatar_url?: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface RegisterRequest {
  email: string;
  password: string;
  full_name: string;
  role?: UserRole;
}

export interface LoginRequest {
  email: string;
  password: string;
}

// Patient Types
export interface Patient {
  id: string;
  first_name: string;
  last_name?: string;
  birth_date?: string;
  photo_url?: string;
  relationship: string;
  caregiver_id: string;
  created_at: string;
}

export interface PatientCreate {
  first_name: string;
  last_name?: string;
  birth_date?: string;
  relationship: string;
}

export interface PatientSettings {
  require_photo_approval: boolean;
  voice_therapy_enabled: boolean;
  voice_speed: 'slow' | 'normal';
  settings_pin?: string | null;
}

// Media Types
export type MediaStatus = 'pending' | 'approved' | 'rejected';

export interface Media {
  id: string;
  patient_id: string;
  type: string;
  storage_path: string;
  url?: string;
  thumbnail_url?: string;
  caption?: string;
  tags: Tag[];
  date_taken?: string;
  status: MediaStatus;
  uploaded_by: string;
  created_at: string;
}

export interface Tag {
  id: string;
  media_id: string;
  tag_type: 'person' | 'place' | 'event' | 'date' | 'custom';
  tag_value: string;
  confidence?: number;
  source?: string;
  created_at: string;
}

export interface MediaUploadResponse {
  uploaded: Media[];
}

// Therapy Types
export interface TherapySession {
  id: string;
  patient_id: string;
  started_at: string;
  ended_at?: string;
  photos_viewed: number;
  duration_seconds?: number;
  voice_enabled: boolean;
}

export interface TherapySchedule {
  id: string;
  patient_id: string;
  session_duration: number;
  notification_minutes_before: number;
  sessions: ScheduleSession[];
}

export interface ScheduleSession {
  day_of_week: number;
  time_of_day: string;
  enabled: boolean;
}

// Invitation Types
export interface Invitation {
  id: string;
  email: string;
  patient_id: string;
  invite_code: string;
  expires_at: string;
  status: 'pending' | 'accepted' | 'expired';
  created_at: string;
}

export interface Supporter {
  id: string;
  patient_id: string;
  supporter_id: string;
  created_at: string;
  revoked_at?: string | null;
  supporter_name?: string | null;
  supporter_email?: string | null;
}

// API Response Types
export interface ApiError {
  detail: string;
}

// Voice Types
export interface VoiceTranscriptEntry {
  role: 'user' | 'model' | 'system';
  text: string;
  timestamp: string;
  photo_id?: string;
}

export interface VoiceTranscript {
  id: string;
  therapy_session_id: string;
  created_at: string;
  transcript: VoiceTranscriptEntry[];
  duration_seconds?: number;
  word_count?: number;
}

export type VoiceSessionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'listening'
  | 'processing'
  | 'speaking'
  | 'error';

export interface VoiceSessionMessage {
  type: 'connected' | 'transcript' | 'interrupted' | 'error' | 'photo_context_updated';
  session_id?: string;
  role?: string;
  text?: string;
  photo_id?: string;
  message?: string;
}
