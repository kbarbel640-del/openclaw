import logging
import os
import uvicorn
from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from local_places.schemas import SearchRequest, SearchResponse, PlaceDetails, LocationResolveRequest, LocationResolveResponse
from local_places.google_places import search_places, get_place_details, resolve_locations

app = FastAPI(title="Nails Location Service")
logger = logging.getLogger("local_places")

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logger.error(f"Validation error: {exc}")
    return JSONResponse(status_code=422, content=jsonable_encoder({"detail": exc.errors()}))

@app.post("/places/search", response_model=SearchResponse)
def api_search(req: SearchRequest): return search_places(req)

@app.get("/places/{place_id}", response_model=PlaceDetails)
def api_details(place_id: str): return get_place_details(place_id)

@app.post("/locations/resolve", response_model=LocationResolveResponse)
def api_resolve(req: LocationResolveRequest): return resolve_locations(req)

if __name__ == "__main__":
    uvicorn.run("local_places.main:app", host="127.0.0.1", port=8000, reload=True)
