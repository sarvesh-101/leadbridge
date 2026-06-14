"""LeadFlow AI OS - AuditLog Model"""

from sqlalchemy import Column, String, Boolean, DateTime, Integer, Text, JSON, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
import uuid


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String(36), ForeignKey("tenants.id"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=True, index=True)
    
    # Action Details
    action = Column(String(100), nullable=False)  # create, update, delete, view, login, logout, export, etc.
    resource_type = Column(String(100), nullable=False)  # lead, user, tenant, appointment, etc.
    resource_id = Column(String(36), nullable=True)
    resource_name = Column(String(255), nullable=True)
    
    # Change Details
    changes = Column(JSON, default=dict)  # before/after values
    record_metadata = Column("metadata", JSON, default=dict)
    
    # Request Info
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(String(500), nullable=True)
    request_method = Column(String(10), nullable=True)
    request_path = Column(String(500), nullable=True)
    
    # Status
    status = Column(String(50), default="success")  # success, failure, pending
    error_message = Column(Text, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    tenant = relationship("Tenant", back_populates="audit_logs")
