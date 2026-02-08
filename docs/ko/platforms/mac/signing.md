---
summary: "패키징 스크립트로 생성된 macOS 디버그 빌드의 서명 단계"
read_when:
  - mac 디버그 빌드를 빌드하거나 서명할 때
title: "macOS 서명"
x-i18n:
  source_path: platforms/mac/signing.md
  source_hash: 403b92f9a0ecdb7c
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:40:09Z
---

# mac 서명 (디버그 빌드)

이 앱은 보통 [`scripts/package-mac-app.sh`](https://github.com/openclaw/openclaw/blob/main/scripts/package-mac-app.sh)에서 빌드되며, 현재 다음을 수행합니다:

- 안정적인 디버그 번들 식별자를 설정합니다: `ai.openclaw.mac.debug`
- 해당 번들 ID 로 Info.plist 를 작성합니다 (`BUNDLE_ID=...` 로 오버라이드 가능)
- [`scripts/codesign-mac-app.sh`](https://github.com/openclaw/openclaw/blob/main/scripts/codesign-mac-app.sh)를 호출하여 메인 바이너리와 앱 번들을 서명합니다. 이렇게 하면 macOS 가 각 재빌드를 동일한 서명된 번들로 처리하여 TCC 권한(알림, 손쉬운 사용, 화면 기록, 마이크, 음성)을 유지합니다. 안정적인 권한을 위해서는 실제 서명 ID 를 사용하십시오. 애드혹 서명은 옵트인 방식이며 취약합니다([macOS permissions](/platforms/mac/permissions) 참조).
- 기본적으로 `CODESIGN_TIMESTAMP=auto` 를 사용합니다. 이는 Developer ID 서명에 대해 신뢰된 타임스탬프를 활성화합니다. 타임스탬프를 건너뛰려면(오프라인 디버그 빌드) `CODESIGN_TIMESTAMP=off` 를 설정하십시오.
- 빌드 메타데이터를 Info.plist 에 주입합니다: `OpenClawBuildTimestamp` (UTC) 및 `OpenClawGitCommit` (짧은 해시). 이를 통해 About 패널에서 빌드, git, 디버그/릴리스 채널을 표시할 수 있습니다.
- **패키징에는 Node 22+ 가 필요합니다**: 스크립트가 TS 빌드와 Control UI 빌드를 실행합니다.
- 환경 변수에서 `SIGN_IDENTITY` 를 읽습니다. 셸 rc 에 `export SIGN_IDENTITY="Apple Development: Your Name (TEAMID)"` (또는 Developer ID Application 인증서)를 추가하면 항상 해당 인증서로 서명합니다. 애드혹 서명은 `ALLOW_ADHOC_SIGNING=1` 또는 `SIGN_IDENTITY="-"` 를 통한 명시적 옵트인이 필요합니다(권한 테스트에는 권장하지 않음).
- 서명 후 Team ID 감사를 실행하며, 앱 번들 내부의 어떤 Mach-O 라도 다른 Team ID 로 서명되어 있으면 실패합니다. 우회하려면 `SKIP_TEAM_ID_CHECK=1` 를 설정하십시오.

## 사용법

```bash
# from repo root
scripts/package-mac-app.sh               # auto-selects identity; errors if none found
SIGN_IDENTITY="Developer ID Application: Your Name" scripts/package-mac-app.sh   # real cert
ALLOW_ADHOC_SIGNING=1 scripts/package-mac-app.sh    # ad-hoc (permissions will not stick)
SIGN_IDENTITY="-" scripts/package-mac-app.sh        # explicit ad-hoc (same caveat)
DISABLE_LIBRARY_VALIDATION=1 scripts/package-mac-app.sh   # dev-only Sparkle Team ID mismatch workaround
```

### 애드혹 서명 참고

`SIGN_IDENTITY="-"` (애드혹)으로 서명할 때, 스크립트는 **Hardened Runtime** (`--options runtime`)을 자동으로 비활성화합니다. 이는 동일한 Team ID 를 공유하지 않는 임베디드 프레임워크(예: Sparkle)를 앱이 로드하려 할 때 크래시를 방지하기 위해 필요합니다. 애드혹 서명은 TCC 권한의 지속성도 깨뜨립니다. 복구 단계는 [macOS permissions](/platforms/mac/permissions)를 참조하십시오.

## About 용 빌드 메타데이터

`package-mac-app.sh` 는 번들에 다음을 스탬프합니다:

- `OpenClawBuildTimestamp`: 패키징 시점의 ISO8601 UTC
- `OpenClawGitCommit`: 짧은 git 해시(사용할 수 없으면 `unknown`)

About 탭은 이 키들을 읽어 버전, 빌드 날짜, git 커밋, 그리고 디버그 빌드 여부(`#if DEBUG` 를 통해)를 표시합니다. 코드 변경 후에는 패키저를 실행하여 이 값들을 새로 고치십시오.

## 이유

TCC 권한은 번들 식별자 _그리고_ 코드 서명에 연결됩니다. UUID 가 변경되는 미서명 디버그 빌드는 각 재빌드 후 macOS 가 권한 부여를 잊게 만들고 있었습니다. 바이너리를 서명하고(기본값은 애드혹) 고정된 번들 ID/경로(`dist/OpenClaw.app`)를 유지하면 빌드 간 권한 부여가 보존되어 VibeTunnel 접근 방식과 일치합니다.
