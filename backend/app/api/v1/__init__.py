"""LeadFlow AI OS - API v1 Router"""

from fastapi import APIRouter

router = APIRouter(prefix="/api/v1")

# Import route modules
from app.api.routes import auth, leads, calls, appointments, campaigns, territories, subscriptions, analytics, admin, integrations

# Include sub-routers
router.include_router(auth.router)
router.include_router(leads.router)
router.include_router(calls.router)
router.include_router(appointments.router)
router.include_router(campaigns.router)
router.include_router(territories.router)
router.include_router(subscriptions.router)
router.include_router(analytics.router)
router.include_router(admin.router)
router.include_router(integrations.router)
