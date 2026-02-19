# Auto-Update System for OpenClaw CLI

A comprehensive auto-update system for OpenClaw that provides configurable automatic background updates with notification support.

## Features

### 🚀 Core Features

- **Auto-Update**: Enable automatic background updates with a single command
- **Flexible Scheduling**: Choose from daily, weekly, or manual update checks
- **Channel Support**: Stable, Beta, or Dev channels
- **Version Skipping**: Skip specific versions (e.g., buggy releases)
- **Quiet Mode**: Suppress non-critical update messages

### 🔔 Notifications

- **Pre-Update Notifications**: Get notified when updates are available
- **Post-Update Notifications**: Confirm successful updates
- **Failure Alerts**: Get alerted when updates fail

### 🎛️ Configuration

All settings can be configured via CLI commands:

```bash
# Enable auto-update
openclaw update --auto on

# Set daily checks
openclaw update --interval daily

# Skip specific versions
openclaw update --skip "2026.2.10,2026.2.11"
```

## Installation

This feature will be included in OpenClaw v2026.2.18+. 

For manual installation:

```bash
# Clone OpenClaw
git clone https://github.com/openclaw/openclaw.git
cd openclaw

# Install dependencies
pnpm install

# Build
pnpm build
```

## Usage

### Basic Commands

```bash
# Check for updates (manual)
openclaw update

# View update status
openclaw update status

# View current configuration
openclaw update config
```

### Auto-Update Configuration

```bash
# Enable auto-update
openclaw update --auto on

# Disable auto-update
openclaw update --auto off

# Set update channel (stable | beta | dev)
openclaw update --channel beta

# Set check interval (daily | weekly | manual)
openclaw update --interval daily
```

### Notification Settings

```bash
# Enable notifications
openclaw update --notify on

# Disable notifications  
openclaw update --notify off
```

### Advanced Options

```bash
# Skip specific versions
openclaw update --skip "2026.2.10,2026.2.11"

# Non-interactive mode (skip confirmations)
openclaw update --yes

# Don't restart gateway after update
openclaw update --no-restart

# JSON output
openclaw update --json
openclaw update status --json
```

## Configuration File

Settings are stored in `~/.openclaw/update-config.json`:

```json
{
  "auto": true,
  "channel": "stable",
  "interval": "weekly",
  "checkTime": "09:00",
  "notify": true,
  "notifyOnComplete": true,
  "quiet": false,
  "skipVersions": []
}
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `auto` | boolean | false | Enable automatic background updates |
| `channel` | string | stable | Update channel (stable/beta/dev) |
| `interval` | string | weekly | How often to check for updates |
| `checkTime` | string | "09:00" | Time of day to check for updates |
| `notify` | boolean | true | Notify when update is available |
| `notifyOnComplete` | boolean | true | Notify after successful update |
| `quiet` | boolean | false | Suppress non-critical messages |
| `skipVersions` | array | [] | Versions to skip |

## Background Service

When auto-update is enabled, the Gateway will:

1. **Startup Check**: Verify update status on Gateway start
2. **Scheduled Checks**: Check for updates based on interval
3. **Silent Download**: Download updates in background
4. **Graceful Restart**: Restart Gateway after successful update
5. **Rollback Support**: Revert if update fails

### Scheduling

- **daily**: Check every day at `checkTime`
- **weekly**: Check once per week (Sunday) at `checkTime`
- **manual**: Only check when explicitly requested

## Troubleshooting

### Update Failed

```bash
# View detailed error
openclaw update --json

# Check logs
openclaw logs --follow
```

### Reset Configuration

```bash
openclaw update config --reset
```

### Manual Rollback

```bash
# Install specific version
npm install -g openclaw@2026.2.6

# Run doctor
openclaw doctor
```

## Security

- Package signatures verified before installation
- User opt-in required for auto-update (default: disabled)
- Full audit trail of update attempts
- Secure version skipping

## Future Enhancements

### Planned Features

- [ ] Telegram commands for update control
- [ ] Discord notifications
- [ ] Email notifications
- [ ] Webhook support for CI/CD integration
- [ ] Delta updates for faster downloads
- [ ] Scheduled maintenance windows

## Contributing

This is an official OpenClaw feature. To contribute:

1. Fork the repository
2. Create a feature branch
3. Submit a Pull Request

## License

MIT License - See LICENSE file for details
