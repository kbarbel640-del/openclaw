---
summary: "Cách OpenClaw cung cấp các mã định danh model thiết bị Apple thành tên thân thiện trong ứng dụng macOS."
read_when:
  - Cập nhật ánh xạ mã định danh model thiết bị hoặc các tệp NOTICE/license
  - Thay đổi cách UI Instances hiển thị tên thiết bị
title: "Cơ sở dữ liệu model thiết bị"
x-i18n:
  source_path: reference/device-models.md
  source_hash: 1d99c2538a0d8fdd
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:08:11Z
---

# Cơ sở dữ liệu model thiết bị (tên thân thiện)

Ứng dụng đồng hành macOS hiển thị các tên model thiết bị Apple thân thiện trong UI **Instances** bằng cách ánh xạ các mã định danh model của Apple (ví dụ: `iPad16,6`, `Mac16,6`) sang các tên dễ đọc cho con người.

Ánh xạ này được cung cấp dưới dạng JSON tại:

- `apps/macos/Sources/OpenClaw/Resources/DeviceModels/`

## Nguồn dữ liệu

Hiện tại chúng tôi cung cấp ánh xạ từ kho lưu trữ được cấp phép MIT:

- `kyle-seongwoo-jun/apple-device-identifiers`

Để giữ cho các bản build có tính xác định, các tệp JSON được ghim vào các commit upstream cụ thể (được ghi lại trong `apps/macos/Sources/OpenClaw/Resources/DeviceModels/NOTICE.md`).

## Cập nhật cơ sở dữ liệu

1. Chọn các commit upstream bạn muốn ghim (một cho iOS, một cho macOS).
2. Cập nhật các hash commit trong `apps/macos/Sources/OpenClaw/Resources/DeviceModels/NOTICE.md`.
3. Tải lại các tệp JSON, được ghim theo các commit đó:

```bash
IOS_COMMIT="<commit sha for ios-device-identifiers.json>"
MAC_COMMIT="<commit sha for mac-device-identifiers.json>"

curl -fsSL "https://raw.githubusercontent.com/kyle-seongwoo-jun/apple-device-identifiers/${IOS_COMMIT}/ios-device-identifiers.json" \
  -o apps/macos/Sources/OpenClaw/Resources/DeviceModels/ios-device-identifiers.json

curl -fsSL "https://raw.githubusercontent.com/kyle-seongwoo-jun/apple-device-identifiers/${MAC_COMMIT}/mac-device-identifiers.json" \
  -o apps/macos/Sources/OpenClaw/Resources/DeviceModels/mac-device-identifiers.json
```

4. Đảm bảo `apps/macos/Sources/OpenClaw/Resources/DeviceModels/LICENSE.apple-device-identifiers.txt` vẫn khớp với upstream (thay thế nếu giấy phép upstream thay đổi).
5. Xác minh ứng dụng macOS build thành công, không có cảnh báo:

```bash
swift build --package-path apps/macos
```
