#!/usr/bin/env python3
"""
Config: Configuration management for the bridge
"""
import os
from dataclasses import dataclass, field

from models import BridgeConfig


def get_env(key: str, default: str = "") -> str:
    """Get environment variable"""
    return os.getenv(key, default)


def get_bool(key: str, default: bool = False) -> bool:
    """Get boolean environment variable"""
    value = os.getenv(key, "").lower()
    if value in ("true", "1", "yes"):
        return True
    elif value in ("false", "0", "no"):
        return False
    return default


@dataclass
class Config:
    """Configuration loaded from environment variables"""
    
    # Signal settings
    signal_phone: str = "+14259798283"
    signal_ws_url: str = "ws://infra-signal:8080/v1/receive/%2B14259798283"
    signal_api_url: str = "http://infra-signal:8080"
    
    # Gateway settings
    gateway_ws_url: str = "ws://openclaw-gateway:18789"
    gateway_token: str = ""
    session_id: str = "agent:main:dm:+14259798283"
    
    # Logging
    log_file: str = "/tmp/hikari-bridge.log"
    
    # Bridge settings
    reconnect_delay: int = 5
    gateway_timeout: int = 120
    signal_timeout: int = 30
    
    @classmethod
    def from_env(cls) -> "Config":
        """Load configuration from environment variables"""
        return cls(
            signal_phone=get_env("SIGNAL_PHONE_NUMBER", "+14259798283"),
            signal_ws_url=get_env("SIGNAL_WS_URL", "ws://infra-signal:8080/v1/receive/%2B14259798283"),
            signal_api_url=get_env("SIGNAL_API_URL", "http://infra-signal:8080"),
            gateway_ws_url=get_env("GATEWAY_WS_URL", "ws://openclaw-gateway:18789"),
            gateway_token=get_env("GATEWAY_TOKEN", ""),
            session_id=get_env("SESSION_ID", "agent:main:dm:+14259798283"),
            log_file=get_env("LOG_FILE", "/tmp/hikari-bridge.log"),
        )
    
    def to_bridge_config(self) -> BridgeConfig:
        """Convert to BridgeConfig dataclass"""
        return BridgeConfig(
            signal_phone=self.signal_phone,
            signal_ws_url=self.signal_ws_url,
            signal_api_url=self.signal_api_url,
            gateway_ws_url=self.gateway_ws_url,
            gateway_token=self.gateway_token,
            session_id=self.session_id,
            log_file=self.log_file,
        )
    
    def validate(self) -> bool:
        """Validate required configuration"""
        errors = []
        
        if not self.signal_phone:
            errors.append("SIGNAL_PHONE_NUMBER is required")
        if not self.signal_ws_url:
            errors.append("SIGNAL_WS_URL is required")
        if not self.gateway_ws_url:
            errors.append("GATEWAY_WS_URL is required")
        if not self.gateway_token:
            errors.append("GATEWAY_TOKEN is required")
        if not self.session_id:
            errors.append("SESSION_ID is required")
        
        if errors:
            for error in errors:
                print(f"❌ {error}")
            return False
        
        return True
