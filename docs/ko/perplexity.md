---
summary: "웹 검색을 위한 Perplexity Sonar 설정"
read_when:
  - 웹 검색에 Perplexity Sonar 를 사용하려는 경우
  - PERPLEXITY_API_KEY 또는 OpenRouter 설정이 필요한 경우
title: "Perplexity Sonar"
x-i18n:
  source_path: perplexity.md
  source_hash: 264d08e62e3bec85
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:39:50Z
---

# Perplexity Sonar

OpenClaw 는 `web_search` 도구에 Perplexity Sonar 를 사용할 수 있습니다. Perplexity 의 직접 API 또는 OpenRouter 를 통해 연결할 수 있습니다.

## API 옵션

### Perplexity (직접)

- 기본 URL: https://api.perplexity.ai
- 환경 변수: `PERPLEXITY_API_KEY`

### OpenRouter (대안)

- 기본 URL: https://openrouter.ai/api/v1
- 환경 변수: `OPENROUTER_API_KEY`
- 선불/암호화폐 크레딧을 지원합니다.

## 설정 예시

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

## Brave 에서 전환

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

`PERPLEXITY_API_KEY` 와 `OPENROUTER_API_KEY` 가 모두 설정된 경우, 구분을 위해 `tools.web.search.perplexity.baseUrl` (또는 `tools.web.search.perplexity.apiKey`) 를 설정하십시오.

기본 URL 이 설정되지 않은 경우, OpenClaw 는 API 키 소스에 따라 기본값을 선택합니다.

- `PERPLEXITY_API_KEY` 또는 `pplx-...` → 직접 Perplexity (`https://api.perplexity.ai`)
- `OPENROUTER_API_KEY` 또는 `sk-or-...` → OpenRouter (`https://openrouter.ai/api/v1`)
- 알 수 없는 키 형식 → OpenRouter (안전한 폴백)

## 모델

- `perplexity/sonar` — 웹 검색을 포함한 빠른 Q&A
- `perplexity/sonar-pro` (기본값) — 다단계 추론 + 웹 검색
- `perplexity/sonar-reasoning-pro` — 심층 연구

전체 web_search 설정은 [Web tools](/tools/web) 를 참조하십시오.
