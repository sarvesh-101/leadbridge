"""LeadFlow AI OS - Appointment Schemas"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime


class AppointmentCreate(BaseModel):
    lead_id: str
    title: str
    description: Optional[str] = None
    appointment_type: str = "site_visit"
    scheduled_date: datetime
    scheduled_start_time: datetime
    scheduled_end_time: Optional[datetime] = None
    duration_minutes: int = 30
    location: Optional[str] = None
    location_url: Optional[str] = None
    meeting_link: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    notes: Optional[str] = None


class AppointmentUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    appointment_type: Optional[str] = None
    status: Optional[str] = None
    scheduled_start_time: Optional[datetime] = None
    scheduled_end_time: Optional[datetime] = None
    duration_minutes: Optional[int] = None
    location: Optional[str] = None
    location_url: Optional[str] = None
    meeting_link: Optional[str] = None
    address: Optional[str] = None
    notes: Optional[str] = None
    outcome: Optional[str] = None
    outcome_notes: Optional[str] = None


class AppointmentResponse(BaseModel):
    id: str
    tenant_id: str
    lead_id: str
    title: str
    description: Optional[str] = None
    appointment_type: str
    status: str
    scheduled_date: datetime
    scheduled_start_time: datetime
    scheduled_end_time: Optional[datetime] = None
    duration_minutes: int
    location: Optional[str] = None
    meeting_link: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    reminder_sent_24h: bool
    follow_up_required: bool
    outcome: Optional[str] = None
    outcome_notes: Optional[str] = None
    rescheduled_count: int
    created_at: datetime
    lead: Optional[Dict[str, Any]] = None

    class Config:
        from_attributes = True


class AppointmentListResponse(BaseModel):
    items: List[AppointmentResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class AppointmentRescheduleRequest(BaseModel):
    new_start_time: datetime
    new_end_time: Optional[datetime] = None
    reason: Optional[str] = None


class AppointmentConfirmRequest(BaseModel):
    status: str  # visited, no_show, cancelled
    notes: Optional[str] = None
    outcome: Optional[str] = None


class AppointmentAnalytics(BaseModel):
    total_appointments: int
    scheduled: int
    confirmed: int
    visited: int
    no_shows: int
    cancelled: int
    rescheduled: int
    visit_rate: float
    no_show_rate: float
