"""Tests for Gateway HTTP common utilities."""

import pytest
from fastapi.responses import JSONResponse

from openclaw_py.gateway.http_common import (
    send_invalid_request,
    send_json,
    send_method_not_allowed,
    send_not_found,
    send_text,
    send_unauthorized,
)


def test_send_json_success():
    """Test send_json with success response."""
    response = send_json(200, {"message": "ok"})
    assert isinstance(response, JSONResponse)
    assert response.status_code == 200
    assert response.body == b'{"message":"ok"}'


def test_send_json_error():
    """Test send_json with error response."""
    response = send_json(500, {"error": "server error"})
    assert isinstance(response, JSONResponse)
    assert response.status_code == 500


def test_send_text_plain():
    """Test send_text with plain text."""
    response = send_text("Hello, World!")
    assert response.status_code == 200
    assert response.body == b"Hello, World!"
    assert response.media_type == "text/plain"


def test_send_text_custom_status():
    """Test send_text with custom status code."""
    response = send_text("Not Modified", status_code=304)
    assert response.status_code == 304


def test_send_unauthorized_default():
    """Test send_unauthorized with default message."""
    response = send_unauthorized()
    assert response.status_code == 401
    assert b"Unauthorized" in response.body
    assert b"unauthorized" in response.body


def test_send_unauthorized_custom():
    """Test send_unauthorized with custom message."""
    response = send_unauthorized("Invalid token")
    assert response.status_code == 401
    assert b"Invalid token" in response.body


def test_send_invalid_request():
    """Test send_invalid_request."""
    response = send_invalid_request("Missing required field")
    assert response.status_code == 400
    assert b"Missing required field" in response.body
    assert b"invalid_request_error" in response.body


def test_send_not_found():
    """Test send_not_found."""
    response = send_not_found("Resource not found")
    assert response.status_code == 404
    import json

    data = json.loads(response.body)
    assert data["error"]["message"] == "Resource not found"
    assert data["error"]["type"] == "not_found_error"


def test_send_method_not_allowed():
    """Test send_method_not_allowed."""
    response = send_method_not_allowed("POST")
    assert response.status_code == 405
    import json

    data = json.loads(response.body)
    assert "POST" in data["error"]["message"]
    assert data["error"]["type"] == "method_not_allowed"
