"""LeadFlow AI OS - Lead Schemas"""

from pydantic import BaseModel, Field, validator
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


class LeadCreate(BaseModel):
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: Optional[str] = None
    email: Optional[str] = None
    phone: str = Field(..., min_length=10, max_length=20)
    alternate_phone: Optional[str] = None
    source: str = "manual"
    source_url: Optional[str] = None
    source_reference_id: Optional[str] = None
    requirement: Optional[str] = None
    budget_min: Optional[float] = None
    budget_max: Optional[float] = None
    location: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    timeline: Optional[str] = None
    company_name: Optional[str] = None
    designation: Optional[str] = None
    website: Optional[str] = None
    tags: List[str] = []
    custom_fields: Dict[str, Any] = {}
    notes: Optional[str] = None
    consent_given: bool = False
    preferred_contact_time: Optional[str] = None
    preferred_contact_method: Optional[str] = None


class LeadUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    alternate_phone: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    requirement: Optional[str] = None
    budget_min: Optional[float] = None
    budget_max: Optional[float] = None
    location: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    timeline: Optional[str] = None
    company_name: Optional[str] = None
    assigned_to: Optional[str] = None
    tags: Optional[List[str]] = None
    custom_fields: Optional[Dict[str, Any]] = None
    notes: Optional[str] = None


class LeadResponse(BaseModel):
    id: str
    tenant_id: str
    first_name: str
    last_name: Optional[str] = None
    full_name: str
    email: Optional[str] = None
    phone: str
    alternate_phone: Optional[str] = None
    source: str
    status: str
    priority: str
    requirement: Optional[str] = None
    budget_min: Optional[float] = None
    budget_max: Optional[float] = None
    location: Optional[str] = None
    city: Optional[str] = None
    company_name: Optional[str] = None
    lead_score: int
    ai_sentiment: Optional[str] = None
    ai_summary: Optional[str] = None
    tags: List[str]
    assigned_to: Optional[str] = None
    created_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class LeadListResponse(BaseModel):
    items: List[LeadResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class LeadActivityResponse(BaseModel):
    id: str
    lead_id: str
    activity_type: str
    description: Optional[str] = None
    metadata: Dict[str, Any]
    created_at: datetime

    class Config:
        from_attributes = True


class LeadScoreUpdate(BaseModel):
    lead_score: int = Field(..., ge=0, le=100)
    reason: Optional[str] = None


class LeadAssignRequest(BaseModel):
    user_id: str


class LeadBulkAction(BaseModel):
    lead_ids: List[str]
    action: str  # assign, change_status, add_tag, delete
    value: Optional[str] = None


class LeadFilterParams(BaseModel):
    search: Optional[str] = None
    status: Optional[str] = None
    source: Optional[str] = None
    priority: Optional[str] = None
    assigned_to: Optional[str] = None
    city: Optional[str] = None
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None
    min_score: Optional[int] = None
    max_score: Optional[int] = None
    tags: Optional[List[str]] = None
    page: int = 1
    page_size: int = 20
    sort_by: str = "created_at"
    sort_order: str = "desc"
