import os
from pathlib import Path
from dotenv import load_dotenv
from typing import Dict, Any, Optional
from backend.config.secrets import (
    GEMINI_API_KEY, GOOGLE_API_KEY, MAPBOX_TOKEN,
    LLM_MODEL, check_api_keys, all_keys_available
)

# Load environment variables from .env file
load_dotenv()

# Base directory of the project
BASE_DIR = Path(__file__).resolve().parent.parent.parent

# Application settings
DEBUG = os.getenv("DEBUG", "True").lower() in ["true", "1", "yes"]
API_HOST = os.getenv("API_HOST", "0.0.0.0")
API_PORT = int(os.getenv("API_PORT", "8000"))

# Wake word settings
WAKE_WORDS = ["suno saarthi", "suno sarathi", "hello saarthi"]
WAKE_WORD_ENERGY_THRESHOLD = int(os.getenv("WAKE_WORD_ENERGY_THRESHOLD", "300"))
WAKE_WORD_PAUSE_THRESHOLD = float(os.getenv("WAKE_WORD_PAUSE_THRESHOLD", "0.8"))

# LLM settings
LLM_MAX_TOKENS = int(os.getenv("LLM_MAX_TOKENS", "100"))
LLM_TEMPERATURE = float(os.getenv("LLM_TEMPERATURE", "0.8"))

# Navigation settings
NAVIGATION_DEFAULT_MODE = os.getenv("NAVIGATION_DEFAULT_MODE", "driving")
NAVIGATION_DEFAULT_LANGUAGE = os.getenv("NAVIGATION_DEFAULT_LANGUAGE", "en-IN")
NAVIGATION_ALTERNATIVES = os.getenv("NAVIGATION_ALTERNATIVES", "True").lower() in ["true", "1", "yes"]

# Safety settings - these could be moved to a separate security config module
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "*").split(",")
RATE_LIMIT_REQUESTS = int(os.getenv("RATE_LIMIT_REQUESTS", "100"))
RATE_LIMIT_PERIOD = int(os.getenv("RATE_LIMIT_PERIOD", "3600"))  # in seconds

# Helper function to get all settings as a dict
def get_all_settings() -> Dict[str, Any]:
    """
    Get all settings as a dictionary, excluding sensitive data
    
    Returns:
        Dict with all non-sensitive settings
    """
    return {
        "debug": DEBUG,
        "api_host": API_HOST,
        "api_port": API_PORT,
        "wake_words": WAKE_WORDS,
        "wake_word_energy_threshold": WAKE_WORD_ENERGY_THRESHOLD,
        "wake_word_pause_threshold": WAKE_WORD_PAUSE_THRESHOLD,
        "llm_model": LLM_MODEL,
        "llm_max_tokens": LLM_MAX_TOKENS,
        "llm_temperature": LLM_TEMPERATURE,
        "navigation_default_mode": NAVIGATION_DEFAULT_MODE,
        "navigation_default_language": NAVIGATION_DEFAULT_LANGUAGE,
        "navigation_alternatives": NAVIGATION_ALTERNATIVES,
        "cors_origins": CORS_ORIGINS,
        "rate_limit_requests": RATE_LIMIT_REQUESTS,
        "rate_limit_period": RATE_LIMIT_PERIOD
    } 