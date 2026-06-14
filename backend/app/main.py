"""LeadFlow AI OS - Application Entry Point

FastAPI application with middleware, routers, startup events, health checks,
and comprehensive error handling for the AI-Powered Lead Recovery platform.
"""

import time
import uuid
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from fastapi.exception_handlers import http_exception_handler
from starlette.exceptions import HTTPException as StarletteHTTPException

from sqlalchemy import text

from app.core.config import settings
from app.core.database import async_engine, Base, AsyncSessionLocal
from app.api.v1 import router as api_v1_router

import logging

# ─── Logging Configuration ────────────────────────────────────────
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO),
    format="%(asctime)s | %(levelname)-8s | %(name)s:%(funcName)s:%(lineno)d | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("leadflow")


# ─── Lifespan Events ──────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator:
    """Application lifespan: startup and shutdown events."""
    logger.info(
        "🚀 Starting %s v%s — Environment: %s",
        settings.APP_NAME,
        settings.APP_VERSION,
        settings.ENVIRONMENT,
    )
    logger.info("Database: %s", settings.DATABASE_URL.split("@")[-1] if "@" in settings.DATABASE_URL else settings.DATABASE_URL)
    logger.info("Redis: %s", settings.REDIS_URL.split("@")[-1] if "@" in settings.REDIS_URL else settings.REDIS_URL)

    # Startup: Create tables (development only; use Alembic migrations in production)
    if settings.ENVIRONMENT in ("development", "test"):
        async with async_engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
            logger.info("✅ Database tables synchronized")

    yield

    # Shutdown: Clean up connections
    await async_engine.dispose()
    logger.info("🛑 Application shutdown complete — connections closed")


# ─── Application Factory ──────────────────────────────────────────
app = FastAPI(
    title=settings.APP_NAME,
    description=settings.APP_DESCRIPTION,
    version=settings.APP_VERSION,
    docs_url="/docs" if settings.ENVIRONMENT != "production" else None,
    redoc_url="/redoc" if settings.ENVIRONMENT != "production" else None,
    lifespan=lifespan,
)


# ─── Middleware ────────────────────────────────────────────────────

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID", "X-Total-Count"],
)

# Trusted Host (protect against host header attacks)
if settings.ENVIRONMENT == "production":
    app.add_middleware(
        TrustedHostMiddleware,
        allowed_hosts=[
            "leadflow.ai",
            "api.leadflow.ai",
            "app.leadflow.ai",
            "*.leadflow.ai",
            "localhost",
            "127.0.0.1",
        ],
    )


# ─── Middleware: Request ID & Timing ──────────────────────────────
@app.middleware("http")
async def add_request_id_and_timing(request: Request, call_next):
    """Attach a unique request ID and measure execution time."""
    request_id = str(uuid.uuid4())[:8]
    request.state.request_id = request_id
    start_time = time.perf_counter()

    response = await call_next(request)

    elapsed = time.perf_counter() - start_time
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Execution-Time-MS"] = str(round(elapsed * 1000, 2))

    # Log slow requests
    if elapsed > 2.0:
        logger.warning(
            "🐢 Slow request [%s] %s %s — %.2fs",
            request_id,
            request.method,
            request.url.path,
            elapsed,
        )

    return response


# ─── Exception Handlers ───────────────────────────────────────────
@app.exception_handler(StarletteHTTPException)
async def custom_http_exception_handler(request: Request, exc: StarletteHTTPException):
    """Return structured JSON for HTTP exceptions."""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": exc.detail,
            "status_code": exc.status_code,
            "request_id": getattr(request.state, "request_id", None),
        },
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Catch-all exception handler to prevent stack trace leaks."""
    request_id = getattr(request.state, "request_id", "unknown")
    logger.exception(
        "💥 Unhandled exception [%s] %s %s",
        request_id,
        request.method,
        request.url.path,
    )
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "detail": str(exc) if settings.ENVIRONMENT != "production" else "An unexpected error occurred",
            "request_id": request_id,
        },
    )


# ─── Health Check ─────────────────────────────────────────────────
@app.get("/health", tags=["System"])
async def health_check():
    """Health check endpoint for load balancers and monitoring."""
    db_status = "unhealthy"
    try:
        async with async_engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
            db_status = "healthy"
    except Exception as e:
        logger.error("Health check — database unhealthy: %s", e)

    redis_status = "unhealthy"
    try:
        import redis.asyncio as aioredis
        r = aioredis.from_url(settings.REDIS_URL, socket_connect_timeout=3)
        await r.ping()
        redis_status = "healthy"
        await r.close()
    except Exception as e:
        logger.warning("Health check — Redis unhealthy: %s", e)

    overall = "healthy" if db_status == "healthy" else "degraded"

    return {
        "status": overall,
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "environment": settings.ENVIRONMENT,
        "timestamp": time.time(),
        "checks": {
            "database": db_status,
            "redis": redis_status,
        },
    }


# ─── API Readiness Probe ──────────────────────────────────────────
@app.get("/ready", tags=["System"])
async def readiness_check():
    """Kubernetes readiness probe."""
    return {"status": "ready"}


# ─── Mount API v1 Router ─────────────────────────────────────────
app.include_router(api_v1_router, prefix=settings.API_V1_PREFIX)


# ─── Root Redirect ───────────────────────────────────────────────
@app.get("/", tags=["System"])
async def root():
    """Root endpoint — redirects to API documentation."""
    return {
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "docs": "/docs",
        "api": f"{settings.API_V1_PREFIX}",
    }


# ─── Direct Execution ────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=settings.API_HOST,
        port=settings.API_PORT,
        reload=settings.ENVIRONMENT == "development",
        log_level=settings.LOG_LEVEL.lower(),
        access_log=True,
    )
