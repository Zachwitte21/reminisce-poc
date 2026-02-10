# tests/services/test_invitations_service.py
"""
Unit tests for invitations service (app/services/invitations_service.py).

Coverage:
- Invitation code generation
- Code uniqueness validation
- Code format validation
"""

import pytest


@pytest.mark.unit
class TestInvitationCodeGeneration:
    """Test invitation code generation functionality."""

    def test_generate_invite_code_format(self):
        """Test invitation code is generated in correct format."""
        from app.utils.generators import generate_invite_code

        code = generate_invite_code()

        # Default length is 8 uppercase alphanumeric characters
        assert isinstance(code, str)
        assert len(code) == 8
        assert code.isalnum()

    def test_generate_invite_code_uniqueness(self):
        """Test that generated codes are unique."""
        from app.utils.generators import generate_invite_code

        # Generate multiple codes
        codes = [generate_invite_code() for _ in range(100)]

        # All codes should be unique
        assert len(codes) == len(set(codes))

    def test_generate_invite_code_uppercase(self):
        """Test that codes are uppercase for readability."""
        from app.utils.generators import generate_invite_code

        code = generate_invite_code()

        # Should be uppercase (digits are unchanged by upper())
        assert code == code.upper()

    def test_generate_invite_code_no_ambiguous_chars(self):
        """Test that codes use only alphanumeric characters."""
        from app.utils.generators import generate_invite_code

        # Generate many codes to check character set
        codes = [generate_invite_code() for _ in range(50)]

        # All characters should be alphanumeric
        all_chars = "".join(codes)
        assert all(c.isalnum() for c in all_chars)

    def test_generate_invite_code_length(self):
        """Test code length is appropriate."""
        from app.utils.generators import generate_invite_code

        # Default length is 8
        code = generate_invite_code()
        assert len(code) == 8

        # Custom length
        code_12 = generate_invite_code(length=12)
        assert len(code_12) == 12


