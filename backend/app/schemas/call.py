"""LeadFlow AI OS - Call Schemas"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime


class CallCreate(BaseModel):
    lead_id: str
    phone: Optional[str] = None
    call_type: str = "ai"
    ai_agent: str = "default"
    notes: Optional[str] = None


class CallResponse(BaseModel):
    id: str
    tenant_id: str
    lead_id: str
    user_id: Optional[str] = None
    call_sid: Optional[str] = None
    direction: str
    call_type: str
    status: str
    from_number: str
    to_number: str
    duration_seconds: int
    talk_time_seconds: int
    ai_summary: Optional[str] = None
    ai_sentiment: Optional[str] = None
    ai_sentiment_score: Optional[float] = None
    lead_score_after_call: Optional[int] = None
    appointment_booked: bool
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    created_at: datetime
    lead: Optional[Dict[str, Any]] = None

    class Config:
        from_attributes = True


class CallListResponse(BaseModel):
    items: List[CallResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class CallAnalytics(BaseModel):
    total_calls: int
    answered_calls: int
    missed_calls: int
    avg_duration: float
    avg_talk_time: float
    appointment_booking_rate: float
    total_cost: float


class InitiateCallRequest(BaseModel):
    lead_id: str
    phone_number: Optional[str] = None
    ai_agent: str = "default"
    script_variables: Dict[str, Any] = {}


class CallRecordingResponse(BaseModel):
    id: str
    call_id: str
    recording_url: str
    recording_duration: Optional[int] = None
    recording_format: str
    transcript_text: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
