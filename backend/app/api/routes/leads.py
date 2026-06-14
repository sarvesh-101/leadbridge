"""LeadFlow AI OS - Leads API Routes"""

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, and_, desc, asc
from sqlalchemy.orm import selectinload
from typing import Optional, List
from datetime import datetime, timezone
import csv
import io
import uuid

from app.core.database import get_db
from app.models.lead import Lead, LeadStatus, LeadActivity, LeadSource, LeadPriority
from app.models.user import User
from app.schemas.lead import (
    LeadCreate, LeadUpdate, LeadResponse, LeadListResponse,
    LeadActivityResponse, LeadScoreUpdate, LeadAssignRequest,
    LeadBulkAction,
)
from app.middleware.auth import get_current_user, require_permission

router = APIRouter(prefix="/leads", tags=["Leads"])


@router.get("/", response_model=LeadListResponse)
async def list_leads(
    request: Request,
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    source: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    assigned_to: Optional[str] = Query(None),
    city: Optional[str] = Query(None),
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    min_score: Optional[int] = Query(None),
    max_score: Optional[int] = Query(None),
    tags: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    sort_by: str = Query("created_at"),
    sort_order: str = Query("desc"),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List leads with filtering, search, and pagination."""
    tenant_id = current_user["tenant_id"]
    query = select(Lead).where(
        Lead.tenant_id == tenant_id,
        Lead.is_active == True,
        Lead.deleted_at == None,
    )

    # Apply filters
    if search:
        search_filter = or_(
            Lead.first_name.ilike(f"%{search}%"),
            Lead.last_name.ilike(f"%{search}%"),
            Lead.email.ilike(f"%{search}%"),
            Lead.phone.ilike(f"%{search}%"),
            Lead.company_name.ilike(f"%{search}%"),
            Lead.requirement.ilike(f"%{search}%"),
        )
        query = query.where(search_filter)

    if status:
        query = query.where(Lead.status == status)
    if source:
        query = query.where(Lead.source == source)
    if priority:
        query = query.where(Lead.priority == priority)
    if assigned_to:
        query = query.where(Lead.assigned_to == assigned_to)
    if city:
        query = query.where(Lead.city.ilike(f"%{city}%"))
    if date_from:
        query = query.where(Lead.created_at >= date_from)
    if date_to:
        query = query.where(Lead.created_at <= date_to)
    if min_score is not None:
        query = query.where(Lead.lead_score >= min_score)
    if max_score is not None:
        query = query.where(Lead.lead_score <= max_score)
    if tags:
        tag_list = [t.strip() for t in tags.split(",")]
        for tag in tag_list:
            query = query.where(Lead.tags.any(tag))

    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar()

    # Sorting
    sort_column = getattr(Lead, sort_by, Lead.created_at)
    order_func = desc if sort_order == "desc" else asc
    query = query.order_by(order_func(sort_column))

    # Pagination
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)

    # Load relationships
    query = query.options(
        selectinload(Lead.assigned_to_user),
        selectinload(Lead.created_by_user),
    )

    result = await db.execute(query)
    leads = result.scalars().all()

    items = []
    for lead in leads:
        lead_dict = {
            "id": lead.id,
            "tenant_id": lead.tenant_id,
            "first_name": lead.first_name,
            "last_name": lead.last_name,
            "full_name": lead.full_name,
            "email": lead.email,
            "phone": lead.phone,
            "alternate_phone": lead.alternate_phone,
            "source": lead.source.value if hasattr(lead.source, 'value') else lead.source,
            "status": lead.status.value if hasattr(lead.status, 'value') else lead.status,
            "priority": lead.priority.value if hasattr(lead.priority, 'value') else lead.priority,
            "requirement": lead.requirement,
            "budget_min": lead.budget_min,
            "budget_max": lead.budget_max,
            "location": lead.location,
            "city": lead.city,
            "company_name": lead.company_name,
            "lead_score": lead.lead_score,
            "ai_sentiment": lead.ai_sentiment,
            "ai_summary": lead.ai_summary,
            "tags": lead.tags or [],
            "assigned_to": lead.assigned_to,
            "created_by": lead.created_by,
            "created_at": lead.created_at,
            "updated_at": lead.updated_at,
        }
        items.append(LeadResponse(**lead_dict))

    return LeadListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=(total + page_size - 1) // page_size,
    )


@router.post("/", response_model=LeadResponse, status_code=201)
async def create_lead(
    lead_data: LeadCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new lead."""
    tenant_id = current_user["tenant_id"]

    lead = Lead(
        tenant_id=tenant_id,
        created_by=current_user["id"],
        first_name=lead_data.first_name,
        last_name=lead_data.last_name,
        email=lead_data.email,
        phone=lead_data.phone,
        alternate_phone=lead_data.alternate_phone,
        source=lead_data.source,
        source_url=lead_data.source_url,
        source_reference_id=lead_data.source_reference_id,
        requirement=lead_data.requirement,
        budget_min=lead_data.budget_min,
        budget_max=lead_data.budget_max,
        location=lead_data.location,
        city=lead_data.city,
        state=lead_data.state,
        timeline=lead_data.timeline,
        company_name=lead_data.company_name,
        designation=lead_data.designation,
        website=lead_data.website,
        tags=lead_data.tags,
        custom_fields=lead_data.custom_fields,
        notes=lead_data.notes,
        consent_given=lead_data.consent_given,
        preferred_contact_time=lead_data.preferred_contact_time,
        preferred_contact_method=lead_data.preferred_contact_method,
    )
    db.add(lead)
    await db.flush()

    # Create initial status record
    status_record = LeadStatus(
        tenant_id=tenant_id,
        lead_id=lead.id,
        changed_by=current_user["id"],
        from_status=None,
        to_status="pending",
    )
    db.add(status_record)

    # Create activity record
    activity = LeadActivity(
        tenant_id=tenant_id,
        lead_id=lead.id,
        user_id=current_user["id"],
        activity_type="created",
        description=f"Lead created from {lead_data.source}",
    )
    db.add(activity)
    await db.commit()
    await db.refresh(lead)

    return LeadResponse(
        id=lead.id,
        tenant_id=lead.tenant_id,
        first_name=lead.first_name,
        last_name=lead.last_name,
        full_name=lead.full_name,
        email=lead.email,
        phone=lead.phone,
        alternate_phone=lead.alternate_phone,
        source=lead.source.value if hasattr(lead.source, 'value') else lead.source,
        status=lead.status.value if hasattr(lead.status, 'value') else lead.status,
        priority=lead.priority.value if hasattr(lead.priority, 'value') else lead.priority,
        requirement=lead.requirement,
        budget_min=lead.budget_min,
        budget_max=lead.budget_max,
        location=lead.location,
        city=lead.city,
        company_name=lead.company_name,
        lead_score=lead.lead_score,
        ai_sentiment=lead.ai_sentiment,
        ai_summary=lead.ai_summary,
        tags=lead.tags or [],
        assigned_to=lead.assigned_to,
        created_by=lead.created_by,
        created_at=lead.created_at,
        updated_at=lead.updated_at,
    )


@router.get("/{lead_id}", response_model=LeadResponse)
async def get_lead(
    lead_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a single lead by ID."""
    tenant_id = current_user["tenant_id"]
    result = await db.execute(
        select(Lead).where(
            Lead.id == lead_id,
            Lead.tenant_id == tenant_id,
            Lead.is_active == True,
        ).options(
            selectinload(Lead.assigned_to_user),
            selectinload(Lead.created_by_user),
            selectinload(Lead.activities),
            selectinload(Lead.calls),
            selectinload(Lead.appointments),
        )
    )
    lead = result.scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    return LeadResponse(
        id=lead.id,
        tenant_id=lead.tenant_id,
        first_name=lead.first_name,
        last_name=lead.last_name,
        full_name=lead.full_name,
        email=lead.email,
        phone=lead.phone,
        alternate_phone=lead.alternate_phone,
        source=lead.source.value if hasattr(lead.source, 'value') else lead.source,
        status=lead.status.value if hasattr(lead.status, 'value') else lead.status,
        priority=lead.priority.value if hasattr(lead.priority, 'value') else lead.priority,
        requirement=lead.requirement,
        budget_min=lead.budget_min,
        budget_max=lead.budget_max,
        location=lead.location,
        city=lead.city,
        company_name=lead.company_name,
        lead_score=lead.lead_score,
        ai_sentiment=lead.ai_sentiment,
        ai_summary=lead.ai_summary,
        tags=lead.tags or [],
        assigned_to=lead.assigned_to,
        created_by=lead.created_by,
        created_at=lead.created_at,
        updated_at=lead.updated_at,
    )


@router.put("/{lead_id}", response_model=LeadResponse)
async def update_lead(
    lead_id: str,
    lead_data: LeadUpdate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a lead."""
    tenant_id = current_user["tenant_id"]
    result = await db.execute(
        select(Lead).where(
            Lead.id == lead_id,
            Lead.tenant_id == tenant_id,
            Lead.is_active == True,
        )
    )
    lead = result.scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    # Track status change
    old_status = lead.status
    if lead_data.status and lead_data.status != old_status:
        status_record = LeadStatus(
            tenant_id=tenant_id,
            lead_id=lead.id,
            changed_by=current_user["id"],
            from_status=old_status.value if hasattr(old_status, 'value') else old_status,
            to_status=lead_data.status,
        )
        db.add(status_record)

        activity = LeadActivity(
            tenant_id=tenant_id,
            lead_id=lead.id,
            user_id=current_user["id"],
            activity_type="status_change",
            description=f"Status changed from {old_status} to {lead_data.status}",
        )
        db.add(activity)

    # Update fields
    update_data = lead_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(lead, key, value)

    # Add update activity
    activity = LeadActivity(
        tenant_id=tenant_id,
        lead_id=lead.id,
        user_id=current_user["id"],
        activity_type="updated",
        description="Lead information updated",
        metadata={"changes": list(update_data.keys())},
    )
    db.add(activity)
    await db.commit()
    await db.refresh(lead)

    return LeadResponse(
        id=lead.id,
        tenant_id=lead.tenant_id,
        first_name=lead.first_name,
        last_name=lead.last_name,
        full_name=lead.full_name,
        email=lead.email,
        phone=lead.phone,
        alternate_phone=lead.alternate_phone,
        source=lead.source.value if hasattr(lead.source, 'value') else lead.source,
        status=lead.status.value if hasattr(lead.status, 'value') else lead.status,
        priority=lead.priority.value if hasattr(lead.priority, 'value') else lead.priority,
        requirement=lead.requirement,
        budget_min=lead.budget_min,
        budget_max=lead.budget_max,
        location=lead.location,
        city=lead.city,
        company_name=lead.company_name,
        lead_score=lead.lead_score,
        ai_sentiment=lead.ai_sentiment,
        ai_summary=lead.ai_summary,
        tags=lead.tags or [],
        assigned_to=lead.assigned_to,
        created_by=lead.created_by,
        created_at=lead.created_at,
        updated_at=lead.updated_at,
    )


@router.delete("/{lead_id}")
async def delete_lead(
    lead_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Soft delete a lead."""
    tenant_id = current_user["tenant_id"]
    result = await db.execute(
        select(Lead).where(
            Lead.id == lead_id,
            Lead.tenant_id == tenant_id,
            Lead.is_active == True,
        )
    )
    lead = result.scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    lead.is_active = False
    lead.deleted_at = datetime.now(timezone.utc)

    activity = LeadActivity(
        tenant_id=tenant_id,
        lead_id=lead.id,
        user_id=current_user["id"],
        activity_type="deleted",
        description="Lead deleted",
    )
    db.add(activity)
    await db.commit()

    return {"message": "Lead deleted successfully"}


@router.post("/{lead_id}/assign")
async def assign_lead(
    lead_id: str,
    assign_data: LeadAssignRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Assign lead to a user."""
    tenant_id = current_user["tenant_id"]

    # Verify lead exists
    result = await db.execute(
        select(Lead).where(
            Lead.id == lead_id,
            Lead.tenant_id == tenant_id,
        )
    )
    lead = result.scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    # Verify assignee exists in same tenant
    result = await db.execute(
        select(User).where(
            User.id == assign_data.user_id,
            User.tenant_id == tenant_id,
            User.is_active == True,
        )
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Assignee not found")

    old_assignee = lead.assigned_to
    lead.assigned_to = assign_data.user_id

    activity = LeadActivity(
        tenant_id=tenant_id,
        lead_id=lead.id,
        user_id=current_user["id"],
        activity_type="assigned",
        description=f"Lead assigned to {user.full_name}",
        metadata={"from": old_assignee, "to": assign_data.user_id},
    )
    db.add(activity)
    await db.commit()

    return {"message": f"Lead assigned to {user.full_name}"}


@router.post("/{lead_id}/score")
async def update_lead_score(
    lead_id: str,
    score_data: LeadScoreUpdate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update lead AI score."""
    tenant_id = current_user["tenant_id"]
    result = await db.execute(
        select(Lead).where(
            Lead.id == lead_id,
            Lead.tenant_id == tenant_id,
        )
    )
    lead = result.scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    old_score = lead.lead_score
    lead.lead_score = score_data.lead_score

    activity = LeadActivity(
        tenant_id=tenant_id,
        lead_id=lead.id,
        user_id=current_user["id"],
        activity_type="score_updated",
        description=score_data.reason or f"Score updated from {old_score} to {score_data.lead_score}",
        metadata={"from": old_score, "to": score_data.lead_score},
    )
    db.add(activity)
    await db.commit()

    return {"message": "Score updated", "score": score_data.lead_score}


@router.get("/{lead_id}/activities", response_model=List[LeadActivityResponse])
async def get_lead_activities(
    lead_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get lead activity timeline."""
    tenant_id = current_user["tenant_id"]
    result = await db.execute(
        select(Lead).where(
            Lead.id == lead_id,
            Lead.tenant_id == tenant_id,
        )
    )
    lead = result.scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    result = await db.execute(
        select(LeadActivity)
        .where(LeadActivity.lead_id == lead_id)
        .order_by(desc(LeadActivity.created_at))
        .limit(50)
    )
    activities = result.scalars().all()

    return [
        LeadActivityResponse(
            id=a.id,
            lead_id=a.lead_id,
            activity_type=a.activity_type,
            description=a.description,
            metadata=a.metadata or {},
            created_at=a.created_at,
        )
        for a in activities
    ]


@router.post("/bulk")
async def bulk_lead_action(
    bulk_action: LeadBulkAction,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Bulk action on leads (assign, change_status, add_tag, delete)."""
    tenant_id = current_user["tenant_id"]
    action = bulk_action.action
    value = bulk_action.value
    lead_ids = bulk_action.lead_ids

    result = await db.execute(
        select(Lead).where(
            Lead.id.in_(lead_ids),
            Lead.tenant_id == tenant_id,
        )
    )
    leads = result.scalars().all()

    updated_count = 0
    for lead in leads:
        if action == "assign" and value:
            lead.assigned_to = value
        elif action == "change_status" and value:
            lead.status = value
        elif action == "add_tag" and value:
            tags = lead.tags or []
            if value not in tags:
                tags.append(value)
                lead.tags = tags
        elif action == "delete":
            lead.is_active = False
            lead.deleted_at = datetime.now(timezone.utc)

        activity = LeadActivity(
            tenant_id=tenant_id,
            lead_id=lead.id,
            user_id=current_user["id"],
            activity_type=f"bulk_{action}",
            description=f"Bulk {action}: {value or ''}",
        )
        db.add(activity)
        updated_count += 1

    await db.commit()
    return {"message": f"{updated_count} leads updated", "action": action, "count": updated_count}


@router.post("/import/csv")
async def import_leads_csv(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Import leads from CSV file."""
    tenant_id = current_user["tenant_id"]

    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are supported")

    content = await file.read()
    reader = csv.DictReader(io.StringIO(content.decode("utf-8")))

    imported = 0
    errors = []

    for row_num, row in enumerate(reader, start=2):
        try:
            if not row.get("phone") and not row.get("Phone") and not row.get("phone"):
                errors.append(f"Row {row_num}: Phone number is required")
                continue

            phone = row.get("phone") or row.get("Phone") or row.get("PHONE", "")
            first_name = row.get("first_name") or row.get("First Name") or row.get("name") or row.get("Name", "Unknown")
            email = row.get("email") or row.get("Email") or row.get("EMAIL")

            lead = Lead(
                tenant_id=tenant_id,
                created_by=current_user["id"],
                first_name=first_name,
                last_name=row.get("last_name") or row.get("Last Name"),
                email=email,
                phone=phone,
                source="csv_import",
                requirement=row.get("requirement") or row.get("Requirement"),
                budget_min=row.get("budget_min") or row.get("Budget Min"),
                budget_max=row.get("budget_max") or row.get("Budget Max"),
                location=row.get("location") or row.get("Location"),
                city=row.get("city") or row.get("City"),
                company_name=row.get("company") or row.get("Company"),
                notes=row.get("notes") or row.get("Notes"),
            )
            db.add(lead)
            imported += 1

        except Exception as e:
            errors.append(f"Row {row_num}: {str(e)}")

    await db.commit()
    return {
        "message": f"Imported {imported} leads",
        "imported": imported,
        "errors": errors,
        "total_rows": row_num - 1,
    }


@router.get("/analytics/summary")
async def get_lead_analytics(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get lead analytics summary for dashboard."""
    tenant_id = current_user["tenant_id"]

    base_query = select(Lead).where(
        Lead.tenant_id == tenant_id,
        Lead.is_active == True,
        Lead.deleted_at == None,
    )

    # Total leads
    total = (await db.execute(select(func.count()).select_from(base_query.subquery()))).scalar()

    # Leads by status
    status_query = select(Lead.status, func.count().label("count")).where(
        Lead.tenant_id == tenant_id,
        Lead.is_active == True,
        Lead.deleted_at == None,
    ).group_by(Lead.status)
    status_result = await db.execute(status_query)
    status_counts = {row.status.value if hasattr(row.status, 'value') else row.status: row.count for row in status_result}

    # Leads by source
    source_query = select(Lead.source, func.count().label("count")).where(
        Lead.tenant_id == tenant_id,
        Lead.is_active == True,
        Lead.deleted_at == None,
    ).group_by(Lead.source)
    source_result = await db.execute(source_query)
    source_counts = {row.source.value if hasattr(row.source, 'value') else row.source: row.count for row in source_result}

    # Today's leads
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    today_query = select(func.count()).select_from(
        base_query.where(Lead.created_at >= today_start).subquery()
    )
    today = (await db.execute(today_query)).scalar()

    # Average score
    avg_score_result = await db.execute(
        select(func.avg(Lead.lead_score)).where(
            Lead.tenant_id == tenant_id,
            Lead.is_active == True,
        )
    )
    avg_score = avg_score_result.scalar() or 0

    return {
        "total_leads": total,
        "today_leads": today,
        "average_score": round(float(avg_score), 1),
        "by_status": status_counts,
        "by_source": source_counts,
    }
