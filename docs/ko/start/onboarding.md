---
summary: "OpenClaw (macOS 앱)의 최초 실행 온보딩 흐름"
read_when:
  - macOS 온보딩 어시스턴트 설계
  - 인증 또는 아이덴티티 설정 구현
title: "온보딩 (macOS 앱)"
sidebarTitle: "Onboarding: macOS App"
x-i18n:
  source_path: start/onboarding.md
  source_hash: 45f912067527158f
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:37:36Z
---

# 온보딩 (macOS 앱)

이 문서는 **현재**의 최초 실행 온보딩 흐름을 설명합니다. 목표는 매끄러운 'day 0' 경험입니다. 즉, Gateway(게이트웨이)가 실행될 위치를 선택하고, 인증을 연결하며, 마법사를 실행한 뒤, 에이전트가 스스로 부트스트랩하도록 하는 것입니다.

<Steps>
<Step title="macOS 경고 승인">
<Frame>
<img src="/assets/macos-onboarding/01-macos-warning.jpeg" alt="" />
</Frame>
</Step>
<Step title="로컬 네트워크 찾기 승인">
<Frame>
<img src="/assets/macos-onboarding/02-local-networks.jpeg" alt="" />
</Frame>
</Step>
<Step title="환영 및 보안 안내">
<Frame caption="표시된 보안 안내를 읽고 그에 따라 결정합니다">
<img src="/assets/macos-onboarding/03-security-notice.png" alt="" />
</Frame>
</Step>
<Step title="로컬 vs 원격">
<Frame>
<img src="/assets/macos-onboarding/04-choose-gateway.png" alt="" />
</Frame>

**Gateway(게이트웨이)** 는 어디에서 실행되나요?

- **이 Mac (로컬 전용):** 온보딩에서 OAuth 흐름을 실행하고 자격 증명을
  로컬에 기록할 수 있습니다.
- **원격 (SSH/Tailnet 통해):** 온보딩이 로컬에서 OAuth를 실행하지 않습니다;
  자격 증명은 게이트웨이 호스트에 존재해야 합니다.
- **나중에 구성:** 설정을 건너뛰고 앱을 미구성 상태로 둡니다.

<Tip>
**Gateway(게이트웨이) 인증 팁:**
- 마법사는 이제 loopback 에 대해서도 **토큰**을 생성하므로, 로컬 WS 클라이언트는 인증이 필요합니다.
- 인증을 비활성화하면 어떤 로컬 프로세스든 연결할 수 있으므로, 완전히 신뢰된 머신에서만 사용하십시오.
- 다중 머신 접근 또는 non‑loopback 바인드에는 **토큰**을 사용하십시오.
</Tip>
</Step>
<Step title="권한">
<Frame caption="OpenClaw 에 부여할 권한을 선택합니다">
<img src="/assets/macos-onboarding/05-permissions.png" alt="" />
</Frame>

온보딩은 다음에 필요한 TCC 권한을 요청합니다:

- 자동화 (AppleScript)
- 알림
- 접근성
- 화면 기록
- 마이크
- 음성 인식
- 카메라
- 위치

</Step>
<Step title="CLI">
  <Info>이 단계는 선택 사항입니다</Info>
  앱은 전역 `openclaw` CLI 를 npm/pnpm 을 통해 설치할 수 있으며, 터미널
  워크플로와 launchd 작업이 즉시 동작하도록 합니다.
</Step>
<Step title="온보딩 채팅 (전용 세션)">
  설정이 완료되면, 앱은 전용 온보딩 채팅 세션을 열어 에이전트가 자신을
  소개하고 다음 단계를 안내할 수 있도록 합니다. 이는 최초 실행 안내를
  일반 대화와 분리합니다. 첫 번째 에이전트 실행 중 게이트웨이 호스트에서
  어떤 일이 발생하는지는 [Bootstrapping](/start/bootstrapping)을 참고하십시오.
</Step>
</Steps>
