---
read_when:
    - 처음부터 설정을 시작할 때
    - 가장 빠르게 채팅을 시작하고 싶을 때
summary: OpenClaw를 설치하고 몇 분 안에 첫 채팅을 시작하세요.
title: 시작하기
x-i18n:
    generated_at: "2026-02-08T16:05:01Z"
    model: gtx
    provider: google-translate
    source_hash: 6eeb4d38a70f2ad9f20977ff24191a3e2417b73c989fb6074aceddcff0e633d4
    source_path: start/getting-started.md
    workflow: 15
---

# 시작하기

목표: 최소한의 설정으로 첫 번째 정상 동작 채팅까지 빠르게 연결합니다.

<Info>
가장 빠른 시작 방법은 Control UI를 여는 것입니다(채널 설정 없이 가능). `openclaw dashboard`를 실행하고,
브라우저에서 채팅하거나 `http://127.0.0.1:18789/`을
<Tooltip headline="Gateway host" tip="OpenClaw gateway 서비스가 실행되는 머신">게이트웨이 호스트</Tooltip>에서 엽니다.
관련 문서: [Dashboard](/web/dashboard), [Control UI](/web/control-ui).
</Info>

## 사전 요구 사항

- Node 22 이상

<Tip>
버전이 헷갈리면 `node --version`으로 확인하세요.
</Tip>

## 빠른 설정 CLI

<Steps>
  <Step title="OpenClaw 설치 (권장)">
    <Tabs>
      <Tab title="macOS/Linux">
        ```bash
        curl -fsSL https://openclaw.ai/install.sh | bash
        ```
      </Tab>
      <Tab title="Windows (PowerShell)">
        ```powershell
        iwr -useb https://openclaw.ai/install.ps1 | iex
        ```
      </Tab>
    </Tabs>

    <Note>
    다른 설치 방법과 요구 사항은 [Install](/install)에서 확인하세요.
    </Note>

  </Step>
  <Step title="온보딩 마법사 실행">
    ```bash
    openclaw onboard --install-daemon
    ```

    마법사는 인증, Gateway 설정, 선택 채널 구성을 자동으로 진행합니다.
    자세한 내용은 [Onboarding Wizard](/start/wizard)를 참고하세요.

  </Step>
  <Step title="Gateway 상태 확인">
    서비스를 설치했다면 이미 실행 중이어야 합니다.

    ```bash
    openclaw gateway status
    ```

  </Step>
  <Step title="Control UI 열기">
    ```bash
    openclaw dashboard
    ```
  </Step>
</Steps>

<Check>
Control UI가 정상 로드되면 Gateway를 바로 사용할 수 있습니다.
</Check>

## 선택 점검 및 추가 작업

<AccordionGroup>
  <Accordion title="포그라운드에서 Gateway 실행">
    빠른 테스트나 문제 해결 시 유용합니다.

    ```bash
    openclaw gateway --port 18789
    ```

  </Accordion>
  <Accordion title="테스트 메시지 전송">
    채널이 미리 구성되어 있어야 합니다.

    ```bash
    openclaw message send --target +15555550123 --message "Hello from OpenClaw"
    ```

  </Accordion>
</AccordionGroup>

## 더 깊게 보기

<Columns>
  <Card title="Onboarding Wizard 상세" href="/start/wizard">
    CLI 마법사의 전체 참조와 고급 옵션을 확인하세요.
  </Card>
  <Card title="macOS 앱 온보딩" href="/start/onboarding">
    macOS 앱 첫 실행 흐름을 안내합니다.
  </Card>
</Columns>

## 완료 상태

- Gateway 실행 중
- 인증 구성 완료
- Control UI 접근 가능 또는 채널 연결 완료

## 다음 단계

- DM 안전/승인 설정: [Pairing](/channels/pairing)
- 채널 추가 연결: [Channels](/channels)
- 고급 워크플로와 소스 기반 설정: [Setup](/start/setup)
