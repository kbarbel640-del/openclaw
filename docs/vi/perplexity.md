---
summary: "Thiết lập Perplexity Sonar cho web_search"
read_when:
  - Ban muon su dung Perplexity Sonar cho tim kiem web
  - Ban can PERPLEXITY_API_KEY hoac thiet lap OpenRouter
title: "Perplexity Sonar"
x-i18n:
  source_path: perplexity.md
  source_hash: 264d08e62e3bec85
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:07:45Z
---

# Perplexity Sonar

OpenClaw co the su dung Perplexity Sonar cho cong cu `web_search`. Ban co the ket noi
thong qua API truc tiep cua Perplexity hoac qua OpenRouter.

## Tuy chon API

### Perplexity (truc tiep)

- Base URL: https://api.perplexity.ai
- Bien moi truong: `PERPLEXITY_API_KEY`

### OpenRouter (thay the)

- Base URL: https://openrouter.ai/api/v1
- Bien moi truong: `OPENROUTER_API_KEY`
- Ho tro tin dung tra truoc/tien dien tu.

## Vi du cau hinh

```json5
{
  tools: {
    web: {
      search: {
        provider: "perplexity",
        perplexity: {
          apiKey: "pplx-...",
          baseUrl: "https://api.perplexity.ai",
          model: "perplexity/sonar-pro",
        },
      },
    },
  },
}
```

## Chuyen tu Brave

```json5
{
  tools: {
    web: {
      search: {
        provider: "perplexity",
        perplexity: {
          apiKey: "pplx-...",
          baseUrl: "https://api.perplexity.ai",
        },
      },
    },
  },
}
```

Neu ca `PERPLEXITY_API_KEY` va `OPENROUTER_API_KEY` deu duoc thiet lap, hay dat
`tools.web.search.perplexity.baseUrl` (hoac `tools.web.search.perplexity.apiKey`)
de tranh nham lan.

Neu khong co base URL nao duoc thiet lap, OpenClaw se chon mac dinh dua tren nguon API key:

- `PERPLEXITY_API_KEY` hoac `pplx-...` → Perplexity truc tiep (`https://api.perplexity.ai`)
- `OPENROUTER_API_KEY` hoac `sk-or-...` → OpenRouter (`https://openrouter.ai/api/v1`)
- Dinh dang key khong xac dinh → OpenRouter (phuong an an toan)

## Mo hinh

- `perplexity/sonar` — hoi dap nhanh voi tim kiem web
- `perplexity/sonar-pro` (mac dinh) — suy luan nhieu buoc + tim kiem web
- `perplexity/sonar-reasoning-pro` — nghien cuu chuyen sau

Xem [Web tools](/tools/web) de biet them chi tiet ve cau hinh web_search day du.
