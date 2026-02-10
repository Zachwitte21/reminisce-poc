# tests/utils/test_validators.py
"""
Unit tests for Pydantic schema validation (app/models/schemas.py).

Coverage:
- Field validators (email, password, PIN, time format)
- Enum values
- Required fields
- Data sanitization
- Security validation
"""

import pytest
from pydantic import ValidationError


@pytest.mark.unit
class TestUserSchemas:
    """Test user-related schema validation."""

    def test_user_register_valid(self):
        """Test valid user registration data."""
        from app.models.schemas import UserRegister

        data = {
            "email": "test@example.com",
            "password": "SecurePassword123!",
            "full_name": "John Doe",
            "role": "caregiver",
        }

        user = UserRegister(**data)

        assert user.email == "test@example.com"
        assert user.full_name == "John Doe"
        assert user.role == "caregiver"

    def test_user_register_invalid_email(self):
        """Test registration with invalid email format."""
        from app.models.schemas import UserRegister

        data = {
            "email": "not-an-email",
            "password": "SecurePassword123!",
            "full_name": "John Doe",
            "role": "caregiver",
        }

        with pytest.raises(ValidationError) as exc_info:
            UserRegister(**data)

        assert "email" in str(exc_info.value).lower()

    def test_user_register_weak_password(self):
        """Test registration with weak password."""
        from app.models.schemas import UserRegister

        data = {
            "email": "test@example.com",
            "password": "123",  # Too short
            "full_name": "John Doe",
            "role": "caregiver",
        }

        with pytest.raises(ValidationError) as exc_info:
            UserRegister(**data)

        assert "password" in str(exc_info.value).lower()

    def test_user_register_invalid_role(self):
        """Test registration with invalid role."""
        from app.models.schemas import UserRegister

        data = {
            "email": "test@example.com",
            "password": "SecurePassword123!",
            "full_name": "John Doe",
            "role": "admin",  # Invalid role
        }

        with pytest.raises(ValidationError) as exc_info:
            UserRegister(**data)

        assert "role" in str(exc_info.value).lower()

    def test_user_register_missing_fields(self):
        """Test registration with missing required fields."""
        from app.models.schemas import UserRegister

        data = {
            "email": "test@example.com",
            # Missing password, full_name, role
        }

        with pytest.raises(ValidationError):
            UserRegister(**data)


@pytest.mark.unit
class TestPatientSchemas:
    """Test patient-related schema validation."""

    def test_patient_create_valid(self):
        """Test valid patient creation data."""
        from app.models.schemas import PatientCreate

        data = {
            "first_name": "Mary",
            "last_name": "Smith",
            "birth_date": "1945-06-15",
            "relationship": "Mother",
        }

        patient = PatientCreate(**data)

        assert patient.first_name == "Mary"
        assert patient.last_name == "Smith"
        assert patient.relationship == "Mother"

    def test_patient_create_invalid_date(self):
        """Test patient creation with invalid date format."""
        from app.models.schemas import PatientCreate

        data = {
            "first_name": "Mary",
            "last_name": "Smith",
            "birth_date": "not-a-date",
            "relationship": "Mother",
        }

        with pytest.raises(ValidationError) as exc_info:
            PatientCreate(**data)

        assert "date" in str(exc_info.value).lower()

    def test_patient_settings_pin_validation(self):
        """Test patient settings PIN format validation."""
        from app.models.schemas import PatientSettingsUpdate

        # Valid 4-digit PIN
        data = {"settings_pin": "1234"}
        settings = PatientSettingsUpdate(**data)
        assert settings.settings_pin == "1234"

        # Invalid PIN (too short)
        with pytest.raises(ValidationError):
            PatientSettingsUpdate(settings_pin="12")

        # Invalid PIN (not numeric)
        with pytest.raises(ValidationError):
            PatientSettingsUpdate(settings_pin="abcd")


@pytest.mark.unit
class TestMediaSchemas:
    """Test media-related schema validation."""

    def test_media_status_enum(self):
        """Test media status enum values."""
        from app.models.schemas import MediaStatus

        # Valid statuses
        assert MediaStatus.pending.value == "pending"
        assert MediaStatus.approved.value == "approved"
        assert MediaStatus.rejected.value == "rejected"

        # Should only have these three values
        assert len(MediaStatus) == 3

    def test_tag_type_enum(self):
        """Test tag type enum values."""
        from app.models.schemas import TagType

        # Valid types
        assert TagType.person.value == "person"
        assert TagType.place.value == "place"
        assert TagType.event.value == "event"
        assert TagType.date.value == "date"
        assert TagType.custom.value == "custom"

    def test_media_review_valid(self):
        """Test valid media review data."""
        from app.models.schemas import MediaReview

        data = {
            "action": "approve",
        }

        review = MediaReview(**data)
        assert review.action == "approve"

    def test_tag_suggestion_confidence(self):
        """Test tag suggestion confidence values."""
        from app.models.schemas import TagSuggestion

        # Valid confidence
        data = {
            "type": "person",
            "value": "John Doe",
            "confidence": 0.95,
        }

        tag = TagSuggestion(**data)
        assert tag.confidence == 0.95

        # Any float is accepted (no bounds validation on confidence)
        tag_high = TagSuggestion(type="person", value="Test", confidence=1.5)
        assert tag_high.confidence == 1.5

        tag_low = TagSuggestion(type="person", value="Test", confidence=-0.5)
        assert tag_low.confidence == -0.5


@pytest.mark.unit
class TestTherapySchemas:
    """Test therapy-related schema validation."""

    def test_therapy_session_create_valid(self):
        """Test valid therapy session creation."""
        from app.models.schemas import TherapySessionCreate

        data = {
            "patient_id": "123e4567-e89b-12d3-a456-426614174000",
            "voice_enabled": True,
        }

        session = TherapySessionCreate(**data)
        assert session.voice_enabled == True

    def test_therapy_schedule_time_format(self):
        """Test therapy schedule time format validation."""
        from app.models.schemas import ScheduleSessionItem

        # Valid time format (HH:MM)
        data = {
            "day_of_week": 1,
            "time_of_day": "14:30",
            "enabled": True,
        }

        schedule = ScheduleSessionItem(**data)
        assert schedule.time_of_day == "14:30"

        # Invalid time format
        with pytest.raises(ValidationError):
            ScheduleSessionItem(day_of_week=1, time_of_day="2:30 PM", enabled=True)

    def test_therapy_schedule_day_of_week(self):
        """Test day of week validation (0-6)."""
        from app.models.schemas import ScheduleSessionItem

        # Valid days (0-6)
        for day in range(7):
            schedule = ScheduleSessionItem(day_of_week=day, time_of_day="10:00", enabled=True)
            assert schedule.day_of_week == day

        # Invalid day (< 0)
        with pytest.raises(ValidationError):
            ScheduleSessionItem(day_of_week=-1, time_of_day="10:00", enabled=True)

        # Invalid day (> 6)
        with pytest.raises(ValidationError):
            ScheduleSessionItem(day_of_week=7, time_of_day="10:00", enabled=True)


@pytest.mark.unit
class TestInvitationSchemas:
    """Test invitation-related schema validation."""

    def test_invitation_create_valid(self):
        """Test valid invitation creation."""
        from app.models.schemas import InvitationCreate

        data = {
            "patient_id": "123e4567-e89b-12d3-a456-426614174000",
            "email": "supporter@example.com",
            "personal_message": "Please join!",
        }

        invitation = InvitationCreate(**data)
        assert invitation.email == "supporter@example.com"

    def test_invitation_create_invalid_email(self):
        """Test invitation with invalid email."""
        from app.models.schemas import InvitationCreate

        data = {
            "patient_id": "123e4567-e89b-12d3-a456-426614174000",
            "email": "not-an-email",
        }

        with pytest.raises(ValidationError) as exc_info:
            InvitationCreate(**data)

        assert "email" in str(exc_info.value).lower()


@pytest.mark.unit
class TestDataSanitization:
    """Test data sanitization and security validation."""

    def test_sanitize_control_characters(self):
        """Test removal of control characters from validated input."""
        from app.models.schemas import MediaTagCreate

        # MediaTagCreate has a field_validator that strips control characters
        tag = MediaTagCreate(tag_type="person", tag_value="John\x00Doe\x1b[31m")
        assert "\x00" not in tag.tag_value
        assert "\x1b" not in tag.tag_value



@pytest.mark.unit
class TestOptionalFields:
    """Test optional field handling."""

    def test_patient_create_optional_photo(self):
        """Test patient creation with optional photo URL."""
        from app.models.schemas import PatientCreate

        # Without photo
        data = {
            "first_name": "Mary",
            "last_name": "Smith",
            "birth_date": "1945-06-15",
            "relationship": "Mother",
        }

        patient = PatientCreate(**data)
        assert patient.first_name == "Mary"
        # photo_url should be optional/None

    def test_media_optional_caption(self):
        """Test media review with optional rejection reason."""
        from app.models.schemas import MediaReview

        # Without rejection_reason
        data = {"action": "approve"}

        review = MediaReview(**data)
        assert review.action == "approve"
        assert review.rejection_reason is None
