---
summary: "Chinh sach thu lai cho cac cuoc goi nha cung cap dau ra"
read_when:
  - Cap nhat hanh vi thu lai hoac mac dinh cua nha cung cap
  - Xu ly su co loi gui cua nha cung cap hoac gioi han toc do
title: "Chinh sach thu lai"
x-i18n:
  source_path: concepts/retry.md
  source_hash: 55bb261ff567f46c
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:06:45Z
---

# Chinh sach thu lai

## Muc tieu

- Thu lai theo tung yeu cau HTTP, khong theo luong nhieu buoc.
- Bao toan thu tu bang cach chi thu lai buoc hien tai.
- Tranh trung lap cac thao tac khong co tinh idempotent.

## Mac dinh

- So lan thu: 3
- Gioi han do tre toi da: 30000 ms
- Jitter: 0.1 (10 phan tram)
- Mac dinh theo nha cung cap:
  - Telegram do tre toi thieu: 400 ms
  - Discord do tre toi thieu: 500 ms

## Hanh vi

### Discord

- Chi thu lai khi gap loi gioi han toc do (HTTP 429).
- Su dung `retry_after` khi co san, neu khong thi su dung backoff theo ham mu.

### Telegram

- Thu lai khi gap loi tam thoi (429, timeout, connect/reset/closed, tam thoi khong kha dung).
- Su dung `retry_after` khi co san, neu khong thi su dung backoff theo ham mu.
- Loi phan tich Markdown khong duoc thu lai; se chuyen sang van ban thuong.

## Cau hinh

Thiet lap chinh sach thu lai theo tung nha cung cap trong `~/.openclaw/openclaw.json`:

```json5
{
  channels: {
    telegram: {
      retry: {
        attempts: 3,
        minDelayMs: 400,
        maxDelayMs: 30000,
        jitter: 0.1,
      },
    },
    discord: {
      retry: {
        attempts: 3,
        minDelayMs: 500,
        maxDelayMs: 30000,
        jitter: 0.1,
      },
    },
  },
}
```

## Ghi chu

- Thu lai ap dung theo tung yeu cau (gui tin nhan, tai len media, reaction, poll, sticker).
- Cac luong tong hop khong thu lai cac buoc da hoan thanh.
