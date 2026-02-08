---
summary: "전송, Gateway(게이트웨이), 에이전트 응답에 대한 이미지 및 미디어 처리 규칙"
read_when:
  - 미디어 파이프라인 또는 첨부파일을 수정할 때
title: "이미지 및 미디어 지원"
x-i18n:
  source_path: nodes/images.md
  source_hash: 971aed398ea01078
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:41:02Z
---

# 이미지 및 미디어 지원 — 2025-12-05

WhatsApp 채널은 **Baileys Web** 를 통해 동작합니다. 이 문서는 전송, Gateway(게이트웨이), 에이전트 응답에 대한 현재 미디어 처리 규칙을 정리합니다.

## 목표

- `openclaw message send --media` 를 통해 선택적 캡션과 함께 미디어를 전송합니다.
- 웹 인박스의 자동 응답이 텍스트와 함께 미디어를 포함할 수 있도록 합니다.
- 타입별 한도를 합리적이고 예측 가능하게 유지합니다.

## CLI Surface

- `openclaw message send --media <path-or-url> [--message <caption>]`
  - `--media` 는 선택 사항이며, 미디어만 전송하는 경우 캡션은 비어 있어도 됩니다.
  - `--dry-run` 는 해결된 페이로드를 출력하고, `--json` 는 `{ channel, to, messageId, mediaUrl, caption }` 를 방출합니다.

## WhatsApp Web 채널 동작

- 입력: 로컬 파일 경로 **또는** HTTP(S) URL.
- 흐름: Buffer 로 로드하고, 미디어 종류를 감지한 뒤, 올바른 페이로드를 빌드합니다:
  - **이미지:** JPEG 로 리사이즈 및 재압축(최대 변 2048 px), `agents.defaults.mediaMaxMb` (기본 5 MB) 를 목표로 하며, 6 MB 로 상한 처리합니다.
  - **오디오/음성/비디오:** 16 MB 까지 패스스루; 오디오는 음성 노트로 전송됩니다(`ptt: true`).
  - **문서:** 그 외 모든 항목, 100 MB 까지, 가능한 경우 파일명을 유지합니다.
- WhatsApp GIF 스타일 재생: 모바일 클라이언트가 인라인으로 루프하도록 `gifPlayback: true` (CLI: `--gif-playback`) 와 함께 MP4 를 전송합니다.
- MIME 감지는 매직 바이트를 우선하고, 그다음 헤더, 그다음 파일 확장자를 사용합니다.
- 캡션은 `--message` 또는 `reply.text` 에서 가져오며, 빈 캡션이 허용됩니다.
- 로깅: 비-verbose 는 `↩️`/`✅` 를 표시하며, verbose 는 크기와 소스 경로/URL 을 포함합니다.

## 자동 응답 파이프라인

- `getReplyFromConfig` 는 `{ text?, mediaUrl?, mediaUrls? }` 를 반환합니다.
- 미디어가 존재하면, 웹 발신자는 `openclaw message send` 와 동일한 파이프라인을 사용하여 로컬 경로 또는 URL 을 해결합니다.
- 여러 미디어 항목이 제공되면 순차적으로 전송됩니다.

## 인바운드 미디어를 Commands(Pi) 로 전달

- 인바운드 웹 메시지에 미디어가 포함되면, OpenClaw 는 임시 파일로 다운로드하고 템플릿 변수들을 노출합니다:
  - 인바운드 미디어에 대한 `{{MediaUrl}}` 의사 URL.
  - 커맨드를 실행하기 전에 기록되는 `{{MediaPath}}` 로컬 임시 경로.
- 세션별 Docker 샌드박스가 활성화되면, 인바운드 미디어가 샌드박스 워크스페이스로 복사되고 `MediaPath`/`MediaUrl` 는 `media/inbound/<filename>` 같은 상대 경로로 재작성됩니다.
- 미디어 이해( `tools.media.*` 또는 공유 `tools.media.models` 를 통해 설정된 경우)는 템플릿 처리 전에 실행되며 `Body` 에 `[Image]`, `[Audio]`, `[Video]` 블록을 삽입할 수 있습니다.
  - 오디오는 `{{Transcript}}` 를 설정하고, 슬래시 커맨드가 계속 동작하도록 커맨드 파싱에 트랜스크립트를 사용합니다.
  - 비디오 및 이미지 설명은 커맨드 파싱을 위해 모든 캡션 텍스트를 보존합니다.
- 기본적으로 일치하는 첫 번째 이미지/오디오/비디오 첨부파일만 처리됩니다. 여러 첨부파일을 처리하려면 `tools.media.<cap>.attachments` 를 설정합니다.

## 한도 및 오류

**아웃바운드 전송 상한(WhatsApp web send)**

- 이미지: 재압축 후 약 6 MB 상한.
- 오디오/음성/비디오: 16 MB 상한; 문서: 100 MB 상한.
- 과대 용량 또는 읽을 수 없는 미디어 → 로그에 명확한 오류가 표시되고 응답은 건너뜁니다.

**미디어 이해 상한(전사/설명)**

- 이미지 기본값: 10 MB (`tools.media.image.maxBytes`).
- 오디오 기본값: 20 MB (`tools.media.audio.maxBytes`).
- 비디오 기본값: 50 MB (`tools.media.video.maxBytes`).
- 과대 용량 미디어는 이해를 건너뛰지만, 응답은 원래 본문과 함께 계속 전송됩니다.

## 테스트를 위한 참고 사항

- 이미지/오디오/문서 케이스에 대해 전송 + 응답 플로우를 커버합니다.
- 이미지에 대한 재압축(크기 상한)과 오디오에 대한 음성 노트 플래그를 검증합니다.
- 멀티-미디어 응답이 순차 전송으로 팬아웃되는지 확인합니다.
