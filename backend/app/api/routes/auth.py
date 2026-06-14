"""LeadFlow AI OS - Auth Routes"""

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timedelta, timezone
from typing import Optional

from app.core.database import get_db
from app.core.security import (
    get_password_hash, verify_password,
    create_access_token, create_refresh_token,
    decode_access_token, decode_refresh_token,
    RBACManager, generate_tenant_slug,
)
from app.models.user import User, UserRole, UserStatus
from app.models.tenant import Tenant, TenantStatus, TenantPlan
from app.schemas.auth import (
    LoginRequest, RegisterRequest, TokenResponse,
    RefreshTokenRequest, ForgotPasswordRequest,
    ResetPasswordRequest, ChangePasswordRequest,
    UserResponse, TenantResponse,
)
from app.middleware.auth import get_current_user

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/login", response_model=TokenResponse)
async def login(
    request: LoginRequest,
    http_request: Request,
    db: AsyncSession = Depends(get_db)
):
    """Authenticate user and return JWT tokens."""
    # Find user by email
    result = await db.execute(
        select(User).where(User.email == request.email, User.is_active == True)
    )
    user = result.scalar_one_or_none()
    
    if not user or not verify_password(request.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    if user.status == UserStatus.SUSPENDED:
        raise HTTPException(status_code=403, detail="Account is suspended")
    
    # Verify tenant is active
    tenant_result = await db.execute(
        select(Tenant).where(Tenant.id == user.tenant_id)
    )
    tenant = tenant_result.scalar_one_or_none()
    if not tenant or tenant.status not in [TenantStatus.ACTIVE, TenantStatus.TRIAL]:
        raise HTTPException(status_code=403, detail="Tenant account is not active")
    
    # Update last login
    user.last_login_at = datetime.now(timezone.utc)
    user.last_login_ip = http_request.client.host if http_request.client else None
    await db.commit()
    
    # Generate tokens
    access_token = create_access_token(
        data={"sub": user.id, "role": user.role},
        tenant_id=user.tenant_id,
    )
    refresh_token = create_refresh_token(data={"sub": user.id})
    
    # Store refresh token
    user.refresh_token = refresh_token
    await db.commit()
    
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=timedelta(minutes=30).seconds,
        user=UserResponse(
            id=user.id,
            email=user.email,
            phone=user.phone,
            first_name=user.first_name,
            last_name=user.last_name,
            full_name=user.full_name,
            role=user.role,
            is_verified=user.is_verified,
            is_active=user.is_active,
            profile_image_url=user.profile_image_url,
            designation=user.designation,
            tenant_id=user.tenant_id,
            created_at=user.created_at,
        ),
    )


@router.post("/register", response_model=TokenResponse)
async def register(request: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """Register a new tenant and admin user."""
    # Check if email exists
    existing = await db.execute(
        select(User).where(User.email == request.email)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create tenant
    tenant_name = request.tenant_name or f"{request.first_name}'s Business"
    tenant_slug = generate_tenant_slug(tenant_name)
    
    # Ensure unique slug
    slug_check = await db.execute(
        select(Tenant).where(Tenant.slug == tenant_slug)
    )
    if slug_check.scalar_one_or_none():
        tenant_slug = f"{tenant_slug}-{datetime.now().strftime('%Y%m%d%H%M%S')}"
    
    tenant = Tenant(
        name=tenant_name,
        slug=tenant_slug,
        email=request.email,
        phone=request.phone,
        plan=TenantPlan.STARTER,
        status=TenantStatus.ACTIVE,
        trial_ends_at=datetime.now(timezone.utc) + timedelta(days=14),
        is_verified=True,
        verified_at=datetime.now(timezone.utc),
    )
    db.add(tenant)
    await db.flush()
    
    # Create admin user
    user = User(
        tenant_id=tenant.id,
        email=request.email,
        phone=request.phone,
        first_name=request.first_name,
        last_name=request.last_name,
        hashed_password=get_password_hash(request.password),
        role=UserRole.ADMIN,
        is_tenant_admin=True,
        status=UserStatus.ACTIVE,
        is_verified=True,
        is_email_verified=True,
        email_verified_at=datetime.now(timezone.utc),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    
    # Generate tokens
    access_token = create_access_token(
        data={"sub": user.id, "role": user.role},
        tenant_id=user.tenant_id,
    )
    refresh_token = create_refresh_token(data={"sub": user.id})
    
    user.refresh_token = refresh_token
    await db.commit()
    
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=timedelta(minutes=30).seconds,
        user=UserResponse(
            id=user.id,
            email=user.email,
            phone=user.phone,
            first_name=user.first_name,
            last_name=user.last_name,
            full_name=user.full_name,
            role=user.role,
            is_verified=user.is_verified,
            is_active=user.is_active,
            profile_image_url=user.profile_image_url,
            designation=user.designation,
            tenant_id=user.tenant_id,
            created_at=user.created_at,
        ),
    )


@router.post("/refresh")
async def refresh_token(request: RefreshTokenRequest, db: AsyncSession = Depends(get_db)):
    """Refresh access token using refresh token."""
    payload = decode_refresh_token(request.refresh_token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    
    user_id = payload.get("sub")
    result = await db.execute(
        select(User).where(User.id == user_id, User.is_active == True)
    )
    user = result.scalar_one_or_none()
    
    if not user or user.refresh_token != request.refresh_token:
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    
    access_token = create_access_token(
        data={"sub": user.id, "role": user.role},
        tenant_id=user.tenant_id,
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "expires_in": timedelta(minutes=30).seconds,
    }


@router.post("/logout")
async def logout(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Logout user by invalidating refresh token."""
    result = await db.execute(
        select(User).where(User.id == current_user["id"])
    )
    user = result.scalar_one_or_none()
    if user:
        user.refresh_token = None
        await db.commit()
    
    return {"message": "Logged out successfully"}


@router.get("/me", response_model=UserResponse)
async def get_current_user_profile(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get current user profile."""
    result = await db.execute(
        select(User).where(User.id == current_user["id"])
    )
    user = result.scalar_one_or_none()
    
    return UserResponse(
        id=user.id,
        email=user.email,
        phone=user.phone,
        first_name=user.first_name,
        last_name=user.last_name,
        full_name=user.full_name,
        role=user.role,
        is_verified=user.is_verified,
        is_active=user.is_active,
        profile_image_url=user.profile_image_url,
        designation=user.designation,
        tenant_id=user.tenant_id,
        created_at=user.created_at,
    )


@router.get("/tenant", response_model=TenantResponse)
async def get_current_tenant(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get current tenant information."""
    result = await db.execute(
        select(Tenant).where(Tenant.id == current_user["tenant_id"])
    )
    tenant = result.scalar_one_or_none()
    
    return TenantResponse(
        id=tenant.id,
        name=tenant.name,
        slug=tenant.slug,
        email=tenant.email,
        phone=tenant.phone,
        website=tenant.website,
        logo_url=tenant.logo_url,
        plan=tenant.plan.value,
        status=tenant.status.value,
        timezone=tenant.timezone,
        is_verified=tenant.is_verified,
        trial_ends_at=tenant.trial_ends_at,
        subscription_ends_at=tenant.subscription_ends_at,
        created_at=tenant.created_at,
    )


@router.post("/change-password")
async def change_password(
    request: ChangePasswordRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Change user password."""
    result = await db.execute(
        select(User).where(User.id == current_user["id"])
    )
    user = result.scalar_one_or_none()
    
    if not verify_password(request.current_password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    
    user.hashed_password = get_password_hash(request.new_password)
    user.password_changed_at = datetime.now(timezone.utc)
    await db.commit()
    
    return {"message": "Password changed successfully"}
