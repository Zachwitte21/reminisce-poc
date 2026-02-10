import resend
from app.config import settings
from app.utils.logger import logger

class EmailService:
    @staticmethod
    def send_invitation_email(to_email: str, invite_code: str, patient_name: str, personal_message: str | None = None):
        """
        Send an invitation email to a potential supporter.
        """
        if not settings.RESEND_API_KEY:
            logger.warning("RESEND_API_KEY is not set. Email sending skipped.")
            logger.info(f"Mock Email -> To: {to_email}, Code: {invite_code}")
            return

        resend.api_key = settings.RESEND_API_KEY

        html_content = f"""
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>You've been invited to connect!</h2>
            <p>You have been invited to join <strong>{patient_name}'s</strong> support circle on Reminisce.</p>
            
            <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
                <p style="margin: 0; color: #666;">Your Invite Code:</p>
                <h1 style="margin: 10px 0; letter-spacing: 5px; color: #4f46e5;">{invite_code}</h1>
            </div>

            {f'<p><strong>Message from caregiver:</strong><br/>"{personal_message}"</p>' if personal_message else ''}

            <p>To accept this invitation:</p>
            <ol>
                <li>Download the Reminisce App or visit our website.</li>
                <li>Select "I have an invite code".</li>
                <li>Enter the code above to create your account.</li>
            </ol>
            
            <p style="color: #999; font-size: 12px; margin-top: 40px;">
                This invitation will expire in 7 days.
            </p>
        </div>
        """

        try:
            r = resend.Emails.send({
                "from": settings.FROM_EMAIL,
                "to": to_email,
                "subject": f"Invitation to join {patient_name}'s circle on Reminisce",
                "html": html_content
            })
            logger.info(f"Invitation email sent to {to_email}. ID: {r.get('id')}")
        except Exception as e:
            logger.error(f"Failed to send email to {to_email}: {e}")
            raise e
