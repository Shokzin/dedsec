from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import structlog
from app.core.config import get_settings
from app.api.routes import scans
from app.api.routes.auth_routes import router as auth_router

logger = structlog.get_logger()
settings = get_settings()

app = FastAPI(
    title="DedSec API",
    description="Vulnerability analysis platform for GitHub repositories",
    version="1.0.0",
    docs_url="/docs" if settings.environment == "development" else None,
    redoc_url=None,
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(scans.router, prefix="/api/v1")
app.include_router(auth_router, prefix="/api/v1")

# ── Health ────────────────────────────────────────────────────────────────────
@app.get("/health", tags=["health"])
async def health_check():
    return {"status": "ok", "environment": settings.environment}


@app.get("/", tags=["health"])
async def root():
    return {"message": "DedSec Vulnerability Scanner API", "version": "1.0.0"}