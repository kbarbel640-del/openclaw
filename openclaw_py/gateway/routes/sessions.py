"""Session management routes.

This module provides API endpoints for managing sessions.
"""

from pathlib import Path

from fastapi import APIRouter, Request

from openclaw_py.config import resolve_state_dir
from openclaw_py.sessions import load_session_store

from ..auth import authorize_gateway_request
from ..http_common import send_not_found, send_unauthorized
from ..types import SessionListResponse

router = APIRouter()


def get_sessions_store_path() -> Path:
    """Get the path to the sessions store file.

    Returns:
        Path to sessions.json
    """
    state_dir = resolve_state_dir()
    return state_dir / "sessions.json"


@router.get("/api/sessions")
async def list_sessions(
    request: Request,
):
    """List all sessions.

    Args:
        request: FastAPI Request

    Returns:
        SessionListResponse with all sessions
    """
    # Get config from app state
    config = request.app.state.gateway_config

    # Check authentication
    auth = authorize_gateway_request(request, config)
    if not auth.authenticated:
        return send_unauthorized()

    # Load sessions store
    store_path = get_sessions_store_path()
    store = await load_session_store(store_path)

    # Convert SessionEntry objects to dicts
    sessions_dict = {
        key: entry.model_dump(exclude_none=True)
        for key, entry in store.items()
    }

    return SessionListResponse(
        sessions=sessions_dict,
        count=len(sessions_dict),
    )


@router.get("/api/sessions/{session_key:path}")
async def get_session(
    session_key: str,
    request: Request,
):
    """Get a specific session by key.

    Args:
        session_key: Session key
        request: FastAPI Request

    Returns:
        Session entry or 404 if not found
    """
    # Get config from app state
    config = request.app.state.gateway_config

    # Check authentication
    auth = authorize_gateway_request(request, config)
    if not auth.authenticated:
        return send_unauthorized()

    # Load sessions store
    store_path = get_sessions_store_path()
    store = await load_session_store(store_path)

    # Find session
    entry = store.get(session_key)
    if not entry:
        return send_not_found(f"Session not found: {session_key}")

    return entry.model_dump(exclude_none=True)


@router.delete("/api/sessions/{session_key:path}")
async def delete_session(
    session_key: str,
    request: Request,
):
    """Delete a session by key.

    Args:
        session_key: Session key
        request: FastAPI Request

    Returns:
        Success response or 404 if not found
    """
    from openclaw_py.sessions import save_session_store

    # Get config from app state
    config = request.app.state.gateway_config

    # Check authentication
    auth = authorize_gateway_request(request, config)
    if not auth.authenticated:
        return send_unauthorized()

    # Load sessions store
    store_path = get_sessions_store_path()
    store = await load_session_store(store_path)

    # Check if session exists
    if session_key not in store:
        return send_not_found(f"Session not found: {session_key}")

    # Delete session
    del store[session_key]

    # Save store
    await save_session_store(store_path, store)

    return {"status": "deleted", "session_key": session_key}
