"""Gateway authentication.

This module handles authentication for Gateway HTTP requests.
"""

from fastapi import Request

from openclaw_py.config import GatewayConfig

from .types import GatewayAuth


def get_client_ip(request: Request) -> str:
    """Get client IP address from request.

    Args:
        request: FastAPI Request object

    Returns:
        Client IP address

    Examples:
        >>> # In a real request handler
        >>> ip = get_client_ip(request)
    """
    # Check X-Forwarded-For header first (for reverse proxies)
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        # Take the first IP in the chain
        return forwarded_for.split(",")[0].strip()

    # Check X-Real-IP header
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip.strip()

    # Fall back to direct client address
    if request.client:
        return request.client.host

    return "unknown"


def is_local_request(client_ip: str) -> bool:
    """Check if request is from localhost.

    Args:
        client_ip: Client IP address

    Returns:
        True if request is from localhost
    """
    return client_ip in ("127.0.0.1", "::1", "localhost")


def check_password(request: Request, config: GatewayConfig) -> bool:
    """Check if request has valid password.

    Args:
        request: FastAPI Request object
        config: Gateway configuration

    Returns:
        True if password is valid
    """
    if not config.password:
        return False

    # Check X-Password header (preferred method for password)
    x_password = request.headers.get("X-Password")
    if x_password == config.password:
        return True

    # Check query parameter
    password_param = request.query_params.get("password")
    if password_param == config.password:
        return True

    return False


def check_token(request: Request, config: GatewayConfig) -> bool:
    """Check if request has valid token.

    Args:
        request: FastAPI Request object
        config: Gateway configuration

    Returns:
        True if token is valid
    """
    if not config.token:
        return False

    # Check Authorization header
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[7:].strip()
        return token == config.token

    # Check query parameter
    token_param = request.query_params.get("token")
    if token_param == config.token:
        return True

    return False


def authorize_gateway_request(
    request: Request,
    config: GatewayConfig,
) -> GatewayAuth:
    """Authorize a Gateway HTTP request.

    Args:
        request: FastAPI Request object
        config: Gateway configuration

    Returns:
        GatewayAuth object with authentication result

    Examples:
        >>> auth = authorize_gateway_request(request, config)
        >>> if not auth.authenticated:
        ...     return send_unauthorized()
    """
    client_ip = get_client_ip(request)

    # Local direct requests are always allowed
    if is_local_request(client_ip):
        return GatewayAuth(
            authenticated=True,
            source="local-direct",
            client_ip=client_ip,
        )

    # Check token first (higher priority)
    if check_token(request, config):
        return GatewayAuth(
            authenticated=True,
            source="token",
            client_ip=client_ip,
        )

    # Check password
    if check_password(request, config):
        return GatewayAuth(
            authenticated=True,
            source="password",
            client_ip=client_ip,
        )

    # Not authorized
    return GatewayAuth(
        authenticated=False,
        source="none",
        client_ip=client_ip,
    )
