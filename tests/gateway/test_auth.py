"""Tests for Gateway authentication."""

import pytest
from fastapi import Request
from starlette.datastructures import Headers

from openclaw_py.config import GatewayConfig
from openclaw_py.gateway.auth import (
    authorize_gateway_request,
    get_client_ip,
    is_local_request,
)


def mock_request(
    client_host: str = "127.0.0.1",
    headers: dict | None = None,
) -> Request:
    """Create a mock FastAPI request."""
    if headers is None:
        headers = {}

    # Headers need to be lowercase keys as bytes
    header_list = [
        (k.lower().encode(), v.encode()) for k, v in headers.items()
    ]

    scope = {
        "type": "http",
        "method": "GET",
        "path": "/",
        "query_string": b"",
        "headers": header_list,
        "client": (client_host, 12345),
    }
    return Request(scope)


def test_is_local_request_localhost():
    """Test is_local_request recognizes localhost."""
    assert is_local_request("127.0.0.1") is True
    assert is_local_request("::1") is True
    assert is_local_request("localhost") is True


def test_is_local_request_remote():
    """Test is_local_request rejects remote IPs."""
    assert is_local_request("192.168.1.100") is False
    assert is_local_request("8.8.8.8") is False
    assert is_local_request("2001:4860:4860::8888") is False


def test_get_client_ip_direct():
    """Test get_client_ip with direct connection."""
    request = mock_request(client_host="192.168.1.100")
    assert get_client_ip(request) == "192.168.1.100"


def test_get_client_ip_forwarded_for():
    """Test get_client_ip with X-Forwarded-For header."""
    request = mock_request(
        client_host="127.0.0.1",
        headers={"X-Forwarded-For": "203.0.113.1, 192.168.1.1"},
    )
    assert get_client_ip(request) == "203.0.113.1"


def test_get_client_ip_real_ip():
    """Test get_client_ip with X-Real-IP header."""
    request = mock_request(
        client_host="127.0.0.1",
        headers={"X-Real-IP": "203.0.113.5"},
    )
    assert get_client_ip(request) == "203.0.113.5"


def test_get_client_ip_precedence():
    """Test get_client_ip header precedence (X-Forwarded-For > X-Real-IP)."""
    request = mock_request(
        client_host="127.0.0.1",
        headers={
            "X-Forwarded-For": "203.0.113.10",
            "X-Real-IP": "203.0.113.20",
        },
    )
    # X-Forwarded-For takes precedence
    assert get_client_ip(request) == "203.0.113.10"


def test_authorize_local_direct():
    """Test authorize_gateway_request allows local direct connections."""
    config = GatewayConfig(enabled=True)
    request = mock_request(client_host="127.0.0.1")

    auth = authorize_gateway_request(request, config)

    assert auth.authenticated is True
    assert auth.source == "local-direct"
    assert auth.client_ip == "127.0.0.1"


def test_authorize_bearer_token():
    """Test authorize_gateway_request with valid bearer token."""
    config = GatewayConfig(enabled=True, token="secret-token-123")
    request = mock_request(
        client_host="192.168.1.100",
        headers={"Authorization": "Bearer secret-token-123"},
    )

    auth = authorize_gateway_request(request, config)

    assert auth.authenticated is True
    assert auth.source == "token"
    assert auth.client_ip == "192.168.1.100"


def test_authorize_invalid_bearer_token():
    """Test authorize_gateway_request with invalid bearer token."""
    config = GatewayConfig(enabled=True, token="secret-token-123")
    request = mock_request(
        client_host="192.168.1.100",
        headers={"Authorization": "Bearer wrong-token"},
    )

    auth = authorize_gateway_request(request, config)

    assert auth.authenticated is False
    assert auth.source == "none"


def test_authorize_password():
    """Test authorize_gateway_request with valid password."""
    config = GatewayConfig(enabled=True, password="my-password")
    request = mock_request(
        client_host="192.168.1.100",
        headers={"X-Password": "my-password"},
    )

    auth = authorize_gateway_request(request, config)

    assert auth.authenticated is True
    assert auth.source == "password"


def test_authorize_invalid_password():
    """Test authorize_gateway_request with invalid password."""
    config = GatewayConfig(enabled=True, password="my-password")
    request = mock_request(
        client_host="192.168.1.100",
        headers={"X-Password": "wrong-password"},
    )

    auth = authorize_gateway_request(request, config)

    assert auth.authenticated is False
    assert auth.source == "none"


def test_authorize_no_credentials():
    """Test authorize_gateway_request with no credentials from remote."""
    config = GatewayConfig(enabled=True, token="secret", password="pass")
    request = mock_request(client_host="192.168.1.100")

    auth = authorize_gateway_request(request, config)

    assert auth.authenticated is False
    assert auth.source == "none"
    assert auth.client_ip == "192.168.1.100"


def test_authorize_priority_token_over_password():
    """Test that token auth takes priority over password auth."""
    config = GatewayConfig(
        enabled=True,
        token="my-token",
        password="my-password",
    )
    request = mock_request(
        client_host="192.168.1.100",
        headers={
            "Authorization": "Bearer my-token",
            "X-Password": "my-password",
        },
    )

    auth = authorize_gateway_request(request, config)

    assert auth.authenticated is True
    assert auth.source == "token"  # Token takes priority
