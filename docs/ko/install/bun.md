---
summary: "Bun 워크플로(실험적): pnpm 대비 설치 및 주의사항"
read_when:
  - 가장 빠른 로컬 개발 루프(bun + watch)를 원합니다
  - Bun 설치/패치/라이프사이클 스크립트 문제를 겪었습니다
title: "Bun (실험적)"
x-i18n:
  source_path: install/bun.md
  source_hash: eb3f4c222b6bae49
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:39:33Z
---

# Bun (실험적)

목표: pnpm 워크플로와 달라지지 않게 하면서, 이 리포지토리를 **Bun**(선택 사항, WhatsApp/Telegram 에는 권장하지 않음)으로 실행합니다.

⚠️ **Gateway(게이트웨이) 런타임에는 권장하지 않습니다**(WhatsApp/Telegram 버그). 프로덕션에서는 Node 를 사용합니다.

## 상태

- Bun 은 TypeScript 를 직접 실행하기 위한 선택적 로컬 런타임입니다(`bun run …`, `bun --watch …`).
- `pnpm` 은 빌드의 기본값이며 완전히 지원됩니다(그리고 일부 문서 도구에서도 사용됩니다).
- Bun 은 `pnpm-lock.yaml` 을 사용할 수 없으며 이를 무시합니다.

## 설치

기본값:

```sh
bun install
```

참고: `bun.lock`/`bun.lockb` 는 gitignore 처리되어 있으므로, 어느 쪽이든 리포지토리 변경이 발생하지 않습니다. *lockfile 쓰기 없음*을 원한다면:

```sh
bun install --no-save
```

## 빌드 / 테스트(Bun)

```sh
bun run build
bun run vitest run
```

## Bun 라이프사이클 스크립트(기본적으로 차단됨)

Bun 은 명시적으로 신뢰하지 않으면 의존성 라이프사이클 스크립트를 차단할 수 있습니다(`bun pm untrusted` / `bun pm trust`).
이 리포지토리에서는, 흔히 차단되는 스크립트가 필요하지 않습니다:

- `@whiskeysockets/baileys` `preinstall`: Node 메이저 버전 >= 20 을 확인합니다(우리는 Node 22+ 를 실행합니다).
- `protobufjs` `postinstall`: 호환되지 않는 버전 스킴에 대한 경고를 출력합니다(빌드 아티팩트 없음).

이러한 스크립트가 필요한 실제 런타임 문제를 겪는 경우, 명시적으로 신뢰하도록 설정합니다:

```sh
bun pm trust @whiskeysockets/baileys protobufjs
```

## 유의사항

- 일부 스크립트는 여전히 pnpm 을 하드코딩합니다(예: `docs:build`, `ui:*`, `protocol:check`). 현재로서는 pnpm 으로 실행합니다.
