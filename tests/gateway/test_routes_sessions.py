"""Tests for Gateway session management routes."""

import tempfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from openclaw_py.config import GatewayConfig, OpenClawConfig
from openclaw_py.gateway.app import create_app
from openclaw_py.sessions import SessionEntry, save_session_store


@pytest.fixture
def temp_state_dir(tmp_path: Path, monkeypatch):
    """Create temporary state directory."""
    state_dir = tmp_path / "state"
    state_dir.mkdir()

    # Mock resolve_state_dir where it's imported in the sessions routes module
    def mock_resolve_state_dir():
        return state_dir

    import openclaw_py.gateway.routes.sessions as sessions_module

    monkeypatch.setattr(sessions_module, "resolve_state_dir", mock_resolve_state_dir)

    yield state_dir


@pytest.fixture
def test_config() -> OpenClawConfig:
    """Create test configuration."""
    return OpenClawConfig(
        gateway=GatewayConfig(
            enabled=True,
            token="test-token-123",
            password="test-password",
        ),
    )


@pytest.fixture
def client(test_config: OpenClawConfig) -> TestClient:
    """Create test client."""
    app = create_app(test_config)
    return TestClient(app)


@pytest.fixture
def sample_sessions(temp_state_dir: Path):
    """Create sample sessions in the store."""
    import asyncio
    import time

    store_path = temp_state_dir / "sessions.json"

    # Use current timestamp to avoid sessions being pruned as stale
    now_ms = int(time.time() * 1000)

    sessions = {
        "session-1": SessionEntry(
            session_id="session-1",
            updated_at=now_ms,
            channel="telegram",
            label="Test Session 1",
        ),
        "session-2": SessionEntry(
            session_id="session-2",
            updated_at=now_ms,
            channel="telegram",
            label="Test Session 2",
        ),
    }

    # Run async save in sync fixture (skip maintenance to avoid pruning test data)
    asyncio.run(save_session_store(store_path, sessions, skip_maintenance=True))
    return sessions


def test_list_sessions_unauthorized(client: TestClient):
    """Test listing sessions without authentication."""
    response = client.get("/api/sessions")

    assert response.status_code == 401
    data = response.json()
    assert "error" in data


def test_list_sessions_with_token(client: TestClient, temp_state_dir, sample_sessions):
    """Test listing sessions with valid token."""
    response = client.get(
        "/api/sessions",
        headers={"Authorization": "Bearer test-token-123"},
    )

    assert response.status_code == 200
    data = response.json()
    assert "sessions" in data
    assert "count" in data
    assert data["count"] == 2
    assert "session-1" in data["sessions"]
    assert "session-2" in data["sessions"]


def test_list_sessions_with_password(client: TestClient, temp_state_dir, sample_sessions):
    """Test listing sessions with valid password."""
    response = client.get(
        "/api/sessions",
        headers={"X-Password": "test-password"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["count"] == 2


def test_list_sessions_empty_store(client: TestClient, temp_state_dir):
    """Test listing sessions with empty store."""
    # Create empty sessions file
    store_path = temp_state_dir / "sessions.json"
    store_path.write_text("{}")

    response = client.get(
        "/api/sessions",
        headers={"Authorization": "Bearer test-token-123"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["count"] == 0
    assert data["sessions"] == {}


def test_get_session_unauthorized(client: TestClient):
    """Test getting specific session without authentication."""
    response = client.get("/api/sessions/session-1")

    assert response.status_code == 401


def test_get_session_success(client: TestClient, temp_state_dir, sample_sessions):
    """Test getting specific session with authentication."""
    response = client.get(
        "/api/sessions/session-1",
        headers={"Authorization": "Bearer test-token-123"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["session_id"] == "session-1"
    assert data["channel"] == "telegram"
    assert data["label"] == "Test Session 1"


def test_get_session_not_found(client: TestClient, temp_state_dir, sample_sessions):
    """Test getting non-existent session."""
    response = client.get(
        "/api/sessions/nonexistent",
        headers={"Authorization": "Bearer test-token-123"},
    )

    assert response.status_code == 404
    data = response.json()
    assert "error" in data
    assert "Session not found" in data["error"]["message"]


def test_delete_session_unauthorized(client: TestClient):
    """Test deleting session without authentication."""
    response = client.delete("/api/sessions/session-1")

    assert response.status_code == 401


def test_delete_session_success(client: TestClient, temp_state_dir, sample_sessions):
    """Test deleting session with authentication."""
    response = client.delete(
        "/api/sessions/session-1",
        headers={"Authorization": "Bearer test-token-123"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "deleted"
    assert data["session_key"] == "session-1"

    # Verify session was actually deleted
    response2 = client.get(
        "/api/sessions/session-1",
        headers={"Authorization": "Bearer test-token-123"},
    )
    assert response2.status_code == 404


def test_delete_session_not_found(client: TestClient, temp_state_dir, sample_sessions):
    """Test deleting non-existent session."""
    response = client.delete(
        "/api/sessions/nonexistent",
        headers={"Authorization": "Bearer test-token-123"},
    )

    assert response.status_code == 404


def test_session_key_with_slashes(client: TestClient, temp_state_dir):
    """Test session key containing slashes (path parameter)."""
    # Create a session with slashes in key
    import asyncio
    import time

    from openclaw_py.sessions import save_session_store

    async def create_session():
        now_ms = int(time.time() * 1000)
        store_path = temp_state_dir / "sessions.json"
        sessions = {
            "user/telegram/12345": SessionEntry(
                session_id="user/telegram/12345",
                updated_at=now_ms,
                channel="telegram",
                label="Slash Test Session",
            ),
        }
        await save_session_store(store_path, sessions, skip_maintenance=True)

    asyncio.run(create_session())

    # Get session with slashes in key
    response = client.get(
        "/api/sessions/user/telegram/12345",
        headers={"Authorization": "Bearer test-token-123"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["session_id"] == "user/telegram/12345"
