# Deploying Moltbot on Coolify

This guide explains how to deploy Moltbot on [Coolify](https://coolify.io), a self-hosted platform for deploying applications with Docker.

## Prerequisites

- A Coolify instance (v4.0+ recommended)
- At least one AI provider API key (Anthropic Claude, OpenAI, Google Gemini, etc.)
- Basic understanding of Docker and environment variables

## Quick Start

### 1. Create a New Service in Coolify

1. Log into your Coolify dashboard
2. Navigate to your project
3. Click **"+ New Resource"** → **"Docker Compose"**
4. Choose **"Public Repository"** or **"Private Repository"**

### 2. Configure Git Repository

- **Repository URL**: `https://github.com/moltbot/moltbot` (or your fork)
- **Branch**: `main`
- **Docker Compose File**: `docker-compose.coolify.yml`

### 3. Set Environment Variables

In Coolify's environment configuration, add the following required variables:

#### Required
```env
# Gateway security (generate a strong random token)
CLAWDBOT_GATEWAY_TOKEN=your-secure-token-here

# At least one AI provider
ANTHROPIC_API_KEY=sk-ant-xxxxx
# OR
OPENAI_API_KEY=sk-xxxxx
# OR
GEMINI_API_KEY=AIzaSyxxxxx
```

#### Optional but Recommended
```env
# Additional AI providers
OPENAI_API_KEY=sk-xxxxx
GEMINI_API_KEY=AIzaSyxxxxx
GROQ_API_KEY=gsk_xxxxx

# Messaging channels (configure the ones you want)
TELEGRAM_BOT_TOKEN=123456789:ABCxxx
DISCORD_BOT_TOKEN=xxx
SLACK_BOT_TOKEN=xoxb-xxx
SLACK_APP_TOKEN=xapp-xxx

# GitHub Copilot
GITHUB_TOKEN=ghp_xxxxx

# Web search
BRAVE_API_KEY=BSAxxxxx
```

### 4. Configure Ports (Optional)

Coolify will automatically handle port mapping. Default ports:
- **19789**: Gateway API (HTTP/WebSocket)
- **19790**: Bridge for browser extension

You can override these with:
```env
CLAWDBOT_GATEWAY_PORT=19789
CLAWDBOT_BRIDGE_PORT=19790
```

### 5. Deploy

1. Click **"Deploy"** in Coolify
2. Coolify will:
   - Clone the repository
   - Build the Docker image
   - Start the container
   - Map persistent storage
   - Generate SSL certificates (if domain is configured)

### 6. Verify Deployment

Check the logs in Coolify to ensure Moltbot started successfully. You should see:
```
Gateway listening on http://0.0.0.0:19789
```

## Advanced Configuration

### Custom Domain with SSL

1. In Coolify, navigate to your Moltbot service
2. Go to **"Domains"** tab
3. Add your domain (e.g., `moltbot.yourdomain.com`)
4. Coolify will automatically provision SSL via Let's Encrypt

Update your client to connect via HTTPS:
```bash
export CLAWDBOT_GATEWAY_URL=https://moltbot.yourdomain.com
```

### Persistent Storage

Coolify automatically manages persistent volumes. Your Moltbot data is stored in:
- `/home/node/.clawdbot` - Configuration, sessions, and state
- `/home/node/clawd` - Workspace directory (optional)

### Resource Limits

Set resource limits via environment variables:
```env
CPU_LIMIT=2
MEMORY_LIMIT=4G
CPU_RESERVATION=0.5
MEMORY_RESERVATION=512M
```

### Multiple Instances

To run multiple Moltbot instances:
1. Create separate services in Coolify
2. Use unique gateway tokens for each instance
3. Configure different ports if needed

### AWS Bedrock Integration

For AWS Bedrock:
```env
AWS_ACCESS_KEY_ID=AKIAxxxxx
AWS_SECRET_ACCESS_KEY=xxxxx
AWS_REGION=us-east-1
```

### Health Checks

The docker-compose.coolify.yml includes built-in health checks:
- Endpoint: `http://localhost:19789/health`
- Interval: 30s
- Timeout: 10s
- Start period: 60s

## Messaging Channel Setup

### Telegram

1. Create a bot via [@BotFather](https://t.me/botfather)
2. Get your bot token
3. Add to Coolify environment:
   ```env
   TELEGRAM_BOT_TOKEN=123456789:ABCxxx
   ```
4. Onboard your bot:
   ```bash
   moltbot onboard telegram
   ```

### Discord

1. Create an application at [Discord Developer Portal](https://discord.com/developers)
2. Create a bot and get the token
3. Add to Coolify environment:
   ```env
   DISCORD_BOT_TOKEN=xxx
   ```
4. Onboard your bot:
   ```bash
   moltbot onboard discord
   ```

### Slack

1. Create a Slack app at [api.slack.com](https://api.slack.com)
2. Enable Socket Mode and get tokens
3. Add to Coolify environment:
   ```env
   SLACK_BOT_TOKEN=xoxb-xxx
   SLACK_APP_TOKEN=xapp-xxx
   ```
4. Onboard your bot:
   ```bash
   moltbot onboard slack
   ```

## Troubleshooting

### Container Fails to Start

1. Check logs in Coolify dashboard
2. Verify environment variables are set correctly
3. Ensure at least one AI provider API key is valid

### Gateway Not Accessible

1. Check if ports are properly mapped
2. Verify firewall rules
3. Check health check status in Coolify

### Permission Errors

The container runs as a non-root user (`node`, UID 1000) for security. Ensure mounted volumes have proper permissions:
```bash
sudo chown -R 1000:1000 ./data
```

### Out of Memory

Increase memory limit:
```env
MEMORY_LIMIT=8G
```

Or optimize session cleanup:
```env
CLAWDBOT_SESSION_CLEANUP_ENABLED=true
CLAWDBOT_SESSION_CLEANUP_TTL=3600000
```

## Updating Moltbot

### Via Coolify UI

1. Navigate to your Moltbot service
2. Click **"Redeploy"**
3. Coolify will pull latest changes and rebuild

### Via Webhook (Recommended)

1. In Coolify, enable webhook for your service
2. Add webhook URL to your GitHub repository settings
3. Automatic deployments on push to main branch

### Manual Tag/Version

Pin to a specific version in docker-compose.coolify.yml:
```yaml
image: ghcr.io/moltbot/moltbot:2026.1.28
```

## Backup and Migration

### Backup Data

Export your Moltbot configuration and data:
```bash
# On the Coolify server
docker cp moltbot-gateway:/home/node/.clawdbot ./moltbot-backup
tar -czf moltbot-backup.tar.gz moltbot-backup
```

### Restore Data

```bash
# Extract backup
tar -xzf moltbot-backup.tar.gz

# Copy to new instance
docker cp moltbot-backup/. moltbot-gateway:/home/node/.clawdbot

# Restart service in Coolify
```

## Security Best Practices

1. **Strong Gateway Token**: Use a cryptographically random token (32+ characters)
   ```bash
   openssl rand -base64 32
   ```

2. **Environment Secrets**: Store sensitive values in Coolify's secret management

3. **Network Isolation**: Use Coolify's private networking features

4. **Regular Updates**: Keep Moltbot updated via Coolify's automatic deployment

5. **Limit Exposure**: Only expose necessary ports

## Performance Tuning

### Database Backend

For better performance with long-running sessions:
```env
# Enable LanceDB for vector memory
CLAWDBOT_MEMORY_PROVIDER=lancedb
```

### Session Cleanup

Automatically clean up idle sessions:
```env
CLAWDBOT_SESSION_CLEANUP_ENABLED=true
CLAWDBOT_SESSION_CLEANUP_INTERVAL=300000
CLAWDBOT_SESSION_CLEANUP_TTL=3600000
```

### Caching

Enable model response caching:
```env
CLAWDBOT_CACHE_ENABLED=true
CLAWDBOT_CACHE_TTL=3600
```

## Monitoring

### Logs

View logs in Coolify dashboard or via CLI:
```bash
docker logs -f moltbot-gateway
```

### OpenTelemetry (Advanced)

Enable distributed tracing:
```env
OTEL_EXPORTER_OTLP_ENDPOINT=http://jaeger:4318
OTEL_SERVICE_NAME=moltbot
```

## Support

- **Documentation**: https://docs.molt.bot
- **GitHub Issues**: https://github.com/moltbot/moltbot/issues
- **Discord**: [Join the community](https://discord.gg/moltbot)
- **Coolify Docs**: https://coolify.io/docs

## Example: Complete Setup

Here's a complete example environment configuration for Coolify:

```env
# === Required ===
CLAWDBOT_GATEWAY_TOKEN=your-secure-random-token-here
ANTHROPIC_API_KEY=sk-ant-xxxxx
OPENAI_API_KEY=sk-xxxxx

# === Messaging ===
TELEGRAM_BOT_TOKEN=123456789:ABCxxx
DISCORD_BOT_TOKEN=MTxxxxx.xxxxx.xxxxx

# === Additional AI ===
GEMINI_API_KEY=AIzaSyxxxxx
GROQ_API_KEY=gsk_xxxxx

# === Features ===
GITHUB_TOKEN=ghp_xxxxx
BRAVE_API_KEY=BSAxxxxx
ELEVENLABS_API_KEY=xxxxx

# === Configuration ===
CLAWDBOT_GATEWAY_BIND=lan
NODE_ENV=production

# === Resources ===
CPU_LIMIT=2
MEMORY_LIMIT=4G
```

Deploy with this configuration and you'll have a fully functional Moltbot instance running on Coolify!
