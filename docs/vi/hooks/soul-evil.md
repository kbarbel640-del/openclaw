---
summary: "Hook SOUL Evil (hoán đổi SOUL.md bằng SOUL_EVIL.md)"
read_when:
  - Bạn muốn bật hoặc tinh chỉnh hook SOUL Evil
  - Bạn muốn một cửa sổ purge hoặc hoán đổi persona theo xác suất ngẫu nhiên
title: "Hook SOUL Evil"
x-i18n:
  source_path: hooks/soul-evil.md
  source_hash: cc32c1e207f2b692
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:07:20Z
---

# Hook SOUL Evil

Hook SOUL Evil hoán đổi nội dung **được tiêm** `SOUL.md` bằng `SOUL_EVIL.md` trong
một cửa sổ purge hoặc theo xác suất ngẫu nhiên. Nó **không** sửa đổi các tệp trên đĩa.

## Cách Hoạt Động

Khi `agent:bootstrap` chạy, hook có thể thay thế nội dung `SOUL.md` trong bộ nhớ
trước khi system prompt được lắp ráp. Nếu `SOUL_EVIL.md` bị thiếu hoặc rỗng,
OpenClaw ghi log cảnh báo và giữ `SOUL.md` bình thường.

Các lần chạy sub-agent **không** bao gồm `SOUL.md` trong các tệp bootstrap của chúng, vì vậy hook này
không có tác dụng với sub-agent.

## Bật

```bash
openclaw hooks enable soul-evil
```

Sau đó đặt cấu hình:

```json
{
  "hooks": {
    "internal": {
      "enabled": true,
      "entries": {
        "soul-evil": {
          "enabled": true,
          "file": "SOUL_EVIL.md",
          "chance": 0.1,
          "purge": { "at": "21:00", "duration": "15m" }
        }
      }
    }
  }
}
```

Tạo `SOUL_EVIL.md` trong thư mục gốc workspace của agent (bên cạnh `SOUL.md`).

## Tùy Chọn

- `file` (chuỗi): tên tệp SOUL thay thế (mặc định: `SOUL_EVIL.md`)
- `chance` (số 0–1): xác suất ngẫu nhiên mỗi lần chạy để dùng `SOUL_EVIL.md`
- `purge.at` (HH:mm): thời điểm bắt đầu purge hằng ngày (định dạng 24 giờ)
- `purge.duration` (thời lượng): độ dài cửa sổ (ví dụ: `30s`, `10m`, `1h`)

**Thứ tự ưu tiên:** cửa sổ purge thắng xác suất.

**Múi giờ:** dùng `agents.defaults.userTimezone` khi được đặt; nếu không thì dùng múi giờ của máy chủ.

## Ghi Chú

- Không có tệp nào được ghi hoặc sửa đổi trên đĩa.
- Nếu `SOUL.md` không nằm trong danh sách bootstrap, hook sẽ không làm gì.

## Xem Thêm

- [Hooks](/hooks)
