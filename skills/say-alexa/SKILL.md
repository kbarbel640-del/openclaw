---
name: say-alexa
description: Speaks text aloud via Amazon Echo using alexacli. Use when announcing notifications, build results, timers, or any audio output to the room.
---

# Say Alexa

Speak text aloud through Amazon Echo devices from any honklab machine.

## Quick Reference

```bash
# Basic usage
say-alexa "Hello from honklab"

# Specific device
ALEXA_DEVICE="Kitchen Echo" say-alexa "Dinner is ready"

# From any machine via SSH
ssh maxblack "say-alexa 'Build complete'"
```

## Setup Status

| Machine     | alexacli                     | say-alexa         | Status        |
| ----------- | ---------------------------- | ----------------- | ------------- |
| maxblack    | `/opt/homebrew/bin/alexacli` | `~/bin/say-alexa` | ✅ Working    |
| honkbox     | `/usr/local/bin/alexacli`    | `~/bin/say-alexa` | ✅ Working    |
| honk        | `/opt/homebrew/bin/alexacli` | `~/bin/say-alexa` | ✅ Working    |
| honkair     | `~/bin/alexacli`             | `~/bin/say-alexa` | ✅ Working    |
| honkpi      | `~/bin/alexacli`             | `~/bin/say-alexa` | ✅ Working    |
| honkstorage | `~/bin/alexacli`             | `~/bin/say-alexa` | ⚠️ DNS issues |

## Installation

### macOS (Homebrew)

```bash
brew install buddyh/tap/alexacli
```

### Linux (Build from source)

```bash
git clone https://github.com/buddyh/alexa-cli.git
cd alexa-cli
go build -o alexacli ./cmd/alexa
sudo mv alexacli /usr/local/bin/
```

### Authentication (once per machine)

```bash
# Get refresh token (run on machine with browser)
npx alexa-cookie-cli

# Authenticate
alexacli auth <refresh-token>
```

## say-alexa Script

Location: `~/bin/say-alexa`

```bash
#!/bin/bash
# Say text on Echo via alexacli
if [ -z "$1" ]; then
    echo "Usage: say-alexa \"text to speak\""
    exit 1
fi
DEVICE="${ALEXA_DEVICE:-Echo}"
alexacli speak "$*" -d "$DEVICE"
```

## Use Cases

```bash
# Build notifications
say-alexa "CI pipeline failed"
say-alexa "Build complete, all tests passed"

# Timers
sleep 300 && say-alexa "5 minutes up"

# Remote announcements
ssh honkbox "say-alexa 'Bitcoin sync complete'"

# From scripts/hooks
#!/bin/bash
# post-build hook
if [ $? -eq 0 ]; then
    say-alexa "Build succeeded"
else
    say-alexa "Build failed"
fi
```

## Troubleshooting

### "Device not found"

```bash
# List available devices
alexacli devices

# Use exact device name
ALEXA_DEVICE="Echo Dot" say-alexa "test"
```

### "Unauthorized" or no response

```bash
# Re-authenticate (token expires ~14 days)
npx alexa-cookie-cli
alexacli auth <new-token>
```

### Test connectivity

```bash
alexacli devices  # Should list your Echo devices
```
