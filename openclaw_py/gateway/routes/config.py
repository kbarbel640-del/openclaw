"""Configuration routes.

This module provides API endpoints for accessing configuration.
"""

import time

from fastapi import APIRouter, Request

from openclaw_py.config import GatewayConfig, OpenClawConfig, resolve_config_path

from ..auth import authorize_gateway_request
from ..http_common import send_unauthorized
from ..types import ConfigSnapshotResponse

router = APIRouter()


@router.get("/api/config")
async def get_config(
    request: Request,
):
    """Get current configuration.

    Args:
        request: FastAPI Request

    Returns:
        Configuration dict (sanitized)
    """
    # Get config from app state
    config = request.app.state.gateway_config
    full_config = request.app.state.config

    # Check authentication
    auth = authorize_gateway_request(request, config)
    if not auth.authenticated:
        return send_unauthorized()

    # Return sanitized config (exclude sensitive fields)
    config_dict = full_config.model_dump(exclude_none=True)

    # Remove sensitive fields
    if "gateway" in config_dict and isinstance(config_dict["gateway"], dict):
        config_dict["gateway"].pop("password", None)
        config_dict["gateway"].pop("token", None)

    if "telegram" in config_dict:
        # Sanitize telegram config
        telegram = config_dict["telegram"]
        if isinstance(telegram, dict):
            telegram.pop("bot_token", None)
        elif isinstance(telegram, list):
            for account in telegram:
                if isinstance(account, dict):
                    account.pop("bot_token", None)

    return config_dict


@router.get("/api/config/snapshot")
async def get_config_snapshot(
    request: Request,
) -> ConfigSnapshotResponse:
    """Get configuration snapshot with metadata.

    Args:
        request: FastAPI Request

    Returns:
        ConfigSnapshotResponse with config and metadata
    """
    # Get config from app state
    config = request.app.state.gateway_config
    full_config = request.app.state.config

    # Check authentication
    auth = authorize_gateway_request(request, config)
    if not auth.authenticated:
        return send_unauthorized()

    # Get sanitized config
    config_dict = full_config.model_dump(exclude_none=True)

    # Remove sensitive fields
    if "gateway" in config_dict and isinstance(config_dict["gateway"], dict):
        config_dict["gateway"].pop("password", None)
        config_dict["gateway"].pop("token", None)

    if "telegram" in config_dict:
        telegram = config_dict["telegram"]
        if isinstance(telegram, dict):
            telegram.pop("bot_token", None)
        elif isinstance(telegram, list):
            for account in telegram:
                if isinstance(account, dict):
                    account.pop("bot_token", None)

    # Get config path
    config_path = resolve_config_path()

    return ConfigSnapshotResponse(
        config=config_dict,
        path=str(config_path),
        loaded_at=int(time.time() * 1000),
    )
