---
summary: "Khắc phục sự cố khởi động CDP Chrome/Brave/Edge/Chromium cho điều khiển trình duyệt OpenClaw trên Linux"
read_when: "Điều khiển trình duyệt thất bại trên Linux, đặc biệt với Chromium dạng snap"
title: "Xu ly su co trinh duyet"
x-i18n:
  source_path: tools/browser-linux-troubleshooting.md
  source_hash: bac2301022511a0b
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:08:38Z
---

# Xu ly su co trinh duyet (Linux)

## Vấn đề: "Failed to start Chrome CDP on port 18800"

Máy chủ điều khiển trình duyệt của OpenClaw không khởi chạy được Chrome/Brave/Edge/Chromium và báo lỗi:

```
{"error":"Error: Failed to start Chrome CDP on port 18800 for profile \"openclaw\"."}
```

### Nguyên nhân gốc rễ

Trên Ubuntu (và nhiều bản phân phối Linux), bản cài Chromium mặc định là **gói snap**. Cơ chế cô lập AppArmor của snap gây nhiễu cách OpenClaw tạo và giám sát tiến trình trình duyệt.

Lệnh `apt install chromium` cài đặt một gói stub chuyển hướng sang snap:

```
Note, selecting 'chromium-browser' instead of 'chromium'
chromium-browser is already the newest version (2:1snap1-0ubuntu2).
```

Đây KHÔNG phải là trình duyệt thực — chỉ là một wrapper.

### Giải pháp 1: Cài đặt Google Chrome (Khuyến nghị)

Cài đặt gói `.deb` Google Chrome chính thức, không bị snap sandbox:

```bash
wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
sudo dpkg -i google-chrome-stable_current_amd64.deb
sudo apt --fix-broken install -y  # if there are dependency errors
```

Sau đó cập nhật cau hinh OpenClaw của bạn (`~/.openclaw/openclaw.json`):

```json
{
  "browser": {
    "enabled": true,
    "executablePath": "/usr/bin/google-chrome-stable",
    "headless": true,
    "noSandbox": true
  }
}
```

### Giải pháp 2: Dùng Snap Chromium với chế độ Chỉ Gắn (Attach-Only)

Nếu buộc phải dùng snap Chromium, hãy cấu hình OpenClaw để gắn vào một trình duyệt được khởi động thủ công:

1. Cập nhật cấu hình:

```json
{
  "browser": {
    "enabled": true,
    "attachOnly": true,
    "headless": true,
    "noSandbox": true
  }
}
```

2. Khởi động Chromium thủ công:

```bash
chromium-browser --headless --no-sandbox --disable-gpu \
  --remote-debugging-port=18800 \
  --user-data-dir=$HOME/.openclaw/browser/openclaw/user-data \
  about:blank &
```

3. Tùy chọn tạo dịch vụ systemd người dùng để tự động khởi động Chrome:

```ini
# ~/.config/systemd/user/openclaw-browser.service
[Unit]
Description=OpenClaw Browser (Chrome CDP)
After=network.target

[Service]
ExecStart=/snap/bin/chromium --headless --no-sandbox --disable-gpu --remote-debugging-port=18800 --user-data-dir=%h/.openclaw/browser/openclaw/user-data about:blank
Restart=on-failure
RestartSec=5

[Install]
WantedBy=default.target
```

Bật bằng: `systemctl --user enable --now openclaw-browser.service`

### Xác minh trình duyệt hoạt động

Kiểm tra trạng thái:

```bash
curl -s http://127.0.0.1:18791/ | jq '{running, pid, chosenBrowser}'
```

Thử duyệt web:

```bash
curl -s -X POST http://127.0.0.1:18791/start
curl -s http://127.0.0.1:18791/tabs
```

### Tham chiếu cấu hình

| Tùy chọn                 | Mô tả                                                                           | Mặc định                                                          |
| ------------------------ | ------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `browser.enabled`        | Bật điều khiển trình duyệt                                                      | `true`                                                            |
| `browser.executablePath` | Đường dẫn tới binary trình duyệt dựa trên Chromium (Chrome/Brave/Edge/Chromium) | tự phát hiện (ưu tiên trình duyệt mặc định nếu dựa trên Chromium) |
| `browser.headless`       | Chạy không GUI                                                                  | `false`                                                           |
| `browser.noSandbox`      | Thêm cờ `--no-sandbox` (cần cho một số thiết lập Linux)                         | `false`                                                           |
| `browser.attachOnly`     | Không khởi chạy trình duyệt, chỉ gắn vào phiên hiện có                          | `false`                                                           |
| `browser.cdpPort`        | Cổng Chrome DevTools Protocol                                                   | `18800`                                                           |

### Vấn đề: "Chrome extension relay is running, but no tab is connected"

Bạn đang dùng profile `chrome` (extension relay). Profile này yêu cầu tiện ích trình duyệt OpenClaw được gắn vào một tab đang hoạt động.

Các cách khắc phục:

1. **Dùng trình duyệt được quản lý:** `openclaw browser start --browser-profile openclaw`
   (hoặc đặt `browser.defaultProfile: "openclaw"`).
2. **Dùng extension relay:** cài tiện ích, mở một tab, rồi nhấp biểu tượng tiện ích OpenClaw để gắn.

Ghi chú:

- Profile `chrome` dùng **trình duyệt Chromium mặc định của hệ thống** khi có thể.
- Các profile `openclaw` cục bộ tự động gán `cdpPort`/`cdpUrl`; chỉ đặt các giá trị đó cho CDP từ xa.
