# tests/services/test_email_service.py
"""
Unit tests for email service (app/services/email_service.py).

Coverage:
- Send invitation email via Resend
- Email template formatting
- Fallback logging when no API key
- Error handling
"""

import pytest
from unittest.mock import patch


@pytest.mark.unit
class TestSendInvitationEmail:
    """Test sending invitation emails."""

    @patch("app.services.email_service.resend")
    @patch("app.services.email_service.settings")
    def test_send_invitation_email_success(self, mock_settings, mock_resend):
        """Test successful email send via Resend."""
        from app.services.email_service import EmailService

        mock_settings.RESEND_API_KEY = "test-api-key"
        mock_settings.FROM_EMAIL = "noreply@reminisce.app"
        mock_resend.Emails.send.return_value = {"id": "email-123"}

        EmailService.send_invitation_email(
            to_email="supporter@example.com",
            invite_code="ABCD-EFGH-IJKL",
            patient_name="Mary Smith",
            personal_message="Please join us!",
        )

        mock_resend.Emails.send.assert_called_once()
        call_args = mock_resend.Emails.send.call_args[0][0]
        assert call_args["to"] == "supporter@example.com"
        assert "ABCD-EFGH-IJKL" in call_args["html"]
        assert "Mary Smith" in call_args["html"]

    @patch("app.services.email_service.resend")
    @patch("app.services.email_service.settings")
    def test_send_invitation_email_with_custom_message(self, mock_settings, mock_resend):
        """Test email includes custom personal message."""
        from app.services.email_service import EmailService

        mock_settings.RESEND_API_KEY = "test-api-key"
        mock_settings.FROM_EMAIL = "noreply@reminisce.app"
        mock_resend.Emails.send.return_value = {"id": "email-456"}

        EmailService.send_invitation_email(
            to_email="test@example.com",
            invite_code="TEST-CODE-1234",
            patient_name="Patient",
            personal_message="Custom message here!",
        )

        call_args = mock_resend.Emails.send.call_args[0][0]
        assert "Custom message here!" in call_args["html"]

    @patch("app.services.email_service.resend")
    @patch("app.services.email_service.settings")
    def test_send_invitation_email_no_personal_message(self, mock_settings, mock_resend):
        """Test email without personal message."""
        from app.services.email_service import EmailService

        mock_settings.RESEND_API_KEY = "test-api-key"
        mock_settings.FROM_EMAIL = "noreply@reminisce.app"
        mock_resend.Emails.send.return_value = {"id": "email-789"}

        EmailService.send_invitation_email(
            to_email="test@example.com",
            invite_code="CODE-1234",
            patient_name="Patient",
        )

        # Should still send successfully
        mock_resend.Emails.send.assert_called_once()

    @patch("app.services.email_service.resend")
    @patch("app.services.email_service.settings")
    def test_send_invitation_email_api_error(self, mock_settings, mock_resend):
        """Test error handling when Resend API fails."""
        from app.services.email_service import EmailService

        mock_settings.RESEND_API_KEY = "test-api-key"
        mock_settings.FROM_EMAIL = "noreply@reminisce.app"
        mock_resend.Emails.send.side_effect = Exception("API rate limit exceeded")

        with pytest.raises(Exception) as exc_info:
            EmailService.send_invitation_email(
                to_email="test@example.com",
                invite_code="CODE",
                patient_name="Patient",
            )

        assert "rate limit" in str(exc_info.value).lower()

    @patch("app.services.email_service.resend")
    @patch("app.services.email_service.settings")
    def test_send_invitation_email_invalid_recipient(self, mock_settings, mock_resend):
        """Test error handling for invalid email address."""
        from app.services.email_service import EmailService

        mock_settings.RESEND_API_KEY = "test-api-key"
        mock_settings.FROM_EMAIL = "noreply@reminisce.app"
        mock_resend.Emails.send.side_effect = Exception("Invalid recipient email")

        with pytest.raises(Exception) as exc_info:
            EmailService.send_invitation_email(
                to_email="not-an-email",
                invite_code="CODE",
                patient_name="Patient",
            )

        assert "email" in str(exc_info.value).lower()


@pytest.mark.unit
class TestEmailFallback:
    """Test email fallback behavior when API key not configured."""

    @patch("app.services.email_service.resend")
    @patch("app.services.email_service.settings")
    def test_send_email_no_api_key_fallback(self, mock_settings, mock_resend):
        """Test fallback to logging when Resend API key not set."""
        from app.services.email_service import EmailService

        mock_settings.RESEND_API_KEY = None

        # Should not raise -- function returns early, logging a warning
        EmailService.send_invitation_email(
            to_email="test@example.com",
            invite_code="CODE",
            patient_name="Patient",
        )

        # Resend should NOT have been called
        mock_resend.Emails.send.assert_not_called()


@pytest.mark.unit
class TestEmailTemplates:
    """Test email template formatting."""

    @patch("app.services.email_service.resend")
    @patch("app.services.email_service.settings")
    def test_email_template_contains_required_elements(self, mock_settings, mock_resend):
        """Test email template includes all required elements."""
        from app.services.email_service import EmailService

        mock_settings.RESEND_API_KEY = "test-api-key"
        mock_settings.FROM_EMAIL = "noreply@reminisce.app"
        mock_resend.Emails.send.return_value = {"id": "email-id"}

        EmailService.send_invitation_email(
            to_email="test@example.com",
            invite_code="ABCD-EFGH-IJKL",
            patient_name="Mary Smith",
            personal_message="Join us!",
        )

        call_args = mock_resend.Emails.send.call_args[0][0]
        html_content = call_args["html"]

        # Required elements
        assert "ABCD-EFGH-IJKL" in html_content  # Invitation code
        assert "Mary Smith" in html_content  # Patient name
        assert "Join us!" in html_content  # Personal message
        assert "Reminisce" in html_content  # App name

    @patch("app.services.email_service.resend")
    @patch("app.services.email_service.settings")
    def test_email_subject_line(self, mock_settings, mock_resend):
        """Test email subject line is appropriate."""
        from app.services.email_service import EmailService

        mock_settings.RESEND_API_KEY = "test-api-key"
        mock_settings.FROM_EMAIL = "noreply@reminisce.app"
        mock_resend.Emails.send.return_value = {"id": "email-id"}

        EmailService.send_invitation_email(
            to_email="test@example.com",
            invite_code="CODE",
            patient_name="Patient",
        )

        call_args = mock_resend.Emails.send.call_args[0][0]
        subject = call_args["subject"]

        # Subject should mention invitation
        assert "invitation" in subject.lower() or "invite" in subject.lower()
