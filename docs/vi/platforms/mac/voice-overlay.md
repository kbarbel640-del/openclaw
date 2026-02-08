---
summary: "Vòng đời của voice overlay khi wake-word và push-to-talk chồng chéo"
read_when:
  - Điều chỉnh hành vi voice overlay
title: "Voice Overlay"
x-i18n:
  source_path: platforms/mac/voice-overlay.md
  source_hash: 3be1a60aa7940b23
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:08:04Z
---

# Vòng đời Voice Overlay (macOS)

Đối tượng: người đóng góp cho ứng dụng macOS. Mục tiêu: giữ cho voice overlay có hành vi dễ dự đoán khi wake-word và push-to-talk chồng chéo.

### Ý định hiện tại

- Nếu overlay đã hiển thị do wake-word và người dùng nhấn phím nóng, phiên phím nóng sẽ _kế thừa_ văn bản hiện có thay vì đặt lại. Overlay tiếp tục hiển thị trong khi phím nóng được giữ. Khi người dùng thả ra: gửi nếu có văn bản đã được cắt gọn, nếu không thì đóng.
- Chỉ wake-word vẫn tự động gửi khi im lặng; push-to-talk gửi ngay khi thả.

### Đã triển khai (9 tháng 12, 2025)

- Các phiên overlay hiện mang theo một token cho mỗi lần thu (wake-word hoặc push-to-talk). Các cập nhật partial/final/send/dismiss/level sẽ bị loại bỏ khi token không khớp, tránh callback cũ.
- Push-to-talk kế thừa mọi văn bản overlay đang hiển thị như một tiền tố (vì vậy nhấn phím nóng khi overlay wake đang hiển thị sẽ giữ văn bản và nối thêm lời nói mới). Nó chờ tối đa 1,5 giây để có bản ghi cuối cùng trước khi rơi về văn bản hiện tại.
- Ghi log chime/overlay được phát tại `info` trong các danh mục `voicewake.overlay`, `voicewake.ptt`, và `voicewake.chime` (bắt đầu phiên, partial, final, send, dismiss, lý do chime).

### Các bước tiếp theo

1. **VoiceSessionCoordinator (actor)**
   - Chỉ sở hữu đúng một `VoiceSession` tại một thời điểm.
   - API (dựa trên token): `beginWakeCapture`, `beginPushToTalk`, `updatePartial`, `endCapture`, `cancel`, `applyCooldown`.
   - Loại bỏ các callback mang token cũ (ngăn các bộ nhận dạng cũ mở lại overlay).
2. **VoiceSession (model)**
   - Trường: `token`, `source` (wakeWord|pushToTalk), văn bản committed/volatile, cờ chime, bộ đếm thời gian (tự động gửi, nhàn rỗi), `overlayMode` (display|editing|sending), thời hạn cooldown.
3. **Liên kết overlay**
   - `VoiceSessionPublisher` (`ObservableObject`) phản chiếu phiên đang hoạt động vào SwiftUI.
   - `VoiceWakeOverlayView` chỉ render thông qua publisher; không bao giờ trực tiếp thay đổi singleton toàn cục.
   - Các hành động người dùng trên overlay (`sendNow`, `dismiss`, `edit`) gọi ngược về coordinator với token của phiên.
4. **Luồng gửi hợp nhất**
   - Trên `endCapture`: nếu văn bản đã cắt gọn rỗng → đóng; ngược lại `performSend(session:)` (phát chime gửi một lần, chuyển tiếp, đóng).
   - Push-to-talk: không trì hoãn; wake-word: có thể trì hoãn cho tự động gửi.
   - Áp dụng một cooldown ngắn cho runtime wake sau khi push-to-talk kết thúc để wake-word không kích hoạt lại ngay.
5. **Ghi log**
   - Coordinator phát log `.info` trong subsystem `bot.molt`, các danh mục `voicewake.overlay` và `voicewake.chime`.
   - Các sự kiện chính: `session_started`, `adopted_by_push_to_talk`, `partial`, `finalized`, `send`, `dismiss`, `cancel`, `cooldown`.

### Danh sách kiểm tra gỡ lỗi

- Theo dõi log khi tái hiện overlay bị dính:

  ```bash
  sudo log stream --predicate 'subsystem == "bot.molt" AND category CONTAINS "voicewake"' --level info --style compact
  ```

- Xác minh chỉ có một token phiên đang hoạt động; các callback cũ phải bị coordinator loại bỏ.
- Đảm bảo việc thả push-to-talk luôn gọi `endCapture` với token đang hoạt động; nếu văn bản rỗng, mong đợi `dismiss` mà không có chime hoặc gửi.

### Các bước migration (đề xuất)

1. Thêm `VoiceSessionCoordinator`, `VoiceSession`, và `VoiceSessionPublisher`.
2. Refactor `VoiceWakeRuntime` để tạo/cập nhật/kết thúc phiên thay vì chạm trực tiếp vào `VoiceWakeOverlayController`.
3. Refactor `VoicePushToTalk` để kế thừa các phiên hiện có và gọi `endCapture` khi thả; áp dụng cooldown runtime.
4. Kết nối `VoiceWakeOverlayController` với publisher; loại bỏ các lời gọi trực tiếp từ runtime/PTT.
5. Thêm các bài kiểm thử tích hợp cho việc kế thừa phiên, cooldown, và đóng khi văn bản rỗng.
