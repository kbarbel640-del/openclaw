---
summary: "Các chế độ đánh thức bằng giọng nói và nhấn-để-nói cùng chi tiết định tuyến trong ứng dụng mac"
read_when:
  - Làm việc với các luồng Voice Wake hoặc PTT
title: "Đánh Thức Bằng Giọng Nói"
x-i18n:
  source_path: platforms/mac/voicewake.md
  source_hash: f6440bb89f349ba5
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:08:04Z
---

# Voice Wake & Push-to-Talk

## Chế độ

- **Chế độ từ khóa đánh thức** (mặc định): bộ nhận dạng Speech luôn bật chờ các token kích hoạt (`swabbleTriggerWords`). Khi khớp, hệ thống bắt đầu thu âm, hiển thị overlay với văn bản từng phần, và tự động gửi sau khi im lặng.
- **Nhấn-để-nói (giữ Right Option)**: giữ phím Option phải để thu ngay—không cần kích hoạt. Overlay xuất hiện khi đang giữ; thả ra sẽ hoàn tất và chuyển tiếp sau một độ trễ ngắn để bạn có thể chỉnh văn bản.

## Hành vi lúc chạy (từ khóa đánh thức)

- Bộ nhận dạng Speech chạy trong `VoiceWakeRuntime`.
- Kích hoạt chỉ xảy ra khi có **khoảng dừng có ý nghĩa** giữa từ khóa đánh thức và từ tiếp theo (khoảng ~0,55s). Overlay/âm báo có thể bắt đầu ngay tại khoảng dừng, trước khi lệnh bắt đầu.
- Cửa sổ im lặng: 2,0s khi lời nói đang diễn ra, 5,0s nếu chỉ nghe thấy từ kích hoạt.
- Dừng cứng: 120s để tránh các phiên chạy không kiểm soát.
- Chống dội giữa các phiên: 350ms.
- Overlay được điều khiển qua `VoiceWakeOverlayController` với tô màu đã xác nhận/chưa xác nhận.
- Sau khi gửi, bộ nhận dạng khởi động lại sạch để lắng nghe lần kích hoạt tiếp theo.

## Bất biến vòng đời

- Nếu Voice Wake được bật và đã cấp quyền, bộ nhận dạng từ khóa đánh thức phải luôn lắng nghe (trừ khi đang thu nhấn-để-nói).
- Hiển thị overlay (bao gồm việc đóng thủ công bằng nút X) không bao giờ được ngăn bộ nhận dạng tiếp tục hoạt động.

## Lỗi overlay bị kẹt (trước đây)

Trước đây, nếu overlay bị kẹt hiển thị và bạn đóng thủ công, Voice Wake có thể trông như “chết” vì lần khởi động lại của runtime có thể bị chặn bởi trạng thái hiển thị overlay và không có lần khởi động lại nào tiếp theo được lên lịch.

Gia cố:

- Việc khởi động lại runtime đánh thức không còn bị chặn bởi trạng thái hiển thị overlay.
- Hoàn tất thao tác đóng overlay kích hoạt `VoiceWakeRuntime.refresh(...)` qua `VoiceSessionCoordinator`, vì vậy việc đóng bằng X luôn tiếp tục lắng nghe.

## Chi tiết nhấn-để-nói

- Phát hiện phím nóng dùng bộ theo dõi toàn cục `.flagsChanged` cho **Option phải** (`keyCode 61` + `.option`). Chỉ quan sát sự kiện (không chặn).
- Pipeline thu nằm trong `VoicePushToTalk`: khởi động Speech ngay, stream phần từng phần lên overlay, và gọi `VoiceWakeForwarder` khi thả.
- Khi nhấn-để-nói bắt đầu, chúng tôi tạm dừng runtime từ khóa đánh thức để tránh xung đột tap âm thanh; nó tự khởi động lại sau khi thả.
- Quyền: cần Microphone + Speech; để thấy sự kiện cần cấp Accessibility/Input Monitoring.
- Bàn phím ngoài: một số có thể không lộ Option phải như mong đợi—hãy cung cấp phím tắt dự phòng nếu người dùng báo bỏ lỡ.

## Cài đặt hướng người dùng

- **Voice Wake**: bật runtime từ khóa đánh thức.
- **Giữ Cmd+Fn để nói**: bật bộ theo dõi nhấn-để-nói. Tắt trên macOS < 26.
- Bộ chọn ngôn ngữ & mic, thước mức âm trực tiếp, bảng từ kích hoạt, trình kiểm tra (chỉ cục bộ; không chuyển tiếp).
- Bộ chọn mic giữ lựa chọn gần nhất nếu thiết bị ngắt kết nối, hiển thị gợi ý đã ngắt, và tạm thời chuyển về mặc định hệ thống cho đến khi thiết bị quay lại.
- **Âm thanh**: âm báo khi phát hiện kích hoạt và khi gửi; mặc định là âm hệ thống “Glass” của macOS. Bạn có thể chọn bất kỳ tệp có thể tải bằng `NSSound` (ví dụ MP3/WAV/AIFF) cho mỗi sự kiện hoặc chọn **Không Âm Thanh**.

## Hành vi chuyển tiếp

- Khi bật Voice Wake, bản chép được chuyển tiếp tới gateway/agent đang hoạt động (cùng chế độ cục bộ hay từ xa như phần còn lại của ứng dụng mac).
- Phản hồi được gửi tới **nhà cung cấp chính dùng gần nhất** (WhatsApp/Telegram/Discord/WebChat). Nếu gửi thất bại, lỗi được ghi log và lần chạy vẫn hiển thị qua WebChat/nhật ký phiên.

## Payload chuyển tiếp

- `VoiceWakeForwarder.prefixedTranscript(_:)` thêm gợi ý máy trước khi gửi. Dùng chung cho cả luồng từ khóa đánh thức và nhấn-để-nói.

## Xác minh nhanh

- Bật nhấn-để-nói, giữ Cmd+Fn, nói, thả: overlay phải hiển thị phần từng phần rồi gửi.
- Khi đang giữ, biểu tượng tai trên thanh menu phải giữ trạng thái phóng to (dùng `triggerVoiceEars(ttl:nil)`); chúng thu nhỏ lại sau khi thả.
