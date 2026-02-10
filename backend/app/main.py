from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi.errors import RateLimitExceeded
from app.routers import auth, health, invitations, media, patients, therapy, voice, logs
from app.utils.logger import logger
from app.middleware.rate_limit import limiter, rate_limit_handler

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting Reminisce API...")
    yield
    logger.info("Shutting down Reminisce API...")

app = FastAPI(title="Reminisce API", version="1.0.0", lifespan=lifespan)

# Rate limiting
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, rate_limit_handler)

from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc):
    logger.error(f"Validation error: {exc}")
    # Convert errors to a serializable format
    errors = []
    for error in exc.errors():
        error_copy = error.copy()
        if "ctx" in error_copy:
             # Remove non-serializable context objects like Exceptions
             error_copy.pop("ctx")
        errors.append(error_copy)
        
    return JSONResponse(
        status_code=422,
        content={"detail": errors, "body": str(exc.body)},
    )

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"],
)

@app.exception_handler(Exception)
async def debug_exception_handler(request, exc):
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc), "type": type(exc).__name__},
    )

# Routes
app.include_router(health.router, prefix="/api/health", tags=["Health"])
app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(patients.router, prefix="/api/patients", tags=["Patients"])
app.include_router(media.router, prefix="/api/media", tags=["Media"])
app.include_router(voice.router, prefix="/api/voice", tags=["Voice"])
app.include_router(therapy.router, prefix="/api", tags=["Therapy"])
app.include_router(invitations.router, prefix="/api/invitations", tags=["Invitations"])
app.include_router(logs.router, prefix="/api", tags=["Logs"])

@app.get("/")
async def root() -> dict[str, str]:
    return {"message": "Welcome to Reminisce API"}
