---
summary: "스트리밍 + 청킹 동작(블록 답장, 드래프트 스트리밍, 제한)"
read_when:
  - 채널에서 스트리밍 또는 청킹이 어떻게 동작하는지 설명할 때
  - 블록 스트리밍 또는 채널 청킹 동작을 변경할 때
  - 중복/조기 블록 답장 또는 드래프트 스트리밍을 디버깅할 때
title: "스트리밍 및 청킹"
x-i18n:
  source_path: concepts/streaming.md
  source_hash: f014eb1898c4351b
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:29:24Z
---

# 스트리밍 + 청킹

OpenClaw 에는 서로 분리된 두 가지 "스트리밍" 레이어가 있습니다:

- **블록 스트리밍(채널):** 어시스턴트가 작성하는 동안 완료된 **블록**을 방출합니다. 이는 일반 채널 메시지(토큰 델타가 아님)입니다.
- **토큰 유사 스트리밍(Telegram 전용):** 생성하는 동안 부분 텍스트로 **드래프트 버블**을 업데이트하며, 최종 메시지는 끝에서 전송됩니다.

현재 외부 채널 메시지로의 **실제 토큰 스트리밍**은 없습니다. Telegram 드래프트 스트리밍만이 유일한 부분 스트리밍 표면입니다.

## 블록 스트리밍(채널 메시지)

블록 스트리밍은 어시스턴트 출력이 사용 가능해지는 대로 거친 청크 단위로 전송합니다.

```
Model output
  └─ text_delta/events
       ├─ (blockStreamingBreak=text_end)
       │    └─ chunker emits blocks as buffer grows
       └─ (blockStreamingBreak=message_end)
            └─ chunker flushes at message_end
                   └─ channel send (block replies)
```

범례:

- `text_delta/events`: 모델 스트림 이벤트(스트리밍하지 않는 모델에서는 드물 수 있음).
- `chunker`: 최소/최대 경계 + 줄바꿈 선호를 적용하는 `EmbeddedBlockChunker`.
- `channel send`: 실제 아웃바운드 메시지(블록 답장).

**제어:**

- `agents.defaults.blockStreamingDefault`: `"on"`/`"off"` (기본값 꺼짐).
- 채널 오버라이드: 채널별로 `"on"`/`"off"`을 강제하기 위한 `*.blockStreaming`(및 계정별 변형).
- `agents.defaults.blockStreamingBreak`: `"text_end"` 또는 `"message_end"`.
- `agents.defaults.blockStreamingChunk`: `{ minChars, maxChars, breakPreference? }`.
- `agents.defaults.blockStreamingCoalesce`: `{ minChars?, maxChars?, idleMs? }` (전송 전에 스트리밍된 블록을 병합).
- 채널 하드 캡: `*.textChunkLimit` (예: `channels.whatsapp.textChunkLimit`).
- 채널 청크 모드: `*.chunkMode` (`length` 기본값, `newline`은 길이 청킹 전에 빈 줄(문단 경계)에서 분할).
- Discord 소프트 캡: `channels.discord.maxLinesPerMessage` (기본값 17) UI 클리핑을 피하기 위해 긴 답장을 분할합니다.

**경계 의미론:**

- `text_end`: 청커가 내보내는 즉시 스트림 블록을 전송하며, 각 `text_end`마다 플러시합니다.
- `message_end`: 어시스턴트 메시지가 끝날 때까지 기다린 다음, 버퍼링된 출력을 플러시합니다.

`message_end`도 버퍼링된 텍스트가 `maxChars`를 초과하면 청커를 사용하므로, 마지막에 여러 청크를 방출할 수 있습니다.

## 청킹 알고리즘(하한/상한)

블록 청킹은 `EmbeddedBlockChunker`로 구현됩니다:

- **하한:** 버퍼 >= `minChars`가 될 때까지 방출하지 않습니다(강제되지 않는 한).
- **상한:** `maxChars` 이전에서 분할을 선호하며, 강제될 경우 `maxChars`에서 분할합니다.
- **줄바꿈 선호:** `paragraph` → `newline` → `sentence` → `whitespace` → 강제 줄바꿈.
- **코드 펜스:** 펜스 내부에서는 절대 분할하지 않습니다. `maxChars`에서 강제될 경우 Markdown 유효성을 유지하기 위해 펜스를 닫고 다시 엽니다.

`maxChars`는 채널 `textChunkLimit`로 클램프되므로, 채널별 캡을 초과할 수 없습니다.

## 코얼레싱(스트리밍된 블록 병합)

블록 스트리밍이 활성화되면, OpenClaw 는 전송하기 전에 연속된 블록 청크를 **병합**할 수 있습니다. 이렇게 하면 점진적 출력을 제공하면서도 "한 줄 스팸"을 줄입니다.

- 코얼레싱은 플러시하기 전에 **유휴 간격**(`idleMs`)을 기다립니다.
- 버퍼는 `maxChars`로 상한이 있으며, 이를 초과하면 플러시됩니다.
- `minChars`은 충분한 텍스트가 누적될 때까지 작은 조각이 전송되는 것을 방지합니다
  (최종 플러시는 항상 남은 텍스트를 전송합니다).
- 조이너는 `blockStreamingChunk.breakPreference`에서 파생됩니다
  (`paragraph` → `\n\n`, `newline` → `\n`, `sentence` → 공백).
- 채널 오버라이드는 `*.blockStreamingCoalesce`(계정별 설정 포함)을 통해 사용할 수 있습니다.
- 기본 코얼레싱 `minChars`은 오버라이드되지 않는 한 Signal/Slack/Discord 에 대해 1500 으로 상향됩니다.

## 블록 간 사람처럼 보이는 페이싱

블록 스트리밍이 활성화되면, (첫 블록 이후) 블록 답장 사이에 **무작위화된 일시 정지**를 추가할 수 있습니다. 이는 여러 버블로 나뉜 응답이 더 자연스럽게 느껴지도록 합니다.

- 설정: `agents.defaults.humanDelay` (`agents.list[].humanDelay`을 통해 에이전트별로 오버라이드).
- 모드: `off` (기본값), `natural` (800–2500ms), `custom` (`minMs`/`maxMs`).
- **블록 답장**에만 적용되며, 최종 답장이나 도구 요약에는 적용되지 않습니다.

## "청크를 스트리밍하거나 전부 보내기"

이는 다음에 매핑됩니다:

- **청크 스트리밍:** `blockStreamingDefault: "on"` + `blockStreamingBreak: "text_end"` (진행하면서 방출). Telegram 이 아닌 채널도 `*.blockStreaming: true`이 필요합니다.
- **끝에서 전부 스트리밍:** `blockStreamingBreak: "message_end"` (한 번 플러시하며, 매우 길면 여러 청크가 될 수 있음).
- **블록 스트리밍 없음:** `blockStreamingDefault: "off"` (최종 답장만).

**채널 참고:** Telegram 이 아닌 채널의 경우, `*.blockStreaming`가 명시적으로 `true`로 설정되지 않는 한 블록 스트리밍은 **꺼져 있습니다**. Telegram 은 블록 답장 없이도 드래프트(`channels.telegram.streamMode`)를 스트리밍할 수 있습니다.

설정 위치 참고: `blockStreaming*` 기본값은 루트 설정이 아니라
`agents.defaults` 아래에 있습니다.

## Telegram 드래프트 스트리밍(토큰 유사)

Telegram 은 드래프트 스트리밍을 지원하는 유일한 채널입니다:

- **토픽이 있는 비공개 채팅**에서 Bot API `sendMessageDraft`를 사용합니다.
- `channels.telegram.streamMode: "partial" | "block" | "off"`.
  - `partial`: 최신 스트림 텍스트로 드래프트를 업데이트합니다.
  - `block`: 청크된 블록으로 드래프트를 업데이트합니다(동일한 청커 규칙).
  - `off`: 드래프트 스트리밍 없음.
- 드래프트 청크 설정(`streamMode: "block"` 전용): `channels.telegram.draftChunk` (기본값: `minChars: 200`, `maxChars: 800`).
- 드래프트 스트리밍은 블록 스트리밍과 별개입니다. 블록 답장은 기본적으로 꺼져 있으며, Telegram 이 아닌 채널에서는 `*.blockStreaming: true`로만 활성화됩니다.
- 최종 답장은 여전히 일반 메시지입니다.
- `/reasoning stream`는 추론을 드래프트 버블에 작성합니다(Telegram 전용).

드래프트 스트리밍이 활성화되면, OpenClaw 는 이중 스트리밍을 피하기 위해 해당 답장에 대해 블록 스트리밍을 비활성화합니다.

```
Telegram (private + topics)
  └─ sendMessageDraft (draft bubble)
       ├─ streamMode=partial → update latest text
       └─ streamMode=block   → chunker updates draft
  └─ final reply → normal message
```

범례:

- `sendMessageDraft`: Telegram 드래프트 버블(실제 메시지가 아님).
- `final reply`: 일반 Telegram 메시지 전송.
