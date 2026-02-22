# Gemini 3.1 Pro Preview for OpenClaw

> **🇰🇷 한국어 안내는 아래에 있습니다.**

---

## 🇺🇸 English

### What is this?

This fork adds **Gemini 3.1 Pro Preview** (`gemini-3.1-pro-preview`) support to [OpenClaw](https://github.com/openclaw/openclaw) — Google's latest and most capable model — using the Cloud Code Assist API with **OAuth authentication** (free via Gemini CLI subscription, no API key needed).

### Why is this needed?

As of OpenClaw 2026.2.21, `gemini-3.1-pro-preview` is not yet in the built-in model catalog. The underlying SDK (pi-ai) hasn't added native support either. This fork bridges the gap so you can use Gemini 3.1 Pro today.

**What this fork does:**

- ✅ Registers `gemini-3.1-pro-preview` in the model catalog (alias: `gemini31`)
- ✅ Auto-injects the model when Gemini CLI OAuth credentials are detected
- ✅ Fixes thinking level support (`thinkingBudget` → `thinkingLevel` conversion)
- ✅ Full test coverage (14 new tests, all 6807 existing tests pass)
- ✅ E2E verified with actual API calls

**Forward-compatible:** When pi-ai adds native Gemini 3.1 support, the patches in this fork become no-ops. Nothing breaks.

### How to build and run

#### Prerequisites

- Node.js ≥ 22
- pnpm ≥ 9
- Gemini CLI installed and authenticated (`gemini` command works)

#### Steps

```bash
# 1. Clone this fork
git clone https://github.com/hongchanroh/openclaw.git
cd openclaw
git checkout feat/gemini-3.1-support

# 2. Install dependencies
pnpm install

# 3. Build
pnpm build

# 4. Run the gateway (foreground, custom port to avoid conflicts)
node openclaw.mjs gateway run --port 18899

# Or replace your global installation:
npm install -g .
openclaw gateway restart
```

#### Verify

```bash
openclaw models list | grep gemini-3.1
# google-gemini-cli/gemini-3.1-pro-preview   text+image 1024k    no    yes   configured,alias:gemini31
```

#### Use

```
/model gemini31
```

Or set as default in `~/.openclaw/openclaw.json`:

```json
{
  "models": {
    "default": "google-gemini-cli/gemini-3.1-pro-preview"
  }
}
```

### Known issue: apiKey validation

If `gemini-3.1-pro-preview` shows as `configured,missing`, another provider in your config (e.g., `openai-codex`) may be missing an `apiKey` field. Add a placeholder:

```json
{
  "models": {
    "providers": {
      "openai-codex": {
        "apiKey": "codex-oauth-placeholder",
        ...
      }
    }
  }
}
```

See [docs/guides/gemini-3.1-pro-setup.md](docs/guides/gemini-3.1-pro-setup.md) for full details.

### PR Status

This is submitted as [PR #23424](https://github.com/openclaw/openclaw/pull/23424) to upstream OpenClaw. Use this fork until it's merged or pi-ai adds native support.

---

## 🇰🇷 한국어

### 이게 뭔가요?

이 포크는 [OpenClaw](https://github.com/openclaw/openclaw)에 **Gemini 3.1 Pro Preview** (`gemini-3.1-pro-preview`) 지원을 추가합니다. Google의 최신 최강 모델을 **OAuth 인증**으로 사용할 수 있습니다 (Gemini CLI 구독으로 무료, API 키 불필요).

### 왜 필요한가요?

OpenClaw 2026.2.21 기준, `gemini-3.1-pro-preview`는 아직 내장 모델 카탈로그에 없습니다. 기반 SDK(pi-ai)도 아직 네이티브 지원을 추가하지 않았습니다. 이 포크가 그 간극을 메워줍니다.

**이 포크가 하는 것:**

- ✅ `gemini-3.1-pro-preview` 모델 카탈로그 등록 (별칭: `gemini31`)
- ✅ Gemini CLI OAuth 인증 감지 시 자동 모델 주입
- ✅ Thinking level 지원 수정 (`thinkingBudget` → `thinkingLevel` 변환)
- ✅ 14개 신규 테스트 포함, 전체 6807개 테스트 통과
- ✅ 실제 API 호출 E2E 검증 완료

**하위 호환:** pi-ai가 Gemini 3.1을 네이티브 지원하면, 이 포크의 패치는 자동으로 no-op이 됩니다. 아무것도 깨지지 않습니다.

### 빌드 및 실행 방법

#### 사전 요건

- Node.js ≥ 22
- pnpm ≥ 9
- Gemini CLI 설치 및 인증 완료 (`gemini` 명령어 동작)

#### 단계

```bash
# 1. 포크 클론
git clone https://github.com/hongchanroh/openclaw.git
cd openclaw
git checkout feat/gemini-3.1-support

# 2. 의존성 설치
pnpm install

# 3. 빌드
pnpm build

# 4. 게이트웨이 실행 (포그라운드, 충돌 방지를 위해 커스텀 포트)
node openclaw.mjs gateway run --port 18899

# 또는 글로벌 설치 교체:
npm install -g .
openclaw gateway restart
```

#### 확인

```bash
openclaw models list | grep gemini-3.1
# google-gemini-cli/gemini-3.1-pro-preview   text+image 1024k    no    yes   configured,alias:gemini31
```

#### 사용

```
/model gemini31
```

또는 `~/.openclaw/openclaw.json`에서 기본 모델로 설정:

```json
{
  "models": {
    "default": "google-gemini-cli/gemini-3.1-pro-preview"
  }
}
```

### 알려진 이슈: apiKey 검증

`gemini-3.1-pro-preview`가 `configured,missing`으로 표시되면, 설정의 다른 프로바이더(예: `openai-codex`)에 `apiKey` 필드가 누락된 것일 수 있습니다. placeholder를 추가하세요:

```json
{
  "models": {
    "providers": {
      "openai-codex": {
        "apiKey": "codex-oauth-placeholder",
        ...
      }
    }
  }
}
```

자세한 내용은 [docs/guides/gemini-3.1-pro-setup.md](docs/guides/gemini-3.1-pro-setup.md)를 참고하세요.

### PR 상태

이 변경사항은 upstream OpenClaw에 [PR #23424](https://github.com/openclaw/openclaw/pull/23424)로 제출되어 있습니다. merge되거나 pi-ai가 네이티브 지원을 추가할 때까지 이 포크를 사용하세요.
