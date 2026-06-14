"""LeadFlow AI OS - Security & Authentication"""

from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any, List
from jose import JWTError, jwt
from passlib.context import CryptContext
from app.core.config import settings
import uuid
import hashlib
import hmac
import secrets

# Password hashing context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain password against a hashed password."""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Hash a password using bcrypt."""
    return pwd_context.hash(password)


def create_access_token(
    data: Dict[str, Any],
    expires_delta: Optional[timedelta] = None,
    tenant_id: Optional[str] = None,
) -> str:
    """Create a JWT access token."""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "jti": str(uuid.uuid4()),
        "type": "access",
    })
    if tenant_id:
        to_encode["tenant_id"] = tenant_id
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(
    data: Dict[str, Any],
    expires_delta: Optional[timedelta] = None,
) -> str:
    """Create a JWT refresh token."""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    )
    to_encode.update({
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "jti": str(uuid.uuid4()),
        "type": "refresh",
    })
    return jwt.encode(
        to_encode, settings.JWT_REFRESH_SECRET, algorithm=settings.JWT_ALGORITHM
    )


def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    """Decode and validate an access token."""
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.JWT_ALGORITHM]
        )
        if payload.get("type") != "access":
            return None
        return payload
    except JWTError:
        return None


def decode_refresh_token(token: str) -> Optional[Dict[str, Any]]:
    """Decode and validate a refresh token."""
    try:
        payload = jwt.decode(
            token, settings.JWT_REFRESH_SECRET, algorithms=[settings.JWT_ALGORITHM]
        )
        if payload.get("type") != "refresh":
            return None
        return payload
    except JWTError:
        return None


def generate_api_key() -> str:
    """Generate a secure API key."""
    return f"lf_{secrets.token_urlsafe(32)}"


def generate_webhook_secret() -> str:
    """Generate a webhook signing secret."""
    return secrets.token_hex(32)


def verify_webhook_signature(payload: bytes, signature: str, secret: str) -> bool:
    """Verify a webhook signature using HMAC-SHA256."""
    expected = hmac.new(
        secret.encode(), payload, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature)


def generate_tenant_slug(name: str) -> str:
    """Generate a URL-safe slug from a tenant name."""
    return name.lower().replace(" ", "-").replace("_", "-")


def encrypt_sensitive_data(data: str) -> str:
    """Encrypt sensitive data (basic implementation - use AES in production)."""
    from cryptography.fernet import Fernet
    import base64
    
    key = base64.urlsafe_b64encode(
        hashlib.sha256(settings.ENCRYPTION_KEY.encode()).digest()
    )
    f = Fernet(key)
    return f.encrypt(data.encode()).decode()


def decrypt_sensitive_data(encrypted_data: str) -> str:
    """Decrypt sensitive data."""
    from cryptography.fernet import Fernet
    import base64
    
    key = base64.urlsafe_b64encode(
        hashlib.sha256(settings.ENCRYPTION_KEY.encode()).digest()
    )
    f = Fernet(key)
    return f.decrypt(encrypted_data.encode()).decode()


class RBACManager:
    """Role-Based Access Control Manager."""

    ROLES = {
        "super_admin": {
            "permissions": [
                "tenant:manage", "tenant:view",
                "user:manage", "user:view",
                "lead:manage", "lead:view",
                "call:manage", "call:view",
                "appointment:manage", "appointment:view",
                "campaign:manage", "campaign:view",
                "territory:manage", "territory:view",
                "subscription:manage", "subscription:view",
                "analytics:view",
                "ai:configure",
                "settings:manage",
                "audit:view",
                "integration:manage",
                "webhook:manage",
            ],
            "description": "Full system access",
        },
        "admin": {
            "permissions": [
                "tenant:view",
                "user:manage", "user:view",
                "lead:manage", "lead:view",
                "call:manage", "call:view",
                "appointment:manage", "appointment:view",
                "campaign:manage", "campaign:view",
                "territory:view",
                "analytics:view",
                "ai:configure",
                "settings:manage",
                "integration:manage",
            ],
            "description": "Administrative access within tenant",
        },
        "manager": {
            "permissions": [
                "lead:manage", "lead:view",
                "call:view",
                "appointment:manage", "appointment:view",
                "campaign:manage", "campaign:view",
                "analytics:view",
                "user:view",
            ],
            "description": "Manager-level access",
        },
        "agent": {
            "permissions": [
                "lead:manage", "lead:view",
                "call:view",
                "appointment:manage", "appointment:view",
                "campaign:view",
            ],
            "description": "Agent-level access",
        },
        "business_owner": {
            "permissions": [
                "lead:view",
                "call:view",
                "appointment:view",
                "analytics:view",
                "campaign:view",
                "settings:view",
            ],
            "description": "Read-only access to business data",
        },
    }

    @classmethod
    def has_permission(cls, role: str, permission: str) -> bool:
        """Check if a role has a specific permission."""
        role_permissions = cls.ROLES.get(role, {}).get("permissions", [])
        return permission in role_permissions

    @classmethod
    def get_role_permissions(cls, role: str) -> List[str]:
        """Get all permissions for a role."""
        return cls.ROLES.get(role, {}).get("permissions", [])

    @classmethod
    def get_role_description(cls, role: str) -> str:
        """Get the description for a role."""
        return cls.ROLES.get(role, {}).get("description", "")

    @classmethod
    def is_valid_role(cls, role: str) -> bool:
        """Check if a role name is valid."""
        return role in cls.ROLES
