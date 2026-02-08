---
summary: "Gateway(게이트웨이) HTTP 엔드포인트를 통해 단일 도구를 직접 호출합니다"
read_when:
  - 전체 에이전트 턴을 실행하지 않고 도구를 호출할 때
  - 도구 정책 강제 적용이 필요한 자동화를 구축할 때
title: "도구 호출 API"
x-i18n:
  source_path: gateway/tools-invoke-http-api.md
  source_hash: 17ccfbe0b0d9bb61
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:39:05Z
---

# 도구 호출 (HTTP)

OpenClaw의 Gateway(게이트웨이)는 단일 도구를 직접 호출하기 위한 간단한 HTTP 엔드포인트를 노출합니다. 항상 활성화되어 있지만, Gateway(게이트웨이) 인증과 도구 정책에 의해 제한됩니다.

- `POST /tools/invoke`
- Gateway(게이트웨이)와 동일한 포트(WS + HTTP 멀티플렉스): `http://<gateway-host>:<port>/tools/invoke`

기본 최대 페이로드 크기는 2 MB입니다.

## 인증

Gateway(게이트웨이) 인증 구성을 사용합니다. bearer 토큰을 전송합니다:

- `Authorization: Bearer <token>`

참고:

- `gateway.auth.mode="token"`인 경우, `gateway.auth.token`(또는 `OPENCLAW_GATEWAY_TOKEN`)를 사용합니다.
- `gateway.auth.mode="password"`인 경우, `gateway.auth.password`(또는 `OPENCLAW_GATEWAY_PASSWORD`)를 사용합니다.

## 요청 본문

```json
{
  "tool": "sessions_list",
  "action": "json",
  "args": {},
  "sessionKey": "main",
  "dryRun": false
}
```

필드:

- `tool` (string, 필수): 호출할 도구 이름입니다.
- `action` (string, 선택): 도구 스키마가 `action`를 지원하고 args 페이로드에서 이를 생략한 경우 args에 매핑됩니다.
- `args` (object, 선택): 도구별 인수입니다.
- `sessionKey` (string, 선택): 대상 세션 키입니다. 생략되었거나 `"main"`인 경우, Gateway(게이트웨이)는 구성된 메인 세션 키를 사용합니다(`session.mainKey` 및 기본 에이전트를 준수하거나, 전역 범위에서는 `global`).
- `dryRun` (boolean, 선택): 향후 사용을 위해 예약됨; 현재는 무시됩니다.

## 정책 + 라우팅 동작

도구 사용 가능 여부는 Gateway(게이트웨이) 에이전트가 사용하는 동일한 정책 체인을 통해 필터링됩니다:

- `tools.profile` / `tools.byProvider.profile`
- `tools.allow` / `tools.byProvider.allow`
- `agents.<id>.tools.allow` / `agents.<id>.tools.byProvider.allow`
- 그룹 정책(세션 키가 그룹 또는 채널에 매핑되는 경우)
- 서브에이전트 정책(서브에이전트 세션 키로 호출하는 경우)

정책에 의해 도구가 허용되지 않으면, 엔드포인트는 **404**를 반환합니다.

그룹 정책이 컨텍스트를 해석하는 데 도움이 되도록, 선택적으로 다음을 설정할 수 있습니다:

- `x-openclaw-message-channel: <channel>` (예: `slack`, `telegram`)
- `x-openclaw-account-id: <accountId>` (여러 계정이 존재하는 경우)

## 응답

- `200` → `{ ok: true, result }`
- `400` → `{ ok: false, error: { type, message } }` (잘못된 요청 또는 도구 오류)
- `401` → 권한 없음
- `404` → 도구를 사용할 수 없음(찾을 수 없거나 allowlist에 없음)
- `405` → 허용되지 않는 메서드

## 예시

```bash
curl -sS http://127.0.0.1:18789/tools/invoke \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "tool": "sessions_list",
    "action": "json",
    "args": {}
  }'
```
