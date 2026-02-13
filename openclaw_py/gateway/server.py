"""Gateway HTTP server.

This module handles starting and stopping the Gateway HTTP server.
"""

import asyncio
from typing import Optional

import uvicorn

from openclaw_py.config import GatewayConfig, OpenClawConfig, load_config_file
from openclaw_py.logging import log_error, log_info

from .app import create_app


class GatewayServer:
    """Gateway HTTP server wrapper.

    This class manages the lifecycle of the Gateway HTTP server.
    """

    def __init__(self, config: OpenClawConfig):
        """Initialize the Gateway server.

        Args:
            config: OpenClaw configuration
        """
        self.config = config
        self.gateway_config = config.gateway
        self.app = create_app(config)
        self.server: Optional[uvicorn.Server] = None
        self._server_task: Optional[asyncio.Task] = None

    async def start(self) -> None:
        """Start the Gateway HTTP server.

        Raises:
            RuntimeError: If server is already running
        """
        if self._server_task is not None:
            raise RuntimeError("Server is already running")

        if not self.gateway_config.enabled:
            log_info("Gateway server is disabled in configuration")
            return

        # Determine host and port
        host = self.gateway_config.host or "127.0.0.1"
        port = self.gateway_config.port or 3000

        log_info(f"Starting Gateway HTTP server on {host}:{port}")

        # Create uvicorn server config
        config = uvicorn.Config(
            app=self.app,
            host=host,
            port=port,
            log_level="info",
            access_log=False,  # We handle logging ourselves
        )

        self.server = uvicorn.Server(config)

        # Start server in background task
        self._server_task = asyncio.create_task(self.server.serve())

        log_info(f"Gateway HTTP server started on http://{host}:{port}")

    async def stop(self) -> None:
        """Stop the Gateway HTTP server."""
        if self._server_task is None:
            return

        log_info("Stopping Gateway HTTP server")

        if self.server:
            self.server.should_exit = True

        if self._server_task:
            try:
                await asyncio.wait_for(self._server_task, timeout=5.0)
            except asyncio.TimeoutError:
                log_error("Gateway server shutdown timed out")
                self._server_task.cancel()
                try:
                    await self._server_task
                except asyncio.CancelledError:
                    pass

        self._server_task = None
        self.server = None

        log_info("Gateway HTTP server stopped")

    async def __aenter__(self):
        """Async context manager entry."""
        await self.start()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        await self.stop()


async def start_server(config: OpenClawConfig | None = None) -> GatewayServer:
    """Start the Gateway HTTP server.

    Args:
        config: OpenClaw configuration (loads from file if not provided)

    Returns:
        GatewayServer instance

    Examples:
        >>> async def main():
        ...     server = await start_server()
        ...     try:
        ...         await asyncio.sleep(60)  # Run for 1 minute
        ...     finally:
        ...         await server.stop()
    """
    if config is None:
        config = await load_config_file()

    server = GatewayServer(config)
    await server.start()
    return server


async def stop_server(server: GatewayServer) -> None:
    """Stop the Gateway HTTP server.

    Args:
        server: GatewayServer instance to stop
    """
    await server.stop()
