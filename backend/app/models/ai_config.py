"""LeadFlow AI OS - AI Configuration Models"""

from sqlalchemy import Column, String, Boolean, DateTime, Integer, Text, JSON, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
import enum
import uuid


class AIVoiceProvider(str, enum.Enum):
    CARTESIA = "cartesia"
    ELEVENLABS = "elevenlabs"
    OPENAI = "openai"
    AZURE = "azure"


class AILLMProvider(str, enum.Enum):
    DEEPSEEK = "deepseek"
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    GROQ = "groq"


class STTProvider(str, enum.Enum):
    DEEPGRAM = "deepgram"
    ASSEMBLY_AI = "assembly_ai"
    WHISPER = "whisper"
    AZURE = "azure"


class AIConfiguration(Base):
    __tablename__ = "ai_configurations"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String(36), ForeignKey("tenants.id"), nullable=False, index=True)
    
    # LLM Configuration
    llm_provider = Column(SAEnum(AILLMProvider), default=AILLMProvider.DEEPSEEK, nullable=False)
    llm_model = Column(String(100), default="deepseek-chat")
    llm_temperature = Column(Integer, default=70)  # 0-100
    llm_max_tokens = Column(Integer, default=2048)
    llm_api_key = Column(String(500), nullable=True)
    
    # Voice Configuration
    voice_provider = Column(SAEnum(AIVoiceProvider), default=AIVoiceProvider.CARTESIA, nullable=False)
    voice_id = Column(String(100), nullable=True)
    voice_speed = Column(Integer, default=100)  # percentage
    voice_pitch = Column(Integer, default=100)
    voice_api_key = Column(String(500), nullable=True)
    
    # STT Configuration
    stt_provider = Column(SAEnum(STTProvider), default=STTProvider.DEEPGRAM, nullable=False)
    stt_model = Column(String(100), default="nova-2")
    stt_language = Column(String(10), default="en")
    stt_api_key = Column(String(500), nullable=True)
    
    # AI Agent Settings
    agent_name = Column(String(100), default="LeadFlow Assistant")
    agent_greeting = Column(Text, default="Hello! This is LeadFlow AI Assistant calling.")
    agent_personality = Column(Text, nullable=True)
    agent_max_call_duration = Column(Integer, default=600)
    agent_timeout_seconds = Column(Integer, default=30)
    agent_language = Column(String(10), default="en")
    
    # Call Settings
    max_retries = Column(Integer, default=3)
    retry_delay_minutes = Column(Integer, default=30)
    concurrent_calls_limit = Column(Integer, default=5)
    call_from_number = Column(String(20), nullable=True)
    
    # Qualification Settings
    enable_lead_scoring = Column(Boolean, default=True)
    qualification_threshold = Column(Integer, default=60)
    enable_sentiment_analysis = Column(Boolean, default=True)
    
    # Appointment Settings
    enable_auto_booking = Column(Boolean, default=True)
    available_days_ahead = Column(Integer, default=14)
    slot_duration_minutes = Column(Integer, default=30)
    buffer_minutes = Column(Integer, default=15)
    
    # Follow-up Settings
    enable_follow_up = Column(Boolean, default=True)
    follow_up_days = Column(JSON, default=[1, 2, 3, 7])
    follow_up_max_attempts = Column(Integer, default=5)
    
    # WhatsApp Settings
    whatsapp_enabled = Column(Boolean, default=True)
    whatsapp_templates = Column(JSON, default=dict)
    
    # Metadata
    record_metadata = Column("metadata", JSON, default=dict)
    is_active = Column(Boolean, default=True, nullable=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    tenant = relationship("Tenant", back_populates="ai_configurations")


class KnowledgeBase(Base):
    __tablename__ = "knowledge_base"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String(36), ForeignKey("tenants.id"), nullable=False, index=True)
    
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    category = Column(String(100), nullable=True)
    tags = Column(JSON, default=list)
    
    # For embedding/search
    embedding = Column(JSON, nullable=True)
    record_metadata = Column("metadata", JSON, default=dict)
    
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    tenant = relationship("Tenant", back_populates="knowledge_base")


class FAQ(Base):
    __tablename__ = "faqs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String(36), ForeignKey("tenants.id"), nullable=False, index=True)
    
    question = Column(Text, nullable=False)
    answer = Column(Text, nullable=False)
    category = Column(String(100), nullable=True)
    tags = Column(JSON, default=list)
    order = Column(Integer, default=0)
    
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    tenant = relationship("Tenant", back_populates="faqs")


class PromptTemplate(Base):
    __tablename__ = "prompt_templates"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String(36), ForeignKey("tenants.id"), nullable=False, index=True)
    
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    prompt_type = Column(String(100), nullable=False)  # call_script, greeting, faq_answer, qualification, follow_up, etc.
    prompt_text = Column(Text, nullable=False)
    variables = Column(JSON, default=list)
    
    is_active = Column(Boolean, default=True, nullable=False)
    is_system = Column(Boolean, default=False)
    version = Column(Integer, default=1)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    tenant = relationship("Tenant", back_populates="prompt_templates")
