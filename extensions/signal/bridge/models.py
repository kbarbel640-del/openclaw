#!/usr/bin/env python3
"""
Models: Data structures for signal bridge
"""
from dataclasses import dataclass
from typing import Optional
from enum import Enum


class MessageSource(Enum):
    NOTE_SELF = "note_self"
    DIRECT = "direct"


@dataclass
class SignalMessage:
    """Represents a received Signal message"""
    text: str
    source: MessageSource
    sender: Optional[str] = None
    timestamp: float = 0.0


@dataclass
class GatewayResponse:
    """Represents a response from Gateway"""
    text: str
    success: bool
    error: Optional[str] = None


@dataclass
class BridgeConfig:
    """Configuration for the bridge"""
    signal_phone: str
    signal_ws_url: str
    signal_api_url: str
    gateway_ws_url: str
    gateway_token: str
    session_id: str
    log_file: str
