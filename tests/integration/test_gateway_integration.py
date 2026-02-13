"""Integration tests for Gateway HTTP + WebSocket."""

import pytest
from fastapi.testclient import TestClient

from openclaw_py.config.types import OpenClawConfig


class TestGatewayHTTPIntegration:
    """Test Gateway HTTP endpoints integration."""

    def test_full_health_check_flow(self, test_gateway_client: TestClient):
        """Test complete health check flow."""
        # Check main health endpoint
        response = test_gateway_client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert "uptime" in data

        # Check API health endpoint
        response = test_gateway_client.get("/api/health")
        assert response.status_code == 200

    def test_config_api_with_auth(self, test_gateway_client: TestClient, test_config: OpenClawConfig):
        """Test config API with authentication."""
        # Without auth - should fail
        response = test_gateway_client.get("/api/config")
        assert response.status_code == 401

        # With valid token
        headers = {"Authorization": "Bearer test-token-123"}
        response = test_gateway_client.get("/api/config", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "gateway" in data
        assert data["gateway"]["enabled"] is True

    def test_config_snapshot_endpoint(self, test_gateway_client: TestClient):
        """Test config snapshot endpoint."""
        headers = {"Authorization": "Bearer test-token-123"}
        response = test_gateway_client.get("/api/config/snapshot", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "config" in data
        assert "timestamp" in data

    def test_sessions_list_endpoint(self, test_gateway_client: TestClient):
        """Test sessions list endpoint."""
        headers = {"Authorization": "Bearer test-token-123"}
        response = test_gateway_client.get("/api/sessions", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "sessions" in data
        assert isinstance(data["sessions"], list)

    def test_session_get_endpoint(self, test_gateway_client: TestClient):
        """Test get session endpoint."""
        headers = {"Authorization": "Bearer test-token-123"}
        session_key = "agent:test-agent:main"

        # Non-existent session
        response = test_gateway_client.get(f"/api/sessions/{session_key}", headers=headers)
        assert response.status_code == 404

    def test_cors_headers(self, test_gateway_client: TestClient):
        """Test CORS configuration."""
        response = test_gateway_client.options("/api/health")
        assert response.status_code == 200
        # CORS headers should be present
        assert "access-control-allow-origin" in response.headers

    def test_openapi_docs_available(self, test_gateway_client: TestClient):
        """Test OpenAPI documentation endpoints."""
        # Check OpenAPI JSON
        response = test_gateway_client.get("/openapi.json")
        assert response.status_code == 200
        data = response.json()
        assert "openapi" in data
        assert "info" in data

        # Check Swagger UI
        response = test_gateway_client.get("/docs")
        assert response.status_code == 200


class TestGatewayWebSocketIntegration:
    """Test Gateway WebSocket integration."""

    def test_websocket_connection_lifecycle(self, test_gateway_client: TestClient):
        """Test WebSocket connection and disconnection."""
        with test_gateway_client.websocket_connect("/ws") as websocket:
            # Send connect frame
            websocket.send_json({
                "type": "request",
                "id": "1",
                "method": "connect",
                "params": {"clientId": "test-client"}
            })

            # Receive response
            response = websocket.receive_json()
            assert response["type"] == "response"
            assert response["id"] == "1"
            assert response.get("error") is None

    def test_websocket_ping_pong(self, test_gateway_client: TestClient):
        """Test WebSocket ping/pong mechanism."""
        with test_gateway_client.websocket_connect("/ws") as websocket:
            # Connect first
            websocket.send_json({
                "type": "request",
                "id": "1",
                "method": "connect",
                "params": {"clientId": "test-client"}
            })
            websocket.receive_json()

            # Send ping
            websocket.send_json({
                "type": "request",
                "id": "2",
                "method": "ping",
                "params": {}
            })

            # Receive pong
            response = websocket.receive_json()
            assert response["type"] == "response"
            assert response["id"] == "2"

    def test_websocket_get_status(self, test_gateway_client: TestClient):
        """Test WebSocket getStatus method."""
        with test_gateway_client.websocket_connect("/ws") as websocket:
            # Connect first
            websocket.send_json({
                "type": "request",
                "id": "1",
                "method": "connect",
                "params": {"clientId": "test-client"}
            })
            websocket.receive_json()

            # Get status
            websocket.send_json({
                "type": "request",
                "id": "2",
                "method": "getStatus",
                "params": {}
            })

            response = websocket.receive_json()
            assert response["type"] == "response"
            assert response["id"] == "2"
            assert "result" in response

    def test_websocket_invalid_method(self, test_gateway_client: TestClient):
        """Test WebSocket with invalid method."""
        with test_gateway_client.websocket_connect("/ws") as websocket:
            websocket.send_json({
                "type": "request",
                "id": "1",
                "method": "invalid_method",
                "params": {}
            })

            response = websocket.receive_json()
            assert response["type"] == "response"
            assert response.get("error") is not None


class TestGatewayEndToEnd:
    """Test complete Gateway end-to-end scenarios."""

    def test_http_and_websocket_together(self, test_gateway_client: TestClient):
        """Test HTTP and WebSocket working together."""
        # First check health via HTTP
        response = test_gateway_client.get("/health")
        assert response.status_code == 200

        # Then connect via WebSocket
        with test_gateway_client.websocket_connect("/ws") as websocket:
            websocket.send_json({
                "type": "request",
                "id": "1",
                "method": "connect",
                "params": {"clientId": "test-client"}
            })
            response = websocket.receive_json()
            assert response.get("error") is None

        # Check health again via HTTP
        response = test_gateway_client.get("/health")
        assert response.status_code == 200

    def test_multiple_websocket_clients(self, test_gateway_client: TestClient):
        """Test multiple WebSocket clients can connect."""
        # Connect first client
        with test_gateway_client.websocket_connect("/ws") as ws1:
            ws1.send_json({
                "type": "request",
                "id": "1",
                "method": "connect",
                "params": {"clientId": "client-1"}
            })
            response1 = ws1.receive_json()
            assert response1.get("error") is None

            # Connect second client
            with test_gateway_client.websocket_connect("/ws") as ws2:
                ws2.send_json({
                    "type": "request",
                    "id": "1",
                    "method": "connect",
                    "params": {"clientId": "client-2"}
                })
                response2 = ws2.receive_json()
                assert response2.get("error") is None
