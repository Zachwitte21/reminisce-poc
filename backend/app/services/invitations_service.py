from datetime import datetime, timedelta, timezone

from fastapi import HTTPException

from app.dependencies import supabase_admin, verify_patient_caregiver
from app.models.schemas import InvitationCreate, InvitationResponse, SupporterResponse, InvitationAccept
from app.services.email_service import EmailService
from app.utils.generators import generate_invite_code
from app.utils.logger import logger

INVITATION_EXPIRY_DAYS = 7


class InvitationsService:
    @staticmethod
    async def create_invitation(
        invitation_data: InvitationCreate,
        caregiver_id: str
    ) -> InvitationResponse:
        patient = await verify_patient_caregiver(invitation_data.patient_id, caregiver_id)

        code = generate_invite_code()
        expires_at = datetime.utcnow() + timedelta(days=INVITATION_EXPIRY_DAYS)

        data = {
            "patient_id": invitation_data.patient_id,
            "email": invitation_data.email,
            "invite_code": code,
            "personal_message": invitation_data.personal_message,
            "status": "pending",
            "expires_at": expires_at.isoformat()
        }

        result = supabase_admin.table('invitations').insert(data).execute()

        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to create invitation")

        # Send email
        patient_name = f"{patient['first_name']} {patient['last_name'] or ''}".strip()
        EmailService.send_invitation_email(
            to_email=invitation_data.email,
            invite_code=code,
            patient_name=patient_name,
            personal_message=invitation_data.personal_message
        )
        
        logger.info(f"Generated invite code {code} for {invitation_data.email}")

        return InvitationResponse(**result.data[0])

    @staticmethod
    async def accept_invitation(
        invite_code: str,
        accept_data: InvitationAccept
    ) -> dict:
        # 1. Verify invitation
        invite_query = supabase_admin.table('invitations').select("*").eq(
            "invite_code", invite_code
        ).eq("status", "pending").execute()

        if not invite_query.data:
            raise HTTPException(status_code=404, detail="Invalid or used invite code")

        invite = invite_query.data[0]

        # Handle expiration check (ensure both are aware)
        expires_at_str = invite['expires_at'].replace('Z', '+00:00')
        expires_dt = datetime.fromisoformat(expires_at_str)
        # Verify if expires_dt is naive or aware. If naive, assume UTC.
        if expires_dt.tzinfo is None:
             expires_dt = expires_dt.replace(tzinfo=timezone.utc)
             
        if expires_dt < datetime.now(timezone.utc):
            raise HTTPException(status_code=400, detail="Invite code expired")

        # 2. Create supporter account (Auth)
        try:
            auth_response = supabase_admin.auth.sign_up({
                "email": accept_data.email,
                "password": accept_data.password,
                "options": {
                    "data": {
                        "role": "supporter",
                        "full_name": accept_data.full_name
                    }
                }
            })
        except Exception as e:
            # Mask the actual error in production but returning 400 for now
            raise HTTPException(status_code=400, detail=f"Registration failed: {str(e)}")

        if not auth_response.user:
            raise HTTPException(status_code=400, detail="Failed to create account")

        user_id = auth_response.user.id

        try:
            # 3. Create profile (if it doesn't exist)
            profile_exists = supabase_admin.table('profiles').select("id").eq("id", user_id).execute()
            if not profile_exists.data:
                supabase_admin.table('profiles').insert({
                    "id": user_id,
                    "full_name": accept_data.full_name,
                    "email": accept_data.email,
                    "role": "supporter"
                }).execute()
                logger.info(f"Created profile for supporter: {user_id}")

            # 4. Link supporter to patient
            supporter_data = {
                "patient_id": invite['patient_id'],
                "supporter_id": user_id
            }

            # Check if link already exists to avoid unique constraint error on retry
            link_exists = supabase_admin.table('patient_supporters').select("id").eq(
                "patient_id", invite['patient_id']
            ).eq("supporter_id", user_id).execute()
            
            if not link_exists.data:
                supabase_admin.table('patient_supporters').insert(
                    supporter_data
                ).execute()
                logger.info(f"Linked supporter {user_id} to patient {invite['patient_id']}")

            # 5. Mark invitation as accepted
            supabase_admin.table('invitations').update({
                "status": "accepted"
            }).eq("id", invite['id']).execute()
            logger.info(f"Marked invitation {invite['id']} as accepted")

        except Exception as e:
            logger.error(f"Error during supporter setup: {e}")
            raise HTTPException(
                status_code=500,
                detail=f"Account setup failed: {str(e)}"
            )

        return {"message": "Invitation accepted", "user_id": user_id}

    @staticmethod
    async def list_supporters(patient_id: str, caregiver_id: str) -> list[SupporterResponse]:
        await verify_patient_caregiver(patient_id, caregiver_id)

        result = supabase_admin.table('patient_supporters').select(
            "*, profiles!patient_supporters_supporter_id_fkey(full_name, email)"
        ).eq(
            "patient_id", patient_id
        ).is_("revoked_at", "null").execute()

        supporters = []
        for s in result.data:
            profile = s.pop("profiles", None) or {}
            s["supporter_name"] = profile.get("full_name")
            s["supporter_email"] = profile.get("email")
            supporters.append(SupporterResponse(**s))
        return supporters

    @staticmethod
    async def revoke_access(
        patient_id: str,
        supporter_id: str,
        caregiver_id: str
    ) -> dict[str, str]:
        await verify_patient_caregiver(patient_id, caregiver_id)

        result = supabase_admin.table('patient_supporters').update({
            "revoked_at": datetime.utcnow().isoformat()
        }).eq("patient_id", patient_id).eq("supporter_id", supporter_id).execute()

        if not result.data:
            raise HTTPException(status_code=404, detail="Supporter not found")

        return {"detail": "Access revoked"}
