from typing import Any, Dict, Optional

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
