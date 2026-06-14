"""LeadFlow AI OS - User & Role Models"""

from sqlalchemy import Column, String, Boolean, DateTime, Integer, Text, JSON, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
import enum
import uuid


class UserRole(str, enum.Enum):
    SUPER_ADMIN = "super_admin"
    ADMIN = "admin"
    MANAGER = "manager"
    AGENT = "agent"
    BUSINESS_OWNER = "business_owner"


class UserStatus(str, enum.Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    SUSPENDED = "suspended"
    INVITED = "invited"


class Role(Base):
    __tablename__ = "roles"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(100), unique=True, nullable=False)
    description = Column(Text, nullable=True)
    permissions = Column(JSON, default=list)
    is_system_role = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    users = relationship("User", back_populates="role_obj")


class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String(36), ForeignKey("tenants.id"), nullable=False, index=True)
    role_id = Column(String(36), ForeignKey("roles.id"), nullable=True)
    
    # Personal Info
    email = Column(String(255), unique=True, nullable=False, index=True)
    phone = Column(String(20), unique=True, nullable=True, index=True)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=True)
    profile_image_url = Column(String(500), nullable=True)
    designation = Column(String(100), nullable=True)
    department = Column(String(100), nullable=True)
    
    # Auth
    hashed_password = Column(String(255), nullable=False)
    password_changed_at = Column(DateTime(timezone=True), nullable=True)
    last_login_at = Column(DateTime(timezone=True), nullable=True)
    last_login_ip = Column(String(45), nullable=True)
    
    # Role & Permissions
    role = Column(String(50), default=UserRole.AGENT, nullable=False)
    permissions = Column(JSON, default=list)
    is_super_admin = Column(Boolean, default=False)
    is_tenant_admin = Column(Boolean, default=False)
    
    # Status
    status = Column(SAEnum(UserStatus), default=UserStatus.INVITED, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    is_verified = Column(Boolean, default=False, nullable=False)
    is_email_verified = Column(Boolean, default=False, nullable=False)
    is_phone_verified = Column(Boolean, default=False, nullable=False)
    email_verified_at = Column(DateTime(timezone=True), nullable=True)
    phone_verified_at = Column(DateTime(timezone=True), nullable=True)
    
    # 2FA
    two_factor_enabled = Column(Boolean, default=False)
    two_factor_secret = Column(String(255), nullable=True)
    
    # Metadata
    user_metadata = Column("metadata", JSON, default=dict)
    preferences = Column(JSON, default=dict)
    notification_preferences = Column(JSON, default=dict)
    
    # Security
    failed_login_attempts = Column(Integer, default=0)
    locked_until = Column(DateTime(timezone=True), nullable=True)
    refresh_token = Column(Text, nullable=True)
    api_key = Column(String(255), unique=True, nullable=True)
    api_key_last_used = Column(DateTime(timezone=True), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    tenant = relationship("Tenant", back_populates="users")
    role_obj = relationship("Role", back_populates="users")
    assigned_leads = relationship("Lead", back_populates="assigned_to_user", foreign_keys="Lead.assigned_to")
    created_leads = relationship("Lead", back_populates="created_by_user", foreign_keys="Lead.created_by")
    calls = relationship("Call", back_populates="user")

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name or ''}".strip()

    def __repr__(self):
        return f"<User {self.email} - {self.role}>"
