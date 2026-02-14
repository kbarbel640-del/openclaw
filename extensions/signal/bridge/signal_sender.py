#!/usr/bin/env python3
"""
Signal Sender: Handles sending messages via infra-signal API
"""
import asyncio
import aiohttp
import logging
from typing import Optional

from interfaces import ISignalSender


logger = logging.getLogger(__name__)


class SignalSender(ISignalSender):
    """Sends messages to Signal via infra-signal REST API"""
    
    def __init__(self, api_url: str, phone: str):
        self.api_url = api_url
        self.phone = phone
        self._session = None
    
    @property
    def session(self) -> aiohttp.ClientSession:
        """Get or create aiohttp session"""
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession()
        return self._session
    
    async def send(self, message: str, recipient: Optional[str] = None) -> bool:
        """Send message via Signal API"""
        target = recipient or self.phone
        
        payload = {
            "message": message,
            "messageType": "chat",
            "number": self.phone,
            "recipients": [target]
        }
        
        try:
            async with self.session as session:
                async with session.post(
                    f"{self.api_url}/v2/send",
                    json=payload,
                    timeout=aiohttp.ClientTimeout(total=30)
                ) as resp:
                    if resp.status in (200, 201):
                        logger.info(f"📱 Sent: {message[:50]}...")
                        return True
                    else:
                        error = await resp.text()
                        logger.error(f"❌ HTTP {resp.status}: {error}")
                        return False
        except Exception as e:
            logger.error(f"❌ Send error: {e}")
            return False
    
    async def close(self):
        """Close aiohttp session"""
        if self._session and not self._session.closed:
            await self._session.close()
            logger.info("🔌 Signal sender session closed")
