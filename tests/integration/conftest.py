"""Pytest configuration and fixtures for integration tests."""

import asyncio
import os
import tempfile
from pathlib import Path
from typing import AsyncGenerator, Generator

import pytest
from fastapi.testclient import TestClient

from openclaw_py.config.loader import load_config_sync
from openclaw_py.config.types import OpenClawConfig
from openclaw_py.gateway.app import create_app
from openclaw_py.sessions.memory_store import InMemorySessionStore


@pytest.fixture(scope="session")
def event_loop() -> Generator[asyncio.AbstractEventLoop, None, None]:
    """Create event loop for async tests."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
def temp_config_dir() -> Generator[Path, None, None]:
    """Create temporary directory for test config files."""
    with tempfile.TemporaryDirectory() as tmpdir:
        yield Path(tmpdir)


@pytest.fixture
def test_config(temp_config_dir: Path) -> OpenClawConfig:
    """Create test configuration."""
    config_data = {
        "gateway": {
            "enabled": True,
            "host": "127.0.0.1",
            "http_port": 18080,
            "ws_port": 18081,
            "bearer_token": "test-token-123",
        },
        "models": {
            "providers": {
                "anthropic": {
                    "api_key": "test-key",
                }
            }
        },
        "agents": [
            {
                "id": "test-agent",
                "default": True,
                "name": "Test Agent",
                "model": "claude-3-5-sonnet-20241022",
            }
        ],
        "telegram": {
            "enabled": False,
        },
    }

    return OpenClawConfig(**config_data)


@pytest.fixture
def test_session_store() -> InMemorySessionStore:
    """Create test session store."""
    return InMemorySessionStore()


@pytest.fixture
def test_gateway_client(test_config: OpenClawConfig) -> TestClient:
    """Create test client for Gateway app."""
    app = create_app(test_config)
    return TestClient(app)


@pytest.fixture
async def async_session_store() -> AsyncGenerator[InMemorySessionStore, None]:
    """Create async session store for testing."""
    store = InMemorySessionStore()
    yield store
    # Cleanup
    store.clear()
