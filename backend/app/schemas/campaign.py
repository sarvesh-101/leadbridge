"""LeadFlow AI OS - Campaign Schemas"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


class CampaignCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    campaign_type: str = "custom"
    target_lead_sources: List[str] = []
    target_lead_statuses: List[str] = []
    target_locations: List[str] = []
    target_tags: List[str] = []
    target_min_score: int = 0
    target_max_score: int = 100
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    working_hours_start: str = "09:00"
    working_hours_end: str = "18:00"
    working_days: List[int] = [1, 2, 3, 4, 5, 6]


class CampaignUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    campaign_type: Optional[str] = None
    status: Optional[str] = None
    target_lead_sources: Optional[List[str]] = None
    target_lead_statuses: Optional[List[str]] = None
    target_locations: Optional[List[str]] = None
    target_tags: Optional[List[str]] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    working_hours_start: Optional[str] = None
    working_hours_end: Optional[str] = None
    working_days: Optional[List[int]] = None


class CampaignResponse(BaseModel):
    id: str
    tenant_id: str
    name: str
    description: Optional[str] = None
    campaign_type: str
    status: str
    leads_processed: int
    calls_made: int
    messages_sent: int
    appointments_booked: int
    conversions: int
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    created_at: datetime
    tasks: Optional[List[Dict[str, Any]]] = None

    class Config:
        from_attributes = True


class CampaignTaskCreate(BaseModel):
    name: str
    action: str
    order: int
    config: Dict[str, Any] = {}
    delay_after_previous_hours: int = 0
    delay_after_previous_minutes: int = 0
    is_condition: bool = False
    condition_field: Optional[str] = None
    condition_operator: Optional[str] = None
    condition_value: Optional[str] = None


class CampaignTaskResponse(BaseModel):
    id: str
    campaign_id: str
    name: str
    action: str
    order: int
    config: Dict[str, Any]
    is_condition: bool
    created_at: datetime

    class Config:
        from_attributes = True


class CampaignAnalytics(BaseModel):
    total_campaigns: int
    active_campaigns: int
    draft_campaigns: int
    completed_campaigns: int
    total_leads_targeted: int
    total_leads_processed: int
    total_calls_made: int
    total_messages_sent: int
    total_appointments: int
    total_conversions: int
    conversion_rate: float
