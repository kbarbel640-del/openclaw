---
summary: 「語音通話外掛：透過 Twilio／Telnyx／Plivo 進行外撥 + 來電（外掛安裝 + 設定 + CLI）」
read_when:
  - 「你想要從 OpenClaw 撥打外撥語音電話」
  - 「你正在設定或開發語音通話外掛」
title: 「語音通話外掛」
x-i18n:
  source_path: plugins/voice-call.md
  source_hash: 46d05a5912b785d7
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:54:19Z
---

# 語音通話（外掛）

透過外掛為 OpenClaw 提供語音通話。支援外撥通知，以及搭配來電政策的多輪對話。

目前支援的提供者：

- `twilio`（可程式化語音 + 媒體串流）
- `telnyx`（Call Control v2）
- `plivo`（Voice API + XML 轉接 + GetInput 語音）
- `mock`（dev／無網路）

快速心智模型：

- 安裝外掛
- 重新啟動 Gateway 閘道器
- 在 `plugins.entries.voice-call.config` 下進行設定
- 使用 `openclaw voicecall ...` 或 `voice_call` 工具

## 執行位置（本機 vs 遠端）

語音通話外掛**在 Gateway 閘道器行程內執行**。

如果你使用遠端 Gateway 閘道器，請在**執行 Gateway 閘道器的機器**上安裝／設定外掛，然後重新啟動 Gateway 閘道器以載入。

## 安裝

### 選項 A：從 npm 安裝（建議）

```bash
openclaw plugins install @openclaw/voice-call
```

之後重新啟動 Gateway 閘道器。

### 選項 B：從本機資料夾安裝（開發用，不複製檔案）

```bash
openclaw plugins install ./extensions/voice-call
cd ./extensions/voice-call && pnpm install
```

之後重新啟動 Gateway 閘道器。

## 設定

在 `plugins.entries.voice-call.config` 下設定：

```json5
{
  plugins: {
    entries: {
      "voice-call": {
        enabled: true,
        config: {
          provider: "twilio", // or "telnyx" | "plivo" | "mock"
          fromNumber: "+15550001234",
          toNumber: "+15550005678",

          twilio: {
            accountSid: "ACxxxxxxxx",
            authToken: "...",
          },

          plivo: {
            authId: "MAxxxxxxxxxxxxxxxxxxxx",
            authToken: "...",
          },

          // Webhook server
          serve: {
            port: 3334,
            path: "/voice/webhook",
          },

          // Webhook security (recommended for tunnels/proxies)
          webhookSecurity: {
            allowedHosts: ["voice.example.com"],
            trustedProxyIPs: ["100.64.0.1"],
          },

          // Public exposure (pick one)
          // publicUrl: "https://example.ngrok.app/voice/webhook",
          // tunnel: { provider: "ngrok" },
          // tailscale: { mode: "funnel", path: "/voice/webhook" }

          outbound: {
            defaultMode: "notify", // notify | conversation
          },

          streaming: {
            enabled: true,
            streamPath: "/voice/stream",
          },
        },
      },
    },
  },
}
```

注意事項：

- Twilio／Telnyx 需要**可公開存取**的 webhook URL。
- Plivo 需要**可公開存取**的 webhook URL。
- `mock` 是本機開發提供者（無網路呼叫）。
- `skipSignatureVerification` 僅供本機測試使用。
- 若使用 ngrok 免費方案，請將 `publicUrl` 設為精確的 ngrok URL；簽章驗證一律強制啟用。
- `tunnel.allowNgrokFreeTierLoopbackBypass: true` 允許 Twilio webhook 在簽章無效時通過，**僅限** `tunnel.provider="ngrok"` 且 `serve.bind` 為 loopback（ngrok 本機代理）。僅供本機開發使用。
- Ngrok 免費方案的 URL 可能變更或加入中介行為；若 `publicUrl` 發生漂移，Twilio 簽章將驗證失敗。正式環境請優先使用穩定網域或 Tailscale funnel。

## Webhook 安全性

當 Gateway 閘道器前方有代理或通道時，外掛會重建
用於簽章驗證的公開 URL。以下選項用來控制哪些轉送標頭可被信任。

`webhookSecurity.allowedHosts` 會從轉送標頭中允許特定主機。

`webhookSecurity.trustForwardingHeaders` 在沒有允許清單時信任轉送標頭。

`webhookSecurity.trustedProxyIPs` 僅在請求的遠端 IP 符合清單時信任轉送標頭。

穩定公開主機的範例：

```json5
{
  plugins: {
    entries: {
      "voice-call": {
        config: {
          publicUrl: "https://voice.example.com/voice/webhook",
          webhookSecurity: {
            allowedHosts: ["voice.example.com"],
          },
        },
      },
    },
  },
}
```

## 通話的 TTS

語音通話使用核心的 `messages.tts` 設定（OpenAI 或 ElevenLabs）
在通話中進行串流語音。你可以在外掛設定下以**相同結構**覆寫——它會與 `messages.tts` 進行深度合併。

```json5
{
  tts: {
    provider: "elevenlabs",
    elevenlabs: {
      voiceId: "pMsXgVXv3BLzUgSXRplE",
      modelId: "eleven_multilingual_v2",
    },
  },
}
```

注意事項：

- **語音通話會忽略 Edge TTS**（電信音訊需要 PCM；Edge 輸出不穩定）。
- 啟用 Twilio 媒體串流時會使用核心 TTS；否則通話會回退至提供者的原生語音。

### 更多範例

僅使用核心 TTS（不覆寫）：

```json5
{
  messages: {
    tts: {
      provider: "openai",
      openai: { voice: "alloy" },
    },
  },
}
```

僅針對通話覆寫為 ElevenLabs（其他地方維持核心預設）：

```json5
{
  plugins: {
    entries: {
      "voice-call": {
        config: {
          tts: {
            provider: "elevenlabs",
            elevenlabs: {
              apiKey: "elevenlabs_key",
              voiceId: "pMsXgVXv3BLzUgSXRplE",
              modelId: "eleven_multilingual_v2",
            },
          },
        },
      },
    },
  },
}
```

僅覆寫通話使用的 OpenAI 模型（深度合併範例）：

```json5
{
  plugins: {
    entries: {
      "voice-call": {
        config: {
          tts: {
            openai: {
              model: "gpt-4o-mini-tts",
              voice: "marin",
            },
          },
        },
      },
    },
  },
}
```

## 來電

來電政策預設為 `disabled`。要啟用來電，請設定：

```json5
{
  inboundPolicy: "allowlist",
  allowFrom: ["+15550001234"],
  inboundGreeting: "Hello! How can I help?",
}
```

自動回應使用代理程式系統。可透過以下項目調整：

- `responseModel`
- `responseSystemPrompt`
- `responseTimeoutMs`

## CLI

```bash
openclaw voicecall call --to "+15555550123" --message "Hello from OpenClaw"
openclaw voicecall continue --call-id <id> --message "Any questions?"
openclaw voicecall speak --call-id <id> --message "One moment"
openclaw voicecall end --call-id <id>
openclaw voicecall status --call-id <id>
openclaw voicecall tail
openclaw voicecall expose --mode funnel
```

## 代理程式工具

工具名稱：`voice_call`

動作：

- `initiate_call`（message, to?, mode?）
- `continue_call`（callId, message）
- `speak_to_user`（callId, message）
- `end_call`（callId）
- `get_status`（callId）

此儲存庫提供相對應的 skill 文件，位於 `skills/voice-call/SKILL.md`。

## Gateway RPC

- `voicecall.initiate`（`to?`, `message`, `mode?`）
- `voicecall.continue`（`callId`, `message`）
- `voicecall.speak`（`callId`, `message`）
- `voicecall.end`（`callId`）
- `voicecall.status`（`callId`）
