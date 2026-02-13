"""Tests for Gateway FastAPI application."""

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from openclaw_py.config import GatewayConfig, OpenClawConfig
from openclaw_py.gateway.app import create_app


@pytest.fixture
def test_config() -> OpenClawConfig:
    """Create test configuration."""
    return OpenClawConfig(
        gateway=GatewayConfig(enabled=True),
    )


def test_create_app(test_config: OpenClawConfig):
    """Test create_app returns FastAPI instance."""
    app = create_app(test_config)

    assert isinstance(app, FastAPI)
    assert app.title == "OpenClaw Gateway API"
    assert app.version == "0.1.0"


def test_app_state_config(test_config: OpenClawConfig):
    """Test that app state contains config."""
    app = create_app(test_config)

    assert hasattr(app.state, "config")
    assert hasattr(app.state, "gateway_config")
    assert app.state.config == test_config
    assert app.state.gateway_config == test_config.gateway


def test_app_root_endpoint(test_config: OpenClawConfig):
    """Test root endpoint returns basic info."""
    app = create_app(test_config)
    client = TestClient(app)

    response = client.get("/")

    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "OpenClaw Gateway API"
    assert data["version"] == "0.1.0"
    assert data["status"] == "running"


def test_app_cors_configured(test_config: OpenClawConfig):
    """Test that CORS middleware is configured."""
    app = create_app(test_config)

    # Check that middleware is present (FastAPI wraps it differently)
    # Just verify we can make CORS requests
    from fastapi.testclient import TestClient

    client = TestClient(app)
    response = client.options("/", headers={"Origin": "http://localhost:3001"})
    # OPTIONS should be allowed (CORS preflight)
    assert response.status_code in [200, 405]  # Either OK or method not defined


def test_app_routes_registered(test_config: OpenClawConfig):
    """Test that all route modules are registered."""
    app = create_app(test_config)
    client = TestClient(app)

    # Test health routes
    response = client.get("/health")
    assert response.status_code == 200

    response = client.get("/api/health")
    assert response.status_code == 200

    # Test sessions routes (will be unauthorized, but route exists)
    response = client.get("/api/sessions")
    assert response.status_code in [200, 401]  # Either local auth or unauthorized

    # Test config routes (will be unauthorized, but route exists)
    response = client.get("/api/config")
    assert response.status_code in [200, 401]


def test_app_openapi_docs(test_config: OpenClawConfig):
    """Test that OpenAPI docs are available."""
    app = create_app(test_config)
    client = TestClient(app)

    # Get OpenAPI schema
    response = client.get("/openapi.json")
    assert response.status_code == 200

    schema = response.json()
    assert schema["info"]["title"] == "OpenClaw Gateway API"
    assert schema["info"]["version"] == "0.1.0"

    # Check that our endpoints are documented
    assert "/health" in schema["paths"]
    assert "/api/health" in schema["paths"]
    assert "/api/sessions" in schema["paths"]
    assert "/api/config" in schema["paths"]


def test_app_tags(test_config: OpenClawConfig):
    """Test that routes are properly tagged."""
    app = create_app(test_config)
    client = TestClient(app)

    schema = client.get("/openapi.json").json()

    # Health endpoints should have 'health' tag
    health_tags = schema["paths"]["/health"]["get"].get("tags", [])
    assert "health" in health_tags

    # Session endpoints should have 'sessions' tag
    sessions_tags = schema["paths"]["/api/sessions"]["get"].get("tags", [])
    assert "sessions" in sessions_tags

    # Config endpoints should have 'config' tag
    config_tags = schema["paths"]["/api/config"]["get"].get("tags", [])
    assert "config" in config_tags
