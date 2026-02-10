-- Reminisce Production Schema
-- This script sets up the core tables, RLS policies, and utility functions for the Reminisce platform.

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TABLES

-- Profiles (Caregivers and Supporters)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT,
  role TEXT NOT NULL CHECK (role IN ('caregiver', 'supporter')),
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Patients
CREATE TABLE IF NOT EXISTS patients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  caregiver_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT,
  birth_date DATE,
  photo_url TEXT,
  relationship TEXT NOT NULL, -- Relation to caregiver (e.g., "Mother")
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(caregiver_id) -- One primary caregiver per patient node
);

-- Patient Settings
CREATE TABLE IF NOT EXISTS patient_settings (
  patient_id UUID PRIMARY KEY REFERENCES patients(id) ON DELETE CASCADE,
  require_photo_approval BOOLEAN DEFAULT TRUE,
  voice_therapy_enabled BOOLEAN DEFAULT FALSE,
  voice_speed TEXT DEFAULT 'normal' CHECK (voice_speed IN ('slow', 'normal', 'fast')),
  settings_pin TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Supporters (Family members)
CREATE TABLE IF NOT EXISTS patient_supporters (
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  supporter_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  PRIMARY KEY (patient_id, supporter_id)
);

-- Invitations
CREATE TABLE IF NOT EXISTS invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  invite_code TEXT UNIQUE NOT NULL,
  personal_message TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Media (Photos/Videos)
CREATE TABLE IF NOT EXISTS media (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  uploaded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  storage_path TEXT NOT NULL,
  url TEXT,
  thumbnail_url TEXT,
  caption TEXT,
  date_taken TIMESTAMPTZ,
  type TEXT DEFAULT 'image',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Media Tags (Faces/Objects/Topics)
CREATE TABLE IF NOT EXISTS media_tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  media_id UUID NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  tag_type TEXT NOT NULL CHECK (tag_type IN ('person', 'place', 'event', 'date', 'custom')),
  tag_value TEXT NOT NULL,
  source TEXT DEFAULT 'manual',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Therapy Sessions (Historical logs)
CREATE TABLE IF NOT EXISTS therapy_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  photos_viewed INTEGER DEFAULT 0,
  duration_seconds INTEGER,
  voice_enabled BOOLEAN DEFAULT FALSE,
  completed_naturally BOOLEAN
);

-- Therapy Schedules
CREATE TABLE IF NOT EXISTS therapy_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  session_duration INTEGER DEFAULT 15, -- minutes
  notification_minutes_before INTEGER DEFAULT 0,
  sessions JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. ENABLE RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_supporters ENABLE ROW LEVEL SECURITY;
ALTER TABLE media ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE therapy_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE therapy_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

-- 4. POLICIES

-- Profiles
CREATE POLICY "Profiles are viewable by authenticated users" ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
-- Allow public insert for initial user registration if not using a trigger
CREATE POLICY "Enable insert for registration" ON profiles FOR INSERT WITH CHECK (true);

-- Patients
CREATE POLICY "Caregivers have full access to their patient" ON patients
  FOR ALL TO authenticated USING (caregiver_id = auth.uid());

CREATE POLICY "Supporters can view patients they support" ON patients
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM patient_supporters 
      WHERE patient_id = patients.id AND supporter_id = auth.uid()
    )
  );

-- Media
CREATE POLICY "Caregivers manage all media for their patient" ON media
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM patients WHERE id = media.patient_id AND caregiver_id = auth.uid())
  );

CREATE POLICY "Supporters can view approved media" ON media
  FOR SELECT TO authenticated USING (
    status = 'approved' AND
    EXISTS (SELECT 1 FROM patient_supporters WHERE patient_id = media.patient_id AND supporter_id = auth.uid())
  );

CREATE POLICY "Supporters can upload media" ON media
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM patient_supporters WHERE patient_id = media.patient_id AND supporter_id = auth.uid())
  );

-- Media Tags
CREATE POLICY "Caregivers manage all tags for their patient" ON media_tags
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM media 
      JOIN patients ON media.patient_id = patients.id 
      WHERE media.id = media_tags.media_id AND patients.caregiver_id = auth.uid()
    )
  );

CREATE POLICY "Supporters can view tags for approved media" ON media_tags
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM media 
      JOIN patient_supporters ON media.patient_id = patient_supporters.patient_id 
      WHERE media.id = media_tags.media_id AND media.status = 'approved' AND patient_supporters.supporter_id = auth.uid()
    )
  );

-- 5. UPDATED_AT TRIGGER
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_profiles_modtime') THEN
        CREATE TRIGGER update_profiles_modtime BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_patients_modtime') THEN
        CREATE TRIGGER update_patients_modtime BEFORE UPDATE ON patients FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
    END IF;
END $$;
