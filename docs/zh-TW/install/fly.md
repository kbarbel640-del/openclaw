---
title: Fly.io
description: Deploy OpenClaw on Fly.io
x-i18n:
  source_path: install/fly.md
  source_hash: 148f8e3579f185f1
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:53:56Z
---

# Fly.io 部署

**目標：** 在 [Fly.io](https://fly.io) 的機器上執行 OpenClaw Gateway 閘道器，具備永續儲存、自動 HTTPS，以及 Discord／頻道存取。

## 你需要準備的項目

- 已安裝 [flyctl CLI](https://fly.io/docs/hands-on/install-flyctl/)
- Fly.io 帳戶（免費方案即可）
- 模型驗證：Anthropic API 金鑰（或其他提供者的金鑰）
- 頻道憑證：Discord 機器人權杖、Telegram 權杖等

## 新手快速路徑

1. 複製 repo → 自訂 `fly.toml`
2. 建立 app + volume → 設定 secrets
3. 使用 `fly deploy` 進行部署
4. SSH 進入建立設定或使用 Control UI

## 1) 建立 Fly app

```bash
# Clone the repo
git clone https://github.com/openclaw/openclaw.git
cd openclaw

# Create a new Fly app (pick your own name)
fly apps create my-openclaw

# Create a persistent volume (1GB is usually enough)
fly volumes create openclaw_data --size 1 --region iad
```

**提示：** 選擇離你較近的區域。常見選項：`lhr`（倫敦）、`iad`（維吉尼亞）、`sjc`（聖荷西）。

## 2) 設定 fly.toml

編輯 `fly.toml` 以符合你的 app 名稱與需求。

**安全性注意事項：** 預設設定會公開一個 URL。若要進行沒有公開 IP 的強化部署，請參閱 [Private Deployment](#private-deployment-hardened) 或使用 `fly.private.toml`。

```toml
app = "my-openclaw"  # Your app name
primary_region = "iad"

[build]
  dockerfile = "Dockerfile"

[env]
  NODE_ENV = "production"
  OPENCLAW_PREFER_PNPM = "1"
  OPENCLAW_STATE_DIR = "/data"
  NODE_OPTIONS = "--max-old-space-size=1536"

[processes]
  app = "node dist/index.js gateway --allow-unconfigured --port 3000 --bind lan"

[http_service]
  internal_port = 3000
  force_https = true
  auto_stop_machines = false
  auto_start_machines = true
  min_machines_running = 1
  processes = ["app"]

[[vm]]
  size = "shared-cpu-2x"
  memory = "2048mb"

[mounts]
  source = "openclaw_data"
  destination = "/data"
```

**關鍵設定：**

| 設定                           | 原因                                                                          |
| ------------------------------ | ----------------------------------------------------------------------------- |
| `--bind lan`                   | 綁定到 `0.0.0.0`，讓 Fly 的 proxy 能連到 gateway                              |
| `--allow-unconfigured`         | 在沒有設定檔的情況下啟動（稍後再建立）                                        |
| `internal_port = 3000`         | 必須與 `--port 3000`（或 `OPENCLAW_GATEWAY_PORT`）相符，以供 Fly 進行健康檢查 |
| `memory = "2048mb"`            | 512MB 太小；建議 2GB                                                          |
| `OPENCLAW_STATE_DIR = "/data"` | 將狀態持久化到 volume                                                         |

## 3) 設定 secrets

```bash
# Required: Gateway token (for non-loopback binding)
fly secrets set OPENCLAW_GATEWAY_TOKEN=$(openssl rand -hex 32)

# Model provider API keys
fly secrets set ANTHROPIC_API_KEY=sk-ant-...

# Optional: Other providers
fly secrets set OPENAI_API_KEY=sk-...
fly secrets set GOOGLE_API_KEY=...

# Channel tokens
fly secrets set DISCORD_BOT_TOKEN=MTQ...
```

**備註：**

- 非 loopback 綁定（`--bind lan`）為了安全性需要 `OPENCLAW_GATEWAY_TOKEN`。
- 將這些權杖視同密碼。
- **所有 API 金鑰與權杖請優先使用環境變數**，不要放在設定檔中。這能避免 secrets 出現在 `openclaw.json` 而被意外暴露或記錄。

## 4) 部署

```bash
fly deploy
```

第一次部署會建置 Docker 映像（約 2–3 分鐘）。後續部署會更快。

部署完成後，請驗證：

```bash
fly status
fly logs
```

你應該會看到：

```
[gateway] listening on ws://0.0.0.0:3000 (PID xxx)
[discord] logged in to discord as xxx
```

## 5) 建立設定檔

透過 SSH 進入機器以建立正式的設定：

```bash
fly ssh console
```

建立設定目錄與檔案：

```bash
mkdir -p /data
cat > /data/openclaw.json << 'EOF'
{
  "agents": {
    "defaults": {
      "model": {
        "primary": "anthropic/claude-opus-4-6",
        "fallbacks": ["anthropic/claude-sonnet-4-5", "openai/gpt-4o"]
      },
      "maxConcurrent": 4
    },
    "list": [
      {
        "id": "main",
        "default": true
      }
    ]
  },
  "auth": {
    "profiles": {
      "anthropic:default": { "mode": "token", "provider": "anthropic" },
      "openai:default": { "mode": "token", "provider": "openai" }
    }
  },
  "bindings": [
    {
      "agentId": "main",
      "match": { "channel": "discord" }
    }
  ],
  "channels": {
    "discord": {
      "enabled": true,
      "groupPolicy": "allowlist",
      "guilds": {
        "YOUR_GUILD_ID": {
          "channels": { "general": { "allow": true } },
          "requireMention": false
        }
      }
    }
  },
  "gateway": {
    "mode": "local",
    "bind": "auto"
  },
  "meta": {
    "lastTouchedVersion": "2026.1.29"
  }
}
EOF
```

**注意：** 使用 `OPENCLAW_STATE_DIR=/data` 時，設定路徑為 `/data/openclaw.json`。

**注意：** Discord 權杖可來自以下其中一種方式：

- 環境變數：`DISCORD_BOT_TOKEN`（建議用於 secrets）
- 設定檔：`channels.discord.token`

若使用環境變數，無需將權杖加入設定檔。Gateway 會自動讀取 `DISCORD_BOT_TOKEN`。

重新啟動以套用設定：

```bash
exit
fly machine restart <machine-id>
```

## 6) 存取 Gateway 閘道器

### Control UI

在瀏覽器中開啟：

```bash
fly open
```

或造訪 `https://my-openclaw.fly.dev/`

貼上你的 gateway 權杖（來自 `OPENCLAW_GATEWAY_TOKEN`）以進行驗證。

### Logs

```bash
fly logs              # Live logs
fly logs --no-tail    # Recent logs
```

### SSH 主控台

```bash
fly ssh console
```

## 疑難排解

### 「App is not listening on expected address」

Gateway 綁定在 `127.0.0.1`，而不是 `0.0.0.0`。

**修正：** 在 `fly.toml` 中的處理程序命令加入 `--bind lan`。

### 健康檢查失敗／連線被拒

Fly 無法連線到設定的連接埠上的 gateway。

**修正：** 確認 `internal_port` 與 gateway 連接埠一致（設定 `--port 3000` 或 `OPENCLAW_GATEWAY_PORT=3000`）。

### OOM／記憶體問題

容器不斷重新啟動或被終止。徵象包括：`SIGABRT`、`v8::internal::Runtime_AllocateInYoungGeneration`，或無聲的重新啟動。

**修正：** 在 `fly.toml` 中提高記憶體：

```toml
[[vm]]
  memory = "2048mb"
```

或更新既有機器：

```bash
fly machine update <machine-id> --vm-memory 2048 -y
```

**注意：** 512MB 太小。1GB 可能可行，但在高負載或詳細記錄時可能 OOM。**建議 2GB。**

### Gateway 鎖定問題

Gateway 以「already running」錯誤拒絕啟動。

當容器重新啟動但 PID 鎖定檔仍留在 volume 時會發生。

**修正：** 刪除鎖定檔：

```bash
fly ssh console --command "rm -f /data/gateway.*.lock"
fly machine restart <machine-id>
```

鎖定檔位於 `/data/gateway.*.lock`（不在子目錄中）。

### 設定未被讀取

若使用 `--allow-unconfigured`，gateway 會建立最小設定。重新啟動時應讀取位於 `/data/openclaw.json` 的自訂設定。

確認設定存在：

```bash
fly ssh console --command "cat /data/openclaw.json"
```

### 透過 SSH 寫入設定

`fly ssh console -C` 指令不支援 shell 重新導向。要寫入設定檔：

```bash
# Use echo + tee (pipe from local to remote)
echo '{"your":"config"}' | fly ssh console -C "tee /data/openclaw.json"

# Or use sftp
fly sftp shell
> put /local/path/config.json /data/openclaw.json
```

**注意：** 若檔案已存在，`fly sftp` 可能會失敗。請先刪除：

```bash
fly ssh console --command "rm /data/openclaw.json"
```

### 狀態未持久化

若重啟後遺失憑證或工作階段，表示狀態目錄寫入到容器檔案系統。

**修正：** 確認在 `fly.toml` 中已設定 `OPENCLAW_STATE_DIR=/data`，然後重新部署。

## 更新

```bash
# Pull latest changes
git pull

# Redeploy
fly deploy

# Check health
fly status
fly logs
```

### 更新機器啟動命令

若需要在不完整重新部署的情況下變更啟動命令：

```bash
# Get machine ID
fly machines list

# Update command
fly machine update <machine-id> --command "node dist/index.js gateway --port 3000 --bind lan" -y

# Or with memory increase
fly machine update <machine-id> --vm-memory 2048 --command "node dist/index.js gateway --port 3000 --bind lan" -y
```

**注意：** 在 `fly deploy` 之後，機器命令可能會重設為 `fly.toml` 中的內容。若你曾進行手動變更，部署後請重新套用。

## 私有部署（強化）

預設情況下，Fly 會配置公開 IP，使你的 gateway 可透過 `https://your-app.fly.dev` 存取。這很方便，但也代表部署可被網路掃描器（Shodan、Censys 等）發現。

若要 **完全沒有公開暴露** 的強化部署，請使用私有範本。

### 何時使用私有部署

- 你只進行 **對外** 呼叫／傳訊（沒有入站 webhook）
- 對任何 webhook 回呼使用 **ngrok 或 Tailscale** 通道
- 透過 **SSH、proxy 或 WireGuard** 存取 gateway，而非瀏覽器
- 你希望部署 **隱藏於網路掃描器**

### 設定

使用 `fly.private.toml` 取代標準設定：

```bash
# Deploy with private config
fly deploy -c fly.private.toml
```

或將既有部署轉換為私有：

```bash
# List current IPs
fly ips list -a my-openclaw

# Release public IPs
fly ips release <public-ipv4> -a my-openclaw
fly ips release <public-ipv6> -a my-openclaw

# Switch to private config so future deploys don't re-allocate public IPs
# (remove [http_service] or deploy with the private template)
fly deploy -c fly.private.toml

# Allocate private-only IPv6
fly ips allocate-v6 --private -a my-openclaw
```

完成後，`fly ips list` 應只顯示 `private` 類型的 IP：

```
VERSION  IP                   TYPE             REGION
v6       fdaa:x:x:x:x::x      private          global
```

### 存取私有部署

由於沒有公開 URL，請使用以下其中一種方式：

**選項 1：本機 proxy（最簡單）**

```bash
# Forward local port 3000 to the app
fly proxy 3000:3000 -a my-openclaw

# Then open http://localhost:3000 in browser
```

**選項 2：WireGuard VPN**

```bash
# Create WireGuard config (one-time)
fly wireguard create

# Import to WireGuard client, then access via internal IPv6
# Example: http://[fdaa:x:x:x:x::x]:3000
```

**選項 3：僅 SSH**

```bash
fly ssh console -a my-openclaw
```

### 私有部署的 Webhooks

若需要 webhook 回呼（Twilio、Telnyx 等）但不想公開暴露：

1. **ngrok 通道**－在容器內或作為 sidecar 執行 ngrok
2. **Tailscale Funnel**－透過 Tailscale 公開特定路徑
3. **僅對外**－部分提供者（Twilio）在沒有 webhook 的情況下也可正常進行對外呼叫

使用 ngrok 的語音通話設定範例：

```json
{
  "plugins": {
    "entries": {
      "voice-call": {
        "enabled": true,
        "config": {
          "provider": "twilio",
          "tunnel": { "provider": "ngrok" },
          "webhookSecurity": {
            "allowedHosts": ["example.ngrok.app"]
          }
        }
      }
    }
  }
}
```

ngrok 通道在容器內執行，提供公開的 webhook URL，而不會暴露 Fly app 本身。將 `webhookSecurity.allowedHosts` 設為公開通道的主機名稱，以接受轉送的 host 標頭。

### 安全性優點

| 面向            | 公開     | 私有       |
| --------------- | -------- | ---------- |
| 網路掃描器      | 可被發現 | 隱藏       |
| 直接攻擊        | 可能     | 阻擋       |
| Control UI 存取 | 瀏覽器   | Proxy／VPN |
| Webhook 傳遞    | 直接     | 透過通道   |

## 備註

- Fly.io 使用 **x86 架構**（非 ARM）
- Dockerfile 與兩種架構皆相容
- WhatsApp／Telegram 入門引導請使用 `fly ssh console`
- 永續資料位於 volume 的 `/data`
- Signal 需要 Java + signal-cli；請使用自訂映像並將記憶體維持在 2GB 以上。

## 成本

使用建議設定（`shared-cpu-2x`，2GB RAM）：

- 每月約 $10–15，視使用量而定
- 免費方案包含部分額度

詳情請參閱 [Fly.io 定價](https://fly.io/docs/about/pricing/)。
