import logging
import traceback

import uvicorn
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from core.config import CONFIG
from saarthi import router as saarthi_router

# Create FastAPI app
app = FastAPI(
    title="Suno Saarthi API",
    description="API for Suno Saarthi - Conversational Navigation Assistant",
    version="0.1.0",
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=CONFIG.UVICORN.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    # Log the full traceback
    print(f"Unhandled exception: {str(exc)}")
    print("Traceback:")
    print(traceback.format_exc())


# Mount the saarthi router
app.include_router(saarthi_router)


@app.get("/")
async def root():
    """API root endpoint that returns basic information"""
    return {
        "app": "Suno Saarthi API",
        "version": "0.1.0",
        "status": "running",
        "documentation": "/docs",
    }


# Run the API server
if __name__ == "__main__":
    # Start the server
    uvicorn.run(
        "app:app",
        host=CONFIG.UVICORN.HOST,
        port=CONFIG.UVICORN.PORT,
        reload=CONFIG.UVICORN.DEBUG,
    )
