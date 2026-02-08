---
summary: "Ghi hình camera (node iOS + ứng dụng macOS) để agent sử dụng: ảnh (jpg) và clip video ngắn (mp4)"
read_when:
  - Thêm hoặc chỉnh sửa tính năng ghi hình camera trên các node iOS hoặc macOS
  - Mở rộng các quy trình làm việc MEDIA tệp tạm có thể truy cập bởi agent
title: "Ghi hình Camera"
x-i18n:
  source_path: nodes/camera.md
  source_hash: b4d5f5ecbab6f705
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:07:43Z
---

# Ghi hình camera (agent)

OpenClaw hỗ trợ **ghi hình camera** cho các quy trình làm việc của agent:

- **Node iOS** (ghép cặp qua Gateway): chụp **ảnh** (`jpg`) hoặc **clip video ngắn** (`mp4`, có âm thanh tùy chọn) qua `node.invoke`.
- **Node Android** (ghép cặp qua Gateway): chụp **ảnh** (`jpg`) hoặc **clip video ngắn** (`mp4`, có âm thanh tùy chọn) qua `node.invoke`.
- **Ứng dụng macOS** (node qua Gateway): chụp **ảnh** (`jpg`) hoặc **clip video ngắn** (`mp4`, có âm thanh tùy chọn) qua `node.invoke`.

Mọi quyền truy cập camera đều được kiểm soát bởi **các cài đặt do người dùng quản lý**.

## Node iOS

### Cài đặt người dùng (mặc định bật)

- Thẻ Cài đặt iOS → **Camera** → **Allow Camera** (`camera.enabled`)
  - Mặc định: **bật** (thiếu khóa được coi là đã bật).
  - Khi tắt: các lệnh `camera.*` trả về `CAMERA_DISABLED`.

### Lệnh (qua Gateway `node.invoke`)

- `camera.list`
  - Payload phản hồi:
    - `devices`: mảng `{ id, name, position, deviceType }`

- `camera.snap`
  - Tham số:
    - `facing`: `front|back` (mặc định: `front`)
    - `maxWidth`: number (tùy chọn; mặc định `1600` trên node iOS)
    - `quality`: `0..1` (tùy chọn; mặc định `0.9`)
    - `format`: hiện tại `jpg`
    - `delayMs`: number (tùy chọn; mặc định `0`)
    - `deviceId`: string (tùy chọn; từ `camera.list`)
  - Payload phản hồi:
    - `format: "jpg"`
    - `base64: "<...>"`
    - `width`, `height`
  - Bảo vệ payload: ảnh được nén lại để giữ payload base64 dưới 5 MB.

- `camera.clip`
  - Tham số:
    - `facing`: `front|back` (mặc định: `front`)
    - `durationMs`: number (mặc định `3000`, bị kẹp tối đa `60000`)
    - `includeAudio`: boolean (mặc định `true`)
    - `format`: hiện tại `mp4`
    - `deviceId`: string (tùy chọn; từ `camera.list`)
  - Payload phản hồi:
    - `format: "mp4"`
    - `base64: "<...>"`
    - `durationMs`
    - `hasAudio`

### Yêu cầu tiền cảnh

Giống như `canvas.*`, node iOS chỉ cho phép các lệnh `camera.*` khi ở **tiền cảnh**. Các lời gọi chạy nền trả về `NODE_BACKGROUND_UNAVAILABLE`.

### Trợ giúp CLI (tệp tạm + MEDIA)

Cách dễ nhất để lấy tệp đính kèm là qua trợ giúp CLI, công cụ này ghi media đã giải mã vào một tệp tạm và in ra `MEDIA:<path>`.

Ví dụ:

```bash
openclaw nodes camera snap --node <id>               # default: both front + back (2 MEDIA lines)
openclaw nodes camera snap --node <id> --facing front
openclaw nodes camera clip --node <id> --duration 3000
openclaw nodes camera clip --node <id> --no-audio
```

Ghi chú:

- `nodes camera snap` mặc định là **cả hai** hướng camera để agent có cả hai góc nhìn.
- Các tệp đầu ra là tạm thời (trong thư mục tạm của hệ điều hành) trừ khi bạn tự xây dựng wrapper.

## Node Android

### Cài đặt người dùng (mặc định bật)

- Trang Cài đặt Android → **Camera** → **Allow Camera** (`camera.enabled`)
  - Mặc định: **bật** (thiếu khóa được coi là đã bật).
  - Khi tắt: các lệnh `camera.*` trả về `CAMERA_DISABLED`.

### Quyền

- Android yêu cầu quyền tại thời điểm chạy:
  - `CAMERA` cho cả `camera.snap` và `camera.clip`.
  - `RECORD_AUDIO` cho `camera.clip` khi `includeAudio=true`.

Nếu thiếu quyền, ứng dụng sẽ nhắc khi có thể; nếu bị từ chối, các yêu cầu `camera.*` sẽ thất bại với lỗi
`*_PERMISSION_REQUIRED`.

### Yêu cầu tiền cảnh

Giống như `canvas.*`, node Android chỉ cho phép các lệnh `camera.*` khi ở **tiền cảnh**. Các lời gọi chạy nền trả về `NODE_BACKGROUND_UNAVAILABLE`.

### Bảo vệ payload

Ảnh được nén lại để giữ payload base64 dưới 5 MB.

## Ứng dụng macOS

### Cài đặt người dùng (mặc định tắt)

Ứng dụng đồng hành macOS cung cấp một ô chọn:

- **Settings → General → Allow Camera** (`openclaw.cameraEnabled`)
  - Mặc định: **tắt**
  - Khi tắt: các yêu cầu camera trả về “Camera disabled by user”.

### Trợ giúp CLI (node invoke)

Sử dụng CLI chính `openclaw` để gọi các lệnh camera trên node macOS.

Ví dụ:

```bash
openclaw nodes camera list --node <id>            # list camera ids
openclaw nodes camera snap --node <id>            # prints MEDIA:<path>
openclaw nodes camera snap --node <id> --max-width 1280
openclaw nodes camera snap --node <id> --delay-ms 2000
openclaw nodes camera snap --node <id> --device-id <id>
openclaw nodes camera clip --node <id> --duration 10s          # prints MEDIA:<path>
openclaw nodes camera clip --node <id> --duration-ms 3000      # prints MEDIA:<path> (legacy flag)
openclaw nodes camera clip --node <id> --device-id <id>
openclaw nodes camera clip --node <id> --no-audio
```

Ghi chú:

- `openclaw nodes camera snap` mặc định là `maxWidth=1600` trừ khi bị ghi đè.
- Trên macOS, `camera.snap` chờ `delayMs` (mặc định 2000ms) sau khi làm ấm/ổn định phơi sáng trước khi chụp.
- Payload ảnh được nén lại để giữ base64 dưới 5 MB.

## An toàn + giới hạn thực tế

- Quyền truy cập camera và microphone sẽ kích hoạt các hộp thoại quyền của hệ điều hành (và yêu cầu chuỗi mô tả sử dụng trong Info.plist).
- Các clip video bị giới hạn (hiện tại `<= 60s`) để tránh payload node quá lớn (chi phí base64 + giới hạn thông điệp).

## Video màn hình macOS (cấp hệ điều hành)

Đối với video _màn hình_ (không phải camera), hãy dùng ứng dụng đồng hành macOS:

```bash
openclaw nodes screen record --node <id> --duration 10s --fps 15   # prints MEDIA:<path>
```

Ghi chú:

- Yêu cầu quyền **Screen Recording** của macOS (TCC).
