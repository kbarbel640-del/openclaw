---
summary: "사용량 추적 표면과 자격 증명 요구 사항"
read_when:
  - 프로바이더 사용량/할당량 표면을 연결할 때
  - 사용량 추적 동작 또는 인증 요구 사항을 설명해야 할 때
title: "사용량 추적"
x-i18n:
  source_path: concepts/usage-tracking.md
  source_hash: 6f6ed2a70329b2a6
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:39:34Z
---

# 사용량 추적

## 무엇인가요

- 프로바이더의 사용량/할당량을 해당 사용량 엔드포인트에서 직접 가져옵니다.
- 추정 비용은 없습니다. 프로바이더가 보고한 기간만 사용합니다.

## 표시되는 위치

- 채팅의 `/status`: 세션 토큰 + 예상 비용(API 키만)을 보여주는 이모지 중심 상태 카드. 가능할 경우 **현재 모델 프로바이더**의 프로바이더 사용량이 표시됩니다.
- 채팅의 `/usage off|tokens|full`: 응답별 사용량 푸터(OAuth 는 토큰만 표시).
- 채팅의 `/usage cost`: OpenClaw 세션 로그에서 집계된 로컬 비용 요약.
- CLI: `openclaw status --usage` 는 프로바이더별 전체 세부 내역을 출력합니다.
- CLI: `openclaw channels list` 는 프로바이더 설정과 함께 동일한 사용량 스냅샷을 출력합니다(`--no-usage` 를 사용해 건너뜁니다).
- macOS 메뉴 막대: 컨텍스트 아래의 '사용량' 섹션(가능한 경우에만).

## 프로바이더 + 자격 증명

- **Anthropic (Claude)**: 인증 프로필의 OAuth 토큰.
- **GitHub Copilot**: 인증 프로필의 OAuth 토큰.
- **Gemini CLI**: 인증 프로필의 OAuth 토큰.
- **Antigravity**: 인증 프로필의 OAuth 토큰.
- **OpenAI Codex**: 인증 프로필의 OAuth 토큰(있는 경우 accountId 사용).
- **MiniMax**: API 키(코딩 플랜 키; `MINIMAX_CODE_PLAN_KEY` 또는 `MINIMAX_API_KEY`); 5시간 코딩 플랜 기간을 사용합니다.
- **z.ai**: env/config/인증 저장소를 통한 API 키.

일치하는 OAuth/API 자격 증명이 없으면 사용량은 숨겨집니다.
