export const CONFIG = {
    API_BASE_URL: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000',
    GEMINI_API_KEY: process.env.EXPO_PUBLIC_GEMINI_API_KEY,
    SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    // Feature flags
    ENABLE_REMOTE_LOGGING: process.env.NODE_ENV === 'production',
    USE_SIMULATED_AI: false, // For development without credits
};

export default CONFIG;
