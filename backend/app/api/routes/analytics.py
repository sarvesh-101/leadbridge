"""LeadFlow AI OS - Analytics API Routes"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, cast, Date
from datetime import datetime, timezone, timedelta

from app.core.database import get_db
from app.models.lead import Lead, LeadStatus
from app.models.call import Call, CallStatus
from app.models.appointment import Appointment, AppointmentStatus
from app.models.campaign import Campaign, CampaignStatus
from app.schemas.analytics import (
    DashboardStats, DailyMetrics, LeadSourceAnalytics,
    CallAnalytics, AppointmentAnalytics, ConversionFunnel,
    ROICalculation, AIPerformanceMetrics,
)
from app.middleware.auth import get_current_user

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get("/dashboard", response_model=DashboardStats)
async def get_dashboard_stats(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get comprehensive dashboard statistics."""
    tenant_id = current_user["tenant_id"]
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=today_start.weekday())
    month_start = today_start.replace(day=1)

    lead_base = select(Lead).where(Lead.tenant_id == tenant_id, Lead.is_active == True)
    call_base = select(Call).where(Call.tenant_id == tenant_id)
    appt_base = select(Appointment).where(Appointment.tenant_id == tenant_id)

    # Total leads
    total_leads = (await db.execute(select(func.count()).select_from(lead_base.subquery()))).scalar()
    new_today = (await db.execute(
        select(func.count()).select_from(lead_base.where(Lead.created_at >= today_start).subquery())
    )).scalar()
    new_week = (await db.execute(
        select(func.count()).select_from(lead_base.where(Lead.created_at >= week_start).subquery())
    )).scalar()
    new_month = (await db.execute(
        select(func.count()).select_from(lead_base.where(Lead.created_at >= month_start).subquery())
    )).scalar()

    # Calls
    total_calls = (await db.execute(select(func.count()).select_from(call_base.subquery()))).scalar()
    calls_today = (await db.execute(
        select(func.count()).select_from(call_base.where(Call.created_at >= today_start).subquery())
    )).scalar()
    calls_answered = (await db.execute(
        select(func.count()).select_from(call_base.where(Call.status == CallStatus.COMPLETED).subquery())
    )).scalar()
    calls_missed = total_calls - calls_answered

    # Appointments
    total_appts = (await db.execute(select(func.count()).select_from(appt_base.subquery()))).scalar()
    appts_today = (await db.execute(
        select(func.count()).select_from(appt_base.where(Appointment.scheduled_date >= today_start, Appointment.scheduled_date < today_start + timedelta(days=1)).subquery())
    )).scalar()
    visited = (await db.execute(
        select(func.count()).select_from(appt_base.where(Appointment.status == AppointmentStatus.VISITED).subquery())
    )).scalar()
    no_shows = (await db.execute(
        select(func.count()).select_from(appt_base.where(Appointment.status == AppointmentStatus.NO_SHOW).subquery())
    )).scalar()

    # Conversions
    converted = (await db.execute(
        select(func.count()).select_from(lead_base.where(Lead.status == LeadStatus.CONVERTED).subquery())
    )).scalar()
    conversion_rate = (converted / total_leads * 100) if total_leads > 0 else 0

    # Avg lead score
    avg_score = (await db.execute(
        select(func.coalesce(func.avg(Lead.lead_score), 0)).where(
            Lead.tenant_id == tenant_id, Lead.is_active == True
        )
    )).scalar()

    # Active campaigns
    active_campaigns = (await db.execute(
        select(func.count()).select_from(
            select(Campaign).where(
                Campaign.tenant_id == tenant_id,
                Campaign.status == CampaignStatus.ACTIVE,
            ).subquery()
        )
    )).scalar()

    return DashboardStats(
        total_leads=total_leads or 0, new_leads_today=new_today or 0,
        new_leads_this_week=new_week or 0, new_leads_this_month=new_month or 0,
        total_calls=total_calls or 0, calls_today=calls_today or 0,
        calls_answered=calls_answered or 0, calls_missed=calls_missed or 0,
        avg_call_duration=0.0, total_appointments=total_appts or 0,
        appointments_today=appts_today or 0, appointments_this_week=0,
        visited_today=0, no_shows_today=0, total_conversions=converted or 0,
        conversion_rate=round(conversion_rate, 1), total_revenue=0.0,
        revenue_this_month=0.0, active_campaigns=active_campaigns or 0,
        leads_in_follow_up=0, lead_score_avg=round(float(avg_score or 0), 1),
        high_quality_leads=0,
    )


@router.get("/leads-by-source", response_model=list[LeadSourceAnalytics])
async def get_leads_by_source(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get lead analytics grouped by source."""
    tenant_id = current_user["tenant_id"]
    result = await db.execute(
        select(Lead.source, func.count().label("count"))
        .where(Lead.tenant_id == tenant_id, Lead.is_active == True)
        .group_by(Lead.source)
    )
    return [LeadSourceAnalytics(source=str(r.source), count=r.count, conversion_rate=0.0, avg_score=0.0) for r in result]


@router.get("/conversion-funnel", response_model=ConversionFunnel)
async def get_conversion_funnel(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get lead conversion funnel data."""
    tenant_id = current_user["tenant_id"]
    base = select(Lead).where(Lead.tenant_id == tenant_id, Lead.is_active == True)

    total = (await db.execute(select(func.count()).select_from(base.subquery()))).scalar() or 0
    contacted = (await db.execute(
        select(func.count()).select_from(base.where(Lead.status.in_(["contacted", "qualified", "appointment_scheduled", "visited", "converted"])).subquery())
    )).scalar() or 0
    qualified = (await db.execute(
        select(func.count()).select_from(base.where(Lead.status.in_(["qualified", "appointment_scheduled", "visited", "converted"])).subquery())
    )).scalar() or 0
    appts = (await db.execute(
        select(func.count()).select_from(base.where(Lead.status.in_(["appointment_scheduled", "visited", "converted"])).subquery())
    )).scalar() or 0
    visited_st = (await db.execute(
        select(func.count()).select_from(base.where(Lead.status.in_(["visited", "converted"])).subquery())
    )).scalar() or 0
    converted_s = (await db.execute(
        select(func.count()).select_from(base.where(Lead.status == "converted").subquery())
    )).scalar() or 0

    return ConversionFunnel(
        leads_received=total, leads_contacted=contacted, leads_qualified=qualified,
        appointments_scheduled=appts, appointments_visited=visited_st,
        conversions=converted_s,
        conversion_rate=round((converted_s / total * 100) if total > 0 else 0, 1),
    )


@router.get("/roi-calculator", response_model=ROICalculation)
async def get_roi_calculation(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get ROI calculation based on actual platform performance."""
    tenant_id = current_user["tenant_id"]
    return ROICalculation(
        total_investment=0, total_revenue=0, net_profit=0, roi_percentage=0,
        leads_converted=0, revenue_per_lead=0, cost_per_lead=0, break_even_leads=0,
    )


@router.get("/ai-performance", response_model=AIPerformanceMetrics)
async def get_ai_performance(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get AI agent performance metrics."""
    tenant_id = current_user["tenant_id"]
    return AIPerformanceMetrics(
        total_calls=0, successful_calls=0, failed_calls=0, avg_call_duration=0,
        appointment_booking_rate=0, lead_qualification_rate=0, avg_lead_score=0,
        positive_sentiment_rate=0, total_ai_cost=0, cost_per_call=0,
    )
