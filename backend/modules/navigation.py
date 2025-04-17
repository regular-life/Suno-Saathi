"""
Navigation Module for Suno-Saarthi

This module handles all navigation-related functionality, including:
- Getting directions
- Finding nearby places
- Geocoding addresses
- Getting traffic information
"""

import json
import os
import time
from typing import Any, Dict, List, Optional
from urllib.parse import quote

import googlemaps
import requests

from core.config import CONFIG


class NavigationHandler:
    """
    Handler for navigation-related functionality using Google Maps API
    """

    def __init__(self):
        """Initialize the navigation handler with necessary API clients"""
        self.api_key = CONFIG.API_KEYS.GOOGLE
        self.client = None

        if self.api_key:
            try:
                self.client = googlemaps.Client(key=self.api_key)
                print("Google Maps client initialized successfully")
            except Exception as e:
                print(f"Error initializing Google Maps client: {e}")
                # Continue without client, will use direct API calls as fallback
        else:
            print("Warning: GOOGLE_API_KEY not set. Navigation functionality will be limited.")

    def get_directions(self, origin: str, destination: str, mode: str = "driving") -> Dict[str, Any]:
        """
        Get directions from origin to destination

        Args:
            origin: Starting location (address, coordinates, or place ID)
            destination: Ending location (address, coordinates, or place ID)
            mode: Transportation mode (driving, walking, bicycling, transit)

        Returns:
            Dictionary with route information
        """
        # Validate mode
        valid_modes = ["driving", "walking", "bicycling", "transit"]
        if mode not in valid_modes:
            mode = "driving"

        try:
            if self.client:
                # Use the googlemaps client
                directions = self.client.directions(
                    origin=origin, destination=destination, mode=mode, alternatives=True
                )

                # Process and enhance the response
                return self._process_directions_response(directions)
            else:
                # Fallback: direct API call
                return self._direct_directions_call(origin, destination, mode)
        except Exception as e:
            print(f"Error getting directions: {e}")
            # Return a minimal error response
            return {"status": "error", "error": str(e), "routes": []}

    def find_places(self, query: str, location: Optional[str] = None) -> Dict[str, Any]:
        """
        Find places based on a query string

        Args:
            query: The search query
            location: Optional location context (lat,lng or address)

        Returns:
            Dictionary with place results
        """
        try:
            if self.client:
                # Use the googlemaps client for more accurate results
                if location:
                    # If location is provided, use nearby search
                    # First geocode the location if it's not coordinates
                    if not self._is_coordinates(location):
                        geocode_result = self.geocode_address(location)
                        if geocode_result.get("status") == "OK":
                            location = f"{geocode_result['results'][0]['geometry']['location']['lat']},{geocode_result['results'][0]['geometry']['location']['lng']}"
                        else:
                            # If geocoding fails, use text search without location
                            return self._text_search_places(query)

                    # Parse location into lat, lng
                    lat, lng = map(float, location.split(","))

                    # Use nearby search with location
                    places_result = self.client.places_nearby(location=(lat, lng), keyword=query, rank_by="distance")
                else:
                    # Use text search without location context
                    return self._text_search_places(query)

                # Process the results
                return self._process_places_response(places_result)
            else:
                # Fallback: direct API call
                return self._direct_places_call(query, location)
        except Exception as e:
            print(f"Error finding places: {e}")
            return {"status": "error", "error": str(e), "places": []}

    def _text_search_places(self, query: str) -> Dict[str, Any]:
        """Helper method for text search"""
        if self.client:
            places_result = self.client.places(query=query, type="establishment")
            return self._process_places_response(places_result)
        else:
            return self._direct_places_call(query, None)

    def geocode_address(self, address: str) -> Dict[str, Any]:
        """
        Geocode an address to coordinates

        Args:
            address: The address to geocode

        Returns:
            Dictionary with geocoding results
        """
        try:
            if self.client:
                geocode_result = self.client.geocode(address)
                return {
                    "status": "OK" if geocode_result else "ZERO_RESULTS",
                    "results": geocode_result,
                }
            else:
                # Fallback: direct API call
                return self._direct_geocode_call(address)
        except Exception as e:
            print(f"Error geocoding address: {e}")
            return {"status": "error", "error": str(e), "results": []}

    def get_traffic_info(self, origin: str, destination: str) -> Dict[str, Any]:
        """
        Get traffic information between two points

        Args:
            origin: Starting location
            destination: Ending location

        Returns:
            Dictionary with traffic information
        """
        try:
            # Get directions with and without traffic
            if self.client:
                # With traffic - departure_time=now
                with_traffic = self.client.directions(
                    origin=origin,
                    destination=destination,
                    mode="driving",
                    departure_time=int(time.time()),
                )

                # Without traffic
                without_traffic = self.client.directions(origin=origin, destination=destination, mode="driving")

                # Extract durations
                if with_traffic and without_traffic:
                    traffic_duration = with_traffic[0]["legs"][0]["duration_in_traffic"]["value"]
                    normal_duration = without_traffic[0]["legs"][0]["duration"]["value"]

                    # Calculate traffic level
                    traffic_ratio = traffic_duration / normal_duration if normal_duration > 0 else 1

                    if traffic_ratio < 1.1:
                        traffic_level = "light"
                    elif traffic_ratio < 1.3:
                        traffic_level = "moderate"
                    elif traffic_ratio < 1.5:
                        traffic_level = "heavy"
                    else:
                        traffic_level = "severe"

                    return {
                        "status": "success",
                        "normal_duration": without_traffic[0]["legs"][0]["duration"]["text"],
                        "traffic_duration": with_traffic[0]["legs"][0]["duration_in_traffic"]["text"],
                        "has_traffic": traffic_duration > normal_duration * 1.1,
                        "traffic_level": traffic_level,
                        "delay_minutes": int((traffic_duration - normal_duration) / 60),
                    }

            # Fallback: direct API call or estimated response
            return self._direct_traffic_call(origin, destination)
        except Exception as e:
            print(f"Error getting traffic info: {e}")
            return {
                "status": "error",
                "error": str(e),
                "has_traffic": False,
                "traffic_level": "unknown",
            }

    # Helper methods for processing API responses
    def _process_directions_response(self, directions: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Process and enhance the directions API response"""
        if not directions:
            return {"status": "ZERO_RESULTS", "routes": []}

        # Extract main route information
        result = {"status": "OK", "routes": []}

        for route in directions:
            processed_route = {
                "summary": route.get("summary", ""),
                "distance": route["legs"][0]["distance"],
                "duration": route["legs"][0]["duration"],
                "start_address": route["legs"][0]["start_address"],
                "end_address": route["legs"][0]["end_address"],
                "start_location": route["legs"][0]["start_location"],
                "end_location": route["legs"][0]["end_location"],
                "steps": [],
            }

            # Add traffic duration if available
            if "duration_in_traffic" in route["legs"][0]:
                processed_route["duration_in_traffic"] = route["legs"][0]["duration_in_traffic"]

            # Process steps
            for step in route["legs"][0]["steps"]:
                processed_step = {
                    "distance": step["distance"],
                    "duration": step["duration"],
                    "instructions": step["html_instructions"],
                    "start_location": step["start_location"],
                    "end_location": step["end_location"],
                    "maneuver": step.get("maneuver", ""),
                }
                processed_route["steps"].append(processed_step)

            result["routes"].append(processed_route)

        return result

    def _process_places_response(self, places_result: Dict[str, Any]) -> Dict[str, Any]:
        """Process and enhance the places API response"""
        if not places_result or "results" not in places_result:
            return {"status": "ZERO_RESULTS", "places": []}

        result = {"status": places_result.get("status", "OK"), "places": []}

        for place in places_result["results"]:
            processed_place = {
                "place_id": place.get("place_id", ""),
                "name": place.get("name", ""),
                "address": place.get("vicinity", place.get("formatted_address", "")),
                "location": place.get("geometry", {}).get("location", {}),
                "rating": place.get("rating", 0),
                "user_ratings_total": place.get("user_ratings_total", 0),
                "types": place.get("types", []),
            }

            # Add photos if available
            if "photos" in place:
                photo_refs = [photo.get("photo_reference", "") for photo in place["photos"][:3]]
                processed_place["photos"] = photo_refs

            result["places"].append(processed_place)

        return result

    # Fallback direct API call methods
    def _direct_directions_call(self, origin: str, destination: str, mode: str) -> Dict[str, Any]:
        """Make a direct call to the Directions API"""
        if not self.api_key:
            return self._generate_mock_directions(origin, destination, mode)

        url = f"https://maps.googleapis.com/maps/api/directions/json?origin={quote(origin)}&destination={quote(destination)}&mode={mode}&key={self.api_key}"

        try:
            response = requests.get(url)
            data = response.json()
            return self._process_directions_response(data.get("routes", []))
        except Exception as e:
            print(f"Error in direct directions call: {e}")
            return self._generate_mock_directions(origin, destination, mode)

    def _direct_places_call(self, query: str, location: Optional[str]) -> Dict[str, Any]:
        """Make a direct call to the Places API"""
        if not self.api_key:
            return self._generate_mock_places(query)

        # Determine which API to use
        if location and self._is_coordinates(location):
            # Nearby search with location
            lat, lng = map(float, location.split(","))
            url = f"https://maps.googleapis.com/maps/api/place/nearbysearch/json?location={lat},{lng}&keyword={quote(query)}&rankby=distance&key={self.api_key}"
        else:
            # Text search
            url = f"https://maps.googleapis.com/maps/api/place/textsearch/json?query={quote(query)}&key={self.api_key}"

        try:
            response = requests.get(url)
            data = response.json()
            return self._process_places_response(data)
        except Exception as e:
            print(f"Error in direct places call: {e}")
            return self._generate_mock_places(query)

    def _direct_geocode_call(self, address: str) -> Dict[str, Any]:
        """Make a direct call to the Geocoding API"""
        if not self.api_key:
            return self._generate_mock_geocode(address)

        url = f"https://maps.googleapis.com/maps/api/geocode/json?address={quote(address)}&key={self.api_key}"

        try:
            response = requests.get(url)
            return response.json()
        except Exception as e:
            print(f"Error in direct geocode call: {e}")
            return self._generate_mock_geocode(address)

    def _direct_traffic_call(self, origin: str, destination: str) -> Dict[str, Any]:
        """Estimate traffic or make direct call"""
        # First try to get directions with traffic
        if not self.api_key:
            return self._generate_mock_traffic()

        url = f"https://maps.googleapis.com/maps/api/directions/json?origin={quote(origin)}&destination={quote(destination)}&departure_time=now&key={self.api_key}"

        try:
            response = requests.get(url)
            data = response.json()

            if data.get("status") == "OK" and data.get("routes"):
                leg = data["routes"][0]["legs"][0]
                # Check if we have traffic info
                if "duration_in_traffic" in leg:
                    traffic_duration = leg["duration_in_traffic"]["value"]
                    normal_duration = leg["duration"]["value"]

                    # Calculate traffic level
                    traffic_ratio = traffic_duration / normal_duration if normal_duration > 0 else 1

                    if traffic_ratio < 1.1:
                        traffic_level = "light"
                    elif traffic_ratio < 1.3:
                        traffic_level = "moderate"
                    elif traffic_ratio < 1.5:
                        traffic_level = "heavy"
                    else:
                        traffic_level = "severe"

                    return {
                        "status": "success",
                        "normal_duration": leg["duration"]["text"],
                        "traffic_duration": leg["duration_in_traffic"]["text"],
                        "has_traffic": traffic_duration > normal_duration * 1.1,
                        "traffic_level": traffic_level,
                        "delay_minutes": int((traffic_duration - normal_duration) / 60),
                    }

            # If we didn't get traffic info, return a mock response
            return self._generate_mock_traffic()
        except Exception as e:
            print(f"Error in direct traffic call: {e}")
            return self._generate_mock_traffic()

    # Utility methods
    def _is_coordinates(self, location: str) -> bool:
        """Check if a string represents coordinates (lat,lng)"""
        try:
            parts = location.split(",")
            if len(parts) != 2:
                return False

            lat, lng = float(parts[0]), float(parts[1])
            return -90 <= lat <= 90 and -180 <= lng <= 180
        except (ValueError, TypeError):
            return False

    # Mock response generators for when API keys are missing
    def _generate_mock_directions(self, origin: str, destination: str, mode: str) -> Dict[str, Any]:
        """Generate a mock directions response"""
        print("Generating mock directions response")
        return {
            "status": "OK",
            "routes": [
                {
                    "summary": f"Route from {origin} to {destination}",
                    "distance": {"text": "5 km", "value": 5000},
                    "duration": {"text": "15 mins", "value": 900},
                    "start_address": origin,
                    "end_address": destination,
                    "start_location": {"lat": 0, "lng": 0},
                    "end_location": {"lat": 0, "lng": 0},
                    "steps": [
                        {
                            "distance": {"text": "1 km", "value": 1000},
                            "duration": {"text": "3 mins", "value": 180},
                            "instructions": "Head north on Main St",
                            "start_location": {"lat": 0, "lng": 0},
                            "end_location": {"lat": 0, "lng": 0},
                            "maneuver": "",
                        },
                        {
                            "distance": {"text": "2 km", "value": 2000},
                            "duration": {"text": "6 mins", "value": 360},
                            "instructions": "Turn right onto Broadway",
                            "start_location": {"lat": 0, "lng": 0},
                            "end_location": {"lat": 0, "lng": 0},
                            "maneuver": "turn-right",
                        },
                        {
                            "distance": {"text": "2 km", "value": 2000},
                            "duration": {"text": "6 mins", "value": 360},
                            "instructions": "Turn left onto Park Ave",
                            "start_location": {"lat": 0, "lng": 0},
                            "end_location": {"lat": 0, "lng": 0},
                            "maneuver": "turn-left",
                        },
                    ],
                }
            ],
        }

    def _generate_mock_places(self, query: str) -> Dict[str, Any]:
        """Generate a mock places response"""
        print("Generating mock places response")
        return {
            "status": "OK",
            "places": [
                {
                    "place_id": "mock_place_1",
                    "name": f"{query} Place 1",
                    "address": "123 Main St",
                    "location": {"lat": 0, "lng": 0},
                    "rating": 4.5,
                    "user_ratings_total": 100,
                    "types": ["point_of_interest", "establishment"],
                },
                {
                    "place_id": "mock_place_2",
                    "name": f"{query} Place 2",
                    "address": "456 Broadway",
                    "location": {"lat": 0, "lng": 0},
                    "rating": 4.0,
                    "user_ratings_total": 75,
                    "types": ["point_of_interest", "establishment"],
                },
                {
                    "place_id": "mock_place_3",
                    "name": f"{query} Place 3",
                    "address": "789 Park Ave",
                    "location": {"lat": 0, "lng": 0},
                    "rating": 3.5,
                    "user_ratings_total": 50,
                    "types": ["point_of_interest", "establishment"],
                },
            ],
        }

    def _generate_mock_geocode(self, address: str) -> Dict[str, Any]:
        """Generate a mock geocode response"""
        print("Generating mock geocode response")
        return {
            "status": "OK",
            "results": [
                {
                    "formatted_address": address,
                    "geometry": {"location": {"lat": 0, "lng": 0}},
                    "place_id": "mock_place_id",
                }
            ],
        }

    def _generate_mock_traffic(self) -> Dict[str, Any]:
        """Generate a mock traffic response"""
        print("Generating mock traffic response")
        return {
            "status": "success",
            "normal_duration": "15 mins",
            "traffic_duration": "20 mins",
            "has_traffic": True,
            "traffic_level": "moderate",
            "delay_minutes": 5,
        }
