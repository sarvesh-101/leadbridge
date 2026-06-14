"""LeadFlow AI OS - Message & WhatsAppLog Models"""

from sqlalchemy import Column, String, Boolean, DateTime, Integer, Text, JSON, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
import enum
import uuid


class MessageType(str, enum.Enum):
    WHATSAPP = "whatsapp"
    SMS = "sms"
    EMAIL = "email"
    IN_APP = "in_app"


class MessageDirection(str, enum.Enum):
    OUTBOUND = "outbound"
    INBOUND = "inbound"


class MessageStatus(str, enum.Enum):
    QUEUED = "queued"
    SENT = "sent"
    DELIVERED = "delivered"
    READ = "read"
    FAILED = "failed"
    REJECTED = "rejected"


class WhatsAppTemplate(str, enum.Enum):
    APPOINTMENT_CONFIRMATION = "appointment_confirmation"
    APPOINTMENT_REMINDER = "appointment_reminder"
    FOLLOW_UP = "follow_up"
    LEAD_THANK_YOU = "lead_thank_you"
    NO_SHOW_ALERT = "no_show_alert"
    CUSTOM = "custom"


class Message(Base):
    __tablename__ = "messages"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String(36), ForeignKey("tenants.id"), nullable=False, index=True)
    lead_id = Column(String(36), ForeignKey("leads.id"), nullable=False, index=True)
    
    # Message Details
    message_type = Column(SAEnum(MessageType), default=MessageType.WHATSAPP, nullable=False)
    direction = Column(SAEnum(MessageDirection), default=MessageDirection.OUTBOUND, nullable=False)
    status = Column(SAEnum(MessageStatus), default=MessageStatus.QUEUED, nullable=False)
    
    # Content
    subject = Column(String(500), nullable=True)
    body = Column(Text, nullable=False)
    template_name = Column(String(100), nullable=True)
    template_variables = Column(JSON, default=dict)
    
    # Media
    media_url = Column(String(500), nullable=True)
    media_type = Column(String(50), nullable=True)
    
    # Provider Info
    provider_message_id = Column(String(255), unique=True, nullable=True)
    provider_response = Column(JSON, default=dict)
    
    # Recipient
    recipient_phone = Column(String(20), nullable=True)
    recipient_email = Column(String(255), nullable=True)
    
    # Metadata
    record_metadata = Column("metadata", JSON, default=dict)
    error_log = Column(Text, nullable=True)
    
    # Timestamps
    sent_at = Column(DateTime(timezone=True), nullable=True)
    delivered_at = Column(DateTime(timezone=True), nullable=True)
    read_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    tenant = relationship("Tenant", back_populates="messages")
    lead = relationship("Lead", back_populates="messages")


class WhatsAppLog(Base):
    __tablename__ = "whatsapp_logs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String(36), ForeignKey("tenants.id"), nullable=False, index=True)
    message_id = Column(String(36), ForeignKey("messages.id"), nullable=True)
    
    # WhatsApp Cloud API Fields
    wa_phone_number_id = Column(String(100), nullable=True)
    wa_message_id = Column(String(255), nullable=True, index=True)
    wa_status = Column(String(50), nullable=True)
    wa_error_code = Column(String(50), nullable=True)
    wa_error_message = Column(Text, nullable=True)
    
    # Webhook Data
    webhook_payload = Column(JSON, default=dict)
    webhook_received_at = Column(DateTime(timezone=True), nullable=True)
    
    # Conversation
    conversation_id = Column(String(255), nullable=True)
    pricing_model = Column(String(50), nullable=True)
    charge_amount = Column(Integer, nullable=True)
    charge_currency = Column(String(10), default="INR")
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    tenant = relationship("Tenant", back_populates="whatsapp_logs")
