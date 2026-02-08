---
summary: "Voice Call プラグイン：Twilio / Telnyx / Plivo による発信 + 着信通話（プラグインのインストール + 設定 + CLI）"
read_when:
  - OpenClaw から発信の音声通話を行いたい場合
  - voice-call プラグインを設定または開発している場合
title: "Voice Call プラグイン"
x-i18n:
  source_path: plugins/voice-call.md
  source_hash: 46d05a5912b785d7
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:34:37Z
---

# Voice Call（プラグイン）

プラグインによる OpenClaw の音声通話です。発信通知および着信ポリシーを用いたマルチターン会話をサポートします。

現在のプロバイダー：

- `twilio`（Programmable Voice + Media Streams）
- `telnyx`（Call Control v2）
- `plivo`（Voice API + XML transfer + GetInput speech）
- `mock`（dev / ネットワークなし）

簡単なメンタルモデル：

- プラグインをインストール
- Gateway（ゲートウェイ）を再起動
- `plugins.entries.voice-call.config` 配下で設定
- `openclaw voicecall ...` または `voice_call` ツールを使用

## 実行場所（ローカル vs リモート）

Voice Call プラグインは **Gateway（ゲートウェイ）プロセス内** で実行されます。

リモート Gateway（ゲートウェイ）を使用する場合は、**Gateway（ゲートウェイ）を実行しているマシン** にプラグインをインストール / 設定し、その後 Gateway（ゲートウェイ）を再起動して読み込んでください。

## インストール

### オプション A：npm からインストール（推奨）

```bash
openclaw plugins install @openclaw/voice-call
```

その後 Gateway（ゲートウェイ）を再起動してください。

### オプション B：ローカルフォルダーからインストール（開発用、コピーなし）

```bash
openclaw plugins install ./extensions/voice-call
cd ./extensions/voice-call && pnpm install
```

その後 Gateway（ゲートウェイ）を再起動してください。

## 設定

`plugins.entries.voice-call.config` 配下に設定します：

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

- Twilio / Telnyx には **公開到達可能** な webhook URL が必要です。
- Plivo には **公開到達可能** な webhook URL が必要です。
- `mock` はローカル開発用プロバイダー（ネットワーク呼び出しなし）です。
- `skipSignatureVerification` はローカルテスト専用です。
- ngrok の無料プランを使用する場合、`publicUrl` を正確な ngrok URL に設定してください。署名検証は常に有効です。
- `tunnel.allowNgrokFreeTierLoopbackBypass: true` は、`tunnel.provider="ngrok"` かつ `serve.bind` が loopback（ngrok ローカルエージェント）の場合に **のみ**、無効な署名の Twilio webhook を許可します。ローカル開発専用として使用してください。
- ngrok 無料プランの URL は変更されたり、インタースティシャル挙動が追加されたりすることがあります。`publicUrl` が変動すると Twilio の署名検証は失敗します。本番環境では、安定したドメインまたは Tailscale funnel の使用を推奨します。

## Webhook セキュリティ

Gateway（ゲートウェイ）の前段にプロキシやトンネルがある場合、プラグインは署名検証のために
公開 URL を再構築します。以下のオプションで、どの転送ヘッダーを信頼するかを制御します。

`webhookSecurity.allowedHosts` は、転送ヘッダーからのホストを allowlist に登録します。

`webhookSecurity.trustForwardingHeaders` は、allowlist なしで転送ヘッダーを信頼します。

`webhookSecurity.trustedProxyIPs` は、リクエストのリモート IP がリストと一致する場合にのみ、
転送ヘッダーを信頼します。

安定した公開ホストを使用する例：

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

## 通話向け TTS

Voice Call は、通話中の音声ストリーミングにコアの `messages.tts` 設定（OpenAI または ElevenLabs）を使用します。プラグイン設定配下で **同一の構造** により上書きできます。これは `messages.tts` とディープマージされます。

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

- **音声通話では Edge TTS は無視されます**（電話音声には PCM が必要であり、Edge の出力は信頼性が低いため）。
- Twilio のメディアストリーミングが有効な場合はコア TTS が使用されます。それ以外の場合、通話はプロバイダーのネイティブ音声にフォールバックします。

### 追加例

コア TTS のみを使用（上書きなし）：

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

通話に限って ElevenLabs に上書き（他はコアのデフォルトを維持）：

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

通話向けに OpenAI のモデルのみを上書き（ディープマージの例）：

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

## 着信通話

着信ポリシーのデフォルトは `disabled` です。着信通話を有効にするには、次を設定します：

```json5
{
  inboundPolicy: "allowlist",
  allowFrom: ["+15550001234"],
  inboundGreeting: "Hello! How can I help?",
}
```

自動応答はエージェントシステムを使用します。以下で調整できます：

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

## エージェントツール

ツール名：`voice_call`

アクション：

- `initiate_call`（message, to?, mode?）
- `continue_call`（callId, message）
- `speak_to_user`（callId, message）
- `end_call`（callId）
- `get_status`（callId）

このリポジトリには、対応する skill ドキュメントが `skills/voice-call/SKILL.md` に含まれています。

## Gateway RPC

- `voicecall.initiate`（`to?`、`message`、`mode?`）
- `voicecall.continue`（`callId`、`message`）
- `voicecall.speak`（`callId`、`message`）
- `voicecall.end`（`callId`）
- `voicecall.status`（`callId`）
