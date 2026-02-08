---
summary: "macOS Skills 설정 UI 및 게이트웨이 기반 상태"
read_when:
  - macOS Skills 설정 UI 를 업데이트할 때
  - Skills 게이팅 또는 설치 동작을 변경할 때
title: "Skills"
x-i18n:
  source_path: platforms/mac/skills.md
  source_hash: ecd5286bbe49eed8
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:40:02Z
---

# Skills (macOS)

macOS 앱은 Gateway(게이트웨이)를 통해 OpenClaw Skills 를 노출하며, Skills 를 로컬에서 파싱하지 않습니다.

## 데이터 소스

- `skills.status` (게이트웨이)는 모든 Skills 와 자격 요건 및 누락된 요구 사항을 반환합니다
  (번들된 Skills 에 대한 허용 목록 차단 포함).
- 요구 사항은 각 `SKILL.md` 의 `metadata.openclaw.requires` 에서 파생됩니다.

## 설치 작업

- `metadata.openclaw.install` 는 설치 옵션(brew/node/go/uv)을 정의합니다.
- 앱은 `skills.install` 를 호출하여 게이트웨이 호스트에서 설치 프로그램을 실행합니다.
- 여러 설치 프로그램이 제공되는 경우, 게이트웨이는 선호 설치 프로그램 하나만 노출합니다
  (사용 가능하면 brew, 그렇지 않으면 `skills.install` 의 node manager, 기본값은 npm).

## Env/API 키

- 앱은 `skills.entries.<skillKey>` 아래의 `~/.openclaw/openclaw.json` 에 키를 저장합니다.
- `skills.update` 는 `enabled`, `apiKey`, 및 `env` 을 패치합니다.

## 원격 모드

- 설치 및 설정 업데이트는 로컬 Mac 이 아니라 게이트웨이 호스트에서 수행됩니다.
