"""LeadFlow AI OS - Integration & Webhook Models"""

from sqlalchemy import Column, String, Boolean, DateTime, Integer, Text, JSON, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
import enum
import uuid


class IntegrationProvider(str, enum.Enum):
    INDIAMART = "indiamart"
    JUSTDIAL = "justdial"
    MAGICBRICKS = "magicbricks"
    HOUSING = "housing"
    NINETY_ACRES = "99acres"
    FACEBOOK = "facebook"
    GOOGLE = "google"
    ZOHO = "zoho"
    SALESFORCE = "salesforce"
    HUBSPOT = "hubspot"
    ZAPIER = "zapier"
    MAKE = "make"
    CUSTOM = "custom"


class IntegrationStatus(str, enum.Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    ERROR = "error"
    DISCONNECTED = "disconnected"


class WebhookEvent(str, enum.Enum):
    LEAD_CREATED = "lead.created"
    LEAD_UPDATED = "lead.updated"
    LEAD_DELETED = "lead.deleted"
    CALL_COMPLETED = "call.completed"
    APPOINTMENT_CREATED = "appointment.created"
    APPOINTMENT_UPDATED = "appointment.updated"
    APPOINTMENT_NO_SHOW = "appointment.no_show"
    APPOINTMENT_VISITED = "appointment.visited"
    MESSAGE_SENT = "message.sent"
    CAMPAIGN_COMPLETED = "campaign.completed"


class Integration(Base):
    __tablename__ = "integrations"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String(36), ForeignKey("tenants.id"), nullable=False, index=True)
    
    # Integration Details
    provider = Column(SAEnum(IntegrationProvider), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(SAEnum(IntegrationStatus), default=IntegrationStatus.INACTIVE, nullable=False)
    
    # Credentials (encrypted)
    credentials = Column(JSON, default=dict)
    api_key = Column(String(500), nullable=True)
    api_secret = Column(String(500), nullable=True)
    webhook_url = Column(String(500), nullable=True)
    
    # Settings
    settings = Column(JSON, default=dict)
    sync_frequency = Column(String(50), default="realtime")  # realtime, hourly, daily, manual
    last_sync_at = Column(DateTime(timezone=True), nullable=True)
    next_sync_at = Column(DateTime(timezone=True), nullable=True)
    
    # Metrics
    total_synced = Column(Integer, default=0)
    total_errors = Column(Integer, default=0)
    last_error_message = Column(Text, nullable=True)
    last_error_at = Column(DateTime(timezone=True), nullable=True)
    
    # Metadata
    record_metadata = Column("metadata", JSON, default=dict)
    is_active = Column(Boolean, default=True, nullable=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    tenant = relationship("Tenant", back_populates="integrations")


class Webhook(Base):
    __tablename__ = "webhooks"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String(36), ForeignKey("tenants.id"), nullable=False, index=True)
    
    # Webhook Details
    name = Column(String(255), nullable=False)
    url = Column(String(500), nullable=False)
    secret = Column(String(255), nullable=True)
    events = Column(JSON, default=list)
    
    # Settings
    is_active = Column(Boolean, default=True, nullable=False)
    retry_count = Column(Integer, default=3)
    timeout_seconds = Column(Integer, default=10)
    
    # Headers
    headers = Column(JSON, default=dict)
    
    # Metrics
    total_sent = Column(Integer, default=0)
    total_success = Column(Integer, default=0)
    total_failed = Column(Integer, default=0)
    last_sent_at = Column(DateTime(timezone=True), nullable=True)
    last_response_code = Column(Integer, nullable=True)
    last_error = Column(Text, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    tenant = relationship("Tenant", back_populates="webhooks")
