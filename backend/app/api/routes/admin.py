"""LeadFlow AI OS - Admin Routes

Administrative API endpoints for platform management:
- Client (tenant) CRUD and management
- System-wide analytics and monitoring
- Territory management (create/assign/release)
- User management across tenants
- Audit log browsing
"""

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, asc, or_, delete as sa_delete
from sqlalchemy.orm import selectinload
from typing import Optional, List, Any, Dict
from datetime import datetime, timezone, timedelta

from app.core.database import get_db
from app.models.tenant import Tenant, TenantStatus, TenantPlan
from app.models.user import User, UserRole, UserStatus
from app.models.lead import Lead, LeadStatus
from app.models.call import Call, CallStatus
from app.models.appointment import Appointment, AppointmentStatus
from app.models.campaign import Campaign, CampaignStatus
from app.models.territory import Territory, TerritoryStatus, TerritoryPurchase
from app.models.subscription import Subscription, SubscriptionStatus
from app.models.audit import AuditLog
from app.models.notification import Notification, NotificationType
from app.core.security import (
    get_password_hash, generate_tenant_slug,
    create_access_token,
)
from app.middleware.auth import get_current_user

router = APIRouter(prefix="/admin", tags=["Admin"])


# ═══════════════════════════════════════════════════════════════════
# TENANT / CLIENT MANAGEMENT
# ═══════════════════════════════════════════════════════════════════

@router.get("/clients")
async def list_clients(
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    plan: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    sort_by: str = Query("created_at"),
    sort_order: str = Query("desc"),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all tenants/clients with filtering and pagination."""
    if not current_user.get("is_super_admin"):
        raise HTTPException(status_code=403, detail="Super admin access required")

    query = select(Tenant)

    if search:
        query = query.where(
            or_(
                Tenant.name.ilike(f"%{search}%"),
                Tenant.email.ilike(f"%{search}%"),
                Tenant.slug.ilike(f"%{search}%"),
                Tenant.phone.ilike(f"%{search}%"),
                Tenant.city.ilike(f"%{search}%"),
            )
        )
    if status:
        query = query.where(Tenant.status == status)
    if plan:
        query = query.where(Tenant.plan == plan)

    # Count
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar()

    # Sorting
    sort_col = getattr(Tenant, sort_by, Tenant.created_at)
    order_fn = desc if sort_order == "desc" else asc
    query = query.order_by(order_fn(sort_col))

    # Pagination
    query = query.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(query)
    tenants = result.scalars().all()

    items = []
    for t in tenants:
        # Get stats for each tenant
        lead_count = (await db.execute(
            select(func.count()).where(Lead.tenant_id == t.id, Lead.is_active == True)
        )).scalar() or 0
        call_count = (await db.execute(
            select(func.count()).where(Call.tenant_id == t.id)
        )).scalar() or 0

        items.append({
            "id": t.id,
            "name": t.name,
            "slug": t.slug,
            "email": t.email,
            "phone": t.phone,
            "city": t.city,
            "state": t.state,
            "plan": t.plan.value if hasattr(t.plan, "value") else t.plan,
            "status": t.status.value if hasattr(t.status, "value") else t.status,
            "is_verified": t.is_verified,
            "max_users": t.max_users,
            "max_leads": t.max_leads,
            "max_calls": t.max_calls,
            "lead_count": lead_count,
            "call_count": call_count,
            "trial_ends_at": t.trial_ends_at,
            "created_at": t.created_at,
        })

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size if total > 0 else 0,
    }


@router.get("/clients/{tenant_id}")
async def get_client_detail(
    tenant_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get detailed information about a specific tenant."""
    if not current_user.get("is_super_admin"):
        raise HTTPException(status_code=403, detail="Super admin access required")

    result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    # Gather statistics
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    lead_total = (await db.execute(
        select(func.count()).where(Lead.tenant_id == tenant_id, Lead.is_active == True)
    )).scalar() or 0
    lead_month = (await db.execute(
        select(func.count()).where(
            Lead.tenant_id == tenant_id, Lead.is_active == True,
            Lead.created_at >= month_start,
        )
    )).scalar() or 0

    call_total = (await db.execute(
        select(func.count()).where(Call.tenant_id == tenant_id)
    )).scalar() or 0
    call_month = (await db.execute(
        select(func.count()).where(
            Call.tenant_id == tenant_id,
            Call.created_at >= month_start,
        )
    )).scalar() or 0

    appt_total = (await db.execute(
        select(func.count()).where(Appointment.tenant_id == tenant_id)
    )).scalar() or 0
    conversions = (await db.execute(
        select(func.count()).where(
            Lead.tenant_id == tenant_id, Lead.status == LeadStatus.CONVERTED,
        )
    )).scalar() or 0

    user_count = (await db.execute(
        select(func.count()).where(User.tenant_id == tenant_id, User.is_active == True)
    )).scalar() or 0

    # Get users
    users_result = await db.execute(
        select(User).where(User.tenant_id == tenant_id, User.is_active == True)
    )
    users = users_result.scalars().all()

    return {
        "tenant": {
            "id": tenant.id,
            "name": tenant.name,
            "slug": tenant.slug,
            "email": tenant.email,
            "phone": tenant.phone,
            "website": tenant.website,
            "logo_url": tenant.logo_url,
            "business_type": tenant.business_type,
            "address": tenant.address,
            "city": tenant.city,
            "state": tenant.state,
            "country": tenant.country,
            "pincode": tenant.pincode,
            "gst_number": tenant.gst_number,
            "pan_number": tenant.pan_number,
            "plan": tenant.plan.value if hasattr(tenant.plan, "value") else tenant.plan,
            "status": tenant.status.value if hasattr(tenant.status, "value") else tenant.status,
            "timezone": tenant.timezone,
            "language": tenant.language,
            "is_verified": tenant.is_verified,
            "is_active": tenant.is_active,
            "trial_ends_at": tenant.trial_ends_at,
            "subscription_ends_at": tenant.subscription_ends_at,
            "created_at": tenant.created_at,
        },
        "stats": {
            "users": user_count,
            "leads_total": lead_total,
            "leads_this_month": lead_month,
            "calls_total": call_total,
            "calls_this_month": call_month,
            "appointments_total": appt_total,
            "conversions": conversions,
            "conversion_rate": round((conversions / lead_total * 100), 1) if lead_total > 0 else 0,
            "max_users": tenant.max_users,
            "max_leads": tenant.max_leads,
            "max_calls": tenant.max_calls,
        },
        "users": [
            {
                "id": u.id,
                "email": u.email,
                "first_name": u.first_name,
                "last_name": u.last_name,
                "role": u.role.value if hasattr(u.role, "value") else u.role,
                "status": u.status.value if hasattr(u.status, "value") else u.status,
                "is_tenant_admin": u.is_tenant_admin,
                "last_login_at": u.last_login_at,
                "created_at": u.created_at,
            }
            for u in users
        ],
    }


@router.patch("/clients/{tenant_id}/status")
async def update_tenant_status(
    tenant_id: str,
    body: dict,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update tenant status (activate, suspend, cancel)."""
    if not current_user.get("is_super_admin"):
        raise HTTPException(status_code=403, detail="Super admin access required")

    result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    valid_statuses = [s.value for s in TenantStatus]
    new_status = body.get("status")
    if new_status and new_status not in valid_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status. Must be one of: {', '.join(valid_statuses)}",
        )

    if new_status:
        tenant.status = TenantStatus(new_status)
        tenant.is_active = new_status in ("active", "trial")

    if "plan" in body:
        valid_plans = [p.value for p in TenantPlan]
        if body["plan"] not in valid_plans:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid plan. Must be one of: {', '.join(valid_plans)}",
            )
        tenant.plan = TenantPlan(body["plan"])

    if "max_users" in body:
        tenant.max_users = body["max_users"]
    if "max_leads" in body:
        tenant.max_leads = body["max_leads"]
    if "max_calls" in body:
        tenant.max_calls = body["max_calls"]
    if "notes" in body:
        tenant.business_description = body["notes"]

    await db.commit()
    return {
        "message": f"Tenant '{tenant.name}' updated",
        "status": tenant.status.value if hasattr(tenant.status, "value") else tenant.status,
        "plan": tenant.plan.value if hasattr(tenant.plan, "value") else tenant.plan,
    }


@router.post("/clients/{tenant_id}/reset-password")
async def reset_tenant_password(
    tenant_id: str,
    body: dict,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Reset a tenant admin's password. Returns the new temporary password."""
    if not current_user.get("is_super_admin"):
        raise HTTPException(status_code=403, detail="Super admin access required")

    # Find the tenant admin user
    result = await db.execute(
        select(User).where(
            User.tenant_id == tenant_id,
            User.is_tenant_admin == True,
            User.is_active == True,
        )
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="No admin user found for this tenant")

    import secrets
    temp_password = secrets.token_urlsafe(10) + "A1!"  # Meets complexity requirements
    user.hashed_password = get_password_hash(temp_password)
    user.password_changed_at = datetime.now(timezone.utc)
    await db.commit()

    return {
        "message": f"Password reset for {user.email}",
        "temporary_password": temp_password,
        "user_email": user.email,
    }


# ═══════════════════════════════════════════════════════════════════
# SYSTEM ANALYTICS
# ═══════════════════════════════════════════════════════════════════

@router.get("/analytics/dashboard")
async def get_admin_dashboard(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Platform-wide analytics for super admin dashboard."""
    if not current_user.get("is_super_admin"):
        raise HTTPException(status_code=403, detail="Super admin access required")

    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    month_start = today_start.replace(day=1)

    # Tenant counts
    total_tenants = (await db.execute(
        select(func.count()).select_from(select(Tenant).subquery())
    )).scalar() or 0
    active_tenants = (await db.execute(
        select(func.count()).where(Tenant.status.in_([TenantStatus.ACTIVE, TenantStatus.TRIAL]))
    )).scalar() or 0
    trial_tenants = (await db.execute(
        select(func.count()).where(Tenant.status == TenantStatus.TRIAL)
    )).scalar() or 0

    # Lead counts
    total_leads = (await db.execute(
        select(func.count()).where(Lead.is_active == True)
    )).scalar() or 0
    leads_today = (await db.execute(
        select(func.count()).where(Lead.created_at >= today_start)
    )).scalar() or 0
    leads_month = (await db.execute(
        select(func.count()).where(Lead.created_at >= month_start)
    )).scalar() or 0

    # Call counts
    total_calls = (await db.execute(
        select(func.count()).select_from(select(Call).subquery())
    )).scalar() or 0
    calls_today = (await db.execute(
        select(func.count()).where(Call.created_at >= today_start)
    )).scalar() or 0
    calls_month = (await db.execute(
        select(func.count()).where(Call.created_at >= month_start)
    )).scalar() or 0

    # Conversion metrics
    total_converted = (await db.execute(
        select(func.count()).where(Lead.status == LeadStatus.CONVERTED)
    )).scalar() or 0
    total_appts = (await db.execute(
        select(func.count()).select_from(select(Appointment).subquery())
    )).scalar() or 0

    # Revenue (from active subscriptions)
    revenue_result = await db.execute(
        select(func.coalesce(func.sum(Subscription.amount), 0)).where(
            Subscription.status.in_([SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL])
        )
    )
    mrr = float(revenue_result.scalar() or 0)

    # Territory stats
    territory_total = (await db.execute(
        select(func.count()).select_from(select(Territory).subquery())
    )).scalar() or 0
    territory_occupied = (await db.execute(
        select(func.count()).where(Territory.status == TerritoryStatus.OCCUPIED)
    )).scalar() or 0

    # Growth: tenants created this month
    new_tenants_month = (await db.execute(
        select(func.count()).where(Tenant.created_at >= month_start)
    )).scalar() or 0

    return {
        "tenants": {
            "total": total_tenants,
            "active": active_tenants,
            "trial": trial_tenants,
            "new_this_month": new_tenants_month,
        },
        "leads": {
            "total": total_leads,
            "today": leads_today,
            "this_month": leads_month,
            "converted": total_converted,
            "conversion_rate": round((total_converted / total_leads * 100), 1) if total_leads > 0 else 0,
        },
        "calls": {
            "total": total_calls,
            "today": calls_today,
            "this_month": calls_month,
        },
        "appointments": {
            "total": total_appts,
        },
        "revenue": {
            "mrr": round(mrr, 2),
            "arr": round(mrr * 12, 2),
        },
        "territories": {
            "total": territory_total,
            "occupied": territory_occupied,
            "available": territory_total - territory_occupied,
        },
    }


@router.get("/analytics/growth")
async def get_growth_metrics(
    days: int = Query(30, ge=7, le=365),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get daily growth metrics for charts (tenants, leads, calls)."""
    if not current_user.get("is_super_admin"):
        raise HTTPException(status_code=403, detail="Super admin access required")

    since = datetime.now(timezone.utc) - timedelta(days=days)

    # Daily tenant signups
    tenant_daily = await db.execute(
        select(
            func.date_trunc("day", Tenant.created_at).label("date"),
            func.count().label("count"),
        ).where(Tenant.created_at >= since)
        .group_by(func.date_trunc("day", Tenant.created_at))
        .order_by(func.date_trunc("day", Tenant.created_at))
    )

    # Daily leads
    lead_daily = await db.execute(
        select(
            func.date_trunc("day", Lead.created_at).label("date"),
            func.count().label("count"),
        ).where(Lead.created_at >= since)
        .group_by(func.date_trunc("day", Lead.created_at))
        .order_by(func.date_trunc("day", Lead.created_at))
    )

    # Daily calls
    call_daily = await db.execute(
        select(
            func.date_trunc("day", Call.created_at).label("date"),
            func.count().label("count"),
        ).where(Call.created_at >= since)
        .group_by(func.date_trunc("day", Call.created_at))
        .order_by(func.date_trunc("day", Call.created_at))
    )

    def rows_to_dict(rows):
        return {str(r.date): r.count for r in rows}

    return {
        "tenants": rows_to_dict(tenant_daily),
        "leads": rows_to_dict(lead_daily),
        "calls": rows_to_dict(call_daily),
        "period_days": days,
    }


# ═══════════════════════════════════════════════════════════════════
# TERRITORY MANAGEMENT (Admin)
# ═══════════════════════════════════════════════════════════════════

@router.post("/territories")
async def create_territory(
    body: dict,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new territory (super admin only)."""
    if not current_user.get("is_super_admin"):
        raise HTTPException(status_code=403, detail="Super admin access required")

    required = ["name", "city", "state", "price_monthly"]
    for field in required:
        if field not in body:
            raise HTTPException(status_code=400, detail=f"Missing required field: {field}")

    slug = generate_tenant_slug(body["name"])
    # Check for slug uniqueness
    existing = await db.execute(select(Territory).where(Territory.slug == slug))
    if existing.scalar_one_or_none():
        slug = f"{slug}-{int(time.time())}"

    territory = Territory(
        name=body["name"],
        slug=slug,
        description=body.get("description"),
        tier=body.get("tier", "tier_2"),
        city=body["city"],
        state=body["state"],
        country=body.get("country", "India"),
        pincodes=body.get("pincodes", []),
        price_monthly=body["price_monthly"],
        price_yearly=body.get("price_yearly"),
        setup_fee=body.get("setup_fee", 0),
        market_potential=body.get("market_potential"),
        status=TerritoryStatus.AVAILABLE,
    )
    db.add(territory)
    await db.commit()
    await db.refresh(territory)

    return {
        "message": f"Territory '{territory.name}' created",
        "id": territory.id,
        "slug": territory.slug,
    }


@router.patch("/territories/{territory_id}")
async def update_territory(
    territory_id: str,
    body: dict,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a territory."""
    if not current_user.get("is_super_admin"):
        raise HTTPException(status_code=403, detail="Super admin access required")

    result = await db.execute(select(Territory).where(Territory.id == territory_id))
    territory = result.scalar_one_or_none()
    if not territory:
        raise HTTPException(status_code=404, detail="Territory not found")

    updatable = ["name", "description", "tier", "city", "state", "country",
                 "pincodes", "price_monthly", "price_yearly", "setup_fee",
                 "market_potential", "status"]
    for field in updatable:
        if field in body:
            setattr(territory, field, body[field])

    await db.commit()
    return {"message": f"Territory '{territory.name}' updated"}


@router.post("/territories/{territory_id}/release")
async def release_territory(
    territory_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Force-release a territory from its current occupant."""
    if not current_user.get("is_super_admin"):
        raise HTTPException(status_code=403, detail="Super admin access required")

    result = await db.execute(
        select(Territory).where(Territory.id == territory_id)
        .options(selectinload(Territory.purchases))
    )
    territory = result.scalar_one_or_none()
    if not territory:
        raise HTTPException(status_code=404, detail="Territory not found")

    old_tenant_id = territory.tenant_id
    territory.tenant_id = None
    territory.status = TerritoryStatus.AVAILABLE
    territory.occupied_at = None

    # Mark active purchases as expired
    for purchase in territory.purchases:
        if purchase.status == "active":
            purchase.status = "expired"
            purchase.cancelled_at = datetime.now(timezone.utc)

    await db.commit()

    return {
        "message": f"Territory '{territory.name}' released",
        "previous_tenant_id": old_tenant_id,
    }


# ═══════════════════════════════════════════════════════════════════
# AUDIT LOGS
# ═══════════════════════════════════════════════════════════════════

@router.get("/audit-logs")
async def list_audit_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    action: Optional[str] = Query(None),
    resource_type: Optional[str] = Query(None),
    tenant_id: Optional[str] = Query(None),
    days: int = Query(7, ge=1, le=90),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Browse audit logs with filtering."""
    if not current_user.get("is_super_admin"):
        raise HTTPException(status_code=403, detail="Super admin access required")

    since = datetime.now(timezone.utc) - timedelta(days=days)
    query = select(AuditLog).where(AuditLog.created_at >= since)

    if action:
        query = query.where(AuditLog.action == action)
    if resource_type:
        query = query.where(AuditLog.resource_type == resource_type)
    if tenant_id:
        query = query.where(AuditLog.tenant_id == tenant_id)

    total = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar()
    query = query.order_by(desc(AuditLog.created_at))
    query = query.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(query)
    logs = result.scalars().all()

    return {
        "items": [
            {
                "id": log.id,
                "tenant_id": log.tenant_id,
                "user_id": log.user_id,
                "action": log.action,
                "resource_type": log.resource_type,
                "resource_id": log.resource_id,
                "changes": log.changes,
                "ip_address": log.ip_address,
                "status": log.status,
                "created_at": log.created_at,
            }
            for log in logs
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size if total > 0 else 0,
    }


@router.get("/audit-logs/summary")
async def get_audit_summary(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get summary of recent audit activity."""
    if not current_user.get("is_super_admin"):
        raise HTTPException(status_code=403, detail="Super admin access required")

    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    actions_result = await db.execute(
        select(AuditLog.action, func.count().label("count"))
        .where(AuditLog.created_at >= today_start)
        .group_by(AuditLog.action)
    )

    return {
        "today_total": sum(r.count for r in actions_result),
        "actions_by_type": {str(r.action): r.count for r in actions_result},
    }


# ═══════════════════════════════════════════════════════════════════
# SYSTEM HEALTH
# ═══════════════════════════════════════════════════════════════════

@router.get("/system/health")
async def get_system_health(
    current_user: dict = Depends(get_current_user),
):
    """Get system health summary (requires admin)."""
    if not current_user.get("is_super_admin") and not current_user.get("is_tenant_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")

    return {
        "status": "ok",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "version": "1.0.0",
    }


@router.get("/system/usage")
async def get_system_usage(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get platform-wide resource usage statistics."""
    if not current_user.get("is_super_admin"):
        raise HTTPException(status_code=403, detail="Super admin access required")

    total_users = (await db.execute(
        select(func.count()).select_from(select(User).subquery())
    )).scalar() or 0

    active_users_today = (await db.execute(
        select(func.count()).where(User.last_login_at >= datetime.now(timezone.utc) - timedelta(days=1))
    )).scalar() or 0

    return {
        "total_users": total_users,
        "active_users_today": active_users_today,
        "engagement_rate": round((active_users_today / total_users * 100), 1) if total_users > 0 else 0,
    }
