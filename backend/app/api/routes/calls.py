"""LeadFlow AI OS - Calls API Routes"""

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from sqlalchemy.orm import selectinload
from typing import Optional
from datetime import datetime, timezone

from app.core.database import get_db
from app.models.call import Call, CallRecording, CallStatus, CallType, CallDirection
from app.models.lead import Lead
from app.schemas.call import (
    CallCreate, CallResponse, CallListResponse, InitiateCallRequest,
    CallRecordingResponse, CallAnalytics,
)
from app.middleware.auth import get_current_user
from app.workers.tasks import initiate_ai_call

router = APIRouter(prefix="/calls", tags=["Calls"])


@router.get("/", response_model=CallListResponse)
async def list_calls(
    request: Request,
    lead_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    call_type: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List calls with filtering and pagination."""
    tenant_id = current_user["tenant_id"]
    query = select(Call).where(Call.tenant_id == tenant_id)

    if lead_id:
        query = query.where(Call.lead_id == lead_id)
    if status:
        query = query.where(Call.status == status)
    if call_type:
        query = query.where(Call.call_type == call_type)

    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar()

    query = query.order_by(desc(Call.created_at))
    query = query.offset((page - 1) * page_size).limit(page_size)
    query = query.options(selectinload(Call.lead))

    result = await db.execute(query)
    calls = result.scalars().all()

    return CallListResponse(
        items=[CallResponse.model_validate(c) for c in calls],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=(total + page_size - 1) // page_size,
    )


@router.post("/initiate")
async def initiate_call(
    req: InitiateCallRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Initiate an AI-powered call to a lead."""
    tenant_id = current_user["tenant_id"]

    result = await db.execute(
        select(Lead).where(Lead.id == req.lead_id, Lead.tenant_id == tenant_id)
    )
    lead = result.scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    call = Call(
        tenant_id=tenant_id,
        lead_id=req.lead_id,
        user_id=current_user["id"],
        call_type="ai",
        direction=CallDirection.OUTBOUND,
        status=CallStatus.QUEUED,
        to_number=req.phone_number or lead.phone,
        from_number="",  # Set from tenant AI config
    )
    db.add(call)
    await db.commit()
    await db.refresh(call)

    # Dispatch async task
    initiate_ai_call.delay(call.id, tenant_id)

    return {"message": "Call initiated", "call_id": call.id, "status": "queued"}


@router.get("/{call_id}", response_model=CallResponse)
async def get_call(
    call_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a single call by ID."""
    tenant_id = current_user["tenant_id"]
    result = await db.execute(
        select(Call).where(Call.id == call_id, Call.tenant_id == tenant_id)
        .options(selectinload(Call.lead), selectinload(Call.recordings))
    )
    call = result.scalar_one_or_none()
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")
    return CallResponse.model_validate(call)


@router.get("/analytics/summary", response_model=CallAnalytics)
async def get_call_analytics(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get call analytics summary."""
    tenant_id = current_user["tenant_id"]
    base = select(Call).where(Call.tenant_id == tenant_id)

    total = (await db.execute(select(func.count()).select_from(base.subquery()))).scalar()
    answered = (await db.execute(
        select(func.count()).select_from(
            base.where(Call.status == CallStatus.COMPLETED).subquery()
        )
    )).scalar()

    return CallAnalytics(
        total_calls=total,
        answered_calls=answered,
        missed_calls=total - answered,
        avg_duration=0.0,
        avg_talk_time=0.0,
        appointment_booking_rate=0.0,
        total_cost=0.0,
    )
