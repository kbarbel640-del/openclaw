from pydantic import BaseModel
from typing import List, Optional

class SearchRequest(BaseModel):
    query: str

class SearchResponse(BaseModel):
    results: List[dict]

class PlaceDetails(BaseModel):
    name: Optional[str] = None
    formatted_address: Optional[str] = None
    location: Optional[dict] = None
    rating: Optional[float] = None
    website: Optional[str] = None
    formatted_phone_number: Optional[str] = None

class LocationResolveRequest(BaseModel):
    location: str

class LocationResolveResponse(BaseModel):
    resolved_address: str
