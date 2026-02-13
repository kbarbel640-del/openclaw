"""Gateway types and models.

This module defines data structures for the Gateway HTTP server.
"""

from typing import Any

from pydantic import BaseModel


class GatewayAuth(BaseModel):
    """Gateway authentication information."""

    authenticated: bool
    source: str  # "password", "token", "local-direct"
    client_ip: str | None = None


class HealthCheckResponse(BaseModel):
    """Health check response."""

    status: str = "ok"
    version: str | None = None
    uptime_seconds: float | None = None
    config_loaded: bool = True


class SessionListResponse(BaseModel):
    """Session list response."""

    sessions: dict[str, dict[str, Any]]
    count: int


class ConfigSnapshotResponse(BaseModel):
    """Configuration snapshot response."""

    config: dict[str, Any]
    path: str | None = None
    loaded_at: int | None = None
