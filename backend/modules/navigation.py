"""
Navigation Module for Suno-Saarthi

This module handles all navigation-related functionality, including:
- Getting directions using Directions API
- Finding nearby places using Places API
- Geocoding addresses using Geocoding API
- Getting traffic information using Directions API
"""

import time
from typing import Any, Dict, List, Optional, Union

import googlemaps

from core.config import CONFIG


class NavigationHandler:
    """
    Handler for navigation-related functionality using Google Maps Platform APIs
    """

    def __init__(self):
        """Initialize the navigation handler with necessary API clients"""
        self.api_key = CONFIG.API_KEYS.GOOGLE
        self.client = googlemaps.Client(key=self.api_key)
        print("Google Maps Platform client initialized successfully")

    def get_directions(
        self,
        origin: Union[str, Dict[str, float]],
        destination: Union[str, Dict[str, float]],
        mode: str = "driving",
        waypoints: Optional[List[Union[str, Dict[str, float]]]] = None,
        departure_time: Optional[int] = None,
        arrival_time: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Get directions from origin to destination using Directions API

        Args:
            origin: Starting location (address, coordinates, or place ID)
            destination: Ending location (address, coordinates, or place ID)
            mode: Transportation mode (driving, walking, bicycling, transit)
            waypoints: List of intermediate points to visit
            departure_time: When to depart (Unix timestamp)
            arrival_time: When to arrive (Unix timestamp)

        Returns:
            Dictionary with route information
        """
        # Validate mode
        valid_modes = ["driving", "walking", "bicycling", "transit"]
        if mode not in valid_modes:
            mode = "driving"

        try:
            # Get directions with the Directions API
            directions = self.client.directions(
                origin=origin,
                destination=destination,
                mode=mode,
                waypoints=waypoints,
                departure_time=departure_time,
                arrival_time=arrival_time,
                alternatives=True,
                language="en",
                units="metric",
            )
            return directions
        except Exception as e:
            print(f"Error getting directions: {e}")
            raise e

    def find_places(
        self,
        query: str,
        location: Optional[Union[str, Dict[str, float]]] = None,
        radius: Optional[int] = None,
        type: Optional[str] = None,
        language: str = "en",
    ) -> Dict[str, Any]:
        """
        Find places based on a query string using Places API

        Args:
            query: The search query
            location: Optional location context (lat,lng or address)
            radius: Search radius in meters
            type: Place type filter
            language: Results language

        Returns:
            Dictionary with place results
        """
        try:
            if location:
                # If location is provided, use nearby search
                if not self._is_coordinates(location):
                    geocode_result = self.geocode_address(location)
                    if geocode_result.get("status") == "OK":
                        location = geocode_result["results"][0]["geometry"]["location"]
                    else:
                        return self._text_search_places(query, language=language)

                # Use nearby search with location
                places_result = self.client.places_nearby(
                    location=location,
                    keyword=query,
                    radius=radius,
                    type=type,
                    language=language,
                )
            else:
                # Use text search without location context
                return self._text_search_places(query, language=language)

            return self._process_places_response(places_result)
        except Exception as e:
            print(f"Error finding places: {e}")
            return {"status": "error", "error": str(e), "places": []}

    def _text_search_places(self, query: str, language: str = "en") -> Dict[str, Any]:
        """Helper method for text search using Places API"""
        places_result = self.client.places(
            query=query,
            type="establishment",
            language=language,
        )
        return self._process_places_response(places_result)

    def geocode_address(
        self,
        address: str,
        components: Optional[Dict[str, str]] = None,
        bounds: Optional[Dict[str, Dict[str, float]]] = None,
        region: Optional[str] = None,
        language: str = "en",
    ) -> Dict[str, Any]:
        """
        Geocode an address to coordinates using Geocoding API

        Args:
            address: The address to geocode
            components: Additional address components to filter by
            bounds: Bounding box to bias results
            region: Region code to bias results
            language: Results language

        Returns:
            Dictionary with geocoding results
        """
        try:
            geocode_result = self.client.geocode(
                address=address,
                components=components,
                bounds=bounds,
                region=region,
                language=language,
            )
            return {
                "status": "OK" if geocode_result else "ZERO_RESULTS",
                "results": geocode_result,
            }
        except Exception as e:
            print(f"Error geocoding address: {e}")
            return {"status": "error", "error": str(e), "results": []}

    def get_traffic_info(
        self,
        origin: Union[str, Dict[str, float]],
        destination: Union[str, Dict[str, float]],
        departure_time: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Get traffic information between two points using Directions API

        Args:
            origin: Starting location
            destination: Ending location
            departure_time: When to depart (Unix timestamp)

        Returns:
            Dictionary with traffic information
        """
        try:
            if not departure_time:
                departure_time = int(time.time())

            # Get directions with traffic
            with_traffic = self.client.directions(
                origin=origin,
                destination=destination,
                mode="driving",
                departure_time=departure_time,
            )

            # Get directions without traffic (using a past time)
            without_traffic = self.client.directions(
                origin=origin,
                destination=destination,
                mode="driving",
                departure_time=departure_time - 86400,  # 24 hours ago
            )

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

            return {
                "status": "error",
                "error": "Could not get traffic information",
                "has_traffic": False,
                "traffic_level": "unknown",
            }
        except Exception as e:
            print(f"Error getting traffic info: {e}")
            return {
                "status": "error",
                "error": str(e),
                "has_traffic": False,
                "traffic_level": "unknown",
            }

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
                "price_level": place.get("price_level", 0),
                "business_status": place.get("business_status", ""),
                "opening_hours": place.get("opening_hours", {}),
                "permanently_closed": place.get("permanently_closed", False),
            }

            # Add photos if available
            if "photos" in place:
                photo_refs = [photo.get("photo_reference", "") for photo in place["photos"][:3]]
                processed_place["photos"] = photo_refs

            result["places"].append(processed_place)

        return result

    def _is_coordinates(self, location: Union[str, Dict[str, float]]) -> bool:
        """Check if a string represents coordinates (lat,lng)"""
        if isinstance(location, dict):
            return "lat" in location and "lng" in location
        if not isinstance(location, str):
            return False
        
        try:
            parts = location.split(",")
            if len(parts) != 2:
                return False

            lat, lng = float(parts[0]), float(parts[1])
            return -90 <= lat <= 90 and -180 <= lng <= 180
        except (ValueError, TypeError, AttributeError):
            return False
