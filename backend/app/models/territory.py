"""LeadFlow AI OS - Territory Exclusivity System Models"""

from sqlalchemy import Column, String, Boolean, DateTime, Integer, Text, JSON, ForeignKey, Float, Enum as SAEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
import enum
import uuid


class TerritoryStatus(str, enum.Enum):
    AVAILABLE = "available"
    RESERVED = "reserved"
    OCCUPIED = "occupied"
    WAITLIST = "waitlist"
    MAINTENANCE = "maintenance"


class TerritoryTier(str, enum.Enum):
    TIER_1 = "tier_1"  # Metro cities
    TIER_2 = "tier_2"  # Tier 2 cities
    TIER_3 = "tier_3"  # Smaller cities


class Territory(Base):
    __tablename__ = "territories"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String(36), ForeignKey("tenants.id"), nullable=True, index=True)
    
    # Territory Info
    name = Column(String(255), nullable=False)
    slug = Column(String(255), unique=True, nullable=False)
    description = Column(Text, nullable=True)
    tier = Column(SAEnum(TerritoryTier), default=TerritoryTier.TIER_2, nullable=False)
    status = Column(SAEnum(TerritoryStatus), default=TerritoryStatus.AVAILABLE, nullable=False)
    
    # Location
    city = Column(String(100), nullable=False)
    state = Column(String(100), nullable=False)
    country = Column(String(100), default="India")
    region = Column(String(100), nullable=True)
    pincodes = Column(JSON, default=list)
    boundaries = Column(JSON, default=dict)  # GeoJSON boundaries
    coordinates = Column(JSON, default=dict)  # lat/lng center
    
    # Pricing
    price_monthly = Column(Float, nullable=False)
    price_yearly = Column(Float, nullable=True)
    setup_fee = Column(Float, default=0.0)
    currency = Column(String(10), default="INR")
    
    # Demographics
    estimated_population = Column(Integer, nullable=True)
    estimated_businesses = Column(Integer, nullable=True)
    market_potential = Column(String(255), nullable=True)
    
    # Metadata
    features = Column(JSON, default=list)
    rules = Column(JSON, default=dict)
    documents = Column(JSON, default=list)
    media = Column(JSON, default=list)
    
    # Timestamps
    occupied_at = Column(DateTime(timezone=True), nullable=True)
    available_from = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    # Relationships
    tenant = relationship("Tenant", back_populates="territories")
    purchases = relationship("TerritoryPurchase", back_populates="territory", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Territory {self.name} - {self.status.value}>"


class TerritoryPurchase(Base):
    __tablename__ = "territory_purchases"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String(36), ForeignKey("tenants.id"), nullable=False, index=True)
    territory_id = Column(String(36), ForeignKey("territories.id"), nullable=False, index=True)
    
    # Purchase Details
    purchase_type = Column(String(50), default="monthly")  # monthly, yearly
    amount_paid = Column(Float, nullable=False)
    currency = Column(String(10), default="INR")
    
    # Period
    start_date = Column(DateTime(timezone=True), nullable=False)
    end_date = Column(DateTime(timezone=True), nullable=False)
    auto_renew = Column(Boolean, default=True)
    
    # Status
    status = Column(String(50), default="active")  # active, expired, cancelled
    cancelled_at = Column(DateTime(timezone=True), nullable=True)
    cancellation_reason = Column(Text, nullable=True)
    
    # Waitlist
    is_waitlisted = Column(Boolean, default=False)
    waitlist_position = Column(Integer, nullable=True)
    waitlist_joined_at = Column(DateTime(timezone=True), nullable=True)
    
    # Metadata
    record_metadata = Column("metadata", JSON, default=dict)
    invoice_id = Column(String(36), ForeignKey("invoices.id"), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    territory = relationship("Territory", back_populates="purchases")
    tenant = relationship("Tenant", back_populates="territory_purchases")
