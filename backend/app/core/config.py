"""LeadFlow AI OS - Application Configuration"""

from pydantic_settings import BaseSettings
from pydantic import field_validator
from typing import Optional, List
import os
from functools import lru_cache


def _parse_csv(v: str | List[str]) -> List[str]:
    """Parse a comma-separated string into a list, stripping whitespace."""
    if isinstance(v, str):
        return [item.strip() for item in v.split(",") if item.strip()]
    return v


class Settings(BaseSettings):
    # Application
    APP_NAME: str = "LeadFlow AI OS"
    APP_VERSION: str = "1.0.0"
    APP_DESCRIPTION: str = "AI-Powered Lead Recovery & Conversion Management Platform"
    DEBUG: bool = False
    ENVIRONMENT: str = "production"

    # API
    API_V1_PREFIX: str = "/api/v1"
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000
    ALLOWED_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:8000", "https://leadflow.ai"]

    @field_validator("ALLOWED_ORIGINS", mode="before")
    @classmethod
    def parse_allowed_origins(cls, v):
        return _parse_csv(v)

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/leadflow_ai"
    DATABASE_SYNC_URL: str = "postgresql+psycopg2://postgres:postgres@localhost:5432/leadflow_ai"
    DB_POOL_SIZE: int = 20
    DB_MAX_OVERFLOW: int = 40

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    REDIS_TTL: int = 3600

    # Security
    SECRET_KEY: str = "change-this-to-a-secure-random-key-in-production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    JWT_REFRESH_SECRET: str = "change-this-refresh-secret-key"
    ENCRYPTION_KEY: str = "change-this-encryption-key"

    # Tenant Settings
    MAX_TENANTS: int = 10000
    DEFAULT_TENANT_PLAN: str = "starter"

    # AWS S3
    AWS_ACCESS_KEY_ID: Optional[str] = None
    AWS_SECRET_ACCESS_KEY: Optional[str] = None
    AWS_REGION: str = "ap-south-1"
    AWS_S3_BUCKET: str = "leadflow-ai-storage"
    AWS_S3_CALLS_FOLDER: str = "call-recordings"
    AWS_S3_DOCUMENTS_FOLDER: str = "documents"

    # AI Services
    DEEPSEEK_API_KEY: Optional[str] = None
    DEEPSEEK_BASE_URL: str = "https://api.deepseek.com/v1"
    DEEPSEEK_MODEL: str = "deepseek-v4-flash"
    DEEPGRAM_API_KEY: Optional[str] = None
    CARTESIA_API_KEY: Optional[str] = None
    OPENAI_API_KEY: Optional[str] = None

    # Telephony (Exotel)
    EXOTEL_SID: Optional[str] = None
    EXOTEL_TOKEN: Optional[str] = None
    EXOTEL_SUBDOMAIN: Optional[str] = None

    # WhatsApp (Cloud API)
    WHATSAPP_API_TOKEN: Optional[str] = None
    WHATSAPP_PHONE_NUMBER_ID: Optional[str] = None
    WHATSAPP_BUSINESS_ACCOUNT_ID: Optional[str] = None

    # Email (Resend)
    RESEND_API_KEY: Optional[str] = None
    RESEND_FROM_EMAIL: str = "noreply@leadflow.ai"
    RESEND_FROM_NAME: str = "LeadFlow AI OS"

    # Celery
    CELERY_BROKER_URL: str = "redis://localhost:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/2"
    CELERY_TASK_ALWAYS_EAGER: bool = False

    # Rate Limiting
    RATE_LIMIT_ENABLED: bool = True
    RATE_LIMIT_REQUESTS: int = 100
    RATE_LIMIT_PERIOD: int = 60  # seconds

    # Monitoring
    SENTRY_DSN: Optional[str] = None
    LOG_LEVEL: str = "INFO"
    ENABLE_PROMETHEUS: bool = True

    # Webhook
    WEBHOOK_MAX_RETRIES: int = 3
    WEBHOOK_TIMEOUT: int = 10

    # File Upload
    MAX_UPLOAD_SIZE: int = 50 * 1024 * 1024  # 50MB
    ALLOWED_FILE_TYPES: List[str] = ["csv", "xlsx", "pdf", "mp3", "wav", "ogg", "txt"]

    @field_validator("ALLOWED_FILE_TYPES", mode="before")
    @classmethod
    def parse_allowed_file_types(cls, v):
        return _parse_csv(v)

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
