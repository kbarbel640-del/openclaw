---
summary: "Lệnh vị trí cho node (location.get), các chế độ quyền, và hành vi nền"
read_when:
  - Thêm hỗ trợ node vị trí hoặc UI quyền
  - Thiết kế luồng vị trí nền + push
title: "Lệnh Vị Trí"
x-i18n:
  source_path: nodes/location-command.md
  source_hash: 23124096256384d2
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:07:44Z
---

# Lệnh vị trí (nodes)

## TL;DR

- `location.get` là một lệnh node (thông qua `node.invoke`).
- Tắt theo mặc định.
- Cài đặt dùng bộ chọn: Tắt / Khi đang sử dụng / Luôn luôn.
- Công tắc riêng: Vị trí chính xác.

## Vì sao dùng bộ chọn (không chỉ là một công tắc)

Quyền của hệ điều hành có nhiều mức. Chúng ta có thể hiển thị bộ chọn trong ứng dụng, nhưng hệ điều hành vẫn quyết định quyền được cấp thực tế.

- iOS/macOS: người dùng có thể chọn **Khi đang sử dụng** hoặc **Luôn luôn** trong lời nhắc/Cài đặt hệ thống. Ứng dụng có thể yêu cầu nâng cấp, nhưng hệ điều hành có thể yêu cầu vào Cài đặt.
- Android: vị trí nền là một quyền riêng; trên Android 10+ thường cần một luồng qua Cài đặt.
- Vị trí chính xác là một quyền riêng (iOS 14+ “Precise”, Android “fine” so với “coarse”).

Bộ chọn trong UI quyết định chế độ chúng ta yêu cầu; quyền được cấp thực tế nằm trong cài đặt hệ điều hành.

## Mô hình cài đặt

Theo từng thiết bị node:

- `location.enabledMode`: `off | whileUsing | always`
- `location.preciseEnabled`: bool

Hành vi UI:

- Chọn `whileUsing` sẽ yêu cầu quyền tiền cảnh.
- Chọn `always` trước tiên đảm bảo `whileUsing`, sau đó yêu cầu quyền nền (hoặc đưa người dùng tới Cài đặt nếu cần).
- Nếu hệ điều hành từ chối mức được yêu cầu, hoàn nguyên về mức cao nhất đã được cấp và hiển thị trạng thái.

## Ánh xạ quyền (node.permissions)

Tùy chọn. Node macOS báo cáo `location` qua bản đồ quyền; iOS/Android có thể bỏ qua.

## Lệnh: `location.get`

Được gọi qua `node.invoke`.

Tham số (đề xuất):

```json
{
  "timeoutMs": 10000,
  "maxAgeMs": 15000,
  "desiredAccuracy": "coarse|balanced|precise"
}
```

Payload phản hồi:

```json
{
  "lat": 48.20849,
  "lon": 16.37208,
  "accuracyMeters": 12.5,
  "altitudeMeters": 182.0,
  "speedMps": 0.0,
  "headingDeg": 270.0,
  "timestamp": "2026-01-03T12:34:56.000Z",
  "isPrecise": true,
  "source": "gps|wifi|cell|unknown"
}
```

Lỗi (mã ổn định):

- `LOCATION_DISABLED`: bộ chọn đang tắt.
- `LOCATION_PERMISSION_REQUIRED`: thiếu quyền cho chế độ được yêu cầu.
- `LOCATION_BACKGROUND_UNAVAILABLE`: ứng dụng đang ở nền nhưng chỉ cho phép Khi đang sử dụng.
- `LOCATION_TIMEOUT`: không có vị trí kịp thời.
- `LOCATION_UNAVAILABLE`: lỗi hệ thống / không có nhà cung cấp.

## Hành vi nền (tương lai)

Mục tiêu: mô hình có thể yêu cầu vị trí ngay cả khi node ở nền, nhưng chỉ khi:

- Người dùng đã chọn **Luôn luôn**.
- Hệ điều hành cấp quyền vị trí nền.
- Ứng dụng được phép chạy nền để lấy vị trí (chế độ nền iOS / dịch vụ tiền cảnh Android hoặc cho phép đặc biệt).

Luồng kích hoạt bằng push (tương lai):

1. Gateway gửi push tới node (push im lặng hoặc dữ liệu FCM).
2. Node thức dậy trong thời gian ngắn và yêu cầu vị trí từ thiết bị.
3. Node chuyển tiếp payload tới Gateway.

Ghi chú:

- iOS: cần quyền Luôn luôn + chế độ vị trí nền. Push im lặng có thể bị hạn chế; dự kiến lỗi gián đoạn.
- Android: vị trí nền có thể yêu cầu dịch vụ tiền cảnh; nếu không, dự kiến bị từ chối.

## Tích hợp mô hình/công cụ

- Bề mặt công cụ: công cụ `nodes` thêm hành động `location_get` (yêu cầu node).
- CLI: `openclaw nodes location get --node <id>`.
- Hướng dẫn agent: chỉ gọi khi người dùng đã bật vị trí và hiểu phạm vi.

## Bản sao UX (đề xuất)

- Tắt: “Chia sẻ vị trí đã bị tắt.”
- Khi đang sử dụng: “Chỉ khi OpenClaw đang mở.”
- Luôn luôn: “Cho phép vị trí nền. Yêu cầu quyền hệ thống.”
- Chính xác: “Dùng vị trí GPS chính xác. Tắt để chia sẻ vị trí xấp xỉ.”
