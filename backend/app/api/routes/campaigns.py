"""LeadFlow AI OS - Campaigns API Routes"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from sqlalchemy.orm import selectinload
from typing import Optional, List
from datetime import datetime

from app.core.database import get_db
from app.models.campaign import Campaign, CampaignStatus, CampaignTask, TaskAction
from app.schemas.campaign import (
    CampaignCreate, CampaignUpdate, CampaignResponse,
    CampaignTaskCreate, CampaignTaskResponse, CampaignAnalytics,
)
from app.middleware.auth import get_current_user

router = APIRouter(prefix="/campaigns", tags=["Campaigns"])


@router.get("/", response_model=List[CampaignResponse])
async def list_campaigns(
    status: Optional[str] = Query(None),
    campaign_type: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    tenant_id = current_user["tenant_id"]
    query = select(Campaign).where(Campaign.tenant_id == tenant_id, Campaign.is_active == True)
    if status:
        query = query.where(Campaign.status == status)
    if campaign_type:
        query = query.where(Campaign.campaign_type == campaign_type)
    query = query.order_by(desc(Campaign.created_at))
    query = query.options(selectinload(Campaign.tasks))
    result = await db.execute(query)
    return [CampaignResponse.model_validate(c) for c in result.scalars().all()]


@router.post("/", response_model=CampaignResponse, status_code=201)
async def create_campaign(
    data: CampaignCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    tenant_id = current_user["tenant_id"]
    campaign = Campaign(
        tenant_id=tenant_id,
        created_by=current_user["id"],
        name=data.name,
        description=data.description,
        campaign_type=data.campaign_type,
        target_lead_sources=data.target_lead_sources,
        target_lead_statuses=data.target_lead_statuses,
        target_locations=data.target_locations,
        target_tags=data.target_tags,
        target_min_score=data.target_min_score,
        target_max_score=data.target_max_score,
        start_date=data.start_date,
        end_date=data.end_date,
        working_hours_start=data.working_hours_start,
        working_hours_end=data.working_hours_end,
        working_days=data.working_days,
    )
    db.add(campaign)
    await db.commit()
    await db.refresh(campaign)
    return CampaignResponse.model_validate(campaign)


@router.get("/{campaign_id}", response_model=CampaignResponse)
async def get_campaign(campaign_id: str, current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    tenant_id = current_user["tenant_id"]
    result = await db.execute(
        select(Campaign).where(Campaign.id == campaign_id, Campaign.tenant_id == tenant_id)
        .options(selectinload(Campaign.tasks))
    )
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return CampaignResponse.model_validate(campaign)


@router.put("/{campaign_id}", response_model=CampaignResponse)
async def update_campaign(campaign_id: str, data: CampaignUpdate, current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    tenant_id = current_user["tenant_id"]
    result = await db.execute(select(Campaign).where(Campaign.id == campaign_id, Campaign.tenant_id == tenant_id))
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(campaign, key, value)
    await db.commit()
    await db.refresh(campaign)
    return CampaignResponse.model_validate(campaign)


@router.post("/{campaign_id}/activate")
async def activate_campaign(campaign_id: str, current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    tenant_id = current_user["tenant_id"]
    result = await db.execute(select(Campaign).where(Campaign.id == campaign_id, Campaign.tenant_id == tenant_id))
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    campaign.status = CampaignStatus.ACTIVE
    campaign.activated_at = datetime.now()
    await db.commit()
    return {"message": "Campaign activated"}


@router.post("/{campaign_id}/pause")
async def pause_campaign(campaign_id: str, current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    tenant_id = current_user["tenant_id"]
    result = await db.execute(select(Campaign).where(Campaign.id == campaign_id, Campaign.tenant_id == tenant_id))
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    campaign.status = CampaignStatus.PAUSED
    await db.commit()
    return {"message": "Campaign paused"}


@router.post("/{campaign_id}/tasks", response_model=CampaignTaskResponse)
async def add_campaign_task(campaign_id: str, data: CampaignTaskCreate, current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    tenant_id = current_user["tenant_id"]
    result = await db.execute(select(Campaign).where(Campaign.id == campaign_id, Campaign.tenant_id == tenant_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Campaign not found")
    task = CampaignTask(
        campaign_id=campaign_id, name=data.name, action=data.action,
        order=data.order, config=data.config,
        delay_after_previous_hours=data.delay_after_previous_hours,
        delay_after_previous_minutes=data.delay_after_previous_minutes,
        is_condition=data.is_condition, condition_field=data.condition_field,
        condition_operator=data.condition_operator, condition_value=data.condition_value,
    )
    db.add(task)
    await db.commit()
    await db.refresh(task)
    return CampaignTaskResponse.model_validate(task)
