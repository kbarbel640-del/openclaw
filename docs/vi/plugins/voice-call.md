---
summary: "Plugin Voice Call: gọi ra + gọi vào qua Twilio/Telnyx/Plivo (cài đặt plugin + cấu hình + CLI)"
read_when:
  - Bạn muốn thực hiện một cuộc gọi thoại gọi ra từ OpenClaw
  - Bạn đang cấu hình hoặc phát triển plugin voice-call
title: "Plugin Voice Call"
x-i18n:
  source_path: plugins/voice-call.md
  source_hash: 46d05a5912b785d7
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:08:06Z
---

# Voice Call (plugin)

Gọi thoại cho OpenClaw thông qua một plugin. Hỗ trợ thông báo gọi ra và
các cuộc hội thoại nhiều lượt với chính sách gọi vào.

Các nhà cung cấp hiện tại:

- `twilio` (Programmable Voice + Media Streams)
- `telnyx` (Call Control v2)
- `plivo` (Voice API + XML transfer + GetInput speech)
- `mock` (dev/không mạng)

Mô hình tư duy nhanh:

- Cài đặt plugin
- Khởi động lại Gateway
- Cấu hình trong `plugins.entries.voice-call.config`
- Sử dụng `openclaw voicecall ...` hoặc công cụ `voice_call`

## Nơi chạy (local vs remote)

Plugin Voice Call chạy **bên trong tiến trình Gateway**.

Nếu bạn dùng Gateway từ xa, hãy cài đặt/cấu hình plugin trên **máy đang chạy Gateway**, sau đó khởi động lại Gateway để nạp plugin.

## Cài đặt

### Tùy chọn A: cài từ npm (khuyến nghị)

```bash
openclaw plugins install @openclaw/voice-call
```

Sau đó khởi động lại Gateway.

### Tùy chọn B: cài từ thư mục local (dev, không sao chép)

```bash
openclaw plugins install ./extensions/voice-call
cd ./extensions/voice-call && pnpm install
```

Sau đó khởi động lại Gateway.

## Cấu hình

Thiết lập cấu hình trong `plugins.entries.voice-call.config`:

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

Ghi chú:

- Twilio/Telnyx yêu cầu một URL webhook **có thể truy cập công khai**.
- Plivo yêu cầu một URL webhook **có thể truy cập công khai**.
- `mock` là nhà cung cấp dev local (không gọi mạng).
- `skipSignatureVerification` chỉ dùng cho kiểm thử local.
- Nếu dùng ngrok gói miễn phí, đặt `publicUrl` thành URL ngrok chính xác; việc xác minh chữ ký luôn được áp dụng.
- `tunnel.allowNgrokFreeTierLoopbackBypass: true` cho phép webhook Twilio có chữ ký không hợp lệ **chỉ khi** `tunnel.provider="ngrok"` và `serve.bind` là loopback (ngrok local agent). Chỉ dùng cho dev local.
- URL ngrok gói miễn phí có thể thay đổi hoặc thêm hành vi trung gian; nếu `publicUrl` bị lệch, chữ ký Twilio sẽ thất bại. Với production, ưu tiên domain ổn định hoặc Tailscale funnel.

## Bảo mật Webhook

Khi có proxy hoặc tunnel đứng trước Gateway, plugin sẽ tái tạo
URL công khai để xác minh chữ ký. Các tùy chọn này kiểm soát những header
được chuyển tiếp nào được tin cậy.

`webhookSecurity.allowedHosts` cho phép danh sách host từ các header chuyển tiếp.

`webhookSecurity.trustForwardingHeaders` tin cậy các header chuyển tiếp mà không cần danh sách cho phép.

`webhookSecurity.trustedProxyIPs` chỉ tin cậy các header chuyển tiếp khi IP từ xa của request
khớp với danh sách.

Ví dụ với một host công khai ổn định:

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

## TTS cho cuộc gọi

Voice Call sử dụng cấu hình `messages.tts` cốt lõi (OpenAI hoặc ElevenLabs) để
stream giọng nói trong cuộc gọi. Bạn có thể ghi đè trong cấu hình plugin với
**cùng cấu trúc** — nó sẽ deep‑merge với `messages.tts`.

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

Ghi chú:

- **Edge TTS bị bỏ qua cho cuộc gọi thoại** (âm thanh viễn thông cần PCM; đầu ra Edge không đáng tin cậy).
- TTS cốt lõi được dùng khi bật Twilio media streaming; nếu không, cuộc gọi sẽ dùng giọng nói gốc của nhà cung cấp.

### Thêm ví dụ

Chỉ dùng TTS cốt lõi (không ghi đè):

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

Ghi đè sang ElevenLabs chỉ cho cuộc gọi (giữ mặc định cốt lõi ở nơi khác):

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

Chỉ ghi đè model OpenAI cho cuộc gọi (ví dụ deep‑merge):

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

## Cuộc gọi vào

Chính sách gọi vào mặc định là `disabled`. Để bật cuộc gọi vào, đặt:

```json5
{
  inboundPolicy: "allowlist",
  allowFrom: ["+15550001234"],
  inboundGreeting: "Hello! How can I help?",
}
```

Phản hồi tự động sử dụng hệ thống agent. Tinh chỉnh với:

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

## Agent tool

Tên công cụ: `voice_call`

Hành động:

- `initiate_call` (message, to?, mode?)
- `continue_call` (callId, message)
- `speak_to_user` (callId, message)
- `end_call` (callId)
- `get_status` (callId)

Repo này đi kèm một tài liệu skill tương ứng tại `skills/voice-call/SKILL.md`.

## Gateway RPC

- `voicecall.initiate` (`to?`, `message`, `mode?`)
- `voicecall.continue` (`callId`, `message`)
- `voicecall.speak` (`callId`, `message`)
- `voicecall.end` (`callId`)
- `voicecall.status` (`callId`)
