"""LeadFlow AI OS - Appointment Model"""

from sqlalchemy import Column, String, Boolean, DateTime, Integer, Text, JSON, ForeignKey, Float, Enum as SAEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
import enum
import uuid


class AppointmentStatus(str, enum.Enum):
    SCHEDULED = "scheduled"
    CONFIRMED = "confirmed"
    REMINDED = "reminded"
    RESCHEDULED = "rescheduled"
    VISITED = "visited"
    NO_SHOW = "no_show"
    CANCELLED = "cancelled"
    COMPLETED = "completed"


class AppointmentType(str, enum.Enum):
    SITE_VISIT = "site_visit"
    OFFICE_MEETING = "office_meeting"
    VIDEO_CALL = "video_call"
    PHONE_CALL = "phone_call"
    DEMO = "demo"
    CONSULTATION = "consultation"
    FOLLOW_UP = "follow_up"


class Appointment(Base):
    __tablename__ = "appointments"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String(36), ForeignKey("tenants.id"), nullable=False, index=True)
    lead_id = Column(String(36), ForeignKey("leads.id"), nullable=False, index=True)
    created_by = Column(String(36), ForeignKey("users.id"), nullable=True)
    
    # Appointment Details
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    appointment_type = Column(SAEnum(AppointmentType), default=AppointmentType.SITE_VISIT, nullable=False)
    status = Column(SAEnum(AppointmentStatus), default=AppointmentStatus.SCHEDULED, nullable=False)
    
    # Schedule
    scheduled_date = Column(DateTime(timezone=True), nullable=False)
    scheduled_start_time = Column(DateTime(timezone=True), nullable=False)
    scheduled_end_time = Column(DateTime(timezone=True), nullable=False)
    duration_minutes = Column(Integer, default=30)
    timezone = Column(String(50), default="Asia/Kolkata")
    
    # Location
    location = Column(Text, nullable=True)
    location_url = Column(String(500), nullable=True)
    meeting_link = Column(String(500), nullable=True)
    address = Column(Text, nullable=True)
    city = Column(String(100), nullable=True)
    
    # Reminder Settings
    reminder_sent_24h = Column(Boolean, default=False)
    reminder_sent_2h = Column(Boolean, default=False)
    reminder_sent_30m = Column(Boolean, default=False)
    whatsapp_reminder_sent = Column(Boolean, default=False)
    call_reminder_made = Column(Boolean, default=False)
    
    # Outcome
    outcome = Column(Text, nullable=True)
    outcome_notes = Column(Text, nullable=True)
    follow_up_required = Column(Boolean, default=False)
    follow_up_date = Column(DateTime(timezone=True), nullable=True)
    
    # Reschedule
    rescheduled_count = Column(Integer, default=0)
    rescheduled_from = Column(DateTime(timezone=True), nullable=True)
    reschedule_reason = Column(Text, nullable=True)
    
    # Cancellation
    cancelled_at = Column(DateTime(timezone=True), nullable=True)
    cancelled_by = Column(String(36), nullable=True)
    cancellation_reason = Column(Text, nullable=True)
    
    # Metadata
    record_metadata = Column("metadata", JSON, default=dict)
    notes = Column(Text, nullable=True)
    
    # Timestamps
    confirmed_at = Column(DateTime(timezone=True), nullable=True)
    visited_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    # Relationships
    tenant = relationship("Tenant", back_populates="appointments")
    lead = relationship("Lead", back_populates="appointments")

    def __repr__(self):
        return f"<Appointment {self.title} - {self.status.value}>"
