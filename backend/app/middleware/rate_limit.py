"""Rate limiting middleware for Reminisce API."""
from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from starlette.responses import JSONResponse
import logging

logger = logging.getLogger(__name__)


def get_user_id_or_ip(request: Request) -> str:
    """Use user ID if authenticated, otherwise IP."""
    if hasattr(request.state, 'user') and request.state.user:
        return f"user:{request.state.user.id}"
    return f"ip:{get_remote_address(request)}"


def get_ip_only(request: Request) -> str:
    """IP-only key for public endpoints."""
    return f"ip:{get_remote_address(request)}"


# Initialize limiter
# Note: headers_enabled=False because enabling it requires Response parameter in all endpoints
limiter = Limiter(key_func=get_ip_only, headers_enabled=False)

# Rate limits by category
RATE_LIMITS = {
    "auth_login": "5/minute",      # Prevent brute force
    "auth_register": "3/minute",   # Prevent spam signups
    "media_upload": "20/minute",   # Moderate - prevent abuse
    "ai_tag": "10/minute",         # Expensive operations
    "client_log": "120/minute",    # Higher limit - frontend logs frequently during sessions
    "invitation_create": "10/minute",
    "invitation_accept": "5/minute",
}


async def rate_limit_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    """Return 429 with Retry-After header."""
    retry_after = getattr(exc, 'retry_after', 60)
    logger.warning(f"Rate limit exceeded: {request.url.path} from {get_remote_address(request)}")
    return JSONResponse(
        status_code=429,
        content={"detail": "Too many requests. Please slow down.", "retry_after": retry_after},
        headers={"Retry-After": str(retry_after)}
    )
