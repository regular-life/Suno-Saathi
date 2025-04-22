import json
from typing import Optional
import uuid
from collections import deque
import asyncio
from fastapi.responses import StreamingResponse
from datetime import datetime

from fastapi import APIRouter, HTTPException, Request

from core.config import CONFIG
from modules.llm_interface import generate_reply, session_manager, DEFAULT_CONTEXT
from modules.navigation import NavigationHandler

from .schemas import (
    DirectionsRequest,
    DirectionsResponse,
    GeocodeRequest,
    GeocodeResponse,
    LLMQueryRequest,
    LLMQueryResponse,
    NavigationQueryRequest,
    NavigationQueryResponse,
    PlacesRequest,
    PlacesResponse,
    TrafficRequest,
    TrafficResponse,
    WakeWordRequest,
    WakeWordResponse,
)

router = APIRouter(prefix="/api")

# Initialize navigation handler
navigation = NavigationHandler()

# Debug logs for wake word detection (keep track of recent logs)
voice_debug_logs = deque(maxlen=100)  # Store last 100 log entries

def add_voice_debug_log(message: str, log_type: str = "info"):
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S.%f')[:-3]
    log_entry = {
        "timestamp": timestamp,
        "message": message,
        "type": log_type
    }
    voice_debug_logs.append(log_entry)
    print(f"[VOICE DEBUG] {timestamp} - {message}")

# Navigation API routes - consolidated endpoints (supporting both GET and POST)
@router.get("/navigation/directions", response_model=DirectionsResponse)
async def get_directions(origin: str, destination: str, mode: str = "driving"):
    """Get directions between two locations via GET"""
    try:
        directions = navigation.get_directions(origin, destination, mode)
        return DirectionsResponse(status="success", routes=directions)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/navigation/places", response_model=PlacesResponse)
async def find_places(query: str, location: Optional[str] = None):
    """Find places based on a query string via GET"""
    try:
        places = navigation.find_places(query, location)
        return places
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/navigation/geocode", response_model=GeocodeResponse)
async def geocode_address(address: str):
    """Geocode an address to coordinates via GET"""
    try:
        result = navigation.geocode_address(address)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/navigation/traffic", response_model=TrafficResponse)
async def get_traffic(origin: str, destination: str):
    """Get traffic information between two points via GET"""
    try:
        traffic_info = navigation.get_traffic_info(origin, destination)
        return traffic_info
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/navigation/query", response_model=NavigationQueryResponse)
async def process_navigation_query(request: NavigationQueryRequest):
    """Process a natural language navigation query with session management"""
    if not request.query:
        raise HTTPException(status_code=400, detail="Query is required")

    try:
        # Extract session ID from context if available
        session_id = None
        if request.context and "session_id" in request.context:
            session_id = request.context["session_id"]
        
        # Create navigation-specific context
        nav_context = {}
        if request.context:
            nav_context = {k: v for k, v in request.context.items() if k != "session_id"}
        
        # Generate prompt with context
        context_text = ""
        if nav_context:
            context_text = f"Navigation Context: {json.dumps(nav_context)}\n"
        
        # Use session manager to get response
        if session_id:
            # Use existing session
            response = session_manager.get_response(session_id, f"{context_text}Navigation query: {request.query}")
            
            if response and response.get("status") == "success":
                return NavigationQueryResponse(
                    query_type="llm_processed",
                    response=response.get("response"),
                    processed_query=request.query,
                )
        else:
            # Create new session with navigation-specific prompt
            prompt = f"{context_text}User's navigation query: {request.query}\n\nInterpret this navigation-related query and provide a helpful response:"

                # Generate response using LLM without session (legacy mode)
            response = generate_reply(prompt)

        # Extract response text
        if response and response.get("status") == "success":
            return NavigationQueryResponse(
                query_type="llm_processed",
                response=response.get("response"),
                processed_query=request.query,
            )

        # Fallback to rule-based interpretation if LLM response is not successful
        query_lower = request.query.lower()
        response_data = NavigationQueryResponse(
            query_type="general_navigation",
            response="",
            original_query=request.query,
        )

        # Handle traffic-related queries
        if any(keyword in query_lower for keyword in ["traffic", "congestion", "jam", "busy"]):
            response_data.query_type = "traffic"

            # Try to get actual traffic if location is provided
            if request.location and request.context and request.context.get("destination"):
                try:
                    origin = f"{request.location.get('latitude')},{request.location.get('longitude')}"
                    destination = request.context.get("destination")
                    traffic_info = navigation.get_traffic_info(origin, destination)

                    response_data.traffic_info = traffic_info
                    response_data.response = f"Traffic is {traffic_info.get('traffic_level', 'moderate')} on your route. Expected delay of {traffic_info.get('delay_minutes', '5-10')} minutes."
                    return response_data
                except Exception as e:
                    print(f"Error getting traffic info: {e}")

            # Fallback traffic response
            response_data.response = (
                "Let me check the traffic conditions for you. Please make sure your location is enabled."
                )
            return response_data

        # Default response
        response_data.response = (
            "I'll help you with your navigation needs. Please provide more details or ask a specific question."
        )
        return response_data

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing navigation query: {str(e)}")


# Wake word routes
@router.post("/wake/detect", response_model=WakeWordResponse)
async def detect_wake_word(request: WakeWordRequest):
    """Detect wake word in text using improved method"""
    try:
        if not request.text:
            raise HTTPException(status_code=400, detail="Text is required")

        # Debug output
        add_voice_debug_log(f"Received text: '{request.text}'", "wake_word")
        
        # Primary wake words
        primary_wake_words = ["suno saarthi", "hello saarthi"]

        # Variant spellings and phonetic matches
        variant_wake_words = [
            "suno sarathi",
            "suno sarthi",
            "suno saarti",
            "sunno saarthi",
            "sonu saarthi",
            "soonu saarthi",
            "hey saarthi",
            "hi saarthi",
            "ok saarthi",
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

        # Debug output
        detected = primary_detected or variant_detected
        wake_word_found = next(
            (word for word in primary_wake_words + variant_wake_words if word in text_lower),
            None,
        )
        add_voice_debug_log(f"Detected: {detected}, Confidence: {confidence}, Wake word found: {wake_word_found}", 
                           "wake_word_result")
        
        return WakeWordResponse(
            detected=detected,
            confidence=confidence,
            text=request.text,
            wake_word_found=wake_word_found,
        )
    except Exception as e:
        add_voice_debug_log(f"Error: {str(e)}", "error")
        raise HTTPException(status_code=400, detail=f"Invalid request: {str(e)}")


@router.post("/llm/query", response_model=LLMQueryResponse)
async def process_llm_query(request: LLMQueryRequest):
    """Process a query using the LLM and return a response with session management"""
    if not request.query:
        raise HTTPException(status_code=400, detail="Query is required")

    # Debug output
    add_voice_debug_log(f"Received query: '{request.query}'", "command")
    add_voice_debug_log(f"Context: {request.context}", "command_context")
    
    try:
        # Get or create the session ID
        session_id = None
        context = None
        
        # Check if the context is a string (possibly a session ID)
        if request.context and isinstance(request.context, str):
            session_id = request.context
        # Otherwise, it might be a dictionary with navigation context
        elif request.context and isinstance(request.context, dict):
            context = request.context
            if 'session_id' in context:
                session_id = context.pop('session_id')
        
        if not session_id:
            session_id = str(uuid.uuid4())
        
        # Create custom prompt if we have context
        custom_prompt = None
        if context:
            # Format the context for better readability in the prompt
            context_str = "\n".join([f"{key}: {value}" for key, value in context.items()])
            custom_prompt = DEFAULT_CONTEXT + f"\n\nNavigation Context:\n{context_str}\n"
        
        # Get response using SessionManager with optional custom prompt
        if custom_prompt:
            # Get or create session with custom prompt
            if not session_manager.get_session(session_id):
                session_id = session_manager.create_session(session_id, custom_prompt)
            
        # Get response - the SessionManager will already clean the response
        response = session_manager.get_response(session_id, request.query)
        
        # Extract response text and double-check that it's clean
        if response and response.get("status") == "success":
            clean_response = response.get("response", "")
            
            # Apply a secondary cleaning if needed to ensure no debugging text remains
            from modules.llm_interface import clean_llm_response
            clean_response = clean_llm_response(clean_response)
            
            return LLMQueryResponse(
                response=clean_response,
                status="success",
                metadata={"session_id": response.get("session_id")}
            )
        else:
            return LLMQueryResponse(
                response="I couldn't process your request at this time.",
                status="error",
                metadata={"session_id": session_id}
            )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/debug/voice-logs")
async def stream_voice_debug_logs():
    """Stream voice recognition debug logs as server-sent events"""
    
    async def event_generator():
        # First, yield all existing logs
        for log in list(voice_debug_logs):
            yield f"data: {json.dumps(log)}\n\n"
        
        # Set up a counter to track position in the log queue
        last_idx = len(voice_debug_logs)
        
        # Keep connection open and stream new logs as they arrive
        while True:
            if len(voice_debug_logs) > last_idx:
                # New logs available
                new_logs = list(voice_debug_logs)[last_idx:]
                for log in new_logs:
                    yield f"data: {json.dumps(log)}\n\n"
                last_idx = len(voice_debug_logs)
            
            # Sleep to avoid excessive CPU usage
            await asyncio.sleep(0.5)
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )
