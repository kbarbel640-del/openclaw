---
summary: "WeCom (WeChat Work) intelligent bot support status, capabilities, and configuration"
read_when:
  - You want to connect Clawdbot to WeCom
  - You are troubleshooting WeCom webhooks and replies
  - 你想把 Clawdbot 接入企业微信 WeCom
  - 你在排查 WeCom webhook 回调和回复问题
---
# WeCom（企业微信）

Status: WeCom intelligent bot (API mode) via encrypted webhooks + passive replies (stream).

## Quick setup (beginner)

1) Install + enable the plugin:
   ```bash
   clawdbot plugins install @clawdbot/wecom
   clawdbot plugins enable wecom
   ```
2) Create a WeCom “intelligent bot (API mode)” and collect:
   - `Token`
   - `EncodingAESKey`
   - `ReceiveId` (often empty for intelligent bots)
3) Configure Clawdbot (example):
   ```json5
   {
     channels: {
       wecom: {
         enabled: true,
         webhookPath: "/wecom",
         token: "YOUR_TOKEN",
         encodingAESKey: "YOUR_ENCODING_AES_KEY",
         receiveId: "",
         dm: { policy: "pairing" }
       }
     }
   }
   ```
4) Restart the gateway:
   ```bash
   clawdbot gateway restart
   ```
5) Verify:
   ```bash
   clawdbot plugins list | rg -n "wecom|WeCom"
   clawdbot channels status --probe
   ```

## Public URL (Webhook-only)

WeCom webhooks require a public HTTPS endpoint. For security, **only expose `/wecom`** to the internet. Keep the dashboard and other sensitive endpoints private.

### Option A: Tailscale Funnel (Recommended)
只公开 webhook 路径：
```bash
tailscale funnel --bg --set-path /wecom http://127.0.0.1:18789/wecom
tailscale funnel status
```

Your webhook URL looks like:
`https://<node-name>.<tailnet>.ts.net/wecom`

> Note: If `tailscale funnel status` shows `(tailnet only)`, Funnel is not public yet; enable Funnel in your tailnet policy.

### Option B: Reverse Proxy (Nginx/Caddy)
Only proxy `/wecom*` to the gateway:
```caddy
your-domain.com {
  reverse_proxy /wecom* localhost:18789
}
```

### Option C: Cloudflare Tunnel
Limit your tunnel ingress to only route the webhook path:
- Path `/wecom` → `http://localhost:18789/wecom`
- Default rule → 404

## How it works

1) WeCom sends GET/POST webhooks to your endpoint:
   - GET: URL verification (VerifyURL)
   - POST: message callbacks
2) Each request includes `msg_signature`, `timestamp`, `nonce`, and an `encrypt` field in the body.
3) Clawdbot verifies + decrypts the message, routes it to the right agent/session, and replies using **stream**.
4) Stream behavior:
   - The first reply may be a minimal placeholder (often `"1"`).
   - WeCom then calls back with `msgtype=stream` to refresh and fetch the actual content.

Limitations:
- WeCom intelligent bots are passive-reply only; standalone sends (for example `sendText`) are not supported.

## Targets

- 私聊：`wecom:<userid>`
- 群聊：`wecom:group:<chatid>`

## Config highlights

### Single account
```json5
{
  channels: {
    wecom: {
      enabled: true,
      webhookPath: "/wecom",
      token: "YOUR_TOKEN",
      encodingAESKey: "YOUR_ENCODING_AES_KEY",
      receiveId: "",
      welcomeText: "你好，我是 Clawdbot。",
      dm: {
        policy: "pairing",
        allowFrom: ["userid1", "userid2"]
      }
    }
  }
}
```

### Multiple accounts (accounts)
```json5
{
  channels: {
    wecom: {
      enabled: true,
      defaultAccount: "default",
      accounts: {
        default: {
          webhookPath: "/wecom",
          token: "TOKEN_A",
          encodingAESKey: "AESKEY_A",
          receiveId: ""
        },
        team2: {
          webhookPath: "/wecom-team2",
          token: "TOKEN_B",
          encodingAESKey: "AESKEY_B",
          receiveId: ""
        }
      }
    }
  }
}
```

## Troubleshooting

### 400 missing query params
This is expected if you open `/wecom` in a browser; WeCom webhooks include `msg_signature/timestamp/nonce`.

### 401 unauthorized / invalid signature
Common causes:
- Wrong Token
- Reverse proxy drops query string
- Wrong webhook URL (domain or path)

### 400 decrypt failed / receiveId mismatch
Common causes:
- Wrong `encodingAESKey`
- Wrong `receiveId` (if unsure, try empty string or follow WeCom console requirements)

### 只回复 1，没有后续内容
This usually means:
- The initial callback succeeds, but WeCom’s `msgtype=stream` refresh callback does not reach your webhook (network, reverse proxy, TLS/cert, 502, timeouts).

Checklist:
1) 看反代 access_log：同一条消息应该至少看到两次 `/wecom` POST。
2) 用 `clawdbot logs --follow` 观察是否有 `unauthorized`、`decrypt failed` 之类错误。

Related docs:
- [Gateway configuration](/gateway/configuration)
- [Security](/gateway/security)

---

# WeCom（企业微信）中文说明

Status: 支持企业微信 WeCom 智能机器人（API 模式）加密回调 + 被动回复（stream）。

## Quick setup（新手快速上手）

1) 安装并启用插件：
   ```bash
   clawdbot plugins install @clawdbot/wecom
   clawdbot plugins enable wecom
   ```
2) 在企业微信后台创建“智能机器人（API 模式）”，拿到以下参数：
   - `Token`
   - `EncodingAESKey`
   - `ReceiveId`（部分场景需要；智能机器人常见为空字符串）
3) 配置 Clawdbot（示例）：
   ```json5
   {
     channels: {
       wecom: {
         enabled: true,
         webhookPath: "/wecom",
         token: "YOUR_TOKEN",
         encodingAESKey: "YOUR_ENCODING_AES_KEY",
         receiveId: "",
         dm: { policy: "pairing" }
       }
     }
   }
   ```
4) 重启网关：
   ```bash
   clawdbot gateway restart
   ```
5) 验证：
   ```bash
   clawdbot plugins list | rg -n "wecom|WeCom"
   clawdbot channels status --probe
   ```

## Public URL（Webhook-only）

WeCom webhook 需要公网 HTTPS endpoint。为了安全，强烈建议**只暴露 `/wecom` 路径**，不要把 Clawdbot dashboard 和其他敏感端点暴露到公网。

### Option A: Tailscale Funnel（推荐）
只公开 webhook 路径：
```bash
tailscale funnel --bg --set-path /wecom http://127.0.0.1:18789/wecom
tailscale funnel status
```

你的 webhook URL 形如：
`https://<node-name>.<tailnet>.ts.net/wecom`

> Note: 如果 `tailscale funnel status` 显示 `(tailnet only)`，表示还没有真正公网开放；需要在 tailnet 策略里允许 Funnel。

### Option B: Reverse Proxy（Nginx/Caddy）
只代理 `/wecom*` 到网关：
```caddy
your-domain.com {
  reverse_proxy /wecom* localhost:18789
}
```

### Option C: Cloudflare Tunnel
把 tunnel 的 ingress 规则限制为只转发 webhook：
- Path `/wecom` → `http://localhost:18789/wecom`
- Default rule → 404

## How it works（工作原理）

1) WeCom 会对你的 webhook 发起 GET/POST 回调：
   - GET：URL 验证（VerifyURL）
   - POST：消息回调
2) 每次请求会携带 `msg_signature`、`timestamp`、`nonce`，并在 body 里携带 `encrypt`（加密的消息体）。
3) Clawdbot 会验签 + 解密，路由到对应 agent/session，然后以 **stream 模式**回复。
4) stream 模式要点：
   - 首次回包通常会返回一个 stream 占位符（内容可能是 `"1"`）。
   - WeCom 会用 `msgtype=stream` 的刷新回调再次请求 webhook，以拉取后续内容。

重要限制：
- WeCom 智能机器人是被动回复模式，不支持“脱离回调主动发消息”；因此 `sendText` 之类的独立发送会被拒绝。

## Targets（目标标识）

- 私聊：`wecom:<userid>`
- 群聊：`wecom:group:<chatid>`

## Config highlights（配置要点）

### 单账号
```json5
{
  channels: {
    wecom: {
      enabled: true,
      webhookPath: "/wecom",
      token: "YOUR_TOKEN",
      encodingAESKey: "YOUR_ENCODING_AES_KEY",
      receiveId: "",
      welcomeText: "你好，我是 Clawdbot。",
      dm: {
        policy: "pairing",
        allowFrom: ["userid1", "userid2"]
      }
    }
  }
}
```

### 多账号（accounts）
```json5
{
  channels: {
    wecom: {
      enabled: true,
      defaultAccount: "default",
      accounts: {
        default: {
          webhookPath: "/wecom",
          token: "TOKEN_A",
          encodingAESKey: "AESKEY_A",
          receiveId: ""
        },
        team2: {
          webhookPath: "/wecom-team2",
          token: "TOKEN_B",
          encodingAESKey: "AESKEY_B",
          receiveId: ""
        }
      }
    }
  }
}
```

## Troubleshooting（排障）

### 400 missing query params
你直接用浏览器访问 `/wecom` 常见会这样；WeCom 回调必须带 `msg_signature/timestamp/nonce`。

### 401 unauthorized / invalid signature
常见原因：
- Token 配错
- 反向代理丢了 query string
- 回调 URL 配到错误的域名或路径

### 400 decrypt failed / receiveId mismatch
常见原因：
- `encodingAESKey` 错
- `receiveId` 不匹配（不确定时先留空字符串，或按后台要求填写）

### 只回复 1，没有后续内容
这通常表示：
- 首次回调成功，但 WeCom 的 `msgtype=stream` 刷新回调没有打到你的 webhook（网络、反代、证书、502/超时）。

排查思路：
1) 看反代 access_log：同一条消息应该至少看到两次 `/wecom` POST。
2) 用 `clawdbot logs --follow` 观察是否有 `unauthorized`、`decrypt failed` 之类错误。

Related docs:
- [Gateway configuration](/gateway/configuration)
- [Security](/gateway/security)
