from fastapi import APIRouter, Request
import logging

from app.models.schemas import ClientLogRequest
from app.middleware.rate_limit import limiter, RATE_LIMITS

logger = logging.getLogger("frontend")
router = APIRouter()


@router.post("/client-log")
@limiter.limit(RATE_LIMITS["client_log"])
async def client_log(request: Request, data: ClientLogRequest):
    log_msg = f"[FRONTEND] {data.message}"

    if data.level == "error":
        logger.error(log_msg)
    elif data.level == "warn":
        logger.warning(log_msg)
    else:
        logger.info(log_msg)

    return {"status": "ok"}
