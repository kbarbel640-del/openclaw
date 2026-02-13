"""HTTP response helper functions.

This module provides utilities for sending standardized HTTP responses.
"""

from typing import Any

from fastapi import Response
from fastapi.responses import JSONResponse


def send_json(status_code: int, body: Any) -> JSONResponse:
    """Send a JSON response.

    Args:
        status_code: HTTP status code
        body: Response body (will be serialized to JSON)

    Returns:
        JSONResponse object

    Examples:
        >>> response = send_json(200, {"status": "ok"})
        >>> response.status_code
        200
    """
    return JSONResponse(content=body, status_code=status_code)


def send_text(body: str, status_code: int = 200) -> Response:
    """Send a plain text response.

    Args:
        body: Response text
        status_code: HTTP status code (default: 200)

    Returns:
        Response object
    """
    return Response(content=body, media_type="text/plain", status_code=status_code)


def send_unauthorized(message: str = "Unauthorized") -> JSONResponse:
    """Send a 401 Unauthorized response.

    Args:
        message: Error message

    Returns:
        JSONResponse with 401 status
    """
    return JSONResponse(
        content={
            "error": {
                "message": message,
                "type": "unauthorized",
            }
        },
        status_code=401,
    )


def send_invalid_request(message: str) -> JSONResponse:
    """Send a 400 Bad Request response.

    Args:
        message: Error message

    Returns:
        JSONResponse with 400 status
    """
    return JSONResponse(
        content={
            "error": {
                "message": message,
                "type": "invalid_request_error",
            }
        },
        status_code=400,
    )


def send_not_found(message: str = "Not Found") -> JSONResponse:
    """Send a 404 Not Found response.

    Args:
        message: Error message

    Returns:
        JSONResponse with 404 status
    """
    return JSONResponse(
        content={
            "error": {
                "message": message,
                "type": "not_found_error",
            }
        },
        status_code=404,
    )


def send_method_not_allowed(method: str = "POST") -> JSONResponse:
    """Send a 405 Method Not Allowed response.

    Args:
        method: The method that was attempted

    Returns:
        JSONResponse with 405 status
    """
    return JSONResponse(
        content={
            "error": {
                "message": f"Method {method} not allowed",
                "type": "method_not_allowed",
            }
        },
        status_code=405,
    )
