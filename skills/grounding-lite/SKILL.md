---
name: grounding-lite
description: Google Maps Grounding Lite MCP for AI-powered location search, weather, and routes via mcporter.
homepage: https://developers.google.com/maps/ai/grounding-lite
metadata: {"clawdbot":{"emoji":"🗺️","requires":{"bins":["mcporter"],"env":["GOOGLE_MAPS_API_KEY"]},"primaryEnv":"GOOGLE_MAPS_API_KEY","install":[{"id":"node","kind":"node","package":"mcporter","bins":["mcporter"],"label":"Install mcporter (npm)"}]}}
---

# Grounding Lite

Google Maps Grounding Lite MCP provides AI-grounded location data. Experimental (pre-GA), free during preview.

## When to use each tool

- **search_places**: Use when the user asks about places, businesses, restaurants, addresses, or points of interest. Returns AI-generated summaries with Google Maps links.
- **lookup_weather**: Use when the user asks about weather conditions or forecasts for a location. Works best with US locations.
- **compute_routes**: Use when the user asks about travel distance, duration, or directions between two locations.

## Setup (one-time)

```
mcporter config add grounding-lite --url https://mapstools.googleapis.com/mcp --header "X-Goog-Api-Key=$GOOGLE_MAPS_API_KEY"
```

## Commands

Search places:
- `mcporter call grounding-lite.search_places text_query="coffee shops near Central Park"`
- With location bias: `mcporter call grounding-lite.search_places text_query="pizza" location_bias='{"center":{"latitude":40.7829,"longitude":-73.9654},"radius":2000}'`

Weather lookup:
- `mcporter call grounding-lite.lookup_weather location='{"address":"San Francisco, CA"}' units_system=IMPERIAL`
- By coordinates: `mcporter call grounding-lite.lookup_weather location='{"lat_lng":{"latitude":37.77,"longitude":-122.41}}'`

Compute routes:
- `mcporter call grounding-lite.compute_routes origin='{"address":"San Francisco, CA"}' destination='{"address":"Los Angeles, CA"}' travel_mode=DRIVE`
- Travel modes: DRIVE (default), WALK

List available tools:
- `mcporter list grounding-lite --schema`

## Parameters

**search_places**:
- `text_query` (required): Natural language search query
- `location_bias` (optional): Prioritize results near a location

**lookup_weather**:
- `location` (required): Address, coordinates, or place_id
- `units_system` (optional): METRIC or IMPERIAL
- `date`, `hour` (optional): For forecasts

**compute_routes**:
- `origin`, `destination` (required): Address, coordinates, or place_id
- `travel_mode` (optional): DRIVE or WALK

## Notes

- Rate limits: search_places (100 QPM), lookup_weather (300 QPM), compute_routes (300 QPM)
- Weather has regional restrictions; US locations work reliably
- Include Google Maps links from responses in user-facing output
- Restrict API key to `mapstools.googleapis.com` in Cloud Console
