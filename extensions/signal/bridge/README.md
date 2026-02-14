# Signal Bridge

Python-based Signal bridge for OpenClaw that connects to signal-cli HTTP API and forwards messages to OpenClaw Gateway via WebSocket.

## Overview

This bridge replaces the native signal-cli integration with a Python-based solution that:

- Connects to signal-cli WebSocket API for receiving messages
- Connects to OpenClaw Gateway WebSocket for sending messages to AI
- Sends responses back to Signal via signal-cli HTTP API

## Architecture

```
Signal App → signal-cli → Signal WebSocket → Python Bridge → Gateway WebSocket → OpenClaw AI
                                              ↓
Signal App ← signal-cli ← HTTP API ←──┬── Response
                                      └── Python Bridge
```

## Components

- **signal_receiver.py**: Connects to signal-cli WebSocket and receives messages
- **gateway_client.py**: Connects to OpenClaw Gateway WebSocket
- **signal_sender.py**: Sends messages via signal-cli HTTP API
- **processor.py**: Routes messages between components
- **main.py**: Entry point that orchestrates all components

## Configuration

Add to your OpenClaw config:

```yaml
channels:
  signal:
    enabled: true
    account: "+1234567890" # Your Signal number
    httpUrl: "http://localhost:8080" # signal-cli HTTP API URL
    useBridge: true # Enable Python bridge mode
    bridgePythonPath: "python3" # Optional: Python executable path
    bridgeLogFile: "/tmp/openclaw-signal-bridge.log" # Optional: Log file path
```

## Prerequisites

1. signal-cli running with HTTP API enabled:

   ```bash
   signal-cli daemon --http 0.0.0.0:8080
   ```

2. Python 3.11+ with required packages:
   ```bash
   pip install aiohttp websockets
   # or
   cd extensions/signal/bridge && pip install -r requirements.txt
   ```

## Environment Variables

The bridge uses these environment variables (set automatically by the plugin):

- `SIGNAL_PHONE_NUMBER`: Your Signal phone number
- `SIGNAL_WS_URL`: WebSocket URL for signal-cli
- `SIGNAL_API_URL`: HTTP API URL for signal-cli
- `GATEWAY_WS_URL`: WebSocket URL for OpenClaw Gateway
- `GATEWAY_TOKEN`: Authentication token for Gateway
- `SESSION_ID`: Session identifier for Gateway
- `LOG_FILE`: Path to log file

## Running Standalone

For testing, you can run the bridge standalone:

```bash
cd extensions/signal/bridge
export SIGNAL_PHONE_NUMBER="+1234567890"
export SIGNAL_WS_URL="ws://localhost:8080/v1/receive/%2B1234567890"
export SIGNAL_API_URL="http://localhost:8080"
export GATEWAY_WS_URL="ws://localhost:18789"
export GATEWAY_TOKEN="your-token-here"
export SESSION_ID="agent:main:dm:+1234567890"
python3 main.py
```

## Docker

Build and run with Docker:

```bash
cd extensions/signal/bridge
docker build -t openclaw-signal-bridge .
docker run -e SIGNAL_PHONE_NUMBER=+1234567890 \
           -e SIGNAL_WS_URL=ws://host.docker.internal:8080/v1/receive/%2B1234567890 \
           -e SIGNAL_API_URL=http://host.docker.internal:8080 \
           -e GATEWAY_WS_URL=ws://host.docker.internal:18789 \
           -e GATEWAY_TOKEN=your-token \
           -e SESSION_ID=agent:main:dm:+1234567890 \
           openclaw-signal-bridge
```

## Troubleshooting

1. **Bridge won't start**: Check that Python 3.11+ is installed and required packages are available
2. **Can't connect to signal-cli**: Verify signal-cli is running with HTTP API enabled
3. **Can't connect to Gateway**: Check Gateway is running and token is correct
4. **Messages not being received**: Check Signal WebSocket URL is correct and signal-cli is properly registered

## Logs

Bridge logs are written to:

- File: `/tmp/openclaw-signal-bridge.log` (or configured path)
- Console: stdout/stderr (captured by OpenClaw)

## Development

The bridge is structured with interfaces for easy testing and extension:

- `ISignalReceiver`: Interface for receiving Signal messages
- `IGatewayClient`: Interface for Gateway communication
- `ISignalSender`: Interface for sending Signal messages
- `IMessageProcessor`: Interface for message routing
