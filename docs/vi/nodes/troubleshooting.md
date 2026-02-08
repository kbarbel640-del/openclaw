---
summary: "Xử lý sự cố ghép nối node, yêu cầu chạy nền trước, quyền truy cập và lỗi công cụ"
read_when:
  - Node đã kết nối nhưng các công cụ camera/canvas/screen/exec bị lỗi
  - Bạn cần mô hình tư duy về sự khác biệt giữa ghép nối node và phê duyệt
title: "Xử lý sự cố Node"
x-i18n:
  source_path: nodes/troubleshooting.md
  source_hash: 5c40d298c9feaf8e
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T08:16:03Z
---

# Xử lý sự cố node

Sử dụng trang này khi một node hiển thị trong trạng thái nhưng các công cụ của node không hoạt động.

## Thang lệnh

```bash
openclaw status
openclaw gateway status
openclaw logs --follow
openclaw doctor
openclaw channels status --probe
```

Sau đó chạy các kiểm tra dành riêng cho node:

```bash
openclaw nodes status
openclaw nodes describe --node <idOrNameOrIp>
openclaw approvals get --node <idOrNameOrIp>
```

Dấu hiệu hoạt động tốt:

- Node đã kết nối và được ghép nối cho vai trò `node`.
- `nodes describe` bao gồm khả năng bạn đang gọi.
- Phê duyệt exec hiển thị đúng chế độ/danh sách cho phép.

## Yêu cầu chạy nền trước

`canvas.*`, `camera.*` và `screen.*` chỉ hoạt động khi ở nền trước trên các node iOS/Android.

Kiểm tra và khắc phục nhanh:

```bash
openclaw nodes describe --node <idOrNameOrIp>
openclaw nodes canvas snapshot --node <idOrNameOrIp>
openclaw logs --follow
```

Nếu bạn thấy `NODE_BACKGROUND_UNAVAILABLE`, hãy đưa ứng dụng node lên nền trước và thử lại.

## Ma trận quyền

| Khả năng                     | iOS                                          | Android                                    | Ứng dụng node macOS              | Mã lỗi thường gặp              |
| ---------------------------- | -------------------------------------------- | ------------------------------------------ | -------------------------------- | ------------------------------ |
| `camera.snap`, `camera.clip` | Camera (+ mic cho âm thanh clip)             | Camera (+ mic cho âm thanh clip)           | Camera (+ mic cho âm thanh clip) | `*_PERMISSION_REQUIRED`        |
| `screen.record`              | Screen Recording (+ mic tùy chọn)            | Nhắc chụp màn hình (+ mic tùy chọn)        | Screen Recording                 | `*_PERMISSION_REQUIRED`        |
| `location.get`               | Khi đang sử dụng hoặc Luôn luôn (tùy chế độ) | Quyền vị trí nền trước/nền sau theo chế độ | Quyền vị trí                     | `LOCATION_PERMISSION_REQUIRED` |
| `system.run`                 | n/a (đường dẫn máy chủ node)                 | n/a (đường dẫn máy chủ node)               | Cần phê duyệt exec               | `SYSTEM_RUN_DENIED`            |

## Ghép nối so với phê duyệt

Đây là hai cổng khác nhau:

1. **Ghép nối thiết bị**: node này có thể kết nối tới Gateway không?
2. **Phê duyệt exec**: node này có thể chạy một lệnh shell cụ thể không?

Kiểm tra nhanh:

```bash
openclaw devices list
openclaw nodes status
openclaw approvals get --node <idOrNameOrIp>
openclaw approvals allowlist add --node <idOrNameOrIp> "/usr/bin/uname"
```

Nếu thiếu ghép nối, hãy phê duyệt thiết bị node trước.
Nếu ghép nối ổn nhưng `system.run` bị lỗi, hãy sửa phê duyệt exec/danh sách cho phép.

## Mã lỗi node phổ biến

- `NODE_BACKGROUND_UNAVAILABLE` → ứng dụng đang chạy nền; đưa lên nền trước.
- `CAMERA_DISABLED` → công tắc camera bị tắt trong cài đặt node.
- `*_PERMISSION_REQUIRED` → thiếu/bị từ chối quyền hệ điều hành.
- `LOCATION_DISABLED` → chế độ vị trí đang tắt.
- `LOCATION_PERMISSION_REQUIRED` → chế độ vị trí được yêu cầu chưa được cấp.
- `LOCATION_BACKGROUND_UNAVAILABLE` → ứng dụng chạy nền nhưng chỉ có quyền Khi đang sử dụng.
- `SYSTEM_RUN_DENIED: approval required` → yêu cầu exec cần phê duyệt rõ ràng.
- `SYSTEM_RUN_DENIED: allowlist miss` → lệnh bị chặn bởi chế độ danh sách cho phép.

## Vòng khôi phục nhanh

```bash
openclaw nodes status
openclaw nodes describe --node <idOrNameOrIp>
openclaw approvals get --node <idOrNameOrIp>
openclaw logs --follow
```

Nếu vẫn gặp sự cố:

- Phê duyệt lại ghép nối thiết bị.
- Mở lại ứng dụng node (đưa lên nền trước).
- Cấp lại quyền hệ điều hành.
- Tạo lại/điều chỉnh chính sách phê duyệt exec.

Liên quan:

- [/nodes/index](/nodes/index)
- [/nodes/camera](/nodes/camera)
- [/nodes/location-command](/nodes/location-command)
- [/tools/exec-approvals](/tools/exec-approvals)
- [/gateway/pairing](/gateway/pairing)
