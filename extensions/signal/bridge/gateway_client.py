#!/usr/bin/env python3
"""
Gateway Client: Handles WebSocket connection to OpenClaw Gateway
"""
import asyncio
import json
import logging
import uuid
import websockets
from typing import AsyncIterator, Optional

from models import GatewayResponse
from interfaces import IGatewayClient


logger = logging.getLogger(__name__)


class GatewayClient(IGatewayClient):
    """Communicates with OpenClaw Gateway via WebSocket"""
    
    def __init__(self, ws_url: str, token: str):
        self.ws_url = ws_url
        self.token = token
        self._ws = None
        self._connected = False
    
    @property
    def is_connected(self) -> bool:
        return self._connected
    
    async def connect(self) -> bool:
        """Establish WebSocket connection with Gateway protocol"""
        try:
            self._ws = await asyncio.wait_for(
                websockets.connect(self.ws_url, open_timeout=10),
                timeout=10
            )
            
            # Wait for connect.challenge
            response = await asyncio.wait_for(self._ws.recv(), timeout=10)
            data = json.loads(response)
            
            if data.get("type") == "event" and data.get("event") == "connect.challenge":
                logger.info("📤 Sending connect request...")
                
                connect_params = {
                    "minProtocol": 3,
                    "maxProtocol": 3,
                    "client": {
                        "id": "cli",
                        "displayName": "Signal Bridge",
                        "version": "1.0.0",
                        "platform": "linux",
                        "mode": "backend",
                    },
                    "auth": {"token": self.token}
                }
                
                connect_frame = {
                    "type": "req",
                    "id": str(uuid.uuid4()),
                    "method": "connect",
                    "params": connect_params
                }
                
                await self._ws.send(json.dumps(connect_frame))
                
                # Wait for hello-ok
                response = await asyncio.wait_for(self._ws.recv(), timeout=10)
                data = json.loads(response)
                
                if data.get("type") == "res" and data.get("ok"):
                    payload = data.get("payload", {})
                    if payload.get("type") == "hello-ok":
                        self._connected = True
                        logger.info("✅ Gateway connected")
                        return True
            
            logger.error(f"❌ Gateway connect failed: {data}")
            return False
            
        except Exception as e:
            logger.error(f"❌ Connection error: {e}")
            self._connected = False
            return False
    
    async def send_message(self, session_key: str, message: str) -> GatewayResponse:
        """Send message to Gateway session and wait for response"""
        if not self._connected or not self._ws:
            return GatewayResponse(
                text="",
                success=False,
                error="Not connected to Gateway"
            )
        
        req_id = str(uuid.uuid4())
        
        frame = {
            "type": "req",
            "id": req_id,
            "method": "chat.send",
            "params": {
                "sessionKey": session_key,
                "message": message,
                "deliver": True,
                "idempotencyKey": str(uuid.uuid4())
            }
        }
        
        try:
            await self._ws.send(json.dumps(frame))
            logger.info(f"📤 chat.send: {message[:50]}...")
            
            # Wait for response
            response = await asyncio.wait_for(self._ws.recv(), timeout=120)
            data = json.loads(response)
            
            if data.get("id") == req_id and data.get("ok"):
                payload = data.get("payload", {})
                # chat.send returns runId for async execution
                run_id = payload.get("runId", "")
                return GatewayResponse(
                    text=f"[queued: {run_id}]",
                    success=True
                )
            else:
                return GatewayResponse(
                    text="",
                    success=False,
                    error=f"Unexpected response: {data}"
                )
            
        except asyncio.TimeoutError:
            return GatewayResponse(
                text="",
                success=False,
                error="Timeout waiting for response"
            )
        except Exception as e:
            return GatewayResponse(
                text="",
                success=False,
                error=str(e)
            )
    
    async def listen_events(self) -> AsyncIterator[dict]:
        """Yield Gateway events"""
        while self._connected and self._ws:
            try:
                async for raw_msg in self._ws:
                    data = json.loads(raw_msg)
                    
                    # Only yield events (not responses, those are handled inline)
                    if data.get("type") == "event":
                        yield data
                        
            except websockets.exceptions.ConnectionClosed:
                logger.error("❌ Gateway WS closed")
                self._connected = False
                break
            except Exception as e:
                logger.error(f"❌ Listen error: {e}")
                break
    
    async def disconnect(self):
        """Close WebSocket connection"""
        if self._ws:
            await self._ws.close()
            self._ws = None
            self._connected = False
            logger.info("🔌 Gateway disconnected")
