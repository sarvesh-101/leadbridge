"""LeadFlow AI OS - Territory Schemas"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime


class TerritoryCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    tier: str = "tier_2"
    city: str
    state: str
    country: str = "India"
    region: Optional[str] = None
    pincodes: List[str] = []
    price_monthly: float
    price_yearly: Optional[float] = None
    setup_fee: float = 0.0
    market_potential: Optional[str] = None


class TerritoryUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    tier: Optional[str] = None
    status: Optional[str] = None
    price_monthly: Optional[float] = None
    price_yearly: Optional[float] = None
    setup_fee: Optional[float] = None
    pincodes: Optional[List[str]] = None


class TerritoryResponse(BaseModel):
    id: str
    name: str
    slug: str
    description: Optional[str] = None
    tier: str
    status: str
    city: str
    state: str
    country: str
    pincodes: List[str]
    price_monthly: float
    price_yearly: Optional[float] = None
    setup_fee: float
    currency: str
    is_available: bool
    occupant_name: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class TerritoryPurchaseRequest(BaseModel):
    territory_id: str
    purchase_type: str = "monthly"
    auto_renew: bool = True


class TerritoryPurchaseResponse(BaseModel):
    id: str
    territory_id: str
    territory_name: str
    purchase_type: str
    amount_paid: float
    start_date: datetime
    end_date: datetime
    status: str
    auto_renew: bool

    class Config:
        from_attributes = True


class TerritoryAnalytics(BaseModel):
    total_territories: int
    available: int
    occupied: int
    reserved: int
    waitlist: int
    monthly_revenue: float
    total_revenue: float
