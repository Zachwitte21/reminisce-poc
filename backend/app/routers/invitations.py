from fastapi import APIRouter, Depends, Request
from gotrue.types import User
from app.dependencies import get_current_user
from app.models.schemas import InvitationCreate, InvitationResponse, InvitationAccept
from app.services.invitations_service import InvitationsService
from app.middleware.rate_limit import limiter, RATE_LIMITS, get_user_id_or_ip

router = APIRouter()


@router.post("/", response_model=InvitationResponse)
@limiter.limit(RATE_LIMITS["invitation_create"], key_func=get_user_id_or_ip)
async def create_invitation(
    request: Request,
    data: InvitationCreate,
    current_user: User = Depends(get_current_user)
) -> InvitationResponse:
    """Create a new invitation for a supporter. Only the caregiver can invite supporters."""
    return await InvitationsService.create_invitation(data, current_user.id)


@router.post("/{code}/accept")
@limiter.limit(RATE_LIMITS["invitation_accept"])
async def accept_invitation(
    request: Request,
    code: str,
    accept_data: InvitationAccept
):
    """Accept an invitation using the invite code. Creates a new supporter account."""
    return await InvitationsService.accept_invitation(code, accept_data)
