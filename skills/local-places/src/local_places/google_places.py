import os
import requests
from .schemas import SearchRequest, SearchResponse, PlaceDetails, LocationResolveRequest, LocationResolveResponse

def get_api_key():
    key = os.getenv("GOOGLE_PLACES_API_KEY")
    if not key:
        raise ValueError("Missing GOOGLE_PLACES_API_KEY in .env")
    return key

BASE_URL = "https://maps.googleapis.com/maps/api/place"

def search_places(request: SearchRequest) -> SearchResponse:
    url = f"{BASE_URL}/textsearch/json"
    params = {"query": request.query, "key": get_api_key()}
    resp = requests.get(url, params=params)
    return SearchResponse(results=resp.json().get("results", []))

def get_place_details(place_id: str) -> PlaceDetails:
    url = f"{BASE_URL}/details/json"
    params = {"place_id": place_id, "key": get_api_key(), "fields": "name,formatted_address,geometry,rating,formatted_phone_number,website"}
    resp = requests.get(url, params=params)
    r = resp.json().get("result", {})
    return PlaceDetails(name=r.get("name"), formatted_address=r.get("formatted_address"), location=r.get("geometry", {}).get("location"), rating=r.get("rating"), website=r.get("website"))

def resolve_locations(request: LocationResolveRequest) -> LocationResolveResponse:
    url = "https://maps.googleapis.com/maps/api/geocode/json"
    params = {"latlng": request.location, "key": get_api_key()}
    resp = requests.get(url, params=params)
    data = resp.json()
    addr = data["results"][0]["formatted_address"] if data.get("results") else "Unknown"
    return LocationResolveResponse(resolved_address=addr)
