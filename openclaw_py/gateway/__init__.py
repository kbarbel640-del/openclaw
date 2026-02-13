"""OpenClaw Gateway HTTP server module.

This module provides the HTTP API server for OpenClaw.
"""

from .app import create_app
from .auth import authorize_gateway_request, get_client_ip, is_local_request
from .http_common import (
    send_invalid_request,
    send_json,
    send_method_not_allowed,
    send_not_found,
    send_text,
    send_unauthorized,
)
from .server import GatewayServer, start_server, stop_server
from .types import (
    ConfigSnapshotResponse,
    GatewayAuth,
    HealthCheckResponse,
    SessionListResponse,
)

__all__ = [
    # App
    "create_app",
    # Server
    "GatewayServer",
    "start_server",
    "stop_server",
    # Auth
    "authorize_gateway_request",
    "get_client_ip",
    "is_local_request",
    # HTTP common
    "send_json",
    "send_text",
    "send_unauthorized",
    "send_invalid_request",
    "send_not_found",
    "send_method_not_allowed",
    # Types
    "GatewayAuth",
    "HealthCheckResponse",
    "SessionListResponse",
    "ConfigSnapshotResponse",
]
