"""LeadFlow AI OS - Appointments API Routes"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from sqlalchemy.orm import selectinload
from typing import Optional
from datetime import datetime, timezone

from app.core.database import get_db
from app.models.appointment import Appointment, AppointmentStatus
from app.models.lead import Lead
from app.schemas.appointment import (
    AppointmentCreate, AppointmentUpdate, AppointmentResponse,
    AppointmentListResponse, AppointmentRescheduleRequest,
    AppointmentConfirmRequest, AppointmentAnalytics,
)
from app.middleware.auth import get_current_user

router = APIRouter(prefix="/appointments", tags=["Appointments"])


@router.get("/", response_model=AppointmentListResponse)
async def list_appointments(
    lead_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    tenant_id = current_user["tenant_id"]
    query = select(Appointment).where(Appointment.tenant_id == tenant_id, Appointment.is_active == True)

    if lead_id:
        query = query.where(Appointment.lead_id == lead_id)
    if status:
        query = query.where(Appointment.status == status)
    if date_from:
        query = query.where(Appointment.scheduled_date >= date_from)
    if date_to:
        query = query.where(Appointment.scheduled_date <= date_to)

    total = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar()
    query = query.order_by(desc(Appointment.scheduled_date))
    query = query.offset((page - 1) * page_size).limit(page_size)
    query = query.options(selectinload(Appointment.lead))
    result = await db.execute(query)
    items = result.scalars().all()

    return AppointmentListResponse(
        items=[AppointmentResponse.model_validate(a) for a in items],
        total=total, page=page, page_size=page_size,
        total_pages=(total + page_size - 1) // page_size,
    )


@router.post("/", response_model=AppointmentResponse, status_code=201)
async def create_appointment(
    data: AppointmentCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    tenant_id = current_user["tenant_id"]
    result = await db.execute(select(Lead).where(Lead.id == data.lead_id, Lead.tenant_id == tenant_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Lead not found")

    appointment = Appointment(
        tenant_id=tenant_id, lead_id=data.lead_id, created_by=current_user["id"],
        title=data.title, description=data.description,
        appointment_type=data.appointment_type,
        scheduled_date=data.scheduled_date,
        scheduled_start_time=data.scheduled_start_time,
        scheduled_end_time=data.scheduled_end_time,
        duration_minutes=data.duration_minutes,
        location=data.location, address=data.address, city=data.city,
        meeting_link=data.meeting_link, notes=data.notes,
    )
    db.add(appointment)
    await db.commit()
    await db.refresh(appointment)
    return AppointmentResponse.model_validate(appointment)


@router.get("/{appointment_id}", response_model=AppointmentResponse)
async def get_appointment(appointment_id: str, current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    tenant_id = current_user["tenant_id"]
    result = await db.execute(
        select(Appointment).where(Appointment.id == appointment_id, Appointment.tenant_id == tenant_id)
        .options(selectinload(Appointment.lead))
    )
    appt = result.scalar_one_or_none()
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")
    return AppointmentResponse.model_validate(appt)


@router.put("/{appointment_id}", response_model=AppointmentResponse)
async def update_appointment(appointment_id: str, data: AppointmentUpdate, current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    tenant_id = current_user["tenant_id"]
    result = await db.execute(select(Appointment).where(Appointment.id == appointment_id, Appointment.tenant_id == tenant_id))
    appt = result.scalar_one_or_none()
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(appt, key, value)
    await db.commit()
    await db.refresh(appt)
    return AppointmentResponse.model_validate(appt)


@router.post("/{appointment_id}/reschedule")
async def reschedule_appointment(appointment_id: str, data: AppointmentRescheduleRequest, current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    tenant_id = current_user["tenant_id"]
    result = await db.execute(select(Appointment).where(Appointment.id == appointment_id, Appointment.tenant_id == tenant_id))
    appt = result.scalar_one_or_none()
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")
    appt.status = AppointmentStatus.RESCHEDULED
    appt.rescheduled_count += 1
    appt.rescheduled_from = appt.scheduled_start_time
    appt.reschedule_reason = data.reason
    appt.scheduled_start_time = data.new_start_time
    if data.new_end_time:
        appt.scheduled_end_time = data.new_end_time
    await db.commit()
    return {"message": "Appointment rescheduled"}


@router.post("/{appointment_id}/confirm")
async def confirm_appointment(appointment_id: str, data: AppointmentConfirmRequest, current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    tenant_id = current_user["tenant_id"]
    result = await db.execute(select(Appointment).where(Appointment.id == appointment_id, Appointment.tenant_id == tenant_id))
    appt = result.scalar_one_or_none()
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")
    appt.status = data.status
    appt.outcome = data.outcome
    appt.outcome_notes = data.notes
    if data.status == "visited":
        appt.visited_at = datetime.now(timezone.utc)
    elif data.status == "cancelled":
        appt.cancelled_at = datetime.now(timezone.utc)
        appt.cancellation_reason = data.notes
    await db.commit()
    return {"message": f"Appointment confirmed as {data.status}"}


@router.get("/analytics/summary", response_model=AppointmentAnalytics)
async def get_appointment_analytics(current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    tenant_id = current_user["tenant_id"]
    base = select(Appointment).where(Appointment.tenant_id == tenant_id)
    total = (await db.execute(select(func.count()).select_from(base.subquery()))).scalar()
    
    status_counts = {}
    for s in AppointmentStatus:
        cnt = (await db.execute(
            select(func.count()).select_from(base.where(Appointment.status == s).subquery())
        )).scalar()
        status_counts[s.value] = cnt
    
    return AppointmentAnalytics(
        total_appointments=total,
        scheduled=status_counts.get("scheduled", 0),
        confirmed=status_counts.get("confirmed", 0),
        visited=status_counts.get("visited", 0),
        no_shows=status_counts.get("no_show", 0),
        cancelled=status_counts.get("cancelled", 0),
        rescheduled=status_counts.get("rescheduled", 0),
        visit_rate=(status_counts.get("visited", 0) / total * 100) if total > 0 else 0,
        no_show_rate=(status_counts.get("no_show", 0) / total * 100) if total > 0 else 0,
    )
