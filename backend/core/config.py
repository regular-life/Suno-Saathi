import os
from pathlib import Path
from typing import List

from dotenv import load_dotenv
from pydantic_settings import BaseSettings

path = os.path.abspath(os.environ.get("DOTENV_PATH", ".env"))
if os.path.exists(path):
    load_dotenv(dotenv_path=Path(__file__).parent / path)


class UvicornConfig(BaseSettings):
    PORT: int = 8000
    HOST: str = "0.0.0.0"
    DEBUG: bool = True
    CORS_ORIGINS: str = "*"
    RATE_LIMIT_REQUESTS: int = 100
    RATE_LIMIT_PERIOD: int = 3600  # in seconds

    class Config:
        env_prefix = "API_"


class APIKeysConfig(BaseSettings):
    GEMINI: str
    GOOGLE: str
    MAPBOX: str

    class Config:
        env_prefix = "API_KEY_"


class WakeWordConfig(BaseSettings):
    WORDS: List[str] = ["suno saarthi", "suno sarathi", "hello saarthi"]
    ENERGY_THRESHOLD: int = 300
    PAUSE_THRESHOLD: float = 0.8

    class Config:
        env_prefix = "WAKE_WORD_"


class LLMConfig(BaseSettings):
    MODEL: str = "gemini-2.5-pro-preview-03-25"
    MAX_TOKENS: int = 100
    TEMPERATURE: float = 0.8

    class Config:
        env_prefix = "LLM_"


class NavigationConfig(BaseSettings):
    DEFAULT_MODE: str = "driving"
    DEFAULT_LANGUAGE: str = "en-IN"
    ALTERNATIVES: bool = True

    class Config:
        env_prefix = "NAVIGATION_"


class CONFIG:
    UVICORN = UvicornConfig()
    API_KEYS = APIKeysConfig()
    WAKE_WORD = WakeWordConfig()
    LLM = LLMConfig()
    NAVIGATION = NavigationConfig()
