"""LeadFlow AI OS - Subscriptions API Routes"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from typing import Optional, List
from datetime import datetime, timezone, timedelta

from app.core.database import get_db
from app.models.subscription import Subscription, SubscriptionStatus, Invoice, InvoiceStatus, Payment, PaymentStatus
from app.models.tenant import Tenant, TenantPlan, TenantStatus
from app.schemas.subscription import (
    SubscriptionResponse, InvoiceResponse, PaymentResponse,
    CreateSubscriptionRequest, SubscriptionAnalytics,
)
from app.middleware.auth import get_current_user

router = APIRouter(prefix="/subscriptions", tags=["Subscriptions"])


@router.get("/current", response_model=SubscriptionResponse)
async def get_current_subscription(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get current active subscription for the tenant."""
    tenant_id = current_user["tenant_id"]
    result = await db.execute(
        select(Subscription).where(
            Subscription.tenant_id == tenant_id,
            Subscription.status.in_([SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL]),
        ).order_by(desc(Subscription.created_at))
    )
    sub = result.scalar_one_or_none()
    if not sub:
        raise HTTPException(status_code=404, detail="No active subscription found")
    return SubscriptionResponse.model_validate(sub)


@router.post("/create", response_model=SubscriptionResponse)
async def create_subscription(
    data: CreateSubscriptionRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new subscription."""
    tenant_id = current_user["tenant_id"]

    plans = {
        "starter": {"name": "Starter", "monthly": 2999, "yearly": 29990, "users": 5, "leads": 1000, "calls": 500},
        "professional": {"name": "Professional", "monthly": 6999, "yearly": 69990, "users": 15, "leads": 5000, "calls": 2000},
        "enterprise": {"name": "Enterprise", "monthly": 14999, "yearly": 149990, "users": 50, "leads": 50000, "calls": 10000},
    }

    plan = plans.get(data.plan_tier)
    if not plan:
        raise HTTPException(status_code=400, detail="Invalid plan tier")

    amount = plan["monthly"] if data.billing_cycle == "monthly" else plan["yearly"]
    end_date = datetime.now(timezone.utc) + timedelta(days=30 if data.billing_cycle == "monthly" else 365)

    sub = Subscription(
        tenant_id=tenant_id,
        plan_name=plan["name"],
        plan_tier=data.plan_tier,
        billing_cycle=data.billing_cycle,
        status=SubscriptionStatus.ACTIVE,
        amount=amount,
        total_amount=amount,
        start_date=datetime.now(timezone.utc),
        end_date=end_date,
        auto_renew=True,
        features={"max_users": plan["users"], "max_leads": plan["leads"], "max_calls": plan["calls"]},
        limits={"users": plan["users"], "leads": plan["leads"], "calls": plan["calls"]},
    )
    db.add(sub)

    # Update tenant
    tenant_result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = tenant_result.scalar_one_or_none()
    if tenant:
        tenant.plan = data.plan_tier
        tenant.max_users = plan["users"]
        tenant.max_leads = plan["leads"]
        tenant.max_calls = plan["calls"]
        tenant.subscription_started_at = datetime.now(timezone.utc)
        tenant.subscription_ends_at = end_date

    await db.commit()
    await db.refresh(sub)
    return SubscriptionResponse.model_validate(sub)


@router.get("/invoices", response_model=List[InvoiceResponse])
async def list_invoices(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List invoices for the tenant."""
    tenant_id = current_user["tenant_id"]
    result = await db.execute(
        select(Invoice).where(Invoice.tenant_id == tenant_id)
        .order_by(desc(Invoice.issue_date))
    )
    return [InvoiceResponse.model_validate(i) for i in result.scalars().all()]


@router.get("/invoices/{invoice_id}", response_model=InvoiceResponse)
async def get_invoice(invoice_id: str, current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    tenant_id = current_user["tenant_id"]
    result = await db.execute(select(Invoice).where(Invoice.id == invoice_id, Invoice.tenant_id == tenant_id))
    invoice = result.scalar_one_or_none()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return InvoiceResponse.model_validate(invoice)


@router.post("/cancel")
async def cancel_subscription(current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Cancel the current subscription."""
    tenant_id = current_user["tenant_id"]
    result = await db.execute(
        select(Subscription).where(
            Subscription.tenant_id == tenant_id,
            Subscription.status == SubscriptionStatus.ACTIVE,
        )
    )
    sub = result.scalar_one_or_none()
    if not sub:
        raise HTTPException(status_code=404, detail="No active subscription found")
    sub.status = SubscriptionStatus.CANCELLED
    sub.cancelled_at = datetime.now(timezone.utc)
    await db.commit()
    return {"message": "Subscription cancelled"}


@router.get("/analytics", response_model=SubscriptionAnalytics)
async def get_subscription_analytics(current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Get subscription analytics (super admin)."""
    base = select(Subscription)
    total = (await db.execute(select(func.count()).select_from(base.subquery()))).scalar()
    active = (await db.execute(
        select(func.count()).select_from(base.where(Subscription.status == SubscriptionStatus.ACTIVE).subquery())
    )).scalar()

    return SubscriptionAnalytics(
        total_subscriptions=total,
        active_subscriptions=active,
        trial_subscriptions=0,
        cancelled_subscriptions=0,
        monthly_recurring_revenue=0.0,
        annual_recurring_revenue=0.0,
        churn_rate=0.0,
        average_revenue_per_user=0.0,
    )
