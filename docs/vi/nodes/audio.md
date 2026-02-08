---
summary: "Cách audio/ghi chú giọng nói đến được tải xuống, chuyển thành văn bản và chèn vào phản hồi"
read_when:
  - Thay đổi chuyển đổi giọng nói sang văn bản hoặc xử lý media
title: "Audio và Ghi chú Giọng nói"
x-i18n:
  source_path: nodes/audio.md
  source_hash: b926c47989ab0d1e
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:07:40Z
---

# Audio / Ghi chú Giọng nói — 2026-01-17

## Những gì hoạt động

- **Hiểu media (audio)**: Nếu hiểu audio được bật (hoặc tự động phát hiện), OpenClaw:
  1. Xác định tệp đính kèm audio đầu tiên (đường dẫn cục bộ hoặc URL) và tải xuống nếu cần.
  2. Áp dụng `maxBytes` trước khi gửi tới từng mục model.
  3. Chạy mục model đủ điều kiện đầu tiên theo thứ tự (provider hoặc CLI).
  4. Nếu thất bại hoặc bị bỏ qua (kích thước/timeout), thử mục tiếp theo.
  5. Khi thành công, thay thế `Body` bằng một khối `[Audio]` và đặt `{{Transcript}}`.
- **Phân tích lệnh**: Khi chuyển văn bản thành công, `CommandBody`/`RawBody` được đặt thành bản chép để các lệnh gạch chéo vẫn hoạt động.
- **Ghi log chi tiết**: Trong `--verbose`, chúng tôi ghi lại khi quá trình chuyển văn bản chạy và khi nó thay thế nội dung.

## Tự động phát hiện (mặc định)

Nếu bạn **không cấu hình model** và `tools.media.audio.enabled` **không** được đặt thành `false`,
OpenClaw tự động phát hiện theo thứ tự sau và dừng ở tùy chọn đầu tiên hoạt động:

1. **CLI cục bộ** (nếu đã cài)
   - `sherpa-onnx-offline` (yêu cầu `SHERPA_ONNX_MODEL_DIR` với encoder/decoder/joiner/tokens)
   - `whisper-cli` (từ `whisper-cpp`; dùng `WHISPER_CPP_MODEL` hoặc model tiny đi kèm)
   - `whisper` (Python CLI; tự động tải model)
2. **Gemini CLI** (`gemini`) sử dụng `read_many_files`
3. **Khóa provider** (OpenAI → Groq → Deepgram → Google)

Để tắt tự động phát hiện, đặt `tools.media.audio.enabled: false`.
Để tùy chỉnh, đặt `tools.media.audio.models`.
Lưu ý: Việc phát hiện binary là best‑effort trên macOS/Linux/Windows; hãy đảm bảo CLI nằm trên `PATH` (chúng tôi mở rộng `~`), hoặc đặt một model CLI tường minh với đường dẫn lệnh đầy đủ.

## Ví dụ cấu hình

### Provider + CLI dự phòng (OpenAI + Whisper CLI)

```json5
{
  tools: {
    media: {
      audio: {
        enabled: true,
        maxBytes: 20971520,
        models: [
          { provider: "openai", model: "gpt-4o-mini-transcribe" },
          {
            type: "cli",
            command: "whisper",
            args: ["--model", "base", "{{MediaPath}}"],
            timeoutSeconds: 45,
          },
        ],
      },
    },
  },
}
```

### Chỉ provider với kiểm soát phạm vi

```json5
{
  tools: {
    media: {
      audio: {
        enabled: true,
        scope: {
          default: "allow",
          rules: [{ action: "deny", match: { chatType: "group" } }],
        },
        models: [{ provider: "openai", model: "gpt-4o-mini-transcribe" }],
      },
    },
  },
}
```

### Chỉ provider (Deepgram)

```json5
{
  tools: {
    media: {
      audio: {
        enabled: true,
        models: [{ provider: "deepgram", model: "nova-3" }],
      },
    },
  },
}
```

## Ghi chú & giới hạn

- Xác thực provider tuân theo thứ tự xác thực model tiêu chuẩn (hồ sơ xác thực, biến môi trường, `models.providers.*.apiKey`).
- Deepgram nhận `DEEPGRAM_API_KEY` khi dùng `provider: "deepgram"`.
- Chi tiết thiết lập Deepgram: [Deepgram (chuyển văn bản audio)](/providers/deepgram).
- Các provider audio có thể ghi đè `baseUrl`, `headers` và `providerOptions` thông qua `tools.media.audio`.
- Giới hạn kích thước mặc định là 20MB (`tools.media.audio.maxBytes`). Audio quá lớn sẽ bị bỏ qua cho model đó và thử mục tiếp theo.
- `maxChars` mặc định cho audio là **không đặt** (bản chép đầy đủ). Đặt `tools.media.audio.maxChars` hoặc `maxChars` theo từng mục để cắt bớt đầu ra.
- Mặc định tự động của OpenAI là `gpt-4o-mini-transcribe`; đặt `model: "gpt-4o-transcribe"` để có độ chính xác cao hơn.
- Dùng `tools.media.audio.attachments` để xử lý nhiều ghi chú giọng nói (`mode: "all"` + `maxAttachments`).
- Bản chép có sẵn cho template dưới dạng `{{Transcript}}`.
- stdout của CLI bị giới hạn (5MB); hãy giữ đầu ra CLI ngắn gọn.

## Lưu ý dễ mắc

- Quy tắc phạm vi áp dụng nguyên tắc khớp đầu tiên. `chatType` được chuẩn hóa thành `direct`, `group` hoặc `room`.
- Đảm bảo CLI thoát với mã 0 và in văn bản thuần; JSON cần được xử lý qua `jq -r .text`.
- Giữ timeout hợp lý (`timeoutSeconds`, mặc định 60s) để tránh chặn hàng đợi phản hồi.
