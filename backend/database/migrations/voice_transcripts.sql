-- Voice Transcripts Table Migration
-- Stores conversation transcripts from AI voice therapy sessions

-- Create the voice_transcripts table
CREATE TABLE IF NOT EXISTS voice_transcripts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    therapy_session_id UUID NOT NULL REFERENCES therapy_sessions(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    transcript JSONB NOT NULL DEFAULT '[]'::jsonb,
    duration_seconds INTEGER,
    word_count INTEGER
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_voice_transcripts_therapy_session
    ON voice_transcripts(therapy_session_id);
CREATE INDEX IF NOT EXISTS idx_voice_transcripts_created_at
    ON voice_transcripts(created_at DESC);

-- Enable Row Level Security
ALTER TABLE voice_transcripts ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Caregivers can access transcripts for their patients' sessions
CREATE POLICY caregiver_access_voice_transcripts ON voice_transcripts
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM therapy_sessions ts
            JOIN patients p ON ts.patient_id = p.id
            WHERE ts.id = voice_transcripts.therapy_session_id
            AND p.caregiver_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM therapy_sessions ts
            JOIN patients p ON ts.patient_id = p.id
            WHERE ts.id = voice_transcripts.therapy_session_id
            AND p.caregiver_id = auth.uid()
        )
    );

-- RLS Policy: Supporters can read (SELECT only) transcripts for patients they support
CREATE POLICY supporter_read_voice_transcripts ON voice_transcripts
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM therapy_sessions ts
            JOIN patient_supporters ps ON ts.patient_id = ps.patient_id
            WHERE ts.id = voice_transcripts.therapy_session_id
            AND ps.supporter_id = auth.uid()
            AND ps.revoked_at IS NULL
        )
    );

-- Comment describing the transcript JSONB structure
COMMENT ON COLUMN voice_transcripts.transcript IS
    'Array of transcript entries: [{role: "user"|"model"|"system", text: string, timestamp: string, photo_id?: string}]';
