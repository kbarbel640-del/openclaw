---
summary: "리팩터링 계획: exec 호스트 라우팅, 노드 승인, 헤드리스 러너"
read_when:
  - exec 호스트 라우팅 또는 exec 승인 설계 시
  - 노드 러너 + UI IPC 구현 시
  - exec 호스트 보안 모드 및 슬래시 명령 추가 시
title: "Exec 호스트 리팩터링"
x-i18n:
  source_path: refactor/exec-host.md
  source_hash: 53a9059cbeb1f3f1
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:37:42Z
---

# Exec 호스트 리팩터링 계획

## 목표

- **sandbox**, **gateway**, **node** 전반에 걸쳐 실행을 라우팅하기 위해 `exec.host` + `exec.security` 추가.
- 기본값을 **안전하게** 유지: 명시적으로 활성화하지 않는 한 호스트 간 실행 없음.
- 실행을 **헤드리스 러너 서비스**로 분리하고, 로컬 IPC 를 통해 선택적 UI (macOS 앱) 제공.
- **에이전트별** 정책, 허용 목록, 질문 모드, 노드 바인딩 제공.
- 허용 목록 _유무와 관계없이_ 동작하는 **질문 모드** 지원.
- 크로스 플랫폼: Unix 소켓 + 토큰 인증 (macOS/Linux/Windows 동일성).

## 비목표

- 레거시 허용 목록 마이그레이션 또는 레거시 스키마 지원 없음.
- 노드 exec 에 대한 PTY/스트리밍 없음 (집계된 출력만).
- 기존 Bridge + Gateway 를 넘어서는 신규 네트워크 레이어 없음.

## 결정 사항 (확정)

- **설정 키:** `exec.host` + `exec.security` (에이전트별 오버라이드 허용).
- **권한 상승:** gateway 전체 접근의 별칭으로 `/elevated` 유지.
- **질문 기본값:** `on-miss`.
- **승인 저장소:** `~/.openclaw/exec-approvals.json` (JSON, 레거시 마이그레이션 없음).
- **러너:** 헤드리스 시스템 서비스; UI 앱이 승인을 위한 Unix 소켓을 호스팅.
- **노드 식별:** 기존 `nodeId` 사용.
- **소켓 인증:** Unix 소켓 + 토큰 (크로스 플랫폼); 필요 시 추후 분리.
- **노드 호스트 상태:** `~/.openclaw/node.json` (노드 id + 페어링 토큰).
- **macOS exec 호스트:** macOS 앱 내부에서 `system.run` 실행; 노드 호스트 서비스가 로컬 IPC 로 요청 전달.
- **XPC 헬퍼 없음:** Unix 소켓 + 토큰 + 피어 검사 유지.

## 핵심 개념

### 호스트

- `sandbox`: Docker exec (현재 동작).
- `gateway`: gateway 호스트에서 exec.
- `node`: Bridge (`system.run`) 를 통한 노드 러너에서 exec.

### 보안 모드

- `deny`: 항상 차단.
- `allowlist`: 일치 항목만 허용.
- `full`: 모두 허용 (권한 상승과 동등).

### 질문 모드

- `off`: 질문하지 않음.
- `on-miss`: 허용 목록이 일치하지 않을 때만 질문.
- `always`: 매번 질문.

질문은 허용 목록과 **독립적**이며, 허용 목록은 `always` 또는 `on-miss` 와 함께 사용할 수 있습니다.

### 정책 해석 (exec 당)

1. `exec.host` 해석 (도구 파라미터 → 에이전트 오버라이드 → 전역 기본값).
2. `exec.security` 및 `exec.ask` 해석 (동일한 우선순위).
3. 호스트가 `sandbox` 인 경우, 로컬 샌드박스 exec 진행.
4. 호스트가 `gateway` 또는 `node` 인 경우, 해당 호스트에서 보안 + 질문 정책 적용.

## 기본 안전성

- 기본값 `exec.host = sandbox`.
- `gateway` 및 `node` 에 대한 기본값 `exec.security = deny`.
- 기본값 `exec.ask = on-miss` (보안이 허용하는 경우에만 관련).
- 노드 바인딩이 설정되지 않은 경우, **에이전트는 어떤 노드든 대상 지정 가능**하지만 정책이 허용해야 합니다.

## 설정 표면

### 도구 파라미터

- `exec.host` (선택): `sandbox | gateway | node`.
- `exec.security` (선택): `deny | allowlist | full`.
- `exec.ask` (선택): `off | on-miss | always`.
- `exec.node` (선택): `host=node` 인 경우 사용할 노드 id/이름.

### 설정 키 (전역)

- `tools.exec.host`
- `tools.exec.security`
- `tools.exec.ask`
- `tools.exec.node` (기본 노드 바인딩)

### 설정 키 (에이전트별)

- `agents.list[].tools.exec.host`
- `agents.list[].tools.exec.security`
- `agents.list[].tools.exec.ask`
- `agents.list[].tools.exec.node`

### 별칭

- `/elevated on` = 에이전트 세션에 대해 `tools.exec.host=gateway`, `tools.exec.security=full` 설정.
- `/elevated off` = 에이전트 세션의 이전 exec 설정 복원.

## 승인 저장소 (JSON)

경로: `~/.openclaw/exec-approvals.json`

목적:

- **실행 호스트** (gateway 또는 노드 러너) 에 대한 로컬 정책 + 허용 목록.
- UI 를 사용할 수 없을 때의 질문 대체 수단.
- UI 클라이언트를 위한 IPC 자격 증명.

제안 스키마 (v1):

```json
{
  "version": 1,
  "socket": {
    "path": "~/.openclaw/exec-approvals.sock",
    "token": "base64-opaque-token"
  },
  "defaults": {
    "security": "deny",
    "ask": "on-miss",
    "askFallback": "deny"
  },
  "agents": {
    "agent-id-1": {
      "security": "allowlist",
      "ask": "on-miss",
      "allowlist": [
        {
          "pattern": "~/Projects/**/bin/rg",
          "lastUsedAt": 0,
          "lastUsedCommand": "rg -n TODO",
          "lastResolvedPath": "/Users/user/Projects/.../bin/rg"
        }
      ]
    }
  }
}
```

비고:

- 레거시 허용 목록 형식 없음.
- `ask` 이 필요한데 UI 에 도달할 수 없는 경우에만 `askFallback` 적용.
- 파일 권한: `0600`.

## 러너 서비스 (헤드리스)

### 역할

- 로컬에서 `exec.security` + `exec.ask` 강제.
- 시스템 명령 실행 및 출력 반환.
- exec 라이프사이클에 대한 Bridge 이벤트 방출 (선택 사항이나 권장).

### 서비스 라이프사이클

- macOS 에서는 launchd/데몬; Linux/Windows 에서는 시스템 서비스.
- 승인 JSON 은 실행 호스트 로컬에 위치.
- UI 는 로컬 Unix 소켓을 호스팅하며, 러너는 필요 시 연결.

## UI 통합 (macOS 앱)

### IPC

- `~/.openclaw/exec-approvals.sock` 위치의 Unix 소켓 (0600).
- `exec-approvals.json` 에 저장된 토큰 (0600).
- 피어 검사: 동일 UID 만 허용.
- 챌린지/응답: 재생 공격 방지를 위해 nonce + HMAC(token, request-hash).
- 짧은 TTL (예: 10초) + 최대 페이로드 + 속도 제한.

### 질문 흐름 (macOS 앱 exec 호스트)

1. 노드 서비스가 gateway 로부터 `system.run` 수신.
2. 노드 서비스가 로컬 소켓에 연결하여 프롬프트/exec 요청 전송.
3. 앱이 피어 + 토큰 + HMAC + TTL 검증 후 필요 시 다이얼로그 표시.
4. 앱이 UI 컨텍스트에서 명령을 실행하고 출력 반환.
5. 노드 서비스가 출력을 gateway 로 반환.

UI 가 없는 경우:

- `askFallback` (`deny|allowlist|full`) 적용.

### 다이어그램 (SCI)

```
Agent -> Gateway -> Bridge -> Node Service (TS)
                         |  IPC (UDS + token + HMAC + TTL)
                         v
                     Mac App (UI + TCC + system.run)
```

## 노드 식별 + 바인딩

- Bridge 페어링의 기존 `nodeId` 사용.
- 바인딩 모델:
  - `tools.exec.node` 는 에이전트를 특정 노드로 제한.
  - 설정되지 않은 경우, 에이전트는 어떤 노드든 선택 가능 (정책은 기본값을 여전히 강제).
- 노드 선택 해석:
  - `nodeId` 정확 일치
  - `displayName` (정규화)
  - `remoteIp`
  - `nodeId` 접두사 (>= 6자)

## 이벤트

### 이벤트 가시성

- 시스템 이벤트는 **세션별**이며 다음 프롬프트에서 에이전트에게 표시됩니다.
- gateway 인메모리 큐 (`enqueueSystemEvent`) 에 저장됩니다.

### 이벤트 텍스트

- `Exec started (node=<id>, id=<runId>)`
- `Exec finished (node=<id>, id=<runId>, code=<code>)` + 선택적 출력 꼬리
- `Exec denied (node=<id>, id=<runId>, <reason>)`

### 전송

옵션 A (권장):

- 러너가 Bridge `event` 프레임 `exec.started` / `exec.finished` 전송.
- gateway 가 이를 `enqueueSystemEvent` 로 매핑.

옵션 B:

- gateway `exec` 도구가 라이프사이클을 직접 처리 (동기식만).

## Exec 흐름

### 샌드박스 호스트

- 기존 `exec` 동작 (Docker 또는 비샌드박스 시 호스트).
- PTY 는 비샌드박스 모드에서만 지원.

### Gateway 호스트

- gateway 프로세스가 자체 머신에서 실행.
- 로컬 `exec-approvals.json` (보안/질문/허용 목록) 강제.

### 노드 호스트

- gateway 가 `system.run` 와 함께 `node.invoke` 호출.
- 러너가 로컬 승인 강제.
- 러너가 집계된 stdout/stderr 반환.
- 시작/종료/거부에 대한 선택적 Bridge 이벤트.

## 출력 제한

- stdout+stderr 합계를 **200k** 로 제한; 이벤트에는 **20k 꼬리** 유지.
- 명확한 접미사로 잘라냄 (예: `"… (truncated)"`).

## 슬래시 명령

- `/exec host=<sandbox|gateway|node> security=<deny|allowlist|full> ask=<off|on-miss|always> node=<id>`
- 에이전트별, 세션별 오버라이드; 설정으로 저장하지 않는 한 비영구적.
- `/elevated on|off|ask|full` 는 `full` 로 승인을 건너뛰는 `host=gateway security=full` 의 단축키로 유지.

## 크로스 플랫폼 스토리

- 러너 서비스가 이식 가능한 실행 대상입니다.
- UI 는 선택 사항이며, 없는 경우 `askFallback` 적용.
- Windows/Linux 는 동일한 승인 JSON + 소켓 프로토콜을 지원.

## 구현 단계

### 1단계: 설정 + exec 라우팅

- `exec.host`, `exec.security`, `exec.ask`, `exec.node` 에 대한 설정 스키마 추가.
- `exec.host` 를 존중하도록 도구 플러밍 업데이트.
- `/exec` 슬래시 명령 추가 및 `/elevated` 별칭 유지.

### 2단계: 승인 저장소 + gateway 강제

- `exec-approvals.json` 리더/라이터 구현.
- `gateway` 호스트에 대해 허용 목록 + 질문 모드 강제.
- 출력 제한 추가.

### 3단계: 노드 러너 강제

- 노드 러너가 허용 목록 + 질문을 강제하도록 업데이트.
- macOS 앱 UI 로의 Unix 소켓 프롬프트 브리지 추가.
- `askFallback` 연결.

### 4단계: 이벤트

- exec 라이프사이클에 대한 노드 → gateway Bridge 이벤트 추가.
- 에이전트 프롬프트용 `enqueueSystemEvent` 로 매핑.

### 5단계: UI 마감

- Mac 앱: 허용 목록 편집기, 에이전트별 전환기, 질문 정책 UI.
- 노드 바인딩 컨트롤 (선택).

## 테스트 계획

- 유닛 테스트: 허용 목록 매칭 (glob + 대소문자 무시).
- 유닛 테스트: 정책 해석 우선순위 (도구 파라미터 → 에이전트 오버라이드 → 전역).
- 통합 테스트: 노드 러너 거부/허용/질문 흐름.
- Bridge 이벤트 테스트: 노드 이벤트 → 시스템 이벤트 라우팅.

## 공개 위험

- UI 사용 불가: `askFallback` 이 준수되는지 확인.
- 장시간 실행 명령: 타임아웃 + 출력 제한에 의존.
- 다중 노드 모호성: 노드 바인딩 또는 명시적 노드 파라미터가 없으면 오류.

## 관련 문서

- [Exec 도구](/tools/exec)
- [Exec 승인](/tools/exec-approvals)
- [노드](/nodes)
- [권한 상승 모드](/tools/elevated)
