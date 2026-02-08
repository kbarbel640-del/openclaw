---
summary: "Vòng đời Gateway trên macOS (launchd)"
read_when:
  - Tích hợp ứng dụng mac với vòng đời của Gateway
title: "Vòng đời Gateway"
x-i18n:
  source_path: platforms/mac/child-process.md
  source_hash: 9b910f574b723bc1
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:07:53Z
---

# Vòng đời Gateway trên macOS

Ứng dụng macOS **quản lý Gateway qua launchd** theo mặc định và không khởi chạy
Gateway như một tiến trình con. Trước hết, ứng dụng cố gắng gắn vào một Gateway
đang chạy trên cổng đã cấu hình; nếu không kết nối được, nó sẽ bật dịch vụ
launchd thông qua CLI bên ngoài `openclaw` (không có runtime nhúng). Cách này
mang lại tự động khởi động đáng tin cậy khi đăng nhập và tự khởi động lại khi gặp
sự cố.

Chế độ tiến trình con (Gateway được ứng dụng khởi chạy trực tiếp) hiện **không
được sử dụng**. Nếu bạn cần mức độ gắn kết chặt hơn với UI, hãy chạy Gateway thủ
công trong terminal.

## Hành vi mặc định (launchd)

- Ứng dụng cài đặt một LaunchAgent theo người dùng với nhãn `bot.molt.gateway`
  (hoặc `bot.molt.<profile>` khi dùng `--profile`/`OPENCLAW_PROFILE`; hỗ trợ bản cũ
  `com.openclaw.*`).
- Khi bật Local mode, ứng dụng đảm bảo LaunchAgent được nạp và
  khởi động Gateway nếu cần.
- Log được ghi vào đường dẫn log gateway của launchd (xem trong Debug Settings).

Các lệnh thường dùng:

```bash
launchctl kickstart -k gui/$UID/bot.molt.gateway
launchctl bootout gui/$UID/bot.molt.gateway
```

Thay nhãn bằng `bot.molt.<profile>` khi chạy một hồ sơ có tên.

## Bản dựng dev chưa ký

`scripts/restart-mac.sh --no-sign` dùng cho các bản dựng cục bộ nhanh khi bạn không có
khóa ký. Để ngăn launchd trỏ tới một binary relay chưa ký, nó:

- Ghi `~/.openclaw/disable-launchagent`.

Các lần chạy đã ký của `scripts/restart-mac.sh` sẽ xóa ghi đè này nếu marker
tồn tại. Để đặt lại thủ công:

```bash
rm ~/.openclaw/disable-launchagent
```

## Chế độ chỉ gắn (Attach-only)

Để buộc ứng dụng macOS **không bao giờ cài đặt hay quản lý launchd**, hãy khởi chạy
với `--attach-only` (hoặc `--no-launchd`). Điều này đặt `~/.openclaw/disable-launchagent`,
vì vậy ứng dụng chỉ gắn vào một Gateway đang chạy sẵn. Bạn cũng có thể bật/tắt
hành vi này trong Debug Settings.

## Chế độ Remote

Chế độ Remote không bao giờ khởi động một Gateway cục bộ. Ứng dụng sử dụng một
đường hầm SSH tới máy chủ từ xa và kết nối qua đường hầm đó.

## Vì sao chúng tôi ưu tiên launchd

- Tự động khởi động khi đăng nhập.
- Cơ chế KeepAlive/khởi động lại tích hợp sẵn.
- Log và giám sát rõ ràng, dễ dự đoán.

Nếu trong tương lai thực sự cần lại chế độ tiến trình con, nó nên được tài liệu
hóa như một chế độ dev‑only riêng biệt và rõ ràng.
