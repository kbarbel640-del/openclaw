---
summary: "Chuyen doi giong noi Deepgram cho tin nhan giong noi dau vao"
read_when:
  - "Ban muon dung Deepgram chuyen giong noi thanh van ban cho tep dinh kem am thanh"
  - "Ban can mot vi du cau hinh Deepgram nhanh"
title: "Deepgram"
x-i18n:
  source_path: providers/deepgram.md
  source_hash: 8f19e072f0867211
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:08:04Z
---

# Deepgram (Chuyen doi am thanh thanh van ban)

Deepgram la mot API chuyen giong noi thanh van ban. Trong OpenClaw, no duoc su dung cho **chuyen doi am thanh/tin nhan giong noi dau vao** qua `tools.media.audio`.

Khi duoc bat, OpenClaw tai tep am thanh len Deepgram va chen ban ghi chep vao pipeline tra loi (`{{Transcript}}` + khoi `[Audio]`). Day **khong phai la streaming**; no su dung diem cuoi chuyen doi cho ban ghi am co san.

Website: https://deepgram.com  
Tai lieu: https://developers.deepgram.com

## Khoi dong nhanh

1. Thiet lap khoa API cua ban:

```
DEEPGRAM_API_KEY=dg_...
```

2. Bat nha cung cap:

```json5
{
  tools: {
    media: {
      audio: {
        enabled: true,
        models: [{ provider: "deepgram", model: "nova-3" }],
      },
    },
  },
}
```

## Tuy chon

- `model`: ID mo hinh Deepgram (mac dinh: `nova-3`)
- `language`: goi y ngon ngu (tuy chon)
- `tools.media.audio.providerOptions.deepgram.detect_language`: bat phat hien ngon ngu (tuy chon)
- `tools.media.audio.providerOptions.deepgram.punctuate`: bat dau cau (tuy chon)
- `tools.media.audio.providerOptions.deepgram.smart_format`: bat dinh dang thong minh (tuy chon)

Vi du voi ngon ngu:

```json5
{
  tools: {
    media: {
      audio: {
        enabled: true,
        models: [{ provider: "deepgram", model: "nova-3", language: "en" }],
      },
    },
  },
}
```

Vi du voi cac tuy chon Deepgram:

```json5
{
  tools: {
    media: {
      audio: {
        enabled: true,
        providerOptions: {
          deepgram: {
            detect_language: true,
            punctuate: true,
            smart_format: true,
          },
        },
        models: [{ provider: "deepgram", model: "nova-3" }],
      },
    },
  },
}
```

## Ghi chu

- Xac thuc tuan theo thu tu xac thuc nha cung cap tieu chuan; `DEEPGRAM_API_KEY` la cach don gian nhat.
- Ghi de diem cuoi hoac header bang `tools.media.audio.baseUrl` va `tools.media.audio.headers` khi su dung proxy.
- Dau ra tuan theo cung cac quy tac am thanh nhu cac nha cung cap khac (gioi han kich thuoc, thoi gian cho, chen ban ghi chep).
