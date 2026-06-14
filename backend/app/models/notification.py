"""LeadFlow AI OS - Notification Model"""

from sqlalchemy import Column, String, Boolean, DateTime, Integer, Text, JSON, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
import enum
import uuid


class NotificationType(str, enum.Enum):
    LEAD_CREATED = "lead_created"
    LEAD_ASSIGNED = "lead_assigned"
    LEAD_UPDATED = "lead_updated"
    CALL_COMPLETED = "call_completed"
    APPOINTMENT_BOOKED = "appointment_booked"
    APPOINTMENT_REMINDER = "appointment_reminder"
    APPOINTMENT_NO_SHOW = "appointment_no_show"
    APPOINTMENT_VISITED = "appointment_visited"
    FOLLOW_UP_REQUIRED = "follow_up_required"
    CAMPAIGN_COMPLETED = "campaign_completed"
    SUBSCRIPTION_EXPIRING = "subscription_expiring"
    PAYMENT_SUCCESS = "payment_success"
    PAYMENT_FAILED = "payment_failed"
    TERRITORY_EXPIRING = "territory_expiring"
    SYSTEM_ALERT = "system_alert"
    INTEGRATION_ERROR = "integration_error"
    WELCOME = "welcome"
    CUSTOM = "custom"


class NotificationPriority(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String(36), ForeignKey("tenants.id"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=True, index=True)
    related_resource_id = Column(String(36), nullable=True)
    related_resource_type = Column(String(100), nullable=True)
    
    # Notification Details
    type = Column(SAEnum(NotificationType), nullable=False)
    priority = Column(SAEnum(NotificationPriority), default=NotificationPriority.MEDIUM, nullable=False)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    
    # Read Status
    is_read = Column(Boolean, default=False, nullable=False)
    read_at = Column(DateTime(timezone=True), nullable=True)
    
    # Delivery
    is_email_sent = Column(Boolean, default=False)
    is_whatsapp_sent = Column(Boolean, default=False)
    is_push_sent = Column(Boolean, default=False)
    email_sent_at = Column(DateTime(timezone=True), nullable=True)
    whatsapp_sent_at = Column(DateTime(timezone=True), nullable=True)
    push_sent_at = Column(DateTime(timezone=True), nullable=True)
    
    # Action
    action_url = Column(String(500), nullable=True)
    action_label = Column(String(100), nullable=True)
    
    # Metadata
    record_metadata = Column("metadata", JSON, default=dict)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    tenant = relationship("Tenant", back_populates="notifications")
