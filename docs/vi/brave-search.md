---
summary: "Thiet lap Brave Search API cho web_search"
read_when:
  - Ban muon su dung Brave Search cho web_search
  - Ban can BRAVE_API_KEY hoac thong tin goi dich vu
title: "Brave Search"
x-i18n:
  source_path: brave-search.md
  source_hash: cdcb037b092b8a10
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:05:56Z
---

# Brave Search API

OpenClaw su dung Brave Search lam nha cung cap mac dinh cho `web_search`.

## Lay API key

1. Tao tai khoan Brave Search API tai https://brave.com/search/api/
2. Trong bang dieu khien, chon goi **Data for Search** va tao API key.
3. Luu key vao config (khuyen nghi) hoac dat `BRAVE_API_KEY` trong moi truong Gateway.

## Vi du config

```json5
{
  tools: {
    web: {
      search: {
        provider: "brave",
        apiKey: "BRAVE_API_KEY_HERE",
        maxResults: 5,
        timeoutSeconds: 30,
      },
    },
  },
}
```

## Ghi chu

- Goi Data for AI **khong** tuong thich voi `web_search`.
- Brave cung cap goi mien phi va cac goi tra phi; hay kiem tra cong thong tin Brave API de biet gioi han hien tai.

Xem [Web tools](/tools/web) de biet cau hinh web_search day du.
