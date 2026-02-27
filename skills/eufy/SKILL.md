---
name: eufy
description: Manages Eufy Security cameras via eufy-security-ws on honkbox. Use for surveillance tasks, camera control, stream access, and event monitoring.
---

# Eufy Security Integration

Home surveillance system using Eufy cameras with eufy-security-ws running on honkbox.

## Camera Registry

| Name           | Model                 | MAC               | IP            | Location | Serial           | Features                       |
| -------------- | --------------------- | ----------------- | ------------- | -------- | ---------------- | ------------------------------ |
| honkcam-office | Indoor Cam 2K (T8400) | 8C:85:80:DA:6D:A5 | 192.168.1.160 | Office   | T8400P2021380A13 | 2K, Person/Pet detect, MicroSD |

**Adding new cameras:** Update this table AND `/honklab` skill IoT section.

## Architecture

```
Eufy Cameras → Eufy Cloud → eufy-security-ws (honkbox:3000) → Claude/Scripts
                                    ↓
                            WebSocket API (ws://honkbox.local:3001)
```

**Note:** Indoor Cam 2K (T8400) is cloud-connected only - no local RTSP. Access via P2P through eufy-security-ws.

## eufy-security-ws on honkbox

**Container:** `bropat/eufy-security-ws:latest`
**Port:** 3001 (WebSocket) - changed from 3000 due to Next.js conflict
**Data:** `/home/klabo/eufy-security-ws/data` (persistent config/tokens)
**Config:** `/home/klabo/eufy-security-ws/docker-compose.yml`

### Environment Variables

| Variable                   | Description                                  | Default   |
| -------------------------- | -------------------------------------------- | --------- |
| `USERNAME`                 | Eufy account email                           | Required  |
| `PASSWORD`                 | Eufy account password                        | Required  |
| `COUNTRY`                  | Country code (US, DE, etc.)                  | Required  |
| `TRUSTED_DEVICE_NAME`      | 2FA device label                             | `honklab` |
| `EVENT_DURATION_SECONDS`   | Event reset duration                         | `10`      |
| `P2P_CONNECTION_SETUP`     | 0=prefer local, 1=local only, 2=prefer cloud | `0`       |
| `POLLING_INTERVAL_MINUTES` | Cloud poll interval                          | `10`      |
| `STATION_IP_ADDRESSES`     | Manual IP: `SERIAL:IP;SERIAL2:IP2`           | Auto      |
| `DEBUG`                    | Verbose logging                              | unset     |

### Container Commands

```bash
# Start
ssh honkbox "cd ~/eufy-security-ws && docker compose up -d"

# Stop
ssh honkbox "cd ~/eufy-security-ws && docker compose down"

# Logs
ssh honkbox "docker logs -f eufy-security-ws"

# Restart
ssh honkbox "docker restart eufy-security-ws"

# Status
ssh honkbox "docker ps | grep eufy"
```

### First-Time Setup

1. Create `.env` file:

```bash
ssh honkbox "cat > ~/eufy-security-ws/.env << 'EOF'
EUFY_USERNAME=your_email@example.com
EUFY_PASSWORD=your_password
EOF"
```

2. Start container:

```bash
ssh honkbox "cd ~/eufy-security-ws && docker compose up -d"
```

3. Check logs for 2FA prompt:

```bash
ssh honkbox "docker logs eufy-security-ws"
```

## WebSocket API

Connect to `ws://honkbox.local:3001`

### Connection Flow

1. Server sends version info:

```json
{
  "type": "version",
  "driverVersion": "2.x.x",
  "serverVersion": "1.x.x",
  "minSchemaVersion": 0,
  "maxSchemaVersion": 21
}
```

2. Client sets schema version:

```json
{ "messageId": "1", "command": "set_api_schema", "schemaVersion": 21 }
```

3. Start listening for events:

```json
{ "messageId": "2", "command": "start_listening" }
```

4. Server responds with full state (devices, stations, driver info).

### Message Format

```json
{
  "messageId": "unique-id",
  "command": "namespace.command_name",
  "params": {}
}
```

### Commands by Schema Version

#### Core (Schema 2+)

- `start_listening` - Begin receiving state and events
- `set_api_schema` - Set API version
- `device.startLivestream` - Start P2P video stream
- `device.stopLivestream` - Stop stream
- `device.isLiveStreaming` - Check stream status

#### Schema 3+

- `device.triggerAlarm` - Trigger camera alarm
- `device.resetAlarm` - Reset alarm
- `device.panAndTilt` - PTZ control (if supported)
- `device.quickResponse` - Send quick response audio
- `device.startDownload` - Download recording
- `device.cancelDownload` - Cancel download
- `device.getVoices` - Get available voice responses
- `device.hasProperty` - Check property support
- `device.hasCommand` - Check command support
- `device.getCommands` - List available commands
- `driver.getAlarmEvents` - Get alarm history
- `driver.getVideoEvents` - Get video history
- `driver.getHistoryEvents` - Get event history
- `station.triggerAlarm` - Station-level alarm
- `station.resetAlarm` - Reset station alarm

#### Schema 6+

- `station.startRTSPLivestream` - Start RTSP (if camera supports)
- `station.stopRTSPLivestream` - Stop RTSP
- `station.isRTSPLiveStreaming` - Check RTSP status

#### Schema 9+

- `driver.setLogLevel` - Set logging verbosity
- `driver.getLogLevel` - Get current log level
- `driver.startListeningLogs` - Stream logs
- `driver.stopListeningLogs` - Stop log stream
- `driver.isMqttConnected` - Check MQTT status
- `device.calibrateLock` - Calibrate smart lock

#### Schema 13+

- `device.snooze` - Snooze notifications
- `device.startTalkback` - Start two-way audio
- `device.stopTalkback` - Stop two-way audio
- `device.isTalkbackOngoing` - Check talkback status
- `device.talkbackAudioData` - Send audio data
- `device.addUser` / `deleteUser` / `getUsers` - User management
- `device.verifyPin` - Verify PIN code

#### Schema 15+

- `station.chime` - Trigger chime

#### Schema 18+

- `station.databaseQueryLatestInfo` - Query local DB
- `station.databaseQueryLocal` - Local DB query
- `station.databaseCountByDate` - Count by date
- `station.databaseDelete` - Delete recordings

#### Schema 21+ (Latest)

- `device.presetPosition` - Go to preset
- `device.savePresetPosition` - Save current position
- `device.deletePresetPosition` - Delete preset
- `device.open` - Open (locks/safes)
- `driver.isListeningLogs` - Check log listener status

### Event Types

Subscribe via `start_listening`, then receive:

- `device.motion_detected` - Motion detected
- `device.person_detected` - Person detected
- `device.pet_detected` - Pet detected
- `device.vehicle_detected` - Vehicle detected
- `device.doorbell_pressed` - Doorbell ring
- `device.crying_detected` - Baby crying
- `device.sound_detected` - Sound detection
- `device.livestream_started` - Stream began
- `device.livestream_stopped` - Stream ended

### Python WebSocket Client Example

```python
import asyncio
import websockets
import json

async def connect_eufy():
    uri = "ws://honkbox.local:3001"
    async with websockets.connect(uri) as ws:
        # Wait for version
        version = await ws.recv()
        print(f"Server: {version}")

        # Set schema
        await ws.send(json.dumps({
            "messageId": "1",
            "command": "set_api_schema",
            "schemaVersion": 21
        }))
        await ws.recv()

        # Start listening
        await ws.send(json.dumps({
            "messageId": "2",
            "command": "start_listening"
        }))

        # Receive state with all devices
        state = await ws.recv()
        data = json.loads(state)

        for device in data.get('result', {}).get('state', {}).get('devices', []):
            print(f"Camera: {device['name']} ({device['serialNumber']})")

        # Listen for events
        while True:
            msg = await ws.recv()
            event = json.loads(msg)
            if event.get('type') == 'event':
                print(f"Event: {event}")

asyncio.run(connect_eufy())
```

### Node.js Client Example

```javascript
const WebSocket = require("ws");
const ws = new WebSocket("ws://honkbox.local:3001");

ws.on("open", () => {
  // Set schema after receiving version
});

ws.on("message", (data) => {
  const msg = JSON.parse(data);

  if (msg.type === "version") {
    ws.send(
      JSON.stringify({
        messageId: "1",
        command: "set_api_schema",
        schemaVersion: 21,
      }),
    );
  }

  if (msg.messageId === "1") {
    ws.send(
      JSON.stringify({
        messageId: "2",
        command: "start_listening",
      }),
    );
  }

  if (msg.type === "event") {
    console.log("Event:", msg);
  }
});
```

## Camera Models & Features

| Model             | RTSP     | P2P | Local Storage | Person | Pet | Pan/Tilt |
| ----------------- | -------- | --- | ------------- | ------ | --- | -------- |
| T8400 (Indoor 2K) | No       | Yes | MicroSD       | Yes    | Yes | No       |
| E220              | Yes\*    | Yes | Yes           | Yes    | No  | No       |
| S220              | Yes\*    | Yes | Yes           | Yes    | Yes | No       |
| S330              | Yes\*    | Yes | Yes           | Yes    | Yes | No       |
| 2C Pro            | HomeBase | Yes | HomeBase      | Yes    | No  | No       |

\*Requires enabling in Eufy app: Settings → Storage → RTSP Stream

## Integration Patterns

### Motion Alert to Discord

```python
# On device.motion_detected event:
if event['event'] == 'device.motion_detected':
    device_name = get_device_name(event['serialNumber'])
    send_discord_alert(f"Motion detected on {device_name}")
```

### Pool Safety Monitor

```python
POOL_CAMERAS = ['T8400P2021380A13']  # Add pool camera serials

def on_person_detected(event):
    if event['serialNumber'] in POOL_CAMERAS:
        # Check time of day, presence of adults, etc.
        # Alert if conditions warrant
        pass
```

### Recording on Event

```python
# When person detected, start livestream and record
await ws.send(json.dumps({
    "messageId": str(uuid4()),
    "command": "device.startLivestream",
    "params": {"serialNumber": "T8400P2021380A13"}
}))
# Handle livestream data...
```

## Troubleshooting

### Container Won't Start

1. Check credentials in `.env`
2. Verify `COUNTRY` matches Eufy app setting
3. Check for 2FA: `docker logs eufy-security-ws`

### 2FA Required

- Check email for Eufy verification
- May need `TRUSTED_DEVICE_NAME` to match existing device
- Try `driver.setCaptcha` command if CAPTCHA blocked

### Camera Not Found

1. Camera must be set up in Eufy app first
2. Verify camera is online (green light, app shows active)
3. Check `COUNTRY` code exactly matches app

### P2P Connection Fails

1. Set `P2P_CONNECTION_SETUP=2` (cloud only) as fallback
2. Check firewall allows UDP traffic
3. Ensure honkbox and camera on same network

### High Latency Streams

1. Use `P2P_CONNECTION_SETUP=1` (local only)
2. Add manual IP in `STATION_IP_ADDRESSES` if known
3. Check WiFi signal strength to camera

## References

- [eufy-security-ws GitHub](https://github.com/bropat/eufy-security-ws)
- [API Documentation](https://bropat.github.io/eufy-security-ws/)
- [Schema Versions](https://github.com/bropat/eufy-security-ws/blob/master/docs/api_schema_versions.md)
- [Docker Setup](https://github.com/bropat/eufy-security-ws/blob/master/docs/docker.md)

## Face Recognition Integration

Person detection events can be enhanced with face recognition using the Python Vision server on honk.

### Architecture

```
honkbox (eufy-monitor.py)                   honk (face_server.py)
┌─────────────────────────┐                 ┌─────────────────────┐
│ Person detected event   │                 │ Face Recognition    │
│ → Capture snapshot      │─── HTTP POST ──→│ Server (port 8100)  │
│ → POST /recognize       │                 │ macOS Vision.fw     │
│ → Format Discord msg    │←── JSON ────────│ Returns face list   │
└─────────────────────────┘                 └─────────────────────┘
```

### Face Recognition Server on honk

**URL:** `http://192.168.1.44:8100` (or `http://honk.local:8100`)
**Location:** `~/face-recognition-server/face_server.py`
**Dependencies:** `~/face-recognition-server/venv` (aiohttp, pyobjc-framework-Vision)
**Database:** `~/face-recognition-server/Data/known_faces.json`

### Server Management

```bash
# Start server
ssh honk 'source ~/face-recognition-server/venv/bin/activate && cd ~/face-recognition-server && nohup python3 face_server.py > /tmp/face-server-py.log 2>&1 &'

# Check status
ssh honk 'pgrep -f face_server && curl -s http://localhost:8100/health'

# View logs
ssh honk 'tail -f /tmp/face-server-py.log'

# Stop server
ssh honk 'pkill -f face_server.py'
```

### API Endpoints

| Endpoint        | Method | Description                                                   |
| --------------- | ------ | ------------------------------------------------------------- |
| `/health`       | GET    | Health check                                                  |
| `/recognize`    | POST   | Detect faces in image (JSON: `{imageBase64: "..."}`)          |
| `/enroll`       | POST   | Enroll face (JSON: `{personName: "...", imageBase64: "..."}`) |
| `/faces`        | GET    | List enrolled faces                                           |
| `/faces/{name}` | DELETE | Remove enrolled face                                          |

### Test Face Recognition

```bash
# From honkbox
python3 << 'EOF'
import aiohttp, asyncio, base64

async def test():
    with open("/tmp/eufy_snapshot.jpg", "rb") as f:
        b64 = base64.b64encode(f.read()).decode()
    async with aiohttp.ClientSession() as s:
        async with s.post("http://192.168.1.44:8100/recognize",
                          json={"imageBase64": b64}) as r:
            print(await r.json())

asyncio.run(test())
EOF
```

### eufy-monitor.py Integration

eufy-monitor.py on honkbox automatically calls the face recognition server when a person is detected.

- **Known faces:** Discord message: `👤 **Joel** detected on **honkcam-office** at 19:30:00`
- **Unknown faces:** Discord message: `🚨 **Unknown person** detected on **honkcam-office** at 19:30:00`

### Configuration

In `/home/klabo/eufy-security-ws/eufy-monitor.py`:

```python
FACE_RECOGNITION_URL = "http://192.168.1.44:8100"
FACE_RECOGNITION_ENABLED = True
```

### Enrolling Family Members

```bash
# Take a clear face photo and enroll
curl -X POST http://192.168.1.44:8100/enroll \
  -H "Content-Type: application/json" \
  -d "{\"personName\": \"joel\", \"imageBase64\": \"$(base64 -i photo.jpg)\"}"

# List enrolled faces
curl http://192.168.1.44:8100/faces
```

## Status

- **eufy-security-ws:** Running on honkbox:3001
- **honkcam-office:** Connected at 192.168.1.160 via P2P
- **Push notifications:** Active
- **Face recognition:** Running on honk:8100

**Note:** Your Eufy account has additional cameras (T8410 series) that timed out - these may be offline or at another location.
