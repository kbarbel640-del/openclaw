---
summary: "에이전트 사용을 위한 카메라 캡처(iOS 노드 + macOS 앱): 사진(jpg) 및 짧은 비디오 클립(mp4)"
read_when:
  - iOS 노드 또는 macOS에서 카메라 캡처를 추가하거나 수정할 때
  - 에이전트가 접근 가능한 MEDIA 임시 파일 워크플로를 확장할 때
title: "카메라 캡처"
x-i18n:
  source_path: nodes/camera.md
  source_hash: b4d5f5ecbab6f705
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:40:56Z
---

# 카메라 캡처(에이전트)

OpenClaw 는 에이전트 워크플로를 위한 **카메라 캡처**를 지원합니다:

- **iOS 노드**(Gateway(게이트웨이)를 통해 페어링): `node.invoke` 를 통해 **사진**(`jpg`) 또는 **짧은 비디오 클립**(`mp4`, 선택적 오디오 포함)을 캡처합니다.
- **Android 노드**(Gateway(게이트웨이)를 통해 페어링): `node.invoke` 를 통해 **사진**(`jpg`) 또는 **짧은 비디오 클립**(`mp4`, 선택적 오디오 포함)을 캡처합니다.
- **macOS 앱**(Gateway(게이트웨이)를 통한 노드): `node.invoke` 를 통해 **사진**(`jpg`) 또는 **짧은 비디오 클립**(`mp4`, 선택적 오디오 포함)을 캡처합니다.

모든 카메라 접근은 **사용자가 제어하는 설정** 뒤에서 게이트됩니다.

## iOS 노드

### 사용자 설정(기본값: 켬)

- iOS 설정 탭 → **카메라** → **카메라 허용**(`camera.enabled`)
  - 기본값: **켬**(키가 없으면 활성화된 것으로 처리합니다).
  - 꺼짐일 때: `camera.*` 명령은 `CAMERA_DISABLED` 를 반환합니다.

### 명령(Gateway(게이트웨이) `node.invoke` 를 통해)

- `camera.list`
  - 응답 페이로드:
    - `devices`: `{ id, name, position, deviceType }` 의 배열

- `camera.snap`
  - 파라미터:
    - `facing`: `front|back` (기본값: `front`)
    - `maxWidth`: number (선택 사항; iOS 노드에서 기본값 `1600`)
    - `quality`: `0..1` (선택 사항; 기본값 `0.9`)
    - `format`: 현재 `jpg`
    - `delayMs`: number (선택 사항; 기본값 `0`)
    - `deviceId`: string (선택 사항; `camera.list` 에서)
  - 응답 페이로드:
    - `format: "jpg"`
    - `base64: "<...>"`
    - `width`, `height`
  - 페이로드 가드: 사진은 base64 페이로드가 5 MB 미만이 되도록 재압축됩니다.

- `camera.clip`
  - 파라미터:
    - `facing`: `front|back` (기본값: `front`)
    - `durationMs`: number (기본값 `3000`, 최대 `60000` 로 클램프됨)
    - `includeAudio`: boolean (기본값 `true`)
    - `format`: 현재 `mp4`
    - `deviceId`: string (선택 사항; `camera.list` 에서)
  - 응답 페이로드:
    - `format: "mp4"`
    - `base64: "<...>"`
    - `durationMs`
    - `hasAudio`

### 포그라운드 요구 사항

`canvas.*` 와 마찬가지로, iOS 노드는 **포그라운드**에서만 `camera.*` 명령을 허용합니다. 백그라운드 호출은 `NODE_BACKGROUND_UNAVAILABLE` 를 반환합니다.

### CLI 헬퍼(임시 파일 + MEDIA)

첨부 파일을 얻는 가장 쉬운 방법은 CLI 헬퍼를 사용하는 것으로, 디코딩된 미디어를 임시 파일에 기록하고 `MEDIA:<path>` 를 출력합니다.

예시:

```bash
openclaw nodes camera snap --node <id>               # default: both front + back (2 MEDIA lines)
openclaw nodes camera snap --node <id> --facing front
openclaw nodes camera clip --node <id> --duration 3000
openclaw nodes camera clip --node <id> --no-audio
```

참고:

- `nodes camera snap` 는 에이전트가 양쪽 뷰를 모두 얻을 수 있도록 기본값이 **양쪽** 페이싱입니다.
- 출력 파일은(사용자 자체 래퍼를 만들지 않는 한) OS 임시 디렉토리 내의 임시 파일입니다.

## Android 노드

### 사용자 설정(기본값: 켬)

- Android 설정 시트 → **카메라** → **카메라 허용**(`camera.enabled`)
  - 기본값: **켬**(키가 없으면 활성화된 것으로 처리합니다).
  - 꺼짐일 때: `camera.*` 명령은 `CAMERA_DISABLED` 를 반환합니다.

### 권한

- Android 는 런타임 권한이 필요합니다:
  - `camera.snap` 및 `camera.clip` 모두에 대해 `CAMERA`.
  - `includeAudio=true` 일 때 `camera.clip` 를 위해 `RECORD_AUDIO`.

권한이 없으면 가능한 경우 앱이 프롬프트를 띄웁니다. 거부되면 `camera.*` 요청은
`*_PERMISSION_REQUIRED` 오류로 실패합니다.

### 포그라운드 요구 사항

`canvas.*` 와 마찬가지로, Android 노드는 **포그라운드**에서만 `camera.*` 명령을 허용합니다. 백그라운드 호출은 `NODE_BACKGROUND_UNAVAILABLE` 를 반환합니다.

### 페이로드 가드

사진은 base64 페이로드가 5 MB 미만이 되도록 재압축됩니다.

## macOS 앱

### 사용자 설정(기본값: 끔)

macOS 컴패니언 앱은 체크박스를 제공합니다:

- **설정 → 일반 → 카메라 허용**(`openclaw.cameraEnabled`)
  - 기본값: **끔**
  - 꺼짐일 때: 카메라 요청은 "사용자에 의해 카메라가 비활성화됨"을 반환합니다.

### CLI 헬퍼(노드 호출)

메인 `openclaw` CLI 를 사용해 macOS 노드에서 카메라 명령을 호출합니다.

예시:

```bash
openclaw nodes camera list --node <id>            # list camera ids
openclaw nodes camera snap --node <id>            # prints MEDIA:<path>
openclaw nodes camera snap --node <id> --max-width 1280
openclaw nodes camera snap --node <id> --delay-ms 2000
openclaw nodes camera snap --node <id> --device-id <id>
openclaw nodes camera clip --node <id> --duration 10s          # prints MEDIA:<path>
openclaw nodes camera clip --node <id> --duration-ms 3000      # prints MEDIA:<path> (legacy flag)
openclaw nodes camera clip --node <id> --device-id <id>
openclaw nodes camera clip --node <id> --no-audio
```

참고:

- `openclaw nodes camera snap` 는 재정의하지 않는 한 기본값이 `maxWidth=1600` 입니다.
- macOS 에서 `camera.snap` 는 워밍업/노출 안정화 이후 캡처 전에 `delayMs`(기본값 2000ms) 동안 대기합니다.
- 사진 페이로드는 base64 가 5 MB 미만이 되도록 재압축됩니다.

## 안전 + 실용적 제한

- 카메라 및 마이크 접근은 일반적인 OS 권한 프롬프트를 트리거합니다(그리고 Info.plist 에 usage string 이 필요합니다).
- 비디오 클립은(현재 `<= 60s`) 노드 페이로드가 과도하게 커지는 것을 방지하기 위해 상한이 있습니다(base64 오버헤드 + 메시지 제한).

## macOS 화면 비디오(OS 레벨)

카메라가 아닌 _화면_ 비디오의 경우 macOS 컴패니언을 사용합니다:

```bash
openclaw nodes screen record --node <id> --duration 10s --fps 15   # prints MEDIA:<path>
```

참고:

- macOS **화면 기록** 권한(TCC)이 필요합니다.
