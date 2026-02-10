from pydantic import field_validator, ValidationError
from pydantic_settings import BaseSettings, SettingsConfigDict
import sys


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env")

    SUPABASE_URL: str
    SUPABASE_PUBLISHABLE_KEY: str
    SUPABASE_SECRET_KEY: str
    GEMINI_API_KEY: str
    RESEND_API_KEY: str | None = None
    FROM_EMAIL: str = "onboarding@resend.dev"
    SECRET_KEY: str  # REQUIRED - no default value
    ALGORITHM: str = "HS256"

    # Gemini Live API model configuration
    # Primary model to use for voice sessions (latest native audio preview)
    GEMINI_LIVE_MODEL: str = "gemini-2.5-flash-native-audio-preview-12-2025"
    # Fallback models to try if primary fails (comma-separated)
    GEMINI_LIVE_FALLBACK_MODELS: str = "gemini-2.5-flash-native-audio-preview-09-2025"

    @field_validator('SUPABASE_URL')
    @classmethod
    def ensure_trailing_slash(cls, v: str) -> str:
        if not v.endswith('/'):
            return v + '/'
        return v

    @field_validator('SECRET_KEY')
    @classmethod
    def validate_secret_key(cls, v: str) -> str:
        """Ensure SECRET_KEY is secure and not a weak default."""
        weak_keys = {'supersecret', 'secret', 'changeme', 'your_secret_key', ''}
        if v.lower() in weak_keys:
            raise ValueError(
                'SECRET_KEY must be secure. Generate with: '
                'python -c "import secrets; print(secrets.token_hex(32))"'
            )
        if len(v) < 32:
            raise ValueError('SECRET_KEY must be at least 32 characters')
        return v


try:
    settings = Settings()
except ValidationError as e:
    print("=" * 60)
    print("CONFIGURATION ERROR - Check your .env file:")
    for err in e.errors():
        field = err['loc'][0] if err['loc'] else 'unknown'
        msg = err['msg']
        print(f"  - {field}: {msg}")
    print("=" * 60)
    sys.exit(1)
