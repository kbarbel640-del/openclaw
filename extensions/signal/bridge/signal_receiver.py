#!/usr/bin/env python3
"""
Signal Receiver: Handles WebSocket connection to infra-signal
"""
import asyncio
import json
import logging
import websockets
from typing import AsyncIterator, Optional

from models import SignalMessage, MessageSource
from interfaces import ISignalReceiver


logger = logging.getLogger(__name__)


class SignalReceiver(ISignalReceiver):
    """Receives messages from Signal via infra-signal WebSocket"""
    
    def __init__(self, ws_url: str, phone: str):
        self.ws_url = ws_url
        self.phone = phone
        self._ws = None
        self._connected = False
        self._reconnect_delay = 5
    
    @property
    def is_connected(self) -> bool:
        return self._connected
    
    async def connect(self) -> bool:
        """Establish WebSocket connection to infra-signal"""
        try:
            self._ws = await asyncio.wait_for(
                websockets.connect(self.ws_url, ping_interval=30),
                timeout=10
            )
            self._connected = True
            self._reconnect_delay = 5
            logger.info("✅ Signal WS connected")
            return True
        except Exception as e:
            logger.error(f"❌ Signal WS connect failed: {e}")
            self._connected = False
            return False
    
    async def receive(self) -> AsyncIterator[SignalMessage]:
        """Yield incoming Signal messages"""
        while self._connected and self._ws:
            try:
                async for msg in self._ws:
                    try:
                        data = json.loads(msg)
                        envelope = data.get("envelope") or data.get("params", {}).get("envelope")
                        
                        if envelope:
                            message = self._parse_envelope(envelope)
                            if message:
                                yield message
                                
                    except json.JSONDecodeError:
                        logger.warning(f"⚠️ Invalid JSON: {msg[:100]}")
                        
            except websockets.exceptions.ConnectionClosed:
                logger.error("❌ Signal WS closed")
                self._connected = False
                break
            except Exception as e:
                logger.error(f"❌ Signal receive error: {e}")
                self._connected = False
                break
    
    def _parse_envelope(self, envelope: dict) -> Optional[SignalMessage]:
        """Parse Signal envelope into SignalMessage"""
        # Handle Note to Self (syncMessage)
        sync_message = envelope.get("syncMessage", {})
        if sync_message:
            sent = sync_message.get("sentMessage", {})
            sync_text = sent.get("message")
            if sync_text:
                logger.info(f"📨 [SYNC] {sync_text[:100]}")
                return SignalMessage(
                    text=sync_text,
                    source=MessageSource.NOTE_SELF,
                    sender=self.phone
                )
        
        # Handle regular messages
        data_message = envelope.get("dataMessage", {})
        source = envelope.get("source", "")
        
        # Skip own messages (echo prevention)
        if source == self.phone:
            return None
        
        message_text = data_message.get("message")
        if message_text:
            logger.info(f"📨 [DATA] From {source}: {message_text[:100]}")
            return SignalMessage(
                text=message_text,
                source=MessageSource.DIRECT,
                sender=source
            )
        
        return None
    
    async def disconnect(self):
        """Close WebSocket connection"""
        if self._ws:
            await self._ws.close()
            self._ws = None
            self._connected = False
            logger.info("🔌 Signal WS disconnected")
    
    async def reconnect_loop(self):
        """Reconnection loop for Signal WS"""
        while not self._connected:
            logger.info(f"🔄 Reconnecting to Signal in {self._reconnect_delay}s...")
            await asyncio.sleep(self._reconnect_delay)
            self._reconnect_delay = min(self._reconnect_delay * 2, 60)
            if await self.connect():
                return
