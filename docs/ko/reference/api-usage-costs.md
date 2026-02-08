---
summary: "무엇이 비용을 지출할 수 있는지, 어떤 키가 사용되는지, 사용량을 확인하는 방법을 감사"
read_when:
  - "어떤 기능이 유료 API 를 호출할 수 있는지 이해하고 싶을 때"
  - "키, 비용 및 사용량 가시성을 감사해야 할 때"
  - "/status 또는 /usage 비용 보고를 설명할 때"
title: "API 사용량 및 비용"
x-i18n:
  source_path: reference/api-usage-costs.md
  source_hash: 807d0d88801e919a
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:37:32Z
---

# API 사용량 및 비용

이 문서는 **API 키를 호출할 수 있는 기능**과 해당 비용이 어디에 표시되는지를 나열합니다. 제공자 사용량 또는 유료 API 호출을 생성할 수 있는 OpenClaw 기능에 초점을 둡니다.

## 비용이 표시되는 위치 (채팅 + CLI)

**세션별 비용 스냅샷**

- `/status` 는 현재 세션 모델, 컨텍스트 사용량 및 마지막 응답 토큰을 표시합니다.
- 모델이 **API 키 인증**을 사용하는 경우, `/status` 에서 마지막 답변의 **추정 비용**도 표시합니다.

**메시지별 비용 푸터**

- `/usage full` 는 모든 답변에 **추정 비용**(API 키 전용)을 포함한 사용량 푸터를 추가합니다.
- `/usage tokens` 는 토큰만 표시하며, OAuth 흐름에서는 달러 비용을 숨깁니다.

**CLI 사용량 창 (프로바이더 할당량)**

- `openclaw status --usage` 및 `openclaw channels list` 는 프로바이더 **사용량 창**을 표시합니다
  (메시지별 비용이 아닌 할당량 스냅샷).

자세한 내용과 예시는 [Token use & costs](/token-use)를 참고하세요.

## 키가 발견되는 방식

OpenClaw 는 다음에서 자격 증명을 가져올 수 있습니다:

- **인증 프로필** (에이전트별, `auth-profiles.json` 에 저장).
- **환경 변수** (예: `OPENAI_API_KEY`, `BRAVE_API_KEY`, `FIRECRAWL_API_KEY`).
- **설정** (`models.providers.*.apiKey`, `tools.web.search.*`, `tools.web.fetch.firecrawl.*`,
  `memorySearch.*`, `talk.apiKey`).
- **Skills** (`skills.entries.<name>.apiKey`) — 스킬 프로세스 환경 변수로 키를 내보낼 수 있습니다.

## 키를 사용할 수 있는 기능

### 1) 핵심 모델 응답 (채팅 + 도구)

모든 답변 또는 도구 호출은 **현재 모델 프로바이더**(OpenAI, Anthropic 등)를 사용합니다. 이는 사용량과 비용의 주요 원천입니다.

가격 설정은 [Models](/providers/models), 표시는 [Token use & costs](/token-use)를 참고하세요.

### 2) 미디어 이해 (오디오/이미지/비디오)

수신된 미디어는 답변 실행 전에 요약/전사될 수 있습니다. 이는 모델/프로바이더 API 를 사용합니다.

- 오디오: OpenAI / Groq / Deepgram (키가 존재하면 **자동 활성화**).
- 이미지: OpenAI / Anthropic / Google.
- 비디오: Google.

[Media understanding](/nodes/media-understanding)을 참고하세요.

### 3) 메모리 임베딩 + 시맨틱 검색

시맨틱 메모리 검색은 원격 프로바이더로 구성된 경우 **임베딩 API**를 사용합니다:

- `memorySearch.provider = "openai"` → OpenAI 임베딩
- `memorySearch.provider = "gemini"` → Gemini 임베딩
- 로컬 임베딩 실패 시 OpenAI 로의 선택적 폴백

`memorySearch.provider = "local"` 로 로컬 유지가 가능합니다 (API 사용 없음).

[Memory](/concepts/memory)를 참고하세요.

### 4) 웹 검색 도구 (Brave / Perplexity via OpenRouter)

`web_search` 는 API 키를 사용하며 사용 요금이 발생할 수 있습니다:

- **Brave Search API**: `BRAVE_API_KEY` 또는 `tools.web.search.apiKey`
- **Perplexity** (OpenRouter 경유): `PERPLEXITY_API_KEY` 또는 `OPENROUTER_API_KEY`

**Brave 무료 티어 (넉넉함):**

- **월 2,000 요청**
- **초당 1 요청**
- **신용카드 필요** (검증 목적, 업그레이드하지 않는 한 과금 없음)

[Web tools](/tools/web)를 참고하세요.

### 5) 웹 가져오기 도구 (Firecrawl)

API 키가 있으면 `web_fetch` 가 **Firecrawl** 을 호출할 수 있습니다:

- `FIRECRAWL_API_KEY` 또는 `tools.web.fetch.firecrawl.apiKey`

Firecrawl 이 구성되지 않은 경우, 도구는 직접 가져오기 + 가독성 처리로 폴백합니다 (유료 API 없음).

[Web tools](/tools/web)를 참고하세요.

### 6) 프로바이더 사용량 스냅샷 (상태/헬스)

일부 상태 명령은 할당량 창 또는 인증 상태를 표시하기 위해 **프로바이더 사용량 엔드포인트**를 호출합니다.
일반적으로 호출량은 낮지만 여전히 프로바이더 API 를 호출합니다:

- `openclaw status --usage`
- `openclaw models status --json`

[Models CLI](/cli/models)를 참고하세요.

### 7) 압축 보호 요약

압축 보호 장치는 **현재 모델**을 사용해 세션 기록을 요약할 수 있으며,
실행 시 프로바이더 API 를 호출합니다.

[Session management + compaction](/reference/session-management-compaction)을 참고하세요.

### 8) 모델 스캔 / 프로브

`openclaw models scan` 는 OpenRouter 모델을 프로브할 수 있으며,
프로브가 활성화된 경우 `OPENROUTER_API_KEY` 를 사용합니다.

[Models CLI](/cli/models)를 참고하세요.

### 9) Talk (음성)

Talk 모드는 구성된 경우 **ElevenLabs** 를 호출할 수 있습니다:

- `ELEVENLABS_API_KEY` 또는 `talk.apiKey`

[Talk mode](/nodes/talk)를 참고하세요.

### 10) Skills (서드파티 API)

Skills 는 `skills.entries.<name>.apiKey` 에 `apiKey` 를 저장할 수 있습니다. 스킬이 외부
API 를 위해 해당 키를 사용하는 경우, 스킬의 프로바이더 정책에 따라 비용이 발생할 수 있습니다.

[Skills](/tools/skills)를 참고하세요.
