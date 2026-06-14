"""LeadFlow AI OS - Call & CallRecording Models"""

from sqlalchemy import Column, String, Boolean, DateTime, Integer, Text, JSON, ForeignKey, Float, Enum as SAEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
import enum
import uuid


class CallStatus(str, enum.Enum):
    QUEUED = "queued"
    RINGING = "ringing"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    BUSY = "busy"
    NO_ANSWER = "no_answer"
    CANCELLED = "cancelled"
    TIMEOUT = "timeout"


class CallDirection(str, enum.Enum):
    INBOUND = "inbound"
    OUTBOUND = "outbound"


class CallType(str, enum.Enum):
    AI = "ai"
    MANUAL = "manual"
    FOLLOW_UP = "follow_up"
    REMINDER = "reminder"
    CONFIRMATION = "confirmation"


class Call(Base):
    __tablename__ = "calls"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String(36), ForeignKey("tenants.id"), nullable=False, index=True)
    lead_id = Column(String(36), ForeignKey("leads.id"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    
    # Call Details
    call_sid = Column(String(255), unique=True, nullable=True)
    direction = Column(SAEnum(CallDirection), default=CallDirection.OUTBOUND, nullable=False)
    call_type = Column(SAEnum(CallType), default=CallType.AI, nullable=False)
    status = Column(SAEnum(CallStatus), default=CallStatus.QUEUED, nullable=False)
    
    # Phone Numbers
    from_number = Column(String(20), nullable=False)
    to_number = Column(String(20), nullable=False)
    
    # Duration
    duration_seconds = Column(Integer, default=0)
    ring_duration_seconds = Column(Integer, default=0)
    talk_time_seconds = Column(Integer, default=0)
    
    # AI Call Analysis
    ai_agent_used = Column(String(100), nullable=True)
    ai_summary = Column(Text, nullable=True)
    ai_transcript = Column(Text, nullable=True)
    ai_sentiment = Column(String(50), nullable=True)
    ai_sentiment_score = Column(Float, nullable=True)
    ai_keywords = Column(JSON, default=list)
    ai_entities = Column(JSON, default=dict)
    ai_intent = Column(String(100), nullable=True)
    ai_notes = Column(JSON, default=dict)
    
    # Call Metrics
    lead_score_after_call = Column(Integer, nullable=True)
    qualification_status = Column(String(50), nullable=True)
    appointment_booked = Column(Boolean, default=False)
    
    # Costs
    call_cost = Column(Float, default=0.0)
    ai_cost = Column(Float, default=0.0)
    total_cost = Column(Float, default=0.0)
    currency = Column(String(10), default="INR")
    
    # Errors
    error_code = Column(String(50), nullable=True)
    error_message = Column(Text, nullable=True)
    
    # Timestamps
    started_at = Column(DateTime(timezone=True), nullable=True)
    ended_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    tenant = relationship("Tenant", back_populates="calls")
    lead = relationship("Lead", back_populates="calls")
    user = relationship("User", back_populates="calls")
    recordings = relationship("CallRecording", back_populates="call", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Call {self.call_sid} - {self.status.value}>"


class CallRecording(Base):
    __tablename__ = "call_recordings"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String(36), ForeignKey("tenants.id"), nullable=False, index=True)
    call_id = Column(String(36), ForeignKey("calls.id"), nullable=False, index=True)
    
    # Recording Details
    recording_url = Column(String(500), nullable=False)
    recording_duration = Column(Integer, nullable=True)
    recording_format = Column(String(10), default="mp3")
    recording_size_bytes = Column(Integer, nullable=True)
    
    # S3 Storage
    s3_bucket = Column(String(255), nullable=True)
    s3_key = Column(String(500), nullable=True)
    s3_url = Column(String(500), nullable=True)
    
    # Transcript
    transcript_url = Column(String(500), nullable=True)
    transcript_text = Column(Text, nullable=True)
    transcript_status = Column(String(50), default="pending")
    
    # Processing
    is_processed = Column(Boolean, default=False)
    processing_status = Column(String(50), default="pending")
    processing_notes = Column(Text, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    call = relationship("Call", back_populates="recordings")
    tenant = relationship("Tenant", back_populates="call_recordings")
