"""LeadFlow AI OS - Subscription Schemas"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime


class SubscriptionResponse(BaseModel):
    id: str
    tenant_id: str
    plan_name: str
    plan_tier: str
    billing_cycle: str
    status: str
    amount: float
    currency: str
    total_amount: float
    start_date: datetime
    end_date: datetime
    trial_end_date: Optional[datetime] = None
    auto_renew: bool
    features: Dict[str, Any]
    limits: Dict[str, Any]
    created_at: datetime

    class Config:
        from_attributes = True


class InvoiceResponse(BaseModel):
    id: str
    tenant_id: str
    invoice_number: str
    status: str
    description: Optional[str] = None
    amount: float
    total_amount: float
    currency: str
    issue_date: datetime
    due_date: datetime
    paid_at: Optional[datetime] = None
    invoice_url: Optional[str] = None

    class Config:
        from_attributes = True


class PaymentResponse(BaseModel):
    id: str
    tenant_id: str
    invoice_id: Optional[str] = None
    amount: float
    currency: str
    status: str
    payment_method: Optional[str] = None
    transaction_id: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class CreateSubscriptionRequest(BaseModel):
    plan_tier: str
    billing_cycle: str = "monthly"


class SubscriptionAnalytics(BaseModel):
    total_subscriptions: int
    active_subscriptions: int
    trial_subscriptions: int
    cancelled_subscriptions: int
    monthly_recurring_revenue: float
    annual_recurring_revenue: float
    churn_rate: float
    average_revenue_per_user: float
