---
summary: "Các trạng thái và hoạt ảnh của biểu tượng thanh menu cho OpenClaw trên macOS"
read_when:
  - Thay đổi hành vi biểu tượng thanh menu
title: "Biểu Tượng Thanh Menu"
x-i18n:
  source_path: platforms/mac/icon.md
  source_hash: a67a6e6bbdc2b611
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:07:51Z
---

# Các Trạng Thái Biểu Tượng Thanh Menu

Tác giả: steipete · Cập nhật: 2025-12-06 · Phạm vi: ứng dụng macOS (`apps/macos`)

- **Idle:** Hoạt ảnh biểu tượng bình thường (nhấp nháy, thỉnh thoảng lắc nhẹ).
- **Paused:** Mục trạng thái sử dụng `appearsDisabled`; không có chuyển động.
- **Voice trigger (tai lớn):** Trình phát hiện đánh thức bằng giọng nói gọi `AppState.triggerVoiceEars(ttl: nil)` khi nghe thấy từ đánh thức, giữ `earBoostActive=true` trong khi ghi nhận phát ngôn. Tai phóng to (1.9x), có lỗ tai hình tròn để dễ nhìn, sau đó hạ xuống qua `stopVoiceEars()` sau 1 giây im lặng. Chỉ được kích hoạt từ pipeline giọng nói trong ứng dụng.
- **Working (agent running):** `AppState.isWorking=true` điều khiển vi chuyển động “chạy đuôi/chân”: chân lắc nhanh hơn và hơi lệch vị trí khi công việc đang diễn ra. Hiện được bật/tắt quanh các lần chạy agent WebChat; hãy thêm cùng cách bật/tắt này cho các tác vụ dài khác khi bạn kết nối chúng.

Các điểm kết nối

- Voice wake: runtime/tester gọi `AppState.triggerVoiceEars(ttl: nil)` khi kích hoạt và `stopVoiceEars()` sau 1 giây im lặng để khớp với cửa sổ ghi nhận.
- Hoạt động của agent: đặt `AppStateStore.shared.setWorking(true/false)` quanh các khoảng công việc (đã làm trong lệnh gọi agent WebChat). Giữ các khoảng ngắn và đặt lại trong các khối `defer` để tránh hoạt ảnh bị kẹt.

Hình dạng & kích thước

- Biểu tượng cơ sở được vẽ trong `CritterIconRenderer.makeIcon(blink:legWiggle:earWiggle:earScale:earHoles:)`.
- Tỷ lệ tai mặc định là `1.0`; tăng cường giọng nói đặt `earScale=1.9` và bật/tắt `earHoles=true` mà không thay đổi khung tổng thể (ảnh mẫu 18×18 pt được render vào backing store Retina 36×36 px).
- Scurry sử dụng lắc chân lên đến ~1.0 với một chuyển động ngang nhỏ; nó cộng dồn với bất kỳ lắc idle hiện có nào.

Ghi chú hành vi

- Không có công tắc CLI/broker bên ngoài cho tai/working; giữ nó nội bộ theo các tín hiệu của chính ứng dụng để tránh kích hoạt ngoài ý muốn.
- Giữ TTL ngắn (&lt;10s) để biểu tượng nhanh chóng trở về trạng thái cơ bản nếu một tác vụ bị treo.
