import json
import uuid
from typing import Optional

from fastapi import APIRouter, HTTPException, Request

from core.config import CONFIG
from modules.llm_interface import generate_reply, session_manager
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
