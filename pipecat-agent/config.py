from pydantic_settings import BaseSettings
from typing import Optional


class PipecatConfig(BaseSettings):
    # Server
    host: str = "0.0.0.0"
    port: int = 8000

    # Auth
    pipecat_secret: str = "change-me"

    # DeepSeek LLM
    deepseek_api_key: Optional[str] = None
    deepseek_base_url: str = "https://api.deepseek.com/v1"
    deepseek_model: str = "deepseek-chat"

    # Deepgram STT
    deepgram_api_key: Optional[str] = None
    deepgram_model: str = "nova-3"
    deepgram_language: str = "hi-IN"

    # Cartesia TTS
    cartesia_api_key: Optional[str] = None
    cartesia_voice_id: Optional[str] = None
    cartesia_model: str = "sonic-3"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False


config = PipecatConfig()
