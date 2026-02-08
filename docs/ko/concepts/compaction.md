---
summary: "컨텍스트 윈도우 + 컴팩션: OpenClaw 가 모델 제한 내에서 세션을 유지하는 방법"
read_when:
  - 자동 컴팩션과 /compact 를 이해하고 싶을 때
  - 컨텍스트 제한에 도달하는 긴 세션을 디버깅할 때
title: "컴팩션"
x-i18n:
  source_path: concepts/compaction.md
  source_hash: e1d6791f2902044b
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:35:43Z
---

# 컨텍스트 윈도우 & 컴팩션

모든 모델에는 **컨텍스트 윈도우**(볼 수 있는 최대 토큰 수)가 있습니다. 장시간 실행되는 채팅은 메시지와 도구 결과가 누적되며, 윈도우가 빡빡해지면 OpenClaw 는 제한을 유지하기 위해 이전 기록을 **컴팩션**합니다.

## 컴팩션이란

컴팩션은 **이전 대화를 요약**하여 간결한 요약 항목으로 만들고, 최근 메시지는 그대로 유지합니다. 요약은 세션 기록에 저장되므로, 이후 요청에서는 다음을 사용합니다.

- 컴팩션 요약
- 컴팩션 지점 이후의 최근 메시지

컴팩션은 세션의 JSONL 기록에 **영구적으로** 저장됩니다.

## 구성

`agents.defaults.compaction` 설정에 대해서는 [Compaction config & modes](/concepts/compaction)를 참조하세요.

## 자동 컴팩션 (기본값 켜짐)

세션이 모델의 컨텍스트 윈도우에 근접하거나 초과하면, OpenClaw 는 자동 컴팩션을 트리거하고 컴팩션된 컨텍스트를 사용해 원래 요청을 재시도할 수 있습니다.

다음이 표시됩니다.

- 상세 모드에서 `🧹 Auto-compaction complete`
- `🧹 Compactions: <count>`를 보여주는 `/status`

컴팩션 전에, OpenClaw 는 내구성 있는 노트를 디스크에 저장하기 위해 **무음 메모리 플러시** 턴을 실행할 수 있습니다. 자세한 내용과 설정은 [Memory](/concepts/memory)를 참조하세요.

## 수동 컴팩션

`/compact` (선택적으로 지침과 함께)를 사용하여 컴팩션 패스를 강제로 실행합니다.

```
/compact Focus on decisions and open questions
```

## 컨텍스트 윈도우 출처

컨텍스트 윈도우는 모델별로 다릅니다. OpenClaw 는 구성된 프로바이더 카탈로그의 모델 정의를 사용해 제한을 결정합니다.

## 컴팩션 vs 프루닝

- **컴팩션**: 요약을 생성하고 JSONL 에 **영구 저장**합니다.
- **세션 프루닝**: 요청 단위로 **메모리 내에서** 오래된 **도구 결과만** 잘라냅니다.

프루닝에 대한 자세한 내용은 [/concepts/session-pruning](/concepts/session-pruning)을 참조하세요.

## 팁

- 세션이 오래되어 느껴지거나 컨텍스트가 비대해졌다면 `/compact`을 사용하세요.
- 큰 도구 출력은 이미 잘려 있으며, 프루닝으로 도구 결과 누적을 더 줄일 수 있습니다.
- 새로 시작해야 한다면, `/new` 또는 `/reset`로 새 세션 id 를 시작하세요.
