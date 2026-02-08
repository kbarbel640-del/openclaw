---
summary: "OpenClaw 에서 MiniMax M2.1 사용"
read_when:
  - OpenClaw 에서 MiniMax 모델이 필요합니다
  - MiniMax 설정 가이드가 필요합니다
title: "MiniMax"
x-i18n:
  source_path: providers/minimax.md
  source_hash: 5bbd47fa3327e40c
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:40:29Z
---

# MiniMax

MiniMax 는 **M2/M2.1** 모델 패밀리를 구축하는 AI 회사입니다. 현재
코딩 중심 릴리스는 **MiniMax M2.1** (2025년 12월 23일)로,
실세계의 복잡한 작업을 위해 설계되었습니다.

출처: [MiniMax M2.1 릴리스 노트](https://www.minimax.io/news/minimax-m21)

## 모델 개요 (M2.1)

MiniMax 는 M2.1 에서 다음과 같은 개선 사항을 강조합니다:

- 더 강력한 **다국어 코딩** (Rust, Java, Go, C++, Kotlin, Objective-C, TS/JS).
- **웹/앱 개발** 및 미적 출력 품질 향상 (네이티브 모바일 포함).
- 사무형 워크플로를 위한 **복합 지시 처리** 개선으로,
  인터리브드 사고와 통합 제약 실행을 기반으로 합니다.
- 토큰 사용량 감소와 더 빠른 반복 루프를 통한 **더 간결한 응답**.
- **도구/에이전트 프레임워크** 호환성 및 컨텍스트 관리 강화
  (Claude Code, Droid/Factory AI, Cline, Kilo Code, Roo Code, BlackBox).
- 더 높은 품질의 **대화 및 기술 문서 작성** 출력.

## MiniMax M2.1 vs MiniMax M2.1 Lightning

- **속도:** Lightning 은 MiniMax 가격 문서에서 “빠른” 변형입니다.
- **비용:** 가격표상 입력 비용은 동일하지만 Lightning 은 출력 비용이 더 높습니다.
- **코딩 플랜 라우팅:** Lightning 백엔드는 MiniMax 코딩 플랜에서 직접 사용할 수 없습니다.
  MiniMax 는 대부분의 요청을 Lightning 으로 자동 라우팅하지만,
  트래픽 급증 시에는 일반 M2.1 백엔드로 폴백합니다.

## 설정 선택

### MiniMax OAuth (코딩 플랜) — 권장

**적합 대상:** OAuth 를 통한 MiniMax 코딩 플랜의 빠른 설정, API 키 불필요.

번들된 OAuth 플러그인을 활성화하고 인증합니다:

```bash
openclaw plugins enable minimax-portal-auth  # skip if already loaded.
openclaw gateway restart  # restart if gateway is already running
openclaw onboard --auth-choice minimax-portal
```

엔드포인트 선택을 요청받게 됩니다:

- **Global** - 국제 사용자 (`api.minimax.io`)
- **CN** - 중국 사용자 (`api.minimaxi.com`)

자세한 내용은 [MiniMax OAuth 플러그인 README](https://github.com/openclaw/openclaw/tree/main/extensions/minimax-portal-auth) 를 참조하십시오.

### MiniMax M2.1 (API 키)

**적합 대상:** Anthropic 호환 API 를 사용하는 호스티드 MiniMax.

CLI 를 통해 구성합니다:

- `openclaw configure` 실행
- **Model/auth** 선택
- **MiniMax M2.1** 선택

```json5
{
  env: { MINIMAX_API_KEY: "sk-..." },
  agents: { defaults: { model: { primary: "minimax/MiniMax-M2.1" } } },
  models: {
    mode: "merge",
    providers: {
      minimax: {
        baseUrl: "https://api.minimax.io/anthropic",
        apiKey: "${MINIMAX_API_KEY}",
        api: "anthropic-messages",
        models: [
          {
            id: "MiniMax-M2.1",
            name: "MiniMax M2.1",
            reasoning: false,
            input: ["text"],
            cost: { input: 15, output: 60, cacheRead: 2, cacheWrite: 10 },
            contextWindow: 200000,
            maxTokens: 8192,
          },
        ],
      },
    },
  },
}
```

### MiniMax M2.1 을 폴백으로 사용 (Opus 기본)

**적합 대상:** Opus 4.6 을 기본으로 유지하고, MiniMax M2.1 로 장애 조치.

```json5
{
  env: { MINIMAX_API_KEY: "sk-..." },
  agents: {
    defaults: {
      models: {
        "anthropic/claude-opus-4-6": { alias: "opus" },
        "minimax/MiniMax-M2.1": { alias: "minimax" },
      },
      model: {
        primary: "anthropic/claude-opus-4-6",
        fallbacks: ["minimax/MiniMax-M2.1"],
      },
    },
  },
}
```

### 선택 사항: LM Studio 를 통한 로컬 (수동)

**적합 대상:** LM Studio 를 사용한 로컬 추론.
강력한 하드웨어(예: 데스크톱/서버)에서
LM Studio 의 로컬 서버를 사용해 MiniMax M2.1 로 우수한 결과를 확인했습니다.

`openclaw.json` 를 통해 수동으로 구성합니다:

```json5
{
  agents: {
    defaults: {
      model: { primary: "lmstudio/minimax-m2.1-gs32" },
      models: { "lmstudio/minimax-m2.1-gs32": { alias: "Minimax" } },
    },
  },
  models: {
    mode: "merge",
    providers: {
      lmstudio: {
        baseUrl: "http://127.0.0.1:1234/v1",
        apiKey: "lmstudio",
        api: "openai-responses",
        models: [
          {
            id: "minimax-m2.1-gs32",
            name: "MiniMax M2.1 GS32",
            reasoning: false,
            input: ["text"],
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
            contextWindow: 196608,
            maxTokens: 8192,
          },
        ],
      },
    },
  },
}
```

## `openclaw configure` 를 통한 구성

JSON 을 편집하지 않고 대화형 구성 마법사를 사용해 MiniMax 를 설정합니다:

1. `openclaw configure` 실행.
2. **Model/auth** 선택.
3. **MiniMax M2.1** 선택.
4. 프롬프트에 따라 기본 모델을 선택합니다.

## 구성 옵션

- `models.providers.minimax.baseUrl`: `https://api.minimax.io/anthropic` (Anthropic 호환) 사용을 권장하며, `https://api.minimax.io/v1` 는 OpenAI 호환 페이로드에 선택 사항입니다.
- `models.providers.minimax.api`: `anthropic-messages` 사용을 권장하며, `openai-completions` 는 OpenAI 호환 페이로드에 선택 사항입니다.
- `models.providers.minimax.apiKey`: MiniMax API 키 (`MINIMAX_API_KEY`).
- `models.providers.minimax.models`: `id`, `name`, `reasoning`, `contextWindow`, `maxTokens`, `cost` 정의.
- `agents.defaults.models`: 허용 목록에 포함할 모델의 별칭을 지정합니다.
- `models.mode`: 내장 항목과 함께 MiniMax 를 추가하려면 `merge` 를 유지합니다.

## 참고 사항

- 모델 참조는 `minimax/<model>` 입니다.
- 코딩 플랜 사용 API: `https://api.minimaxi.com/v1/api/openplatform/coding_plan/remains` (코딩 플랜 키 필요).
- 정확한 비용 추적이 필요하면 `models.json` 에서 가격 값을 업데이트하십시오.
- MiniMax 코딩 플랜 추천 링크 (10% 할인): https://platform.minimax.io/subscribe/coding-plan?code=DbXJTRClnb&source=link
- 프로바이더 규칙은 [/concepts/model-providers](/concepts/model-providers) 를 참조하십시오.
- 전환에는 `openclaw models list` 및 `openclaw models set minimax/MiniMax-M2.1` 를 사용합니다.

## 문제 해결

### “Unknown model: minimax/MiniMax-M2.1”

이는 일반적으로 **MiniMax 프로바이더가 구성되지 않았음**을 의미합니다
(프로바이더 항목이 없고 MiniMax 인증 프로필/환경 키도 발견되지 않음).
이 감지에 대한 수정은 **2026.1.12** 에 포함되어 있습니다
(작성 시점에는 미출시). 다음으로 해결하십시오:

- **2026.1.12** 로 업그레이드(또는 소스에서 실행 `main`), 이후 Gateway(게이트웨이) 를 재시작합니다.
- `openclaw configure` 를 실행하고 **MiniMax M2.1** 을 선택하거나,
- `models.providers.minimax` 블록을 수동으로 추가하거나,
- 프로바이더를 주입할 수 있도록 `MINIMAX_API_KEY` (또는 MiniMax 인증 프로필) 을 설정합니다.

모델 ID 는 **대소문자를 구분**합니다:

- `minimax/MiniMax-M2.1`
- `minimax/MiniMax-M2.1-lightning`

그런 다음 다음으로 재확인하십시오:

```bash
openclaw models list
```
