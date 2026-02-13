"""Tests for Gateway health check routes."""

import pytest
from fastapi.testclient import TestClient

from openclaw_py.config import GatewayConfig, OpenClawConfig
from openclaw_py.gateway.app import create_app


@pytest.fixture
def test_config() -> OpenClawConfig:
    """Create test configuration."""
    return OpenClawConfig(
        gateway=GatewayConfig(enabled=True),
    )


@pytest.fixture
def client(test_config: OpenClawConfig) -> TestClient:
    """Create test client."""
    app = create_app(test_config)
    return TestClient(app)


def test_health_endpoint(client: TestClient):
    """Test /health endpoint."""
    response = client.get("/health")

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"


def test_api_health_endpoint(client: TestClient):
    """Test /api/health endpoint with metadata."""
    response = client.get("/api/health")

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["version"] == "0.1.0"
    assert "uptime_seconds" in data
    assert isinstance(data["uptime_seconds"], (int, float))
    assert data["uptime_seconds"] >= 0
    assert data["config_loaded"] is True


def test_health_uptime_increments(client: TestClient):
    """Test that uptime increases between calls."""
    import time

    response1 = client.get("/api/health")
    uptime1 = response1.json()["uptime_seconds"]

    time.sleep(0.1)  # Wait a bit

    response2 = client.get("/api/health")
    uptime2 = response2.json()["uptime_seconds"]

    assert uptime2 > uptime1
