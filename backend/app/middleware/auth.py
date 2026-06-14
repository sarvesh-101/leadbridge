"""LeadFlow AI OS - Auth & Tenant Middleware"""

from fastapi import Request, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional, Dict, Any
import time
import json

from app.core.database import get_db
from app.core.security import decode_access_token, RBACManager
from app.models.user import User
from app.models.tenant import Tenant

security = HTTPBearer(auto_error=False)


async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> Optional[Dict[str, Any]]:
    """Authenticate and return current user from JWT token."""
    if not credentials:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    token = credentials.credentials
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token payload")
    
    # Fetch user
    result = await db.execute(select(User).where(User.id == user_id, User.is_active == True))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    # Attach user info to request state
    request.state.user = user
    request.state.tenant_id = user.tenant_id
    
    return {
        "id": user.id,
        "email": user.email,
        "role": user.role,
        "tenant_id": user.tenant_id,
        "is_super_admin": user.is_super_admin,
        "is_tenant_admin": user.is_tenant_admin,
    }


async def get_optional_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> Optional[Dict[str, Any]]:
    """Optionally authenticate user (doesn't raise error if no token)."""
    if not credentials:
        return None
    
    token = credentials.credentials
    payload = decode_access_token(token)
    if not payload:
        return None
    
    user_id = payload.get("sub")
    if not user_id:
        return None
    
    result = await db.execute(select(User).where(User.id == user_id, User.is_active == True))
    user = result.scalar_one_or_none()
    if not user:
        return None
    
    request.state.user = user
    request.state.tenant_id = user.tenant_id
    
    return {
        "id": user.id,
        "email": user.email,
        "role": user.role,
        "tenant_id": user.tenant_id,
        "is_tenant_admin": user.is_tenant_admin,
    }


def require_permission(permission: str):
    """Dependency factory to check user permissions."""
    async def permission_checker(current_user: Dict = Depends(get_current_user)):
        role = current_user.get("role")
        is_super_admin = current_user.get("is_super_admin", False)
        
        if is_super_admin:
            return current_user
        
        if not RBACManager.has_permission(role, permission):
            raise HTTPException(
                status_code=403,
                detail=f"Permission denied: {permission} required",
            )
        return current_user
    return permission_checker


async def verify_tenant_access(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> None:
    """Verify tenant is active and user has access."""
    tenant_id = getattr(request.state, "tenant_id", None)
    if not tenant_id:
        return
    
    result = await db.execute(
        select(Tenant).where(
            Tenant.id == tenant_id,
            Tenant.is_active == True,
            Tenant.status.in_(["active", "trial"]),
        )
    )
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=403, detail="Tenant access denied")


class RateLimiter:
    """Simple in-memory rate limiter."""
    
    def __init__(self):
        self.requests: Dict[str, list] = {}
    
    async def check(self, request: Request, max_requests: int = 100, window_seconds: int = 60):
        client_ip = request.client.host if request.client else "unknown"
        now = time.time()
        
        if client_ip not in self.requests:
            self.requests[client_ip] = []
        
        # Clean old entries
        self.requests[client_ip] = [
            t for t in self.requests[client_ip] if now - t < window_seconds
        ]
        
        if len(self.requests[client_ip]) >= max_requests:
            raise HTTPException(
                status_code=429,
                detail=f"Rate limit exceeded. Max {max_requests} requests per {window_seconds}s",
            )
        
        self.requests[client_ip].append(now)


rate_limiter = RateLimiter()


async def log_api_request(request: Request):
    """Log API request for audit and monitoring."""
    # Extract relevant info
    path = request.url.path
    method = request.method
    user = getattr(request.state, "user", None)
    tenant_id = getattr(request.state, "tenant_id", None)
    
    return {
        "path": path,
        "method": method,
        "user_id": user.id if user else None,
        "tenant_id": tenant_id,
        "timestamp": time.time(),
    }
