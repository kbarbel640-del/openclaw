---
summary: "Ghi log OpenClaw: log chẩn đoán dạng file cuộn + cờ quyền riêng tư của unified log"
read_when:
  - Thu thập log macOS hoặc điều tra việc ghi log dữ liệu riêng tư
  - Gỡ lỗi các vấn đề vòng đời kích hoạt giọng nói/phiên
title: "Ghi log trên macOS"
x-i18n:
  source_path: platforms/mac/logging.md
  source_hash: c4c201d154915e0e
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:07:52Z
---

# Ghi log (macOS)

## Log chẩn đoán dạng file cuộn (bảng Debug)

OpenClaw định tuyến log ứng dụng macOS qua swift-log (mặc định là unified logging) và có thể ghi một log file cục bộ, xoay vòng trên đĩa khi bạn cần thu thập bền vững.

- Mức độ chi tiết: **Debug pane → Logs → App logging → Verbosity**
- Bật: **Debug pane → Logs → App logging → “Write rolling diagnostics log (JSONL)”**
- Vị trí: `~/Library/Logs/OpenClaw/diagnostics.jsonl` (tự động xoay vòng; các file cũ được thêm hậu tố `.1`, `.2`, …)
- Xóa: **Debug pane → Logs → App logging → “Clear”**

Ghi chú:

- Tính năng này **tắt theo mặc định**. Chỉ bật khi đang gỡ lỗi chủ động.
- Xem file là dữ liệu nhạy cảm; không chia sẻ khi chưa rà soát.

## Dữ liệu riêng tư trong unified logging trên macOS

Unified logging che bớt hầu hết payload trừ khi một subsystem chủ động bật `privacy -off`. Theo bài viết của Peter về macOS [logging privacy shenanigans](https://steipete.me/posts/2025/logging-privacy-shenanigans) (2025), việc này được điều khiển bởi một plist trong `/Library/Preferences/Logging/Subsystems/` được khóa theo tên subsystem. Chỉ các bản ghi log mới nhận cờ này, vì vậy hãy bật trước khi tái hiện sự cố.

## Bật cho OpenClaw (`bot.molt`)

- Ghi plist ra một file tạm trước, sau đó cài đặt nguyên tử với quyền root:

```bash
cat <<'EOF' >/tmp/bot.molt.plist
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>DEFAULT-OPTIONS</key>
    <dict>
        <key>Enable-Private-Data</key>
        <true/>
    </dict>
</dict>
</plist>
EOF
sudo install -m 644 -o root -g wheel /tmp/bot.molt.plist /Library/Preferences/Logging/Subsystems/bot.molt.plist
```

- Không cần khởi động lại; logd nhận biết file nhanh chóng, nhưng chỉ các dòng log mới sẽ bao gồm payload riêng tư.
- Xem đầu ra chi tiết hơn bằng helper hiện có, ví dụ: `./scripts/clawlog.sh --category WebChat --last 5m`.

## Tắt sau khi gỡ lỗi

- Gỡ bỏ ghi đè: `sudo rm /Library/Preferences/Logging/Subsystems/bot.molt.plist`.
- Tùy chọn chạy `sudo log config --reload` để buộc logd bỏ ghi đè ngay lập tức.
- Hãy nhớ bề mặt này có thể bao gồm số điện thoại và nội dung tin nhắn; chỉ giữ plist khi bạn thực sự cần thêm chi tiết.
