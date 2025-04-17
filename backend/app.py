from fastapi import FastAPI, HTTPException, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import time
import os
import sys
import json
from pydantic import BaseModel
from typing import Dict, Any, Optional, List
import uvicorn

# Add the parent directory to sys.path to allow imports from backend module
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.config.secrets import GEMINI_API_KEY, MAPBOX_TOKEN, check_api_keys, get_missing_keys
from backend.config.settings import API_HOST, API_PORT, DEBUG, CORS_ORIGINS
from backend.modules.navigation import NavigationHandler
from backend.modules.llm_interface import GeminiLLM

# Create FastAPI app
app = FastAPI(
    title="Suno Saarthi API",
    description="API for Suno Saarthi - Conversational Navigation Assistant",
    version="0.1.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize navigation handler
navigation = NavigationHandler()

# Initialize LLM interface if API key is available
llm = None
if GEMINI_API_KEY:
    try:
        llm = GeminiLLM()
    except Exception as e:
        print(f"Warning: Failed to initialize LLM: {e}")

# Models for request validation
class DirectionsRequest(BaseModel):
    origin: str
    destination: str
    mode: Optional[str] = "driving"

class PlacesRequest(BaseModel):
    query: str
    location: Optional[str] = None

class GeocodeRequest(BaseModel):
    address: str

class TrafficRequest(BaseModel):
    origin: str
    destination: str

class LLMRequest(BaseModel):
    prompt: str
    max_tokens: Optional[int] = 100
    temperature: Optional[float] = 0.9

class NavigationQueryRequest(BaseModel):
    query: str
    location: Optional[Dict[str, float]] = None
    context: Optional[Dict[str, Any]] = None

class WakeWordRequest(BaseModel):
    text: str

# API Routes
@app.get("/")
async def root():
    """API root endpoint that returns basic information"""
    return {
        "app": "Suno Saarthi API",
        "version": "0.1.0",
        "status": "running",
        "documentation": "/docs"
    }

@app.get("/health")
async def health_check():
    """Health check endpoint that verifies API keys and services"""
    key_status = check_api_keys()
    missing = [k for k, v in key_status.items() if not v]
    
    return {
        "status": "healthy",
        "timestamp": time.time(),
        "api_keys": {
            "status": "ok" if not missing else "missing_keys",
            "missing": missing
        },
        "services": {
            "navigation": "available",
            "llm": "available" if llm else "unavailable"
        }
    }

# Get API keys for frontend (only required ones, with security measures)
@app.get("/api/config")
async def get_frontend_config(request: Request):
    """
    Get necessary configuration for the frontend.
    This includes required API keys and configuration.
    
    Note: This endpoint implements security measures to prevent unauthorized access:
    - Only allows requests from specified origins (CORS)
    - Does not expose all API keys, only the ones needed by frontend
    - In production, should implement additional auth measures
    """
    # Check if request is coming from an allowed origin
    origin = request.headers.get("origin", "")
    if "*" not in CORS_ORIGINS and origin not in CORS_ORIGINS:
        raise HTTPException(status_code=403, detail="Access forbidden")
    
    # Prepare the configuration with keys
    config = {
        "mapbox_token": MAPBOX_TOKEN,
        "api_urls": {
            "directions": "/api/navigation/directions",
            "places": "/api/navigation/places",
            "geocode": "/api/navigation/geocode",
            "traffic": "/api/navigation/traffic",
            "query": "/api/navigation/query",
            "llm": "/api/llm/generate",
            "wake": "/api/wake/detect"
        }
    }
    
    # Only include Gemini API key if it's set
    if GEMINI_API_KEY:
        config["gemini_api_key"] = GEMINI_API_KEY
    
    # Check for missing keys and add warnings
    missing_keys = get_missing_keys()
    if missing_keys:
        config["warnings"] = {
            "missing_keys": missing_keys,
            "message": "Some API keys are missing. Functionality may be limited."
        }
    
    return config

# Navigation API routes - consolidated endpoints (supporting both GET and POST)
@app.get("/api/navigation/directions")
async def get_directions(origin: str, destination: str, mode: str = "driving"):
    """Get directions between two locations via GET"""
    try:
        directions = navigation.get_directions(origin, destination, mode)
        return directions
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/navigation/directions")
async def post_directions(request: DirectionsRequest):
    """Get directions between two locations via POST"""
    try:
        directions = navigation.get_directions(
            request.origin, 
            request.destination, 
            request.mode
        )
        return directions
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/navigation/places")
async def find_places(query: str, location: Optional[str] = None):
    """Find places based on a query string via GET"""
    try:
        places = navigation.find_places(query, location)
        return places
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/navigation/places")
async def post_find_places(request: PlacesRequest):
    """Find places based on a query string via POST"""
    try:
        places = navigation.find_places(request.query, request.location)
        return places
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/navigation/geocode")
async def geocode_address(address: str):
    """Geocode an address to coordinates via GET"""
    try:
        result = navigation.geocode_address(address)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/navigation/geocode")
async def post_geocode_address(request: GeocodeRequest):
    """Geocode an address to coordinates via POST"""
    try:
        result = navigation.geocode_address(request.address)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/navigation/traffic")
async def get_traffic(origin: str, destination: str):
    """Get traffic information between two points via GET"""
    try:
        traffic_info = navigation.get_traffic_info(origin, destination)
        return traffic_info
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/navigation/traffic")
async def post_traffic(request: TrafficRequest):
    """Get traffic information between two points via POST"""
    try:
        traffic_info = navigation.get_traffic_info(request.origin, request.destination)
        return traffic_info
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/navigation/query")
async def process_navigation_query(request: NavigationQueryRequest):
    """Process a natural language navigation query"""
    if not request.query:
        raise HTTPException(status_code=400, detail="Query is required")
    
    try:
        # If LLM is available, use it to interpret the query
        if llm:
            # Create context-aware prompt
            context_text = ""
            if request.context:
                context_text = f"Navigation Context: {json.dumps(request.context)}\n"
            
            prompt = f"{context_text}User's navigation query: {request.query}\n\nInterpret this navigation-related query and provide a helpful response:"
            
            # Generate response using LLM
            response = llm.generate_reply(prompt)
            
            # Extract response text
            if response and response.get("status") == "success":
                return {
                    "query_type": "llm_processed",
                    "response": response.get("response"),
                    "processed_query": request.query
                }
        
        # Fallback to rule-based interpretation if LLM is not available
        query_lower = request.query.lower()
        response_data = {
            "query_type": "general_navigation",
            "original_query": request.query
        }
        
        # Handle traffic-related queries
        if any(keyword in query_lower for keyword in ["traffic", "congestion", "jam", "busy"]):
            response_data["query_type"] = "traffic"
            
            # Try to get actual traffic if location is provided
            if request.location and request.context and request.context.get("destination"):
                try:
                    origin = f"{request.location.get('latitude')},{request.location.get('longitude')}"
                    destination = request.context.get("destination")
                    traffic_info = navigation.get_traffic_info(origin, destination)
                    
                    response_data["traffic_info"] = traffic_info
                    response_data["response"] = f"Traffic is {traffic_info.get('traffic_level', 'moderate')} on your route. Expected delay of {traffic_info.get('delay_minutes', '5-10')} minutes."
                    return response_data
                except Exception as e:
                    print(f"Error getting traffic info: {e}")
            
            # Fallback traffic response
            response_data["response"] = "Let me check the traffic conditions for you. Please make sure your location is enabled."
            return response_data
            
        # Handle route feature queries
        elif any(keyword in query_lower for keyword in ["flyover", "underpass", "bridge", "tunnel"]):
            feature = next((keyword for keyword in ["flyover", "underpass", "bridge", "tunnel"] if keyword in query_lower), "feature")
            response_data["query_type"] = "route_feature"
            response_data["feature"] = feature
            response_data["response"] = f"There's a {feature} ahead on your route. I'll guide you when we get closer."
            return response_data
            
        # Handle alternative route queries
        elif any(keyword in query_lower for keyword in ["shortcut", "faster", "quicker", "alternative", "another way"]):
            response_data["query_type"] = "alternative_route"
            response_data["response"] = "I'll check for alternatives on your route. Let me analyze the traffic conditions."
            return response_data
            
        # Handle nearby place queries
        elif any(keyword in query_lower for keyword in ["nearby", "close", "around", "find", "search"]):
            place_types = ["restaurant", "gas", "petrol", "fuel", "hotel", "hospital", "pharmacy", "atm", "bank", "cafe", "coffee"]
            found_type = next((place_type for place_type in place_types if place_type in query_lower), None)
            
            if found_type:
                response_data["query_type"] = "nearby_place"
                response_data["place_type"] = found_type
                
                # Try to find places if location is provided
                if request.location:
                    try:
                        location_str = f"{request.location.get('latitude')},{request.location.get('longitude')}"
                        search_term = found_type
                        if found_type in ["gas", "petrol", "fuel"]:
                            search_term = "gas station"
                        
                        places = navigation.find_places(search_term, location_str)
                        response_data["places"] = places
                        
                        if places.get("status") == "OK" and places.get("places"):
                            place_count = min(3, len(places.get("places", [])))
                            response_data["response"] = f"I found {place_count} {search_term}s nearby. The closest one is {places['places'][0]['name']}."
                            return response_data
                    except Exception as e:
                        print(f"Error finding places: {e}")
                
                response_data["response"] = f"I'll help you find {found_type}s nearby. Please make sure your location is enabled."
                return response_data
        
        # Default response
        response_data["response"] = "I'll help you with your navigation needs. Please provide more details or ask a specific question."
        return response_data
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing navigation query: {str(e)}")

# LLM routes
@app.post("/api/llm/generate")
async def generate_llm_response(request: LLMRequest):
    """Generate a response using the LLM"""
    if not llm:
        raise HTTPException(status_code=503, detail="LLM service not available")
    
    try:
        response = llm.generate_reply(
            request.prompt,
            max_new_tokens=request.max_tokens,
            temperature=request.temperature
        )
        
        if response and response.get("status") == "success":
            return {
                "status": "success",
                "response": response.get("response"),
                "tokens_used": response.get("tokens_used", 0)
            }
        else:
            return {
                "status": "error",
                "message": response.get("message", "Unknown error"),
                "response": response.get("response", "Failed to generate response")
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Wake word routes
@app.post("/api/wake/detect")
async def detect_wake_word(request: WakeWordRequest):
    """Detect wake word in text using improved method"""
    try:
        if not request.text:
            raise HTTPException(status_code=400, detail="Text is required")
        
        # Primary wake words
        primary_wake_words = ["suno saarthi", "hello saarthi"]
        
        # Variant spellings and phonetic matches
        variant_wake_words = [
            "suno sarathi", "suno sarthi", "suno saarti", 
            "sunno saarthi", "sonu saarthi", "soonu saarthi",
            "hey saarthi", "hi saarthi", "ok saarthi"
        ]
        
        text_lower = request.text.lower()
        
        # Check for primary wake words - exact match
        primary_detected = any(word in text_lower for word in primary_wake_words)
        
        # Check for variant wake words
        variant_detected = any(word in text_lower for word in variant_wake_words)
        
        # Determine confidence level
        confidence = 0.0
        if primary_detected:
            confidence = 0.95
        elif variant_detected:
            confidence = 0.85
        
        return {
            "detected": primary_detected or variant_detected,
            "confidence": confidence,
            "text": request.text,
            "wake_word_found": next((word for word in primary_wake_words + variant_wake_words if word in text_lower), None)
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid request: {str(e)}")

# Run the API server
if __name__ == "__main__":
    # Check if required API keys are available
    key_status = check_api_keys()
    missing = [k for k, v in key_status.items() if not v]
    
    if missing:
        print(f"WARNING: Missing API keys: {', '.join(missing)}")
        print("Some functionality may be limited.")
    
    # Start the server
    uvicorn.run("app:app", host=API_HOST, port=API_PORT, reload=DEBUG) 