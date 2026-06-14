"""LeadFlow AI OS - Auth Schemas"""

from pydantic import BaseModel, EmailStr, Field, validator
from typing import Optional, List, Dict, Any
from datetime import datetime


class LoginRequest(BaseModel):
    email: str
    password: str
    tenant_slug: Optional[str] = None
    remember_me: bool = False


class RegisterRequest(BaseModel):
    email: str
    password: str = Field(..., min_length=8, max_length=128)
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: Optional[str] = None
    phone: Optional[str] = None
    company_name: Optional[str] = None
    tenant_name: Optional[str] = None


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    user: "UserResponse"


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    token: str
    password: str = Field(..., min_length=8, max_length=128)


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8, max_length=128)


class VerifyEmailRequest(BaseModel):
    token: str


class UserResponse(BaseModel):
    id: str
    email: str
    phone: Optional[str] = None
    first_name: str
    last_name: Optional[str] = None
    full_name: str
    role: str
    is_verified: bool
    is_active: bool
    profile_image_url: Optional[str] = None
    designation: Optional[str] = None
    tenant_id: str
    created_at: datetime

    class Config:
        from_attributes = True


class TenantResponse(BaseModel):
    id: str
    name: str
    slug: str
    email: str
    phone: Optional[str] = None
    website: Optional[str] = None
    logo_url: Optional[str] = None
    plan: str
    status: str
    timezone: str
    is_verified: bool
    trial_ends_at: Optional[datetime] = None
    subscription_ends_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True
