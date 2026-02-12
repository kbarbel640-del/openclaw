#!/usr/bin/env python3
"""
SYNAPSE — Synchronized Yet Asynchronous Notification And Persistent Shared Exchange

Structured inter-agent messaging protocol for Helios + Claude Code.
Messages are stored in synapse.json alongside the existing Cortex data.

Atomic writes via tmp+rename. Message pruning caps at 200.
"""
import json
import os
import secrets
from datetime import datetime
from pathlib import Path

# Data directory: use CORTEX_DATA_DIR env var or default to script directory
DATA_DIR = Path(os.environ.get("CORTEX_DATA_DIR", Path(__file__).parent))
SYNAPSE_PATH = DATA_DIR / "synapse.json"

MAX_MESSAGES = 200

VALID_PRIORITIES = ("info", "action", "urgent")
VALID_STATUSES = ("unread", "read", "acknowledged")


def _generate_id(prefix: str) -> str:
    """Generate a prefixed hex ID (e.g. syn_a1b2c3d4e5f6)."""
    return f"{prefix}_{secrets.token_hex(6)}"


def load_synapse() -> dict:
    """Load synapse store or create default."""
    if SYNAPSE_PATH.exists():
        with open(SYNAPSE_PATH, "r") as f:
            return json.load(f)
    return {
        "messages": [],
        "agents": ["helios", "claude-code"],
        "version": 1,
    }


def save_synapse(data: dict) -> None:
    """Atomic write: write to .tmp then os.rename() (POSIX atomic)."""
    SYNAPSE_PATH.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = SYNAPSE_PATH.with_suffix(".json.tmp")
    with open(tmp_path, "w") as f:
        json.dump(data, f, indent=2)
    os.rename(str(tmp_path), str(SYNAPSE_PATH))


def _prune_messages(data: dict) -> None:
    """Cap at MAX_MESSAGES. Remove oldest acknowledged first, then oldest read. Never prune unread."""
    messages = data["messages"]
    if len(messages) <= MAX_MESSAGES:
        return

    # Separate by status
    unread = [m for m in messages if m["status"] == "unread"]
    read_msgs = [m for m in messages if m["status"] == "read"]
    acked = [m for m in messages if m["status"] == "acknowledged"]

    # Sort each group by timestamp (oldest first for pruning)
    read_msgs.sort(key=lambda m: m["timestamp"])
    acked.sort(key=lambda m: m["timestamp"])

    excess = len(messages) - MAX_MESSAGES

    # Prune acknowledged first
    while excess > 0 and acked:
        acked.pop(0)
        excess -= 1

    # Then prune read
    while excess > 0 and read_msgs:
        read_msgs.pop(0)
        excess -= 1

    # Rebuild: keep all unread + surviving read + surviving acked, sorted by timestamp
    data["messages"] = sorted(
        unread + read_msgs + acked,
        key=lambda m: m["timestamp"],
    )


def send_message(
    from_agent: str,
    to_agent: str,
    subject: str,
    body: str,
    priority: str = "info",
    thread_id: str | None = None,
) -> dict:
    """Create and store a new message. Returns the created message."""
    if priority not in VALID_PRIORITIES:
        priority = "info"

    msg = {
        "id": _generate_id("syn"),
        "from": from_agent,
        "to": to_agent,
        "priority": priority,
        "subject": subject,
        "body": body,
        "status": "unread",
        "timestamp": datetime.now().isoformat(),
        "read_by": [],
        "thread_id": thread_id or _generate_id("thr"),
        "ack_body": None,
    }

    data = load_synapse()
    data["messages"].append(msg)
    _prune_messages(data)
    save_synapse(data)
    return msg


def get_inbox(agent_id: str, include_read: bool = False) -> list:
    """Get messages addressed to agent_id (or 'all') that they haven't read yet.

    If include_read=True, also return messages the agent has already read (but not acked).
    """
    data = load_synapse()
    results = []
    for msg in data["messages"]:
        addressed = msg["to"] == agent_id or msg["to"] == "all"
        if not addressed:
            continue

        if include_read:
            # Include unread + read (not acknowledged)
            if msg["status"] != "acknowledged":
                results.append(msg)
        else:
            # Only unread messages where this agent hasn't read yet
            if agent_id not in msg.get("read_by", []):
                results.append(msg)

    # Most recent first
    results.sort(key=lambda m: m["timestamp"], reverse=True)
    return results


def read_message(message_id: str, reader_agent: str) -> dict | None:
    """Get a message by ID and mark it as read by this agent."""
    data = load_synapse()
    for msg in data["messages"]:
        if msg["id"] == message_id:
            if reader_agent not in msg.get("read_by", []):
                msg.setdefault("read_by", []).append(reader_agent)
            if msg["status"] == "unread":
                msg["status"] = "read"
            save_synapse(data)
            return msg
    return None


def acknowledge_message(
    message_id: str, acker_agent: str, ack_body: str | None = None
) -> dict | None:
    """Acknowledge a message. Optionally include a reply body."""
    data = load_synapse()
    for msg in data["messages"]:
        if msg["id"] == message_id:
            msg["status"] = "acknowledged"
            if acker_agent not in msg.get("read_by", []):
                msg.setdefault("read_by", []).append(acker_agent)
            if ack_body is not None:
                msg["ack_body"] = ack_body
            save_synapse(data)
            return msg
    return None


def get_history(
    agent_id: str | None = None,
    thread_id: str | None = None,
    limit: int = 20,
) -> list:
    """Get message history, optionally filtered by agent or thread."""
    data = load_synapse()
    results = data["messages"]

    if agent_id:
        results = [
            m for m in results if m["from"] == agent_id or m["to"] == agent_id or m["to"] == "all"
        ]

    if thread_id:
        results = [m for m in results if m.get("thread_id") == thread_id]

    # Most recent first
    results.sort(key=lambda m: m["timestamp"], reverse=True)
    return results[:limit]
