"""
Secrets management for the Suno-Saarthi application.

This module centralizes all API keys and sensitive information used by the backend.
Secrets are loaded from environment variables with clear error messages if missing.

Security best practices:
1. Never commit this file with actual keys to version control
2. Use environment variables or a secure vault in production
3. Consider using a secrets management service for production deployments
"""

import os
from typing import Dict, Any, Optional
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Define environment variable names
ENV_GEMINI_API_KEY = "GEMINI_API_KEY"
ENV_GOOGLE_API_KEY = "GOOGLE_API_KEY"
ENV_MAPBOX_TOKEN = "MAPBOX_TOKEN"

# Load secrets from environment variables
GEMINI_API_KEY: Optional[str] = os.getenv(ENV_GEMINI_API_KEY)
GOOGLE_API_KEY: Optional[str] = os.getenv(ENV_GOOGLE_API_KEY)
MAPBOX_TOKEN: Optional[str] = os.getenv(ENV_MAPBOX_TOKEN)

# Default LLM model configuration
LLM_MODEL: str = os.getenv("LLM_MODEL", "gemini-2.5-pro-preview-03-25")

def get_secret(key_name: str) -> Optional[str]:
    """
    Get a secret by name.
    
    Args:
        key_name: The name of the secret to retrieve
        
    Returns:
        The secret value or None if not found
    """
    # Add secrets here as needed
    secrets_map = {
        "gemini_api": GEMINI_API_KEY,
        "google_maps_api": GOOGLE_API_KEY,
        "mapbox_token": MAPBOX_TOKEN,
    }
    
    return secrets_map.get(key_name)

def check_api_keys() -> Dict[str, bool]:
    """
    Check if all required API keys are set.
    
    Returns:
        Dictionary mapping API key names to their availability status
    """
    return {
        "gemini_api": GEMINI_API_KEY is not None and len(GEMINI_API_KEY) > 0,
        "google_maps_api": GOOGLE_API_KEY is not None and len(GOOGLE_API_KEY) > 0,
        "mapbox_token": MAPBOX_TOKEN is not None and len(MAPBOX_TOKEN) > 0
    }

def get_missing_keys() -> list:
    """
    Get a list of missing API keys.
    
    Returns:
        List of names of missing API keys
    """
    status = check_api_keys()
    return [key for key, available in status.items() if not available]

def all_keys_available() -> bool:
    """
    Check if all required API keys are available.
    
    Returns:
        True if all keys are available, False otherwise
    """
    return all(check_api_keys().values()) 