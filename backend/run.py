#!/usr/bin/env python3
"""
Run script for Suno Saarthi API
This file allows you to run the API directly from the backend directory
"""

import os
import sys
import uvicorn

# Add the parent directory to sys.path
parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(parent_dir)

if __name__ == "__main__":
    from backend.config.settings import API_HOST, API_PORT, DEBUG
    
    print(f"Starting Suno Saarthi API on http://{API_HOST}:{API_PORT}")
    print(f"Documentation available at http://{API_HOST}:{API_PORT}/docs")
    
    # Use import string format for proper reload support
    uvicorn.run("backend.app:app", host=API_HOST, port=API_PORT, reload=DEBUG) 