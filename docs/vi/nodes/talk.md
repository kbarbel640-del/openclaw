---
summary: "Chế độ Talk: hội thoại giọng nói liên tục với ElevenLabs TTS"
read_when:
  - Triển khai chế độ Talk trên macOS/iOS/Android
  - Thay đổi hành vi giọng nói/TTS/ngắt
title: "Chế độ Talk"
x-i18n:
  source_path: nodes/talk.md
  source_hash: ecbc3701c9e95029
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:07:43Z
---

# Chế độ Talk

Chế độ Talk là một vòng lặp hội thoại giọng nói liên tục:

1. Lắng nghe giọng nói
2. Gửi bản chép lời tới mô hình (phiên chính, chat.send)
3. Chờ phản hồi
4. Phát giọng nói qua ElevenLabs (phát trực tuyến)

## Hành vi (macOS)

- **Lớp phủ luôn bật** khi bật chế độ Talk.
- Chuyển pha **Listening → Thinking → Speaking**.
- Khi có **khoảng dừng ngắn** (cửa sổ im lặng), bản chép lời hiện tại sẽ được gửi đi.
- Phản hồi được **ghi vào WebChat** (giống như khi gõ).
- **Ngắt khi có giọng nói** (bật mặc định): nếu người dùng bắt đầu nói khi trợ lý đang nói, chúng tôi dừng phát và ghi lại dấu thời gian ngắt cho prompt tiếp theo.

## Chỉ thị giọng nói trong phản hồi

Trợ lý có thể thêm tiền tố phản hồi bằng **một dòng JSON duy nhất** để điều khiển giọng nói:

```json
{ "voice": "<voice-id>", "once": true }
```

Quy tắc:

- Chỉ dòng không rỗng đầu tiên.
- Khóa không xác định sẽ bị bỏ qua.
- `once: true` chỉ áp dụng cho phản hồi hiện tại.
- Không có `once` thì giọng nói sẽ trở thành mặc định mới cho chế độ Talk.
- Dòng JSON sẽ bị loại bỏ trước khi phát TTS.

Các khóa được hỗ trợ:

- `voice` / `voice_id` / `voiceId`
- `model` / `model_id` / `modelId`
- `speed`, `rate` (WPM), `stability`, `similarity`, `style`, `speakerBoost`
- `seed`, `normalize`, `lang`, `output_format`, `latency_tier`
- `once`

## Cấu hình (`~/.openclaw/openclaw.json`)

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

Mặc định:

- `interruptOnSpeech`: true
- `voiceId`: dự phòng về `ELEVENLABS_VOICE_ID` / `SAG_VOICE_ID` (hoặc giọng ElevenLabs đầu tiên khi có API key)
- `modelId`: mặc định là `eleven_v3` khi không đặt
- `apiKey`: dự phòng về `ELEVENLABS_API_KEY` (hoặc hồ sơ shell của Gateway nếu có)
- `outputFormat`: mặc định là `pcm_44100` trên macOS/iOS và `pcm_24000` trên Android (đặt `mp3_*` để buộc phát trực tuyến MP3)

## Giao diện macOS

- Công tắc thanh menu: **Talk**
- Tab cấu hình: nhóm **Talk Mode** (voice id + công tắc ngắt)
- Lớp phủ:
  - **Listening**: đám mây nhấp nháy theo mức mic
  - **Thinking**: hoạt ảnh chìm xuống
  - **Speaking**: các vòng tròn lan tỏa
  - Nhấp đám mây: dừng nói
  - Nhấp X: thoát chế độ Talk

## Ghi chú

- Yêu cầu quyền Speech + Microphone.
- Sử dụng `chat.send` với khóa phiên `main`.
- TTS dùng API phát trực tuyến ElevenLabs với `ELEVENLABS_API_KEY` và phát tăng dần trên macOS/iOS/Android để giảm độ trễ.
- `stability` cho `eleven_v3` được kiểm tra để là `0.0`, `0.5`, hoặc `1.0`; các mô hình khác chấp nhận `0..1`.
- `latency_tier` được kiểm tra để là `0..4` khi được đặt.
- Android hỗ trợ các định dạng đầu ra `pcm_16000`, `pcm_22050`, `pcm_24000`, và `pcm_44100` cho phát AudioTrack độ trễ thấp.
