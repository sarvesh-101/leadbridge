"""LeadFlow AI OS - Lead & LeadActivity Models"""

from sqlalchemy import Column, String, Boolean, DateTime, Integer, Text, JSON, ForeignKey, Float, Enum as SAEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
import enum
import uuid


class LeadStatus(str, enum.Enum):
    PENDING = "pending"
    CONTACTED = "contacted"
    QUALIFIED = "qualified"
    DISQUALIFIED = "disqualified"
    APPOINTMENT_SCHEDULED = "appointment_scheduled"
    VISITED = "visited"
    NO_SHOW = "no_show"
    CONVERTED = "converted"
    LOST = "lost"
    FOLLOW_UP = "follow_up"
    ARCHIVED = "archived"


class LeadSource(str, enum.Enum):
    INDIAMART = "indiamart"
    JUSTDIAL = "justdial"
    MAGICBRICKS = "magicbricks"
    HOUSING = "housing"
    NINETY_ACRES = "99acres"
    WEBSITE = "website"
    FACEBOOK = "facebook"
    GOOGLE = "google"
    WHATSAPP = "whatsapp"
    REFERRAL = "referral"
    EMAIL = "email"
    API = "api"
    WEBHOOK = "webhook"
    CSV_IMPORT = "csv_import"
    CRM_SYNC = "crm_sync"
    MANUAL = "manual"
    OTHER = "other"


class LeadPriority(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


class Lead(Base):
    __tablename__ = "leads"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String(36), ForeignKey("tenants.id"), nullable=False, index=True)
    assigned_to = Column(String(36), ForeignKey("users.id"), nullable=True, index=True)
    created_by = Column(String(36), ForeignKey("users.id"), nullable=True)
    
    # Personal Info
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=True)
    email = Column(String(255), nullable=True, index=True)
    phone = Column(String(20), nullable=False, index=True)
    alternate_phone = Column(String(20), nullable=True)
    
    # Lead Details
    source = Column(SAEnum(LeadSource), default=LeadSource.MANUAL, nullable=False)
    source_url = Column(String(500), nullable=True)
    source_reference_id = Column(String(255), nullable=True)
    status = Column(SAEnum(LeadStatus), default=LeadStatus.PENDING, nullable=False)
    priority = Column(SAEnum(LeadPriority), default=LeadPriority.MEDIUM, nullable=False)
    
    # Qualification
    requirement = Column(Text, nullable=True)
    budget_min = Column(Float, nullable=True)
    budget_max = Column(Float, nullable=True)
    budget_currency = Column(String(10), default="INR")
    location = Column(String(255), nullable=True)
    city = Column(String(100), nullable=True)
    state = Column(String(100), nullable=True)
    timeline = Column(String(100), nullable=True)
    
    # Business Info
    company_name = Column(String(255), nullable=True)
    designation = Column(String(100), nullable=True)
    website = Column(String(500), nullable=True)
    
    # AI Scoring
    lead_score = Column(Integer, default=0)
    ai_sentiment = Column(String(50), nullable=True)
    ai_summary = Column(Text, nullable=True)
    ai_qualification = Column(String(100), nullable=True)
    ai_notes = Column(JSON, default=dict)
    
    # Campaign
    campaign_id = Column(String(36), ForeignKey("campaigns.id"), nullable=True)
    assigned_campaign = Column(String(100), nullable=True)
    
    # Metadata
    tags = Column(JSON, default=list)
    custom_fields = Column(JSON, default=dict)
    notes = Column(Text, nullable=True)
    consent_given = Column(Boolean, default=False)
    consent_date = Column(DateTime(timezone=True), nullable=True)
    preferred_contact_time = Column(String(50), nullable=True)
    preferred_contact_method = Column(String(50), nullable=True)
    language_preference = Column(String(10), default="en")
    
    # Timestamps
    first_contacted_at = Column(DateTime(timezone=True), nullable=True)
    last_contacted_at = Column(DateTime(timezone=True), nullable=True)
    converted_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    deleted_at = Column(DateTime(timezone=True), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)

    # Relationships
    tenant = relationship("Tenant", back_populates="leads")
    assigned_to_user = relationship("User", back_populates="assigned_leads", foreign_keys=[assigned_to])
    created_by_user = relationship("User", back_populates="created_leads", foreign_keys=[created_by])
    calls = relationship("Call", back_populates="lead", cascade="all, delete-orphan")
    appointments = relationship("Appointment", back_populates="lead", cascade="all, delete-orphan")
    messages = relationship("Message", back_populates="lead", cascade="all, delete-orphan")
    activities = relationship("LeadActivity", back_populates="lead", cascade="all, delete-orphan")
    statuses = relationship("LeadStatus", back_populates="lead", cascade="all, delete-orphan")

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name or ''}".strip()

    def __repr__(self):
        return f"<Lead {self.full_name} - {self.status.value}>"


class LeadStatus(Base):
    __tablename__ = "lead_statuses"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String(36), ForeignKey("tenants.id"), nullable=False, index=True)
    lead_id = Column(String(36), ForeignKey("leads.id"), nullable=False, index=True)
    changed_by = Column(String(36), ForeignKey("users.id"), nullable=True)
    
    from_status = Column(String(50), nullable=True)
    to_status = Column(String(50), nullable=False)
    reason = Column(Text, nullable=True)
    activity_metadata = Column("metadata", JSON, default=dict)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    lead = relationship("Lead", back_populates="statuses")
    tenant = relationship("Tenant", back_populates="lead_statuses")


class LeadActivity(Base):
    __tablename__ = "lead_activities"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String(36), ForeignKey("tenants.id"), nullable=False, index=True)
    lead_id = Column(String(36), ForeignKey("leads.id"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    
    activity_type = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    activity_metadata = Column("metadata", JSON, default=dict)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    lead = relationship("Lead", back_populates="activities")
    tenant = relationship("Tenant", back_populates="lead_activities")
