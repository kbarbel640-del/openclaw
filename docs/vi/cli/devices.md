---
summary: "Tham chiếu CLI cho `openclaw devices` (ghép cặp thiết bị + xoay/thu hồi token)"
read_when:
  - Bạn đang phê duyệt các yêu cầu ghép cặp thiết bị
  - Bạn cần xoay hoặc thu hồi token thiết bị
title: "thiết bị"
x-i18n:
  source_path: cli/devices.md
  source_hash: ac7d130ecdc5d429
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:06:25Z
---

# `openclaw devices`

Quản lý các yêu cầu ghép cặp thiết bị và token theo phạm vi thiết bị.

## Lệnh

### `openclaw devices list`

Liệt kê các yêu cầu ghép cặp đang chờ và các thiết bị đã ghép cặp.

```
openclaw devices list
openclaw devices list --json
```

### `openclaw devices approve <requestId>`

Phê duyệt một yêu cầu ghép cặp thiết bị đang chờ.

```
openclaw devices approve <requestId>
```

### `openclaw devices reject <requestId>`

Từ chối một yêu cầu ghép cặp thiết bị đang chờ.

```
openclaw devices reject <requestId>
```

### `openclaw devices rotate --device <id> --role <role> [--scope <scope...>]`

Xoay token thiết bị cho một vai trò cụ thể (tùy chọn cập nhật phạm vi).

```
openclaw devices rotate --device <deviceId> --role operator --scope operator.read --scope operator.write
```

### `openclaw devices revoke --device <id> --role <role>`

Thu hồi token thiết bị cho một vai trò cụ thể.

```
openclaw devices revoke --device <deviceId> --role node
```

## Tùy chọn chung

- `--url <url>`: URL WebSocket của Gateway (mặc định là `gateway.remote.url` khi được cấu hình).
- `--token <token>`: Token Gateway (nếu cần).
- `--password <password>`: Mật khẩu Gateway (xác thực bằng mật khẩu).
- `--timeout <ms>`: Thời gian chờ RPC.
- `--json`: Đầu ra JSON (khuyến nghị cho scripting).

Lưu ý: khi bạn đặt `--url`, CLI sẽ không dự phòng sang cấu hình hoặc thông tin xác thực từ môi trường.
Hãy truyền `--token` hoặc `--password` một cách tường minh. Thiếu thông tin xác thực tường minh sẽ gây lỗi.

## Ghi chú

- Việc xoay token trả về một token mới (nhạy cảm). Hãy xử lý như một bí mật.
- Các lệnh này yêu cầu phạm vi `operator.pairing` (hoặc `operator.admin`).
