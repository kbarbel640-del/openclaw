---
summary: "Cách OpenClaw xoay vòng hồ sơ xác thực và chuyển sang dự phòng giữa các mô hình"
read_when:
  - Chẩn đoán việc xoay vòng hồ sơ xác thực, thời gian cooldown, hoặc hành vi dự phòng mô hình
  - Cập nhật các quy tắc failover cho hồ sơ xác thực hoặc mô hình
title: "Dự phòng mô hình"
x-i18n:
  source_path: concepts/model-failover.md
  source_hash: eab7c0633824d941
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:06:51Z
---

# Dự phòng mô hình

OpenClaw xử lý lỗi theo hai giai đoạn:

1. **Xoay vòng hồ sơ xác thực** trong cùng một nhà cung cấp.
2. **Dự phòng mô hình** sang mô hình tiếp theo trong `agents.defaults.model.fallbacks`.

Tài liệu này giải thích các quy tắc khi chạy và dữ liệu đứng sau chúng.

## Lưu trữ xác thực (khóa + OAuth)

OpenClaw sử dụng **hồ sơ xác thực** cho cả khóa API và token OAuth.

- Bí mật được lưu trong `~/.openclaw/agents/<agentId>/agent/auth-profiles.json` (legacy: `~/.openclaw/agent/auth-profiles.json`).
- Cấu hình `auth.profiles` / `auth.order` chỉ là **metadata + định tuyến** (không chứa bí mật).
- Tệp OAuth legacy chỉ để nhập: `~/.openclaw/credentials/oauth.json` (được nhập vào `auth-profiles.json` khi dùng lần đầu).

Chi tiết thêm: [/concepts/oauth](/concepts/oauth)

Các loại thông tin xác thực:

- `type: "api_key"` → `{ provider, key }`
- `type: "oauth"` → `{ provider, access, refresh, expires, email? }` (+ `projectId`/`enterpriseUrl` cho một số nhà cung cấp)

## ID hồ sơ

Đăng nhập OAuth tạo ra các hồ sơ riêng biệt để nhiều tài khoản có thể cùng tồn tại.

- Mặc định: `provider:default` khi không có email.
- OAuth có email: `provider:<email>` (ví dụ `google-antigravity:user@gmail.com`).

Các hồ sơ nằm trong `~/.openclaw/agents/<agentId>/agent/auth-profiles.json` dưới `profiles`.

## Thứ tự xoay vòng

Khi một nhà cung cấp có nhiều hồ sơ, OpenClaw chọn thứ tự như sau:

1. **Cấu hình tường minh**: `auth.order[provider]` (nếu được đặt).
2. **Hồ sơ đã cấu hình**: `auth.profiles` được lọc theo nhà cung cấp.
3. **Hồ sơ đã lưu**: các mục trong `auth-profiles.json` cho nhà cung cấp đó.

Nếu không có thứ tự tường minh, OpenClaw dùng vòng tròn (round‑robin):

- **Khóa chính:** loại hồ sơ (**OAuth trước khóa API**).
- **Khóa phụ:** `usageStats.lastUsed` (cũ nhất trước, trong từng loại).
- **Hồ sơ đang cooldown/bị vô hiệu hóa** được đẩy về cuối, sắp theo thời điểm hết hạn sớm nhất.

### Ghim theo phiên (thân thiện với cache)

OpenClaw **ghim hồ sơ xác thực đã chọn theo từng phiên** để giữ cache của nhà cung cấp luôn ấm.
Nó **không** xoay vòng ở mỗi yêu cầu. Hồ sơ được ghim sẽ được dùng lại cho đến khi:

- phiên được đặt lại (`/new` / `/reset`)
- một lần nén (compaction) hoàn tất (bộ đếm compaction tăng)
- hồ sơ vào trạng thái cooldown/bị vô hiệu hóa

Việc chọn thủ công qua `/model …@<profileId>` đặt **ghi đè của người dùng** cho phiên đó
và sẽ không tự xoay vòng cho đến khi bắt đầu phiên mới.

Các hồ sơ được ghim tự động (do bộ định tuyến phiên chọn) được xem là **ưu tiên**:
chúng được thử trước, nhưng OpenClaw có thể xoay sang hồ sơ khác khi gặp giới hạn tốc độ/timeout.
Hồ sơ do người dùng ghim sẽ bị khóa vào hồ sơ đó; nếu nó thất bại và có cấu hình dự phòng mô hình,
OpenClaw sẽ chuyển sang mô hình tiếp theo thay vì đổi hồ sơ.

### Vì sao OAuth có thể “trông như bị mất”

Nếu bạn có cả hồ sơ OAuth và hồ sơ khóa API cho cùng một nhà cung cấp, vòng tròn có thể chuyển giữa chúng qua các tin nhắn nếu không ghim. Để buộc dùng một hồ sơ duy nhất:

- Ghim bằng `auth.order[provider] = ["provider:profileId"]`, hoặc
- Dùng ghi đè theo phiên qua `/model …` với ghi đè hồ sơ (khi UI/bề mặt chat của bạn hỗ trợ).

## Cooldown

Khi một hồ sơ thất bại do lỗi xác thực/giới hạn tốc độ (hoặc timeout trông giống giới hạn tốc độ),
OpenClaw đánh dấu hồ sơ đó vào cooldown và chuyển sang hồ sơ tiếp theo.
Các lỗi định dạng/yêu cầu không hợp lệ (ví dụ lỗi xác thực ID gọi công cụ Cloud Code Assist)
được xem là đủ điều kiện failover và dùng cùng cơ chế cooldown.

Cooldown dùng backoff theo cấp số nhân:

- 1 phút
- 5 phút
- 25 phút
- 1 giờ (giới hạn)

Trạng thái được lưu trong `auth-profiles.json` dưới `usageStats`:

```json
{
  "usageStats": {
    "provider:profile": {
      "lastUsed": 1736160000000,
      "cooldownUntil": 1736160600000,
      "errorCount": 2
    }
  }
}
```

## Vô hiệu hóa do thanh toán

Các lỗi thanh toán/tín dụng (ví dụ “không đủ tín dụng” / “số dư tín dụng quá thấp”) được xem là đủ điều kiện failover, nhưng thường không mang tính tạm thời. Thay vì cooldown ngắn, OpenClaw đánh dấu hồ sơ là **bị vô hiệu hóa** (với backoff dài hơn) và xoay sang hồ sơ/nhà cung cấp tiếp theo.

Trạng thái được lưu trong `auth-profiles.json`:

```json
{
  "usageStats": {
    "provider:profile": {
      "disabledUntil": 1736178000000,
      "disabledReason": "billing"
    }
  }
}
```

Mặc định:

- Backoff thanh toán bắt đầu từ **5 giờ**, tăng gấp đôi cho mỗi lần lỗi thanh toán, và giới hạn ở **24 giờ**.
- Bộ đếm backoff được đặt lại nếu hồ sơ không thất bại trong **24 giờ** (có thể cấu hình).

## Dự phòng mô hình

Nếu tất cả hồ sơ của một nhà cung cấp đều thất bại, OpenClaw chuyển sang mô hình tiếp theo trong
`agents.defaults.model.fallbacks`. Áp dụng cho lỗi xác thực, giới hạn tốc độ và
timeout đã làm cạn xoay vòng hồ sơ (các lỗi khác không làm tiến trình dự phòng).

Khi một lần chạy bắt đầu với ghi đè mô hình (hooks hoặc CLI), dự phòng vẫn kết thúc tại
`agents.defaults.model.primary` sau khi thử mọi dự phòng đã cấu hình.

## Cấu hình liên quan

Xem [Cấu hình Gateway](/gateway/configuration) để biết:

- `auth.profiles` / `auth.order`
- `auth.cooldowns.billingBackoffHours` / `auth.cooldowns.billingBackoffHoursByProvider`
- `auth.cooldowns.billingMaxHours` / `auth.cooldowns.failureWindowHours`
- `agents.defaults.model.primary` / `agents.defaults.model.fallbacks`
- Định tuyến `agents.defaults.imageModel`

Xem [Models](/concepts/models) để có tổng quan rộng hơn về lựa chọn mô hình và dự phòng.
