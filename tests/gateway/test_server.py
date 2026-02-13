"""Tests for Gateway server lifecycle."""

import asyncio

import pytest

from openclaw_py.config import GatewayConfig, OpenClawConfig
from openclaw_py.gateway.server import GatewayServer, start_server, stop_server


@pytest.fixture
def test_config() -> OpenClawConfig:
    """Create test configuration."""
    return OpenClawConfig(
        gateway=GatewayConfig(
            enabled=True,
            host="127.0.0.1",
            port=None,  # Use default port
        ),
    )


@pytest.fixture
def disabled_config() -> OpenClawConfig:
    """Create configuration with disabled gateway."""
    return OpenClawConfig(
        gateway=GatewayConfig(
            enabled=False,
        ),
    )


@pytest.mark.asyncio
async def test_server_init(test_config: OpenClawConfig):
    """Test GatewayServer initialization."""
    server = GatewayServer(test_config)

    assert server.config == test_config
    assert server.gateway_config == test_config.gateway
    assert server.app is not None
    assert server.server is None
    assert server._server_task is None


@pytest.mark.asyncio
async def test_server_start_stop(test_config: OpenClawConfig):
    """Test starting and stopping the server."""
    server = GatewayServer(test_config)

    # Start server
    await server.start()
    assert server.server is not None
    assert server._server_task is not None

    # Give server a moment to start
    await asyncio.sleep(0.1)

    # Stop server
    await server.stop()
    assert server.server is None
    assert server._server_task is None


@pytest.mark.asyncio
async def test_server_start_already_running(test_config: OpenClawConfig):
    """Test that starting an already running server raises error."""
    server = GatewayServer(test_config)

    await server.start()

    # Try to start again
    with pytest.raises(RuntimeError, match="already running"):
        await server.start()

    await server.stop()


@pytest.mark.asyncio
async def test_server_stop_not_running(test_config: OpenClawConfig):
    """Test that stopping a non-running server is safe."""
    server = GatewayServer(test_config)

    # Should not raise error
    await server.stop()


@pytest.mark.asyncio
async def test_server_disabled_config(disabled_config: OpenClawConfig):
    """Test that disabled config prevents server start."""
    server = GatewayServer(disabled_config)

    await server.start()

    # Server should not actually start
    assert server.server is None
    assert server._server_task is None


@pytest.mark.asyncio
async def test_server_context_manager(test_config: OpenClawConfig):
    """Test using GatewayServer as async context manager."""
    async with GatewayServer(test_config) as server:
        assert server.server is not None
        assert server._server_task is not None

    # After context exit, server should be stopped
    assert server.server is None
    assert server._server_task is None


@pytest.mark.asyncio
async def test_start_server_helper(test_config: OpenClawConfig):
    """Test start_server helper function."""
    server = await start_server(test_config)

    assert isinstance(server, GatewayServer)
    assert server.server is not None

    await server.stop()


@pytest.mark.asyncio
async def test_stop_server_helper(test_config: OpenClawConfig):
    """Test stop_server helper function."""
    server = await start_server(test_config)

    await stop_server(server)

    assert server.server is None
    assert server._server_task is None


@pytest.mark.asyncio
async def test_server_port_binding(test_config: OpenClawConfig):
    """Test that server binds to configured host and port."""
    # Use explicit port for this test
    test_config.gateway.port = 18888

    server = GatewayServer(test_config)
    await server.start()

    # Give server time to bind
    await asyncio.sleep(0.2)

    # Try to connect to the server
    import aiohttp

    try:
        async with aiohttp.ClientSession() as session:
            async with session.get("http://127.0.0.1:18888/health") as resp:
                assert resp.status == 200
                data = await resp.json()
                assert data["status"] == "ok"
    finally:
        await server.stop()


@pytest.mark.asyncio
async def test_server_graceful_shutdown(test_config: OpenClawConfig):
    """Test that server shuts down gracefully."""
    server = GatewayServer(test_config)
    await server.start()

    # Give server time to start
    await asyncio.sleep(0.1)

    # Stop server (should complete without errors)
    await server.stop()

    # Verify server is stopped
    assert server.server is None
    assert server._server_task is None


@pytest.mark.asyncio
async def test_server_default_host_port(test_config: OpenClawConfig):
    """Test server uses default host and port when not configured."""
    # Clear host and port
    test_config.gateway.host = None
    test_config.gateway.port = None

    server = GatewayServer(test_config)
    await server.start()

    # Should use defaults: 127.0.0.1:3000
    # We can't easily verify this without checking internals,
    # but at least ensure it doesn't crash
    assert server.server is not None

    await server.stop()
