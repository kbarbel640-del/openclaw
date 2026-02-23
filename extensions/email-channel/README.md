# Email Channel Plugin for OpenClaw

Email channel plugin with IMAP/SMTP support, using the new Plugin SDK.

## Status

⚠️ **Experimental** - This is a work in progress using the new Plugin SDK helpers.

## Features

- 📧 IMAP email receiving (planned)
- 📤 SMTP email sending (planned)
- 🔒 Allowed senders whitelist
- 📎 Attachment support (planned)
- 🔄 Multiple account support
- 🎯 Uses new Plugin SDK helpers

## Installation

This plugin is bundled in the OpenClaw repository under `extensions/email-channel/`.

## Configuration

Add to your `~/.config/openclaw/openclaw.json`:

```json
{
  "channels": {
    "email": {
      "accounts": {
        "default": {
          "imap": {
            "host": "imap.gmail.com",
            "port": 993,
            "user": "your-email@gmail.com",
            "password": "your-app-password",
            "tls": true
          },
          "smtp": {
            "host": "smtp.gmail.com",
            "port": 465,
            "user": "your-email@gmail.com",
            "password": "your-app-password",
            "secure": true
          },
          "allowedSenders": ["*@trusted-domain.com"],
          "enabled": true
        }
      }
    }
  }
}
```

## Security

⚠️ **Important**: If `allowedSenders` is empty or not configured, the plugin will **reject all incoming emails** for safety.

## Development

This plugin is developed as part of the OpenClaw repository to ensure compatibility with the main codebase.

### Branch Strategy

- **Branch**: `feature/email-channel`
- **Base**: `upstream/main`
- **Sync**: Regularly synced with upstream/main

### Building

```bash
cd extensions/email-channel
pnpm install
pnpm build
```

## Related

- [Plugin SDK PR #23625](https://github.com/openclaw/openclaw/pull/23625)
- [Plugin Development Guide](https://github.com/openclaw/openclaw/blob/main/docs/plugins/developing-channel-plugins.md)

## License

MIT
