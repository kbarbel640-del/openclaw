---
summary: "수신 오디오/음성 메모가 다운로드되고, 전사되며, 답장에 주입되는 방식"
read_when:
  - 오디오 전사 또는 미디어 처리를 변경할 때
title: "오디오 및 음성 메모"
x-i18n:
  source_path: nodes/audio.md
  source_hash: b926c47989ab0d1e
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:40:41Z
---

# 오디오 / 음성 메모 — 2026-01-17

## 동작하는 것

- **미디어 이해(오디오)**: 오디오 이해가 활성화되어 있거나(또는 자동 감지된 경우) OpenClaw 는 다음을 수행합니다:
  1. 첫 번째 오디오 첨부(로컬 경로 또는 URL)를 찾고 필요 시 다운로드합니다.
  2. 각 모델 항목으로 전송하기 전에 `maxBytes` 을(를) 강제합니다.
  3. 순서대로 첫 번째로 적격한 모델 항목(프로바이더 또는 CLI)을 실행합니다.
  4. 실패하거나 건너뛰는 경우(크기/타임아웃), 다음 항목을 시도합니다.
  5. 성공 시, `Body` 를 `[Audio]` 블록으로 교체하고 `{{Transcript}}` 을(를) 설정합니다.
- **명령 파싱**: 전사에 성공하면 `CommandBody`/`RawBody` 이 전사 텍스트로 설정되어 슬래시 명령이 계속 동작합니다.
- **상세 로깅**: `--verbose` 에서 전사가 실행되는 시점과 본문을 교체하는 시점을 로깅합니다.

## 자동 감지(기본값)

모델을 **구성하지 않았고** `tools.media.audio.enabled` 이 `false` 로 설정되어 있지 **않으면**,
OpenClaw 는 다음 순서로 자동 감지하며, 처음으로 동작하는 옵션에서 중지합니다:

1. **로컬 CLI** (설치된 경우)
   - `sherpa-onnx-offline` (인코더/디코더/조이너/토큰을 포함한 `SHERPA_ONNX_MODEL_DIR` 필요)
   - `whisper-cli` (`whisper-cpp` 에서 제공; `WHISPER_CPP_MODEL` 또는 번들된 tiny 모델 사용)
   - `whisper` (Python CLI; 모델을 자동으로 다운로드)
2. `read_many_files` 를 사용하는 **Gemini CLI** (`gemini`)
3. **프로바이더 키** (OpenAI → Groq → Deepgram → Google)

자동 감지를 비활성화하려면 `tools.media.audio.enabled: false` 을(를) 설정하십시오.
사용자 정의하려면 `tools.media.audio.models` 을(를) 설정하십시오.
참고: 바이너리 감지는 macOS/Linux/Windows 전반에서 최선의 노력(best-effort)으로 수행됩니다. CLI 가 `PATH` 에 있도록 보장하십시오(`~` 을 확장합니다). 또는 전체 명령 경로가 포함된 명시적 CLI 모델을 설정하십시오.

## 구성 예시

### 프로바이더 + CLI 폴백(OpenAI + Whisper CLI)

```json5
{
  tools: {
    media: {
      audio: {
        enabled: true,
        maxBytes: 20971520,
        models: [
          { provider: "openai", model: "gpt-4o-mini-transcribe" },
          {
            type: "cli",
            command: "whisper",
            args: ["--model", "base", "{{MediaPath}}"],
            timeoutSeconds: 45,
          },
        ],
      },
    },
  },
}
```

### 스코프 게이팅이 있는 프로바이더 전용

```json5
{
  tools: {
    media: {
      audio: {
        enabled: true,
        scope: {
          default: "allow",
          rules: [{ action: "deny", match: { chatType: "group" } }],
        },
        models: [{ provider: "openai", model: "gpt-4o-mini-transcribe" }],
      },
    },
  },
}
```

### 프로바이더 전용(Deepgram)

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

## 참고 사항 및 제한

- 프로바이더 인증은 표준 모델 인증 순서(인증 프로필, 환경 변수, `models.providers.*.apiKey`)를 따릅니다.
- Deepgram 은 `provider: "deepgram"` 이 사용될 때 `DEEPGRAM_API_KEY` 을(를) 가져옵니다.
- Deepgram 설정 자세한 내용: [Deepgram (오디오 전사)](/providers/deepgram).
- 오디오 프로바이더는 `tools.media.audio` 를 통해 `baseUrl`, `headers`, `providerOptions` 을(를) 재정의할 수 있습니다.
- 기본 크기 상한은 20MB(`tools.media.audio.maxBytes`)입니다. 초과 크기의 오디오는 해당 모델에서 건너뛰고 다음 항목을 시도합니다.
- 오디오에 대한 기본 `maxChars` 는 **설정되지 않음**(전체 전사)입니다. 출력 내용을 다듬려면 `tools.media.audio.maxChars` 또는 항목별 `maxChars` 을(를) 설정하십시오.
- OpenAI 자동 기본값은 `gpt-4o-mini-transcribe` 입니다. 더 높은 정확도를 위해 `model: "gpt-4o-transcribe"` 을(를) 설정하십시오.
- `tools.media.audio.attachments` 을(를) 사용해 여러 음성 메모를 처리하십시오(`mode: "all"` + `maxAttachments`).
- 전사 텍스트는 템플릿에서 `{{Transcript}}` 으로 사용할 수 있습니다.
- CLI stdout 은 5MB 로 제한됩니다. CLI 출력은 간결하게 유지하십시오.

## 주의 사항

- 스코프 규칙은 "첫 번째 매치 우선"을 사용합니다. `chatType` 은 `direct`, `group`, 또는 `room` 로 정규화됩니다.
- CLI 가 종료 코드 0 으로 종료하고 일반 텍스트를 출력하는지 확인하십시오. JSON 은 `jq -r .text` 를 통해 가공해야 합니다.
- 답장 큐가 차단되는 것을 피하려면 타임아웃을 합리적으로 유지하십시오(`timeoutSeconds`, 기본값 60초).
