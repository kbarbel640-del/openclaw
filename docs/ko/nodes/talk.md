---
summary: "Talk 모드: ElevenLabs TTS 를 사용한 연속 음성 대화"
read_when:
  - macOS/iOS/Android 에서 Talk 모드 구현
  - 음성/TTS/인터럽트 동작 변경
title: "Talk 모드"
x-i18n:
  source_path: nodes/talk.md
  source_hash: ecbc3701c9e95029
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:39:55Z
---

# Talk 모드

Talk 모드는 연속적인 음성 대화 루프입니다:

1. 음성 듣기
2. 전사 텍스트를 모델로 전송 (메인 세션, chat.send)
3. 응답 대기
4. ElevenLabs 를 통해 말하기 (스트리밍 재생)

## 동작 (macOS)

- Talk 모드가 활성화되어 있는 동안 **항상 표시되는 오버레이**.
- **Listening → Thinking → Speaking** 단계 전환.
- **짧은 일시 정지** (무음 창) 시 현재 전사 내용이 전송됩니다.
- 응답은 **WebChat 에 작성**됩니다 (타이핑과 동일).
- **음성 시 인터럽트** (기본값 켜짐): 어시스턴트가 말하는 동안 사용자가 말하기를 시작하면 재생을 중지하고 다음 프롬프트를 위해 인터럽트 타임스탬프를 기록합니다.

## 응답의 음성 지시자

어시스턴트는 음성을 제어하기 위해 **단일 JSON 라인**을 응답 앞에 붙일 수 있습니다:

```json
{ "voice": "<voice-id>", "once": true }
```

규칙:

- 첫 번째 비어 있지 않은 줄만 허용됩니다.
- 알 수 없는 키는 무시됩니다.
- `once: true` 는 현재 응답에만 적용됩니다.
- `once` 가 없으면 해당 음성이 Talk 모드의 새로운 기본값이 됩니다.
- JSON 라인은 TTS 재생 전에 제거됩니다.

지원되는 키:

- `voice` / `voice_id` / `voiceId`
- `model` / `model_id` / `modelId`
- `speed`, `rate` (WPM), `stability`, `similarity`, `style`, `speakerBoost`
- `seed`, `normalize`, `lang`, `output_format`, `latency_tier`
- `once`

## 설정 (`~/.openclaw/openclaw.json`)

```json5
{
  talk: {
    voiceId: "elevenlabs_voice_id",
    modelId: "eleven_v3",
    outputFormat: "mp3_44100_128",
    apiKey: "elevenlabs_api_key",
    interruptOnSpeech: true,
  },
}
```

기본값:

- `interruptOnSpeech`: true
- `voiceId`: `ELEVENLABS_VOICE_ID` / `SAG_VOICE_ID` 로 폴백 (API 키가 있을 때는 첫 번째 ElevenLabs 음성)
- `modelId`: 설정되지 않은 경우 `eleven_v3` 로 기본 설정
- `apiKey`: `ELEVENLABS_API_KEY` 로 폴백 (가능한 경우 게이트웨이 셸 프로필)
- `outputFormat`: macOS/iOS 에서는 `pcm_44100`, Android 에서는 `pcm_24000` 가 기본값입니다 (MP3 스트리밍을 강제하려면 `mp3_*` 를 설정)

## macOS UI

- 메뉴 막대 토글: **Talk**
- 설정 탭: **Talk 모드** 그룹 (음성 ID + 인터럽트 토글)
- 오버레이:
  - **Listening**: 마이크 레벨에 따라 구름이 맥동
  - **Thinking**: 가라앉는 애니메이션
  - **Speaking**: 방사형 링
  - 구름 클릭: 말하기 중지
  - X 클릭: Talk 모드 종료

## 참고

- 음성 + 마이크 권한이 필요합니다.
- 세션 키 `main` 에 대해 `chat.send` 를 사용합니다.
- TTS 는 지연 시간을 줄이기 위해 macOS/iOS/Android 에서 `ELEVENLABS_API_KEY` 및 점진적 재생을 사용하는 ElevenLabs 스트리밍 API 를 사용합니다.
- `eleven_v3` 용 `stability` 는 `0.0`, `0.5`, 또는 `1.0` 로 검증되며, 다른 모델은 `0..1` 를 허용합니다.
- `latency_tier` 는 설정 시 `0..4` 로 검증됩니다.
- Android 는 저지연 AudioTrack 스트리밍을 위해 `pcm_16000`, `pcm_22050`, `pcm_24000`, 및 `pcm_44100` 출력 형식을 지원합니다.
