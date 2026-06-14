"""LeadFlow AI OS - Campaign & CampaignTask Models"""

from sqlalchemy import Column, String, Boolean, DateTime, Integer, Text, JSON, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
import enum
import uuid


class CampaignStatus(str, enum.Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    PAUSED = "paused"
    COMPLETED = "completed"
    ARCHIVED = "archived"


class CampaignType(str, enum.Enum):
    FOLLOW_UP = "follow_up"
    RE_ENGAGEMENT = "re_engagement"
    NO_SHOW_RECOVERY = "no_show_recovery"
    WELCOME = "welcome"
    BIRTHDAY = "birthday"
    FESTIVAL = "festival"
    PROMOTIONAL = "promotional"
    CUSTOM = "custom"


class TaskAction(str, enum.Enum):
    CALL = "call"
    WHATSAPP = "whatsapp"
    SMS = "sms"
    EMAIL = "email"
    DELAY = "delay"
    CONDITION = "condition"
    WEBHOOK = "webhook"
    UPDATE_LEAD_STATUS = "update_lead_status"
    ASSIGN_LEAD = "assign_lead"
    UPDATE_SCORE = "update_score"
    TAG_LEAD = "tag_lead"
    CUSTOM = "custom"


class Campaign(Base):
    __tablename__ = "campaigns"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String(36), ForeignKey("tenants.id"), nullable=False, index=True)
    created_by = Column(String(36), ForeignKey("users.id"), nullable=True)
    
    # Campaign Details
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    campaign_type = Column(SAEnum(CampaignType), default=CampaignType.CUSTOM, nullable=False)
    status = Column(SAEnum(CampaignStatus), default=CampaignStatus.DRAFT, nullable=False)
    
    # Targeting
    target_lead_sources = Column(JSON, default=list)
    target_lead_statuses = Column(JSON, default=list)
    target_locations = Column(JSON, default=list)
    target_tags = Column(JSON, default=list)
    target_min_score = Column(Integer, default=0)
    target_max_score = Column(Integer, default=100)
    
    # Schedule
    start_date = Column(DateTime(timezone=True), nullable=True)
    end_date = Column(DateTime(timezone=True), nullable=True)
    timezone = Column(String(50), default="Asia/Kolkata")
    working_hours_start = Column(String(10), default="09:00")
    working_hours_end = Column(String(10), default="18:00")
    working_days = Column(JSON, default=[1, 2, 3, 4, 5, 6])  # 1=Monday
    
    # Performance
    leads_processed = Column(Integer, default=0)
    leads_targeted = Column(Integer, default=0)
    calls_made = Column(Integer, default=0)
    messages_sent = Column(Integer, default=0)
    appointments_booked = Column(Integer, default=0)
    conversions = Column(Integer, default=0)
    
    # AI Config
    ai_prompt_template = Column(String(100), nullable=True)
    ai_voice = Column(String(100), nullable=True)
    ai_language = Column(String(10), default="en")
    
    # Metadata
    record_metadata = Column("metadata", JSON, default=dict)
    tags = Column(JSON, default=list)
    
    # Timestamps
    activated_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    # Relationships
    tenant = relationship("Tenant", back_populates="campaigns")
    tasks = relationship("CampaignTask", back_populates="campaign", cascade="all, delete-orphan", order_by="CampaignTask.order")

    def __repr__(self):
        return f"<Campaign {self.name} - {self.status.value}>"


class CampaignTask(Base):
    __tablename__ = "campaign_tasks"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    campaign_id = Column(String(36), ForeignKey("campaigns.id"), nullable=False, index=True)
    
    # Task Details
    name = Column(String(255), nullable=False)
    action = Column(SAEnum(TaskAction), nullable=False)
    order = Column(Integer, nullable=False)
    
    # Action Configuration
    config = Column(JSON, default=dict)
    # Config structure varies by action:
    # CALL: {"phone": "lead", "script": "...", "ai_agent": "default"}
    # WHATSAPP: {"template": "follow_up", "variables": {...}}
    # SMS: {"message": "..."}
    # EMAIL: {"subject": "...", "body": "...", "template": "..."}
    # DELAY: {"duration": 3600} (in seconds)
    # CONDITION: {"field": "status", "operator": "equals", "value": "no_show"}
    # WEBHOOK: {"url": "...", "method": "POST", "headers": {...}}
    
    # Delay
    delay_after_previous_hours = Column(Integer, default=0)
    delay_after_previous_minutes = Column(Integer, default=0)
    
    # Execution
    is_condition = Column(Boolean, default=False)
    condition_field = Column(String(100), nullable=True)
    condition_operator = Column(String(50), nullable=True)
    condition_value = Column(String(255), nullable=True)
    
    # Metadata
    record_metadata = Column("metadata", JSON, default=dict)
    is_active = Column(Boolean, default=True, nullable=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    campaign = relationship("Campaign", back_populates="tasks")
