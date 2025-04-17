from typing import Any, Dict, List, Optional

from pydantic import BaseModel


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


class NavigationQueryRequest(BaseModel):
    query: str
    location: Optional[Dict[str, float]] = None
    context: Optional[Dict[str, Any]] = None


class WakeWordRequest(BaseModel):
    text: str


class Location(BaseModel):
    lat: float
    lng: float


class Distance(BaseModel):
    text: str
    value: int


class Duration(BaseModel):
    text: str
    value: int


class Points(BaseModel):
    points: str


class Step(BaseModel):
    distance: Distance
    duration: Duration
    end_location: Location
    html_instructions: str
    polyline: Points
    start_location: Location
    travel_mode: str
    maneuver: Optional[str] = None


class Bounds(BaseModel):
    northeast: Location
    southwest: Location


class Leg(BaseModel):
    distance: Distance
    duration: Duration
    end_address: str
    end_location: Location
    start_address: str
    start_location: Location
    steps: List[Step]
    traffic_speed_entry: List[Any] = []
    via_waypoint: List[Any] = []


class OverviewPolyline(BaseModel):
    points: str


class Route(BaseModel):
    bounds: Bounds
    copyrights: str
    legs: List[Leg]
    overview_polyline: OverviewPolyline
    summary: str
    warnings: List[str] = []
    waypoint_order: List[int] = []


class DirectionsResponse(BaseModel):
    status: str
    routes: List[Route]
    error: Optional[str] = None


class Place(BaseModel):
    place_id: str
    name: str
    address: str
    location: Location
    rating: float = 0.0
    user_ratings_total: int = 0
    types: List[str] = []
    price_level: int = 0
    business_status: str = ""
    opening_hours: Dict[str, Any] = {}
    permanently_closed: bool = False
    photos: Optional[List[str]] = None


class PlacesResponse(BaseModel):
    status: str
    places: List[Place]
    error: Optional[str] = None


class Geometry(BaseModel):
    location: Location
    viewport: Dict[str, Location]
    location_type: str


class GeocodeResult(BaseModel):
    formatted_address: str
    geometry: Geometry
    place_id: str
    types: List[str]
    address_components: List[Dict[str, Any]]


class GeocodeResponse(BaseModel):
    status: str
    results: List[GeocodeResult]
    error: Optional[str] = None


class TrafficInfo(BaseModel):
    normal_duration: str
    traffic_duration: str
    has_traffic: bool
    traffic_level: str
    delay_minutes: int


class TrafficResponse(BaseModel):
    status: str
    traffic_info: Optional[TrafficInfo] = None
    error: Optional[str] = None


class NavigationQueryResponse(BaseModel):
    query_type: str
    response: str
    original_query: Optional[str] = None
    processed_query: Optional[str] = None
    traffic_info: Optional[TrafficInfo] = None
    feature: Optional[str] = None
    place_type: Optional[str] = None
    places: Optional[PlacesResponse] = None


class WakeWordResponse(BaseModel):
    detected: bool
    confidence: float
    text: str
    wake_word_found: Optional[str] = None


class ErrorResponse(BaseModel):
    detail: str
