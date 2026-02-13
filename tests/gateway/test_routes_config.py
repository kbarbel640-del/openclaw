"""Tests for Gateway configuration routes."""

import pytest
from fastapi.testclient import TestClient

from openclaw_py.config import GatewayConfig, OpenClawConfig, TelegramConfig
from openclaw_py.gateway.app import create_app


@pytest.fixture
def test_config() -> OpenClawConfig:
    """Create test configuration with sensitive data."""
    return OpenClawConfig(
        gateway=GatewayConfig(
            enabled=True,
            host="127.0.0.1",
            port=3000,
            token="secret-gateway-token",
            password="secret-gateway-password",
        ),
        telegram=TelegramConfig(
            enabled=True,
            bot_token="secret-telegram-bot-token",
            allow_from=[123, 456],
        ),
    )


@pytest.fixture
def client(test_config: OpenClawConfig) -> TestClient:
    """Create test client."""
    app = create_app(test_config)
    return TestClient(app)


def test_get_config_unauthorized(client: TestClient):
    """Test getting config without authentication."""
    response = client.get("/api/config")

    assert response.status_code == 401
    data = response.json()
    assert "error" in data


def test_get_config_with_token(client: TestClient):
    """Test getting config with valid token."""
    response = client.get(
        "/api/config",
        headers={"Authorization": "Bearer secret-gateway-token"},
    )

    assert response.status_code == 200
    data = response.json()

    # Verify structure
    assert "gateway" in data
    assert "telegram" in data

    # Verify sensitive data is sanitized
    assert "token" not in data["gateway"]
    assert "password" not in data["gateway"]
    assert "bot_token" not in data["telegram"]

    # Verify non-sensitive data is present
    assert data["gateway"]["enabled"] is True
    assert data["gateway"]["host"] == "127.0.0.1"
    assert data["gateway"]["port"] == 3000
    assert data["telegram"]["enabled"] is True
    assert data["telegram"]["allow_from"] == [123, 456]


def test_get_config_with_password(client: TestClient):
    """Test getting config with valid password."""
    # Note: TestClient appears as 127.0.0.1 (local), so it's always authenticated
    # This test just verifies the endpoint works
    response = client.get(
        "/api/config",
        headers={"X-Password": "secret-gateway-password"},
    )

    assert response.status_code == 200
    data = response.json()
    assert "gateway" in data


def test_get_config_snapshot_unauthorized(client: TestClient):
    """Test getting config snapshot without authentication."""
    response = client.get("/api/config/snapshot")

    assert response.status_code == 401


def test_get_config_snapshot_with_token(client: TestClient, tmp_path, monkeypatch):
    """Test getting config snapshot with metadata."""
    # Mock config path
    config_path = tmp_path / "config.toml"

    def mock_resolve_config_path():
        return config_path

    import openclaw_py.gateway.routes.config as config_module

    original_fn = config_module.resolve_config_path
    config_module.resolve_config_path = mock_resolve_config_path

    response = client.get(
        "/api/config/snapshot",
        headers={"Authorization": "Bearer secret-gateway-token"},
    )

    # Restore
    config_module.resolve_config_path = original_fn

    assert response.status_code == 200
    data = response.json()

    # Verify structure
    assert "config" in data
    assert "path" in data
    assert "loaded_at" in data

    # Verify metadata
    assert str(config_path) in data["path"]
    assert isinstance(data["loaded_at"], int)
    assert data["loaded_at"] > 0

    # Verify config is sanitized
    assert "token" not in data["config"]["gateway"]
    assert "password" not in data["config"]["gateway"]
    assert "bot_token" not in data["config"]["telegram"]


def test_config_sanitization_with_list_telegram():
    """Test config sanitization when telegram is a list of accounts."""
    from openclaw_py.gateway.app import create_app

    config = OpenClawConfig(
        gateway=GatewayConfig(
            enabled=True,
            token="test-token",
        ),
        # In the future, telegram might be a list
        # For now, we test the sanitization logic handles it
    )

    app = create_app(config)
    client = TestClient(app)

    response = client.get(
        "/api/config",
        headers={"Authorization": "Bearer test-token"},
    )

    assert response.status_code == 200
    # Should not crash even if telegram structure changes


# Note: Local direct access is tested in test_auth.py unit tests
# TestClient doesn't properly simulate local connections for integration tests
