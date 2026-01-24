# @clawdbot/twitch

Twitch channel plugin for Clawdbot.

## Install (local checkout)

```bash
clawdbot plugins install ./extensions/twitch
```

## Install (npm)

```bash
clawdbot plugins install @clawdbot/twitch
```

Onboarding: select Twitch and confirm the install prompt to fetch the plugin automatically.

## Config

Minimal config (default account):

```json5
{
  channels: {
    twitch: {
      enabled: true,
      accounts: {
        default: {
          username: "mybot",
          token: "oauth:your_token_here",
          clientId: "your_client_id_here"
        }
      }
    }
  }
}
```

## Setup

1. **Create a Twitch application:**
   - Go to [Twitch Developer Console](https://dev.twitch.tv/console)
   - Click "Register Your Application"
   - Set Application Type to "Chat Bot"
   - Copy the Client ID

2. **Generate your OAuth token:**
   - Use [Twitch Token Generator](https://twitchtokengenerator.com/) or [TwitchApps TMI](https://twitchapps.com/tmi/)
   - Select scopes: `chat:read` and `chat:write`
   - Copy the token (starts with `oauth:`)

3. **Configure credentials:**
   - Config: `channels.twitch.accounts.default.token`
   - Or env: `CLAWDBOT_TWITCH_ACCESS_TOKEN=...` (default account only)

4. **Start the gateway** - Twitch starts when a token is resolved

## Token refresh (recommended)

For long-running bots, configure automatic token refresh:

```json5
{
  channels: {
    twitch: {
      accounts: {
        default: {
          username: "mybot",
          token: "oauth:abc123...",
          clientId: "your_client_id",
          clientSecret: "your_client_secret",
          refreshToken: "your_refresh_token"
        }
      }
    }
  }
}
```

## Access control

Allowlist by user ID (recommended):

```json5
{
  channels: {
    twitch: {
      accounts: {
        default: {
          username: "mybot",
          token: "oauth:...",
          clientId: "...",
          allowFrom: ["123456789", "987654321"]
        }
      }
    }
  }
}
```

Role-based restrictions:

```json5
{
  channels: {
    twitch: {
      accounts: {
        default: {
          username: "mybot",
          token: "oauth:...",
          clientId: "...",
          allowedRoles: ["moderator", "vip"]
        }
      }
    }
  }
}
```

Available roles: `"moderator"`, `"owner"`, `"vip"`, `"subscriber"`, `"all"`

## Multiple accounts

```json5
{
  channels: {
    twitch: {
      accounts: {
        main: {
          username: "mybot",
          token: "oauth:...",
          clientId: "...",
          channel: "streamer1"
        },
        secondary: {
          username: "mybot",
          token: "oauth:...",
          clientId: "...",
          channel: "streamer2"
        }
      }
    }
  }
}
```

## Environment variables

For the default account:
- `CLAWDBOT_TWITCH_ACCESS_TOKEN` - OAuth token (with `oauth:` prefix)

Restart the gateway after config changes.

## Full documentation

See [https://docs.clawd.bot/channels/twitch](https://docs.clawd.bot/channels/twitch) for complete documentation including:
- Token setup options
- Access control patterns
- Troubleshooting
- Capabilities & limits
