# @openclaw/sms

SMS channel plugin for OpenClaw with two providers:

- Aliyun SMS (Alibaba Cloud)
- Tencent Cloud SMS

## Install

```bash
openclaw plugins install ./extensions/sms
```

## Enable

```json5
{
  plugins: { entries: { sms: { enabled: true } } },
  channels: {
    sms: {
      provider: "aliyun", // or "tencent"
      signName: "YourSign",
      templateId: "SMS_123456789",
      aliyun: {
        accessKeyId: "LTAI...",
        accessKeySecret: "...",
      },
    },
  },
}
```

Tencent example:

```json5
{
  plugins: { entries: { sms: { enabled: true } } },
  channels: {
    sms: {
      provider: "tencent",
      signName: "YourSign",
      templateId: "1234567",
      tencent: {
        secretId: "AKID...",
        secretKey: "...",
        sdkAppId: "1400xxxxxx",
      },
    },
  },
}
```

Use outbound target as E.164 phone number, e.g. `+8613812345678`.
