import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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
