---
summary: "브라우저 자동화를 위한 수동 로그인 + X/Twitter 게시"
read_when:
  - 브라우저 자동화를 위해 사이트에 로그인해야 할 때
  - X/Twitter 에 업데이트를 게시하고 싶을 때
title: "브라우저 로그인"
x-i18n:
  source_path: tools/browser-login.md
  source_hash: 8ceea2d5258836e3
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:37:39Z
---

# 브라우저 로그인 + X/Twitter 게시

## 수동 로그인 (권장)

사이트에서 로그인이 필요할 때는 **호스트** 브라우저 프로필(openclaw 브라우저)에서 **직접 로그인**하십시오.

모델에 자격 증명을 **절대 제공하지 마십시오**. 자동화된 로그인은 종종 안티 봇 방어를 트리거하며 계정이 잠길 수 있습니다.

메인 브라우저 문서로 돌아가기: [Browser](/tools/browser).

## 어떤 Chrome 프로필이 사용되나요?

OpenClaw 는 **전용 Chrome 프로필**(`openclaw`, 주황색 톤 UI)을 제어합니다. 이는 일상적으로 사용하는 브라우저 프로필과 분리되어 있습니다.

접근하는 두 가지 간단한 방법은 다음과 같습니다.

1. **에이전트에게 브라우저를 열도록 요청**한 뒤 직접 로그인합니다.
2. **CLI 를 통해 열기**:

```bash
openclaw browser start
openclaw browser open https://x.com
```

여러 프로필이 있는 경우 `--browser-profile <name>` 를 전달하십시오(기본값은 `openclaw` 입니다).

## X/Twitter: 권장 흐름

- **읽기/검색/스레드:** **bird** CLI Skill 을 사용합니다(브라우저 없음, 안정적).
  - Repo: https://github.com/steipete/bird
- **업데이트 게시:** **호스트** 브라우저를 사용합니다(수동 로그인).

## 샌드박스 처리 + 호스트 브라우저 접근

샌드박스 처리된 브라우저 세션은 봇 탐지를 트리거할 **가능성이 더 높습니다**. X/Twitter(및 기타 엄격한 사이트)의 경우 **호스트** 브라우저를 우선 사용하십시오.

에이전트가 샌드박스 처리된 경우 브라우저 도구는 기본적으로 샌드박스를 사용합니다. 호스트 제어를 허용하려면:

```json5
{
  agents: {
    defaults: {
      sandbox: {
        mode: "non-main",
        browser: {
          allowHostControl: true,
        },
      },
    },
  },
}
```

그다음 호스트 브라우저를 대상으로 지정합니다:

```bash
openclaw browser open https://x.com --browser-profile openclaw --target host
```

또는 업데이트를 게시하는 에이전트에 대해 샌드박스 처리를 비활성화하십시오.
