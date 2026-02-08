---
summary: "Skills 설정 스키마와 예제"
read_when:
  - Skills 설정 추가 또는 수정
  - 번들된 허용 목록 또는 설치 동작 조정
title: "Skills 설정"
x-i18n:
  source_path: tools/skills-config.md
  source_hash: e265c93da7856887
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:37:49Z
---

# Skills 설정

모든 Skills 관련 설정은 `~/.openclaw/openclaw.json`의 `skills` 아래에 있습니다.

```json5
{
  skills: {
    allowBundled: ["gemini", "peekaboo"],
    load: {
      extraDirs: ["~/Projects/agent-scripts/skills", "~/Projects/oss/some-skill-pack/skills"],
      watch: true,
      watchDebounceMs: 250,
    },
    install: {
      preferBrew: true,
      nodeManager: "npm", // npm | pnpm | yarn | bun (Gateway runtime still Node; bun not recommended)
    },
    entries: {
      "nano-banana-pro": {
        enabled: true,
        apiKey: "GEMINI_KEY_HERE",
        env: {
          GEMINI_API_KEY: "GEMINI_KEY_HERE",
        },
      },
      peekaboo: { enabled: true },
      sag: { enabled: false },
    },
  },
}
```

## 필드

- `allowBundled`: **번들된** Skills 전용 선택적 허용 목록입니다. 설정 시,
  목록에 있는 번들된 Skills 만 사용 가능합니다(관리형/워크스페이스 Skills 는 영향 없음).
- `load.extraDirs`: 추가로 스캔할 Skill 디렉토리(가장 낮은 우선순위).
- `load.watch`: Skill 폴더를 감시하고 Skills 스냅샷을 새로 고칩니다(기본값: true).
- `load.watchDebounceMs`: Skill 감시자 이벤트에 대한 디바운스 시간(밀리초, 기본값: 250).
- `install.preferBrew`: 사용 가능할 경우 brew 설치 프로그램을 선호합니다(기본값: true).
- `install.nodeManager`: Node 설치 프로그램 선호도(`npm` | `pnpm` | `yarn` | `bun`, 기본값: npm).
  이는 **Skill 설치**에만 영향을 미칩니다. Gateway 런타임은 여전히 Node 여야 합니다
  (WhatsApp/Telegram 에서는 Bun 을 권장하지 않음).
- `entries.<skillKey>`: Skill 별 재정의.

Skill 별 필드:

- `enabled`: `false`를 설정하여 번들되었거나 설치되었더라도 Skill 을 비활성화합니다.
- `env`: 에이전트 실행 시 주입되는 환경 변수(이미 설정되어 있지 않은 경우에만).
- `apiKey`: 기본 환경 변수를 선언하는 Skills 를 위한 선택적 편의 설정.

## 참고 사항

- `entries` 아래의 키는 기본적으로 Skill 이름에 매핑됩니다. Skill 이
  `metadata.openclaw.skillKey`를 정의한 경우 해당 키를 사용합니다.
- 감시자가 활성화된 경우, Skills 변경 사항은 다음 에이전트 턴에서 반영됩니다.

### 샌드박스 처리된 Skills + 환경 변수

세션이 **샌드박스 처리된** 경우, Skill 프로세스는 Docker 내부에서 실행됩니다. 샌드박스는
호스트의 `process.env`를 **상속하지 않습니다**.

다음 중 하나를 사용하십시오:

- `agents.defaults.sandbox.docker.env` (또는 에이전트별 `agents.list[].sandbox.docker.env`)
- 사용자 정의 샌드박스 이미지에 환경 변수를 포함

전역 `env` 및 `skills.entries.<skill>.env/apiKey`는 **호스트** 실행에만 적용됩니다.
