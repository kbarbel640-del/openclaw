---
summary: "Sử dụng Anthropic Claude qua khóa API hoặc setup-token trong OpenClaw"
read_when:
  - Bạn muốn sử dụng các mô hình Anthropic trong OpenClaw
  - Bạn muốn dùng setup-token thay vì khóa API
title: "Anthropic"
x-i18n:
  source_path: providers/anthropic.md
  source_hash: 5e50b3bca35be37e
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:08:04Z
---

# Anthropic (Claude)

Anthropic xây dựng họ mô hình **Claude** và cung cấp quyền truy cập qua API.
Trong OpenClaw, bạn có thể xác thực bằng khóa API hoặc **setup-token**.

## Tùy chọn A: Khóa API Anthropic

**Phù hợp nhất cho:** truy cập API tiêu chuẩn và thanh toán theo mức sử dụng.
Tạo khóa API của bạn trong Anthropic Console.

### Thiết lập CLI

```bash
openclaw onboard
# choose: Anthropic API key

# or non-interactive
openclaw onboard --anthropic-api-key "$ANTHROPIC_API_KEY"
```

### Đoạn cấu hình

```json5
{
  env: { ANTHROPIC_API_KEY: "sk-ant-..." },
  agents: { defaults: { model: { primary: "anthropic/claude-opus-4-6" } } },
}
```

## Lưu đệm prompt (Anthropic API)

OpenClaw hỗ trợ tính năng lưu đệm prompt của Anthropic. Đây là **chỉ dành cho API**; xác thực bằng thuê bao không áp dụng cài đặt bộ nhớ đệm.

### Cấu hình

Sử dụng tham số `cacheRetention` trong cấu hình mô hình của bạn:

| Giá trị | Thời gian lưu đệm | Mô tả                               |
| ------- | ----------------- | ----------------------------------- |
| `none`  | Không lưu đệm     | Tắt lưu đệm prompt                  |
| `short` | 5 phút            | Mặc định cho xác thực bằng khóa API |
| `long`  | 1 giờ             | Lưu đệm mở rộng (cần cờ beta)       |

```json5
{
  agents: {
    defaults: {
      models: {
        "anthropic/claude-opus-4-6": {
          params: { cacheRetention: "long" },
        },
      },
    },
  },
}
```

### Mặc định

Khi sử dụng xác thực bằng khóa API Anthropic, OpenClaw tự động áp dụng `cacheRetention: "short"` (lưu đệm 5 phút) cho tất cả các mô hình Anthropic. Bạn có thể ghi đè bằng cách đặt rõ ràng `cacheRetention` trong cấu hình.

### Tham số cũ

Tham số `cacheControlTtl` cũ hơn vẫn được hỗ trợ để tương thích ngược:

- `"5m"` ánh xạ tới `short`
- `"1h"` ánh xạ tới `long`

Chúng tôi khuyến nghị chuyển sang tham số `cacheRetention` mới.

OpenClaw bao gồm cờ beta `extended-cache-ttl-2025-04-11` cho các yêu cầu API Anthropic;
hãy giữ cờ này nếu bạn ghi đè header của nhà cung cấp (xem [/gateway/configuration](/gateway/configuration)).

## Tùy chọn B: Claude setup-token

**Phù hợp nhất cho:** sử dụng gói thuê bao Claude của bạn.

### Nơi lấy setup-token

Setup-token được tạo bởi **Claude Code CLI**, không phải Anthropic Console. Bạn có thể chạy công cụ này trên **bất kỳ máy nào**:

```bash
claude setup-token
```

Dán token vào OpenClaw (trình hướng dẫn: **Anthropic token (dán setup-token)**), hoặc chạy trên máy chủ gateway:

```bash
openclaw models auth setup-token --provider anthropic
```

Nếu bạn tạo token trên một máy khác, hãy dán nó:

```bash
openclaw models auth paste-token --provider anthropic
```

### Thiết lập CLI

```bash
# Paste a setup-token during onboarding
openclaw onboard --auth-choice setup-token
```

### Đoạn cấu hình

```json5
{
  agents: { defaults: { model: { primary: "anthropic/claude-opus-4-6" } } },
}
```

## Ghi chú

- Tạo setup-token bằng `claude setup-token` và dán vào, hoặc chạy `openclaw models auth setup-token` trên máy chủ gateway.
- Nếu bạn thấy thông báo “OAuth token refresh failed …” với thuê bao Claude, hãy xác thực lại bằng setup-token. Xem [/gateway/troubleshooting#oauth-token-refresh-failed-anthropic-claude-subscription](/gateway/troubleshooting#oauth-token-refresh-failed-anthropic-claude-subscription).
- Chi tiết xác thực + quy tắc tái sử dụng nằm tại [/concepts/oauth](/concepts/oauth).

## Xử lý sự cố

**Lỗi 401 / token đột ngột không hợp lệ**

- Xác thực thuê bao Claude có thể hết hạn hoặc bị thu hồi. Chạy lại `claude setup-token`
  và dán vào **máy chủ gateway**.
- Nếu đăng nhập Claude CLI nằm trên một máy khác, hãy dùng
  `openclaw models auth paste-token --provider anthropic` trên máy chủ gateway.

**Không tìm thấy khóa API cho nhà cung cấp "anthropic"**

- Xác thực là **theo từng tác tử**. Các tác tử mới không kế thừa khóa của tác tử chính.
- Chạy lại onboarding cho tác tử đó, hoặc dán setup-token / khóa API trên
  máy chủ gateway, sau đó xác minh bằng `openclaw models status`.

**Không tìm thấy thông tin xác thực cho hồ sơ `anthropic:default`**

- Chạy `openclaw models status` để xem hồ sơ xác thực nào đang hoạt động.
- Chạy lại onboarding, hoặc dán setup-token / khóa API cho hồ sơ đó.

**Không có hồ sơ xác thực khả dụng (tất cả đang trong thời gian chờ/không khả dụng)**

- Kiểm tra `openclaw models status --json` cho `auth.unusableProfiles`.
- Thêm một hồ sơ Anthropic khác hoặc chờ hết thời gian chờ.

Xem thêm: [/gateway/troubleshooting](/gateway/troubleshooting) và [/help/faq](/help/faq).
