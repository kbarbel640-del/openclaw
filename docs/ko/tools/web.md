---
summary: "웹 검색 + 가져오기 도구 (Brave Search API, Perplexity direct/OpenRouter)"
read_when:
  - web_search 또는 web_fetch 를 활성화하려는 경우
  - Brave Search API 키 설정이 필요한 경우
  - 웹 검색에 Perplexity Sonar 를 사용하려는 경우
title: "웹 도구"
x-i18n:
  source_path: tools/web.md
  source_hash: f5f25d2b40ccf1e5
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:38:02Z
---

# 웹 도구

OpenClaw 에는 두 가지 경량 웹 도구가 포함되어 있습니다.

- `web_search` — Brave Search API (기본값) 또는 Perplexity Sonar (직접 또는 OpenRouter 경유)를 통해 웹을 검색합니다.
- `web_fetch` — HTTP 가져오기 + 가독성 있는 콘텐츠 추출 (HTML → markdown/text).

이 도구들은 **브라우저 자동화가 아닙니다**. JavaScript 가 많은 사이트나 로그인 페이지의 경우
[Browser tool](/tools/browser)을 사용하십시오.

## 작동 방식

- `web_search` 은 설정된 프로바이더를 호출하고 결과를 반환합니다.
  - **Brave** (기본값): 구조화된 결과 (제목, URL, 스니펫)를 반환합니다.
  - **Perplexity**: 실시간 웹 검색을 기반으로 한 인용이 포함된 AI 합성 답변을 반환합니다.
- 결과는 쿼리 기준으로 15분 동안 캐시됩니다 (설정 가능).
- `web_fetch` 는 단순 HTTP GET 을 수행하고 가독성 있는 콘텐츠를 추출합니다
  (HTML → markdown/text). JavaScript 는 **실행하지 않습니다**.
- `web_fetch` 은 기본적으로 활성화되어 있습니다 (명시적으로 비활성화하지 않는 한).

## 검색 프로바이더 선택

| 프로바이더         | 장점                                 | 단점                                 | API 키                                         |
| ------------------ | ------------------------------------ | ------------------------------------ | ---------------------------------------------- |
| **Brave** (기본값) | 빠르고 구조화된 결과, 무료 티어 제공 | 전통적인 검색 결과                   | `BRAVE_API_KEY`                                |
| **Perplexity**     | AI 합성 답변, 인용 제공, 실시간      | Perplexity 또는 OpenRouter 접근 필요 | `OPENROUTER_API_KEY` 또는 `PERPLEXITY_API_KEY` |

프로바이더별 세부 사항은 [Brave Search 설정](/brave-search)과 [Perplexity Sonar](/perplexity)를 참고하십시오.

config 에서 프로바이더를 설정합니다:

```json5
{
  tools: {
    web: {
      search: {
        provider: "brave", // or "perplexity"
      },
    },
  },
}
```

예시: Perplexity Sonar (직접 API)로 전환:

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

## Brave API 키 받기

1. https://brave.com/search/api/ 에서 Brave Search API 계정을 생성합니다.
2. 대시보드에서 **Data for Search** 플랜을 선택합니다 (“Data for AI” 아님) 그리고 API 키를 생성합니다.
3. 키를 config 에 저장하려면 `openclaw configure --section web` 를 실행하는 것을 권장하며, 또는 환경 변수에 `BRAVE_API_KEY` 를 설정할 수 있습니다.

Brave 는 무료 티어와 유료 플랜을 제공합니다. 현재 제한 사항과 가격은
Brave API 포털을 확인하십시오.

### 키를 설정하는 위치 (권장)

**권장:** `openclaw configure --section web` 를 실행하십시오. 그러면
`~/.openclaw/openclaw.json` 의 `tools.web.search.apiKey` 아래에 키가 저장됩니다.

**환경 변수 대안:** Gateway(게이트웨이) 프로세스 환경에 `BRAVE_API_KEY` 를 설정합니다.
게이트웨이 설치의 경우 `~/.openclaw/.env` (또는 서비스 환경)에 추가하십시오.
자세한 내용은 [Env vars](/help/faq#how-does-openclaw-load-environment-variables)를 참고하십시오.

## Perplexity 사용 (직접 또는 OpenRouter 경유)

Perplexity Sonar 모델은 내장된 웹 검색 기능을 가지고 있으며
인용이 포함된 AI 합성 답변을 반환합니다. OpenRouter 를 통해 사용할 수 있으며
신용카드 없이도 사용 가능하고 암호화폐/선불을 지원합니다.

### OpenRouter API 키 받기

1. https://openrouter.ai/ 에서 계정을 생성합니다.
2. 크레딧을 충전합니다 (암호화폐, 선불, 신용카드 지원).
3. 계정 설정에서 API 키를 생성합니다.

### Perplexity 검색 설정

```json5
{
  tools: {
    web: {
      search: {
        enabled: true,
        provider: "perplexity",
        perplexity: {
          // API key (optional if OPENROUTER_API_KEY or PERPLEXITY_API_KEY is set)
          apiKey: "sk-or-v1-...",
          // Base URL (key-aware default if omitted)
          baseUrl: "https://openrouter.ai/api/v1",
          // Model (defaults to perplexity/sonar-pro)
          model: "perplexity/sonar-pro",
        },
      },
    },
  },
}
```

**환경 변수 대안:** Gateway 환경에 `OPENROUTER_API_KEY` 또는 `PERPLEXITY_API_KEY` 를 설정합니다.
게이트웨이 설치의 경우 `~/.openclaw/.env` 에 추가하십시오.

기본 URL 이 설정되지 않은 경우, OpenClaw 는 API 키 출처에 따라 기본값을 선택합니다:

- `PERPLEXITY_API_KEY` 또는 `pplx-...` → `https://api.perplexity.ai`
- `OPENROUTER_API_KEY` 또는 `sk-or-...` → `https://openrouter.ai/api/v1`
- 알 수 없는 키 형식 → OpenRouter (안전한 폴백)

### 사용 가능한 Perplexity 모델

| 모델                             | 설명                         | 적합한 용도 |
| -------------------------------- | ---------------------------- | ----------- |
| `perplexity/sonar`               | 웹 검색을 포함한 빠른 Q&A    | 빠른 조회   |
| `perplexity/sonar-pro` (기본값)  | 웹 검색을 포함한 다단계 추론 | 복잡한 질문 |
| `perplexity/sonar-reasoning-pro` | 체인-오브-쏘트 분석          | 심층 연구   |

## web_search

설정된 프로바이더를 사용하여 웹을 검색합니다.

### 요구 사항

- `tools.web.search.enabled` 는 `false` 가 아니어야 합니다 (기본값: 활성화)
- 선택한 프로바이더의 API 키:
  - **Brave**: `BRAVE_API_KEY` 또는 `tools.web.search.apiKey`
  - **Perplexity**: `OPENROUTER_API_KEY`, `PERPLEXITY_API_KEY`, 또는 `tools.web.search.perplexity.apiKey`

### Config

```json5
{
  tools: {
    web: {
      search: {
        enabled: true,
        apiKey: "BRAVE_API_KEY_HERE", // optional if BRAVE_API_KEY is set
        maxResults: 5,
        timeoutSeconds: 30,
        cacheTtlMinutes: 15,
      },
    },
  },
}
```

### 도구 파라미터

- `query` (필수)
- `count` (1–10; 기본값은 config 에서 가져옴)
- `country` (선택 사항): 지역별 결과를 위한 2자리 국가 코드 (예: "DE", "US", "ALL"). 생략 시 Brave 가 기본 지역을 선택합니다.
- `search_lang` (선택 사항): 검색 결과의 ISO 언어 코드 (예: "de", "en", "fr")
- `ui_lang` (선택 사항): UI 요소의 ISO 언어 코드
- `freshness` (선택 사항, Brave 전용): 검색 시점 기준 필터 (`pd`, `pw`, `pm`, `py`, 또는 `YYYY-MM-DDtoYYYY-MM-DD`)

**예시:**

```javascript
// German-specific search
await web_search({
  query: "TV online schauen",
  count: 10,
  country: "DE",
  search_lang: "de",
});

// French search with French UI
await web_search({
  query: "actualités",
  country: "FR",
  search_lang: "fr",
  ui_lang: "fr",
});

// Recent results (past week)
await web_search({
  query: "TMBG interview",
  freshness: "pw",
});
```

## web_fetch

URL 을 가져와 가독성 있는 콘텐츠를 추출합니다.

### 요구 사항

- `tools.web.fetch.enabled` 는 `false` 가 아니어야 합니다 (기본값: 활성화)
- 선택 사항인 Firecrawl 폴백: `tools.web.fetch.firecrawl.apiKey` 또는 `FIRECRAWL_API_KEY` 를 설정합니다.

### Config

```json5
{
  tools: {
    web: {
      fetch: {
        enabled: true,
        maxChars: 50000,
        maxCharsCap: 50000,
        timeoutSeconds: 30,
        cacheTtlMinutes: 15,
        maxRedirects: 3,
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        readability: true,
        firecrawl: {
          enabled: true,
          apiKey: "FIRECRAWL_API_KEY_HERE", // optional if FIRECRAWL_API_KEY is set
          baseUrl: "https://api.firecrawl.dev",
          onlyMainContent: true,
          maxAgeMs: 86400000, // ms (1 day)
          timeoutSeconds: 60,
        },
      },
    },
  },
}
```

### 도구 파라미터

- `url` (필수, http/https 만 허용)
- `extractMode` (`markdown` | `text`)
- `maxChars` (긴 페이지 자르기)

참고 사항:

- `web_fetch` 은 먼저 Readability (주요 콘텐츠 추출)를 사용하고, 이후 Firecrawl (설정된 경우)을 사용합니다. 둘 다 실패하면 도구는 오류를 반환합니다.
- Firecrawl 요청은 봇 우회 모드를 사용하며 기본적으로 결과를 캐시합니다.
- `web_fetch` 은 Chrome 과 유사한 User-Agent 와 `Accept-Language` 를 기본으로 전송합니다. 필요 시 `userAgent` 을 재정의하십시오.
- `web_fetch` 은 사설/내부 호스트 이름을 차단하고 리다이렉트를 다시 확인합니다 (`maxRedirects` 로 제한).
- `maxChars` 은 `tools.web.fetch.maxCharsCap` 로 제한됩니다.
- `web_fetch` 은 최선의 추출을 수행하며, 일부 사이트는 브라우저 도구가 필요합니다.
- 키 설정과 서비스 세부 정보는 [Firecrawl](/tools/firecrawl)을 참고하십시오.
- 반복적인 가져오기를 줄이기 위해 응답은 캐시됩니다 (기본값 15분).
- 도구 프로필/허용 목록을 사용하는 경우 `web_search`/`web_fetch` 또는 `group:web` 을 추가하십시오.
- Brave 키가 없는 경우 `web_search` 는 문서 링크가 포함된 간단한 설정 안내를 반환합니다.
