#!/usr/bin/env python3
"""
Processor: Message routing and business logic
"""
import asyncio
import logging
from typing import Optional

from models import SignalMessage, GatewayResponse
from interfaces import IMessageProcessor, ISignalReceiver, IGatewayClient, ISignalSender


logger = logging.getLogger(__name__)


class MessageProcessor(IMessageProcessor):
    """Routes messages between Signal, Gateway, and back to Signal"""
    
    def __init__(
        self,
        receiver: ISignalReceiver,
        gateway: IGatewayClient,
        sender: ISignalSender,
        session_id: str
    ):
        self.receiver = receiver
        self.gateway = gateway
        self.sender = sender
        self.session_id = session_id
    
    async def process(self, message: SignalMessage) -> Optional[str]:
        """Process Signal message and return response text"""
        try:
            # Inject to Gateway
            wrapped_message = f"[Signal/{message.source.value}] {message.text}"
            gateway_response = await self.gateway.send_message(
                self.session_id,
                wrapped_message
            )
            
            if gateway_response.success and gateway_response.text:
                logger.info(f"🤖 Response: {gateway_response.text[:50]}...")
                return gateway_response.text
            
            # Send fallback if Gateway failed
            fallback = "⚠️ 处理超时，请稍后重试"
            await self.sender.send(fallback)
            return None
            
        except Exception as e:
            logger.error(f"❌ Process error: {e}")
            await self.sender.send(f"⚠️ 处理错误: {str(e)[:50]}")
            return None


class BridgeOrchestrator:
    """Orchestrates all bridge components"""
    
    def __init__(
        self,
        receiver: ISignalReceiver,
        gateway: IGatewayClient,
        sender: ISignalSender,
        processor: MessageProcessor
    ):
        self.receiver = receiver
        self.gateway = gateway
        self.sender = sender
        self.processor = processor
        self._running = False
    
    @property
    def is_running(self) -> bool:
        return self._running
    
    async def start(self):
        """Start all components"""
        logger.info("🚀 Starting bridge...")
        
        # Connect to Signal
        if not await self.receiver.connect():
            logger.error("❌ Failed to connect to Signal")
            return
        
        # Connect to Gateway
        if not await self.gateway.connect():
            logger.error("❌ Failed to connect to Gateway")
            await self.receiver.disconnect()
            return
        
        self._running = True
        logger.info("✅ Bridge started")
        
        # Run Signal listener and Gateway event listener concurrently
        await asyncio.gather(
            self._signal_listener(),
            self._gateway_listener()
        )
    
    async def stop(self):
        """Stop all components"""
        logger.info("🛑 Stopping bridge...")
        self._running = False
        await self.receiver.disconnect()
        await self.gateway.disconnect()
        await self.sender.close()
        logger.info("🛑 Bridge stopped")
    
    async def _signal_listener(self):
        """Listen for Signal messages"""
        logger.info("📥 Starting Signal listener...")
        async for message in self.receiver.receive():
            if not self._running:
                break
            logger.info(f"📨 Signal message: {message.text[:50]}...")
            await self.processor.process(message)
    
    async def _gateway_listener(self):
        """Listen for Gateway events"""
        logger.info("📥 Starting Gateway listener...")
        async for event in self.gateway.listen_events():
            if not self._running:
                break
            event_type = event.get("event", "unknown")
            logger.info(f"📥 Gateway event: {event_type}")
