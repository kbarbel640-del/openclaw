#!/usr/bin/env python3
"""
Interfaces: Abstract base classes for the bridge components
"""
from abc import ABC, abstractmethod
from typing import AsyncIterator, Optional
from models import SignalMessage, GatewayResponse, BridgeConfig


class ISignalReceiver(ABC):
    """Interface for receiving Signal messages"""
    
    @abstractmethod
    async def connect(self) -> bool:
        """Establish connection to Signal service"""
        pass
    
    @abstractmethod
    async def receive(self) -> AsyncIterator[SignalMessage]:
        """Stream incoming Signal messages"""
        pass
    
    @abstractmethod
    async def disconnect(self):
        """Close connection"""
        pass
    
    @abstractmethod
    def is_connected(self) -> bool:
        """Check connection status"""
        pass


class IGatewayClient(ABC):
    """Interface for Gateway communication"""
    
    @abstractmethod
    async def connect(self) -> bool:
        """Establish connection to Gateway"""
        pass
    
    @abstractmethod
    async def send_message(self, session_key: str, message: str) -> GatewayResponse:
        """Send message to Gateway session"""
        pass
    
    @abstractmethod
    async def listen_events(self) -> AsyncIterator[dict]:
        """Stream Gateway events"""
        pass
    
    @abstractmethod
    async def disconnect(self):
        """Close connection"""
        pass


class ISignalSender(ABC):
    """Interface for sending Signal messages"""
    
    @abstractmethod
    async def send(self, message: str, recipient: Optional[str] = None) -> bool:
        """Send message via Signal"""
        pass


class IMessageProcessor(ABC):
    """Interface for processing messages"""
    
    @abstractmethod
    async def process(self, message: SignalMessage) -> Optional[str]:
        """Process message and return response"""
        pass
