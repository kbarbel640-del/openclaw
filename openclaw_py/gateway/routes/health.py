"""Health check routes.

This module provides health check endpoints for the Gateway server.
"""

import time

from fastapi import APIRouter

from openclaw_py.config import OpenClawConfig

from ..types import HealthCheckResponse

router = APIRouter()

# Server start time for uptime calculation
_start_time = time.time()


def reset_start_time_for_test():
    """Reset start time (for testing)."""
    global _start_time
    _start_time = time.time()


@router.get("/health")
async def health_check() -> HealthCheckResponse:
    """Basic health check endpoint.

    Returns:
        HealthCheckResponse with status "ok"
    """
    return HealthCheckResponse(status="ok")


@router.get("/api/health")
async def api_health_check() -> HealthCheckResponse:
    """Detailed health check endpoint.

    Returns:
        HealthCheckResponse with detailed information
    """
    uptime = time.time() - _start_time

    return HealthCheckResponse(
        status="ok",
        version="0.1.0",  # TODO: Get from package version
        uptime_seconds=uptime,
        config_loaded=True,
    )
