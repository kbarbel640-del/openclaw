---
summary: "`openclaw pairing` CLI 참조 (페어링 요청 승인/목록 확인)"
read_when:
  - 페어링 모드 다이렉트 메시지를 사용 중이고 발신자를 승인해야 할 때
title: "페어링"
---

# `openclaw pairing`

다이렉트 메시지 페어링 요청 승인 또는 검사 (페어링을 지원하는 채널용).

관련 항목:

- 페어링 흐름: [페어링](/channels/pairing)

## 명령어

```bash
openclaw pairing list telegram
openclaw pairing list --channel telegram --account work
openclaw pairing list telegram --json

openclaw pairing approve telegram <code>
openclaw pairing approve --channel telegram --account work <code> --notify
```

## 참고사항

- 채널 입력: 위치 인수(`pairing list telegram`) 또는 `--channel <channel>`로 전달합니다.
- `pairing list`는 멀티 계정 채널을 위한 `--account <accountId>`를 지원합니다.
- `pairing approve`는 `--account <accountId>` 및 `--notify`를 지원합니다.
- 페어링 지원 채널이 하나만 구성된 경우, `pairing approve <code>`만으로도 허용됩니다.
