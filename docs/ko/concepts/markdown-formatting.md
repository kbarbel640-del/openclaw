---
summary: "아웃바운드 채널을 위한 Markdown 서식 파이프라인"
read_when:
  - 아웃바운드 채널의 Markdown 서식 또는 청킹을 변경할 때
  - 새로운 채널 포매터 또는 스타일 매핑을 추가할 때
  - 채널 전반의 서식 회귀를 디버깅할 때
title: "Markdown 서식"
x-i18n:
  source_path: concepts/markdown-formatting.md
  source_hash: f9cbf9b744f9a218
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:39:39Z
---

# Markdown 서식

OpenClaw 는 아웃바운드 Markdown 을 채널별 출력으로 렌더링하기 전에, 이를 공유 중간 표현(IR)으로 변환하여 서식을 적용합니다. IR 은 소스 텍스트를 그대로 유지하면서 스타일/링크 스팬을 함께 보유하므로, 청킹과 렌더링을 채널 전반에서 일관되게 유지할 수 있습니다.

## 목표

- **일관성:** 한 번의 파싱 단계로 여러 렌더러를 지원합니다.
- **안전한 청킹:** 렌더링 전에 텍스트를 분할하여 인라인 서식이 청크 경계를 넘어 깨지지 않도록 합니다.
- **채널 적합성:** 동일한 IR 을 Slack mrkdwn, Telegram HTML, Signal 스타일 범위로 재파싱 없이 매핑합니다.

## 파이프라인

1. **Markdown 파싱 -> IR**
   - IR 은 일반 텍스트와 스타일 스팬(굵게/기울임/취소선/코드/스포일러), 링크 스팬으로 구성됩니다.
   - 오프셋은 UTF-16 코드 유닛을 사용하여 Signal 스타일 범위가 해당 API 와 정렬되도록 합니다.
   - 테이블은 채널이 테이블 변환을 선택한 경우에만 파싱됩니다.
2. **IR 청킹(서식 우선)**
   - 청킹은 렌더링 전에 IR 텍스트에서 수행됩니다.
   - 인라인 서식은 청크 사이에서 분할되지 않으며, 스팬은 청크별로 슬라이스됩니다.
3. **채널별 렌더링**
   - **Slack:** mrkdwn 토큰(굵게/기울임/취소선/코드), 링크는 `<url|label>`.
   - **Telegram:** HTML 태그(`<b>`, `<i>`, `<s>`, `<code>`, `<pre><code>`, `<a href>`).
   - **Signal:** 일반 텍스트 + `text-style` 범위; 레이블이 다를 경우 링크는 `label (url)` 로 변환됩니다.

## IR 예시

입력 Markdown:

```markdown
Hello **world** — see [docs](https://docs.openclaw.ai).
```

IR(개략도):

```json
{
  "text": "Hello world — see docs.",
  "styles": [{ "start": 6, "end": 11, "style": "bold" }],
  "links": [{ "start": 19, "end": 23, "href": "https://docs.openclaw.ai" }]
}
```

## 사용 위치

- Slack, Telegram, Signal 아웃바운드 어댑터는 IR 에서 렌더링합니다.
- 기타 채널(WhatsApp, iMessage, MS Teams, Discord)은 여전히 일반 텍스트 또는 자체 서식 규칙을 사용하며, 활성화된 경우 Markdown 테이블 변환을 청킹 전에 적용합니다.

## 테이블 처리

Markdown 테이블은 채팅 클라이언트 전반에서 일관되게 지원되지 않습니다. 채널(및 계정)별 변환을 제어하려면 `markdown.tables` 를 사용하십시오.

- `code`: 테이블을 코드 블록으로 렌더링(대부분 채널의 기본값).
- `bullets`: 각 행을 글머리 기호 목록으로 변환(Signal + WhatsApp 기본값).
- `off`: 테이블 파싱과 변환을 비활성화하고, 원시 테이블 텍스트를 그대로 전달합니다.

설정 키:

```yaml
channels:
  discord:
    markdown:
      tables: code
    accounts:
      work:
        markdown:
          tables: off
```

## 청킹 규칙

- 청크 제한은 채널 어댑터/설정에서 가져오며 IR 텍스트에 적용됩니다.
- 코드 펜스는 후행 개행을 포함한 단일 블록으로 보존되어 채널에서 올바르게 렌더링됩니다.
- 목록 접두사와 인용 접두사는 IR 텍스트의 일부이므로, 청킹이 접두사 중간을 분할하지 않습니다.
- 인라인 스타일(굵게/기울임/취소선/인라인 코드/스포일러)은 청크 사이에서 절대 분할되지 않으며, 렌더러는 각 청크 내부에서 스타일을 다시 엽니다.

채널 전반의 청킹 동작에 대한 자세한 내용은
[Streaming + chunking](/concepts/streaming)을 참조하십시오.

## 링크 정책

- **Slack:** `[label](url)` -> `<url|label>`; 베어 URL 은 그대로 유지됩니다. 이중 링크를 방지하기 위해 파싱 중 자동 링크는 비활성화됩니다.
- **Telegram:** `[label](url)` -> `<a href="url">label</a>`(HTML 파싱 모드).
- **Signal:** 레이블이 URL 과 일치하지 않는 경우 `[label](url)` -> `label (url)` 로 변환됩니다.

## 스포일러

스포일러 마커(`||spoiler||`)는 Signal 에서만 파싱되며, SPOILER 스타일 범위로 매핑됩니다. 다른 채널에서는 일반 텍스트로 처리됩니다.

## 채널 포매터 추가 또는 업데이트 방법

1. **한 번만 파싱:** 채널에 적합한 옵션(자동 링크, 제목 스타일, 인용 접두사)으로 공유 `markdownToIR(...)` 헬퍼를 사용하십시오.
2. **렌더링:** `renderMarkdownWithMarkers(...)` 와 스타일 마커 맵(또는 Signal 스타일 범위)을 사용하여 렌더러를 구현하십시오.
3. **청킹:** 렌더링 전에 `chunkMarkdownIR(...)` 를 호출하고 각 청크를 렌더링하십시오.
4. **어댑터 연결:** 새 청커와 렌더러를 사용하도록 채널 아웃바운드 어댑터를 업데이트하십시오.
5. **테스트:** 채널에서 청킹을 사용하는 경우 서식 테스트와 아웃바운드 전달 테스트를 추가 또는 업데이트하십시오.

## 흔한 함정

- Slack 꺾쇠 토큰(`<@U123>`, `<#C123>`, `<https://...>`)은 반드시 보존해야 합니다. 원시 HTML 은 안전하게 이스케이프하십시오.
- Telegram HTML 은 태그 외부의 텍스트를 이스케이프해야 마크업이 깨지지 않습니다.
- Signal 스타일 범위는 UTF-16 오프셋에 의존합니다. 코드 포인트 오프셋을 사용하지 마십시오.
- 펜스 코드 블록의 후행 개행을 보존하여 닫는 마커가 자체 줄에 위치하도록 하십시오.
