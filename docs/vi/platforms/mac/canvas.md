---
summary: "Bảng Canvas do tác tử điều khiển được nhúng qua WKWebView + sơ đồ URL tùy chỉnh"
read_when:
  - Triển khai bảng Canvas trên macOS
  - Thêm điều khiển tác tử cho không gian làm việc trực quan
  - Gỡ lỗi việc tải Canvas trong WKWebView
title: "Canvas"
x-i18n:
  source_path: platforms/mac/canvas.md
  source_hash: e39caa21542e839d
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:07:51Z
---

# Canvas (ứng dụng macOS)

Ứng dụng macOS nhúng **bảng Canvas** do tác tử điều khiển bằng `WKWebView`. Đây
là một không gian làm việc trực quan nhẹ cho HTML/CSS/JS, A2UI và các bề mặt UI
tương tác nhỏ.

## Canvas nằm ở đâu

Trạng thái Canvas được lưu dưới Application Support:

- `~/Library/Application Support/OpenClaw/canvas/<session>/...`

Bảng Canvas phục vụ các tệp đó thông qua **sơ đồ URL tùy chỉnh**:

- `openclaw-canvas://<session>/<path>`

Ví dụ:

- `openclaw-canvas://main/` → `<canvasRoot>/main/index.html`
- `openclaw-canvas://main/assets/app.css` → `<canvasRoot>/main/assets/app.css`
- `openclaw-canvas://main/widgets/todo/` → `<canvasRoot>/main/widgets/todo/index.html`

Nếu không tồn tại `index.html` ở thư mục gốc, ứng dụng sẽ hiển thị **trang khung dựng sẵn**.

## Hành vi của bảng

- Bảng không viền, có thể thay đổi kích thước, neo gần thanh menu (hoặc con trỏ chuột).
- Ghi nhớ kích thước/vị trí theo từng phiên.
- Tự động tải lại khi các tệp canvas cục bộ thay đổi.
- Chỉ một bảng Canvas hiển thị tại một thời điểm (phiên sẽ được chuyển khi cần).

Canvas có thể bị tắt từ Cài đặt → **Allow Canvas**. Khi bị tắt, các lệnh node canvas
trả về `CANVAS_DISABLED`.

## Bề mặt API cho tác tử

Canvas được phơi bày qua **Gateway WebSocket**, vì vậy tác tử có thể:

- hiển thị/ẩn bảng
- điều hướng đến một đường dẫn hoặc URL
- thực thi JavaScript
- chụp ảnh snapshot

Ví dụ CLI:

```bash
openclaw nodes canvas present --node <id>
openclaw nodes canvas navigate --node <id> --url "/"
openclaw nodes canvas eval --node <id> --js "document.title"
openclaw nodes canvas snapshot --node <id>
```

Ghi chú:

- `canvas.navigate` chấp nhận **đường dẫn canvas cục bộ**, URL `http(s)` và URL `file://`.
- Nếu bạn truyền `"/"`, Canvas sẽ hiển thị khung dựng cục bộ hoặc `index.html`.

## A2UI trong Canvas

A2UI được lưu trữ bởi Gateway canvas host và được render bên trong bảng Canvas.
Khi Gateway quảng bá một Canvas host, ứng dụng macOS sẽ tự động điều hướng đến
trang host A2UI ở lần mở đầu tiên.

URL host A2UI mặc định:

```
http://<gateway-host>:18793/__openclaw__/a2ui/
```

### Lệnh A2UI (v0.8)

Hiện tại Canvas chấp nhận các thông điệp server→client **A2UI v0.8**:

- `beginRendering`
- `surfaceUpdate`
- `dataModelUpdate`
- `deleteSurface`

`createSurface` (v0.9) chưa được hỗ trợ.

Ví dụ CLI:

```bash
cat > /tmp/a2ui-v0.8.jsonl <<'EOFA2'
{"surfaceUpdate":{"surfaceId":"main","components":[{"id":"root","component":{"Column":{"children":{"explicitList":["title","content"]}}}},{"id":"title","component":{"Text":{"text":{"literalString":"Canvas (A2UI v0.8)"},"usageHint":"h1"}}},{"id":"content","component":{"Text":{"text":{"literalString":"If you can read this, A2UI push works."},"usageHint":"body"}}}]}}
{"beginRendering":{"surfaceId":"main","root":"root"}}
EOFA2

openclaw nodes canvas a2ui push --jsonl /tmp/a2ui-v0.8.jsonl --node <id>
```

Kiểm tra nhanh:

```bash
openclaw nodes canvas a2ui push --node <id> --text "Hello from A2UI"
```

## Kích hoạt chạy tác tử từ Canvas

Canvas có thể kích hoạt các lần chạy tác tử mới thông qua deep link:

- `openclaw://agent?...`

Ví dụ (trong JS):

```js
window.location.href = "openclaw://agent?message=Review%20this%20design";
```

Ứng dụng sẽ yêu cầu xác nhận trừ khi cung cấp khóa hợp lệ.

## Ghi chú bảo mật

- Sơ đồ Canvas chặn truy cập vượt thư mục; các tệp phải nằm dưới thư mục gốc của phiên.
- Nội dung Canvas cục bộ sử dụng sơ đồ tùy chỉnh (không cần máy chủ local loopback).
- Các URL `http(s)` bên ngoài chỉ được cho phép khi được điều hướng một cách tường minh.
