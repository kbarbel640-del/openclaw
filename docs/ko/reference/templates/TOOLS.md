---
summary: "TOOLS.md 용 워크스페이스 템플릿"
read_when:
  - "워크스페이스를 수동으로 부트스트랩할 때"
x-i18n:
  source_path: reference/templates/TOOLS.md
  source_hash: 3ed08cd537620749
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:37:26Z
---

# TOOLS.md - 로컬 노트

Skills 는 도구가 _어떻게_ 동작하는지를 정의합니다. 이 파일은 _여러분_ 의 구체적인 사항, 즉 여러분의 설정에만 고유한 내용을 위한 곳입니다.

## 여기에 무엇을 적나요

예를 들면 다음과 같습니다:

- 카메라 이름과 위치
- SSH 호스트와 별칭
- TTS 에서 선호하는 음성
- 스피커 / 방 이름
- 디바이스 별명
- 환경별로 다른 모든 것

## 예시

```markdown
### Cameras

- living-room → Main area, 180° wide angle
- front-door → Entrance, motion-triggered

### SSH

- home-server → 192.168.1.100, user: admin

### TTS

- Preferred voice: "Nova" (warm, slightly British)
- Default speaker: Kitchen HomePod
```

## 왜 분리하나요?

Skills 는 공유됩니다. 여러분의 설정은 여러분의 것입니다. 분리해 두면 노트를 잃지 않고 Skills 를 업데이트할 수 있고, 인프라를 노출하지 않고도 Skills 를 공유할 수 있습니다.

---

업무에 도움이 되는 것은 무엇이든 추가하세요. 이 파일은 여러분만의 치트 시트입니다.
