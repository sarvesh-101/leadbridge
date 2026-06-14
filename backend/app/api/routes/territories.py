"""LeadFlow AI OS - Territory Exclusivity API Routes"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, or_
from typing import Optional, List
from datetime import datetime, timezone, timedelta

from app.core.database import get_db
from app.models.territory import Territory, TerritoryStatus, TerritoryPurchase
from app.models.tenant import Tenant
from app.schemas.territory import (
    TerritoryCreate, TerritoryUpdate, TerritoryResponse,
    TerritoryPurchaseRequest, TerritoryPurchaseResponse,
    TerritoryAnalytics,
)
from app.middleware.auth import get_current_user

router = APIRouter(prefix="/territories", tags=["Territories"])


@router.get("/", response_model=List[TerritoryResponse])
async def list_territories(
    status: Optional[str] = Query(None),
    city: Optional[str] = Query(None),
    state: Optional[str] = Query(None),
    tier: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List territories with filtering."""
    query = select(Territory).where(Territory.is_active == True)

    if status:
        query = query.where(Territory.status == status)
    if city:
        query = query.where(Territory.city.ilike(f"%{city}%"))
    if state:
        query = query.where(Territory.state.ilike(f"%{state}%"))
    if tier:
        query = query.where(Territory.tier == tier)
    if search:
        query = query.where(
            or_(
                Territory.name.ilike(f"%{search}%"),
                Territory.city.ilike(f"%{search}%"),
                Territory.description.ilike(f"%{search}%"),
            )
        )

    query = query.order_by(Territory.name)
    result = await db.execute(query)
    territories = result.scalars().all()

    items = []
    for t in territories:
        occupant_name = None
        if t.tenant_id and t.status == TerritoryStatus.OCCUPIED:
            tenant_result = await db.execute(select(Tenant).where(Tenant.id == t.tenant_id))
            tenant = tenant_result.scalar_one_or_none()
            occupant_name = tenant.name if tenant else None

        items.append(TerritoryResponse(
            id=t.id, name=t.name, slug=t.slug,
            description=t.description, tier=t.tier.value if hasattr(t.tier, 'value') else t.tier,
            status=t.status.value if hasattr(t.status, 'value') else t.status,
            city=t.city, state=t.state, country=t.country,
            pincodes=t.pincodes, price_monthly=t.price_monthly,
            price_yearly=t.price_yearly, setup_fee=t.setup_fee,
            currency=t.currency, is_available=t.status == TerritoryStatus.AVAILABLE,
            occupant_name=occupant_name, created_at=t.created_at,
        ))
    return items


@router.get("/available", response_model=List[TerritoryResponse])
async def list_available_territories(current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """List only available territories for purchase."""
    query = select(Territory).where(
        Territory.is_active == True,
        Territory.status == TerritoryStatus.AVAILABLE,
    ).order_by(Territory.price_monthly)
    result = await db.execute(query)
    territories = result.scalars().all()

    return [TerritoryResponse(
        id=t.id, name=t.name, slug=t.slug,
        description=t.description, tier=t.tier.value if hasattr(t.tier, 'value') else t.tier,
        status=t.status.value if hasattr(t.status, 'value') else t.status,
        city=t.city, state=t.state, country=t.country,
        pincodes=t.pincodes, price_monthly=t.price_monthly,
        price_yearly=t.price_yearly, setup_fee=t.setup_fee,
        currency=t.currency, is_available=True, occupant_name=None,
        created_at=t.created_at,
    ) for t in territories]


@router.get("/my")
async def get_my_territories(current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Get territories owned by the current tenant."""
    tenant_id = current_user["tenant_id"]
    result = await db.execute(
        select(TerritoryPurchase).where(TerritoryPurchase.tenant_id == tenant_id)
        .order_by(desc(TerritoryPurchase.created_at))
    )
    purchases = result.scalars().all()
    return [TerritoryPurchaseResponse.model_validate(p) for p in purchases]


@router.post("/purchase")
async def purchase_territory(
    data: TerritoryPurchaseRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Purchase or reserve a territory."""
    tenant_id = current_user["tenant_id"]

    result = await db.execute(select(Territory).where(Territory.id == data.territory_id))
    territory = result.scalar_one_or_none()
    if not territory:
        raise HTTPException(status_code=404, detail="Territory not found")

    if territory.status == TerritoryStatus.OCCUPIED:
        # Add to waitlist
        purchase = TerritoryPurchase(
            tenant_id=tenant_id,
            territory_id=data.territory_id,
            purchase_type=data.purchase_type,
            amount_paid=0,
            start_date=datetime.now(timezone.utc),
            end_date=datetime.now(timezone.utc),
            status="waitlisted",
            is_waitlisted=True,
            auto_renew=data.auto_renew,
        )
        db.add(purchase)
        await db.commit()
        return {"message": "Added to waitlist", "status": "waitlisted"}

    if territory.status != TerritoryStatus.AVAILABLE:
        raise HTTPException(status_code=400, detail="Territory is not available")

    amount = territory.price_monthly if data.purchase_type == "monthly" else (territory.price_yearly or territory.price_monthly * 12)
    end_date = datetime.now(timezone.utc) + timedelta(days=30 if data.purchase_type == "monthly" else 365)

    purchase = TerritoryPurchase(
        tenant_id=tenant_id,
        territory_id=data.territory_id,
        purchase_type=data.purchase_type,
        amount_paid=amount,
        start_date=datetime.now(timezone.utc),
        end_date=end_date,
        auto_renew=data.auto_renew,
        status="active",
    )
    territory.tenant_id = tenant_id
    territory.status = TerritoryStatus.OCCUPIED
    territory.occupied_at = datetime.now(timezone.utc)

    db.add(purchase)
    await db.commit()
    return {"message": f"Territory '{territory.name}' purchased", "status": "occupied"}


@router.get("/analytics", response_model=TerritoryAnalytics)
async def get_territory_analytics(current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Get territory analytics for super admin."""
    base = select(Territory)
    total = (await db.execute(select(func.count()).select_from(base.subquery()))).scalar()
    
    statuses = {}
    for s in TerritoryStatus:
        cnt = (await db.execute(
            select(func.count()).select_from(base.where(Territory.status == s).subquery())
        )).scalar()
        statuses[s.value] = cnt

    return TerritoryAnalytics(
        total_territories=total,
        available=statuses.get("available", 0),
        occupied=statuses.get("occupied", 0),
        reserved=statuses.get("reserved", 0),
        waitlist=statuses.get("waitlist", 0),
        monthly_revenue=0.0,
        total_revenue=0.0,
    )
