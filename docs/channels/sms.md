---
summary: "SMS channel via Aliyun or Tencent Cloud"
read_when:
  - You want to send outbound SMS from OpenClaw
  - You deploy in mainland China and need domestic SMS providers
title: "SMS"
---

# SMS

The SMS plugin provides outbound text delivery through:

- Aliyun SMS (`provider: "aliyun"`)
- Tencent Cloud SMS (`provider: "tencent"`)

Install:

```bash
openclaw plugins install ./extensions/sms
```

Enable:

```json5
{
  plugins: { entries: { sms: { enabled: true } } },
}
```

Configure Aliyun:

```json5
{
  channels: {
    sms: {
      provider: "aliyun",
      signName: "YourSign",
      templateId: "SMS_123456789",
      aliyun: {
        accessKeyId: "LTAI...",
        accessKeySecret: "...",
        templateParamName: "content",
      },
    },
  },
}
```

Configure Tencent:

```json5
{
  channels: {
    sms: {
      provider: "tencent",
      signName: "YourSign",
      templateId: "1234567",
      tencent: {
        secretId: "AKID...",
        secretKey: "...",
        sdkAppId: "1400xxxxxx",
        region: "ap-guangzhou",
      },
    },
  },
}
```

Notes:

- Target must be E.164 phone number format (for example `+8613812345678`).
- SMS uses provider templates. OpenClaw sends the message text as template content.
- This channel is outbound-only (no inbound SMS webhook in this first version).
