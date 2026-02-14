#!/usr/bin/env python3
"""
Main: Entry point for the signal bridge
"""
import asyncio
import logging
import sys
import os

# Add current directory to path
sys.path.insert(0, os.path.dirname(__file__))

from config import Config
from signal_receiver import SignalReceiver
from gateway_client import GatewayClient
from signal_sender import SignalSender
from processor import MessageProcessor, BridgeOrchestrator


def setup_logging(log_file: str):
    """Configure logging"""
    os.makedirs(os.path.dirname(log_file), exist_ok=True)
    
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler(log_file),
            logging.StreamHandler(sys.stdout)
        ]
    )
    return logging.getLogger(__name__)


async def main():
    """Main entry point"""
    # Load configuration
    config = Config.from_env()
    
    if not config.validate():
        print("❌ Configuration validation failed")
        return 1
    
    # Setup logging
    logger = setup_logging(config.log_file)
    logger.info("🎯 Signal Bridge starting...")
    logger.info(f"📱 Signal: {config.signal_phone}")
    logger.info(f"🔗 Gateway: {config.gateway_ws_url}")
    logger.info(f"📋 Session: {config.session_id}")
    
    # Create components
    receiver = SignalReceiver(config.signal_ws_url, config.signal_phone)
    gateway = GatewayClient(config.gateway_ws_url, config.gateway_token)
    sender = SignalSender(config.signal_api_url, config.signal_phone)
    processor = MessageProcessor(receiver, gateway, sender, config.session_id)
    orchestrator = BridgeOrchestrator(receiver, gateway, sender, processor)
    
    try:
        await orchestrator.start()
    except KeyboardInterrupt:
        logger.info("👋 Interrupted")
    finally:
        await orchestrator.stop()
    
    return 0


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
