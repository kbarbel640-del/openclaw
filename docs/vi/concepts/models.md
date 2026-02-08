---
summary: "CLI Models: liệt kê, đặt, bí danh, dự phòng, quét, trạng thái"
read_when:
  - Thêm hoặc chỉnh sửa CLI models (models list/set/scan/aliases/fallbacks)
  - Thay đổi hành vi dự phòng mô hình hoặc UX chọn mô hình
  - Cập nhật các probe quét mô hình (công cụ/hình ảnh)
title: "CLI Models"
x-i18n:
  source_path: concepts/models.md
  source_hash: c4eeb0236c645b55
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:06:54Z
---

# CLI Models

Xem [/concepts/model-failover](/concepts/model-failover) để biết về luân phiên hồ sơ xác thực,
thời gian hạ nhiệt và cách chúng tương tác với fallbacks.
Tổng quan nhanh về nhà cung cấp + ví dụ: [/concepts/model-providers](/concepts/model-providers).

## Cách chọn mô hình hoạt động

OpenClaw chọn mô hình theo thứ tự sau:

1. Mô hình **Primary** (`agents.defaults.model.primary` hoặc `agents.defaults.model`).
2. **Fallbacks** trong `agents.defaults.model.fallbacks` (theo thứ tự).
3. **Failover xác thực của nhà cung cấp** xảy ra bên trong một nhà cung cấp trước khi chuyển sang
   mô hình tiếp theo.

Liên quan:

- `agents.defaults.models` là allowlist/danh mục các mô hình OpenClaw có thể dùng (kèm bí danh).
- `agents.defaults.imageModel` được dùng **chỉ khi** mô hình primary không chấp nhận hình ảnh.
- Mặc định theo từng agent có thể ghi đè `agents.defaults.model` thông qua `agents.list[].model` cộng với bindings (xem [/concepts/multi-agent](/concepts/multi-agent)).

## Gợi ý chọn mô hình nhanh (kinh nghiệm)

- **GLM**: nhỉnh hơn một chút cho coding/gọi công cụ.
- **MiniMax**: tốt hơn cho viết lách và cảm xúc.

## Setup wizard (khuyến nghị)

Nếu bạn không muốn chỉnh sửa cấu hình thủ công, hãy chạy wizard onboarding:

```bash
openclaw onboard
```

Wizard có thể thiết lập mô hình + xác thực cho các nhà cung cấp phổ biến, bao gồm **OpenAI Code (Codex)
subscription** (OAuth) và **Anthropic** (khuyến nghị API key; cũng hỗ trợ `claude
setup-token`).

## Khóa cấu hình (tổng quan)

- `agents.defaults.model.primary` và `agents.defaults.model.fallbacks`
- `agents.defaults.imageModel.primary` và `agents.defaults.imageModel.fallbacks`
- `agents.defaults.models` (allowlist + bí danh + tham số nhà cung cấp)
- `models.providers` (nhà cung cấp tùy chỉnh được ghi vào `models.json`)

Tham chiếu mô hình được chuẩn hóa về chữ thường. Bí danh nhà cung cấp như `z.ai/*` được chuẩn hóa
thành `zai/*`.

Ví dụ cấu hình nhà cung cấp (bao gồm OpenCode Zen) nằm tại
[/gateway/configuration](/gateway/configuration#opencode-zen-multi-model-proxy).

## “Model is not allowed” (và vì sao phản hồi dừng lại)

Nếu `agents.defaults.models` được đặt, nó trở thành **allowlist** cho `/model` và cho
các override theo session. Khi người dùng chọn một mô hình không nằm trong allowlist đó,
OpenClaw trả về:

```
Model "provider/model" is not allowed. Use /model to list available models.
```

Điều này xảy ra **trước** khi tạo phản hồi bình thường, nên tin nhắn có thể có cảm giác
như “không phản hồi”. Cách khắc phục là:

- Thêm mô hình vào `agents.defaults.models`, hoặc
- Xóa allowlist (loại bỏ `agents.defaults.models`), hoặc
- Chọn một mô hình từ `/model list`.

Ví dụ cấu hình allowlist:

```json5
{
  agent: {
    model: { primary: "anthropic/claude-sonnet-4-5" },
    models: {
      "anthropic/claude-sonnet-4-5": { alias: "Sonnet" },
      "anthropic/claude-opus-4-6": { alias: "Opus" },
    },
  },
}
```

## Chuyển mô hình trong chat (`/model`)

Bạn có thể chuyển mô hình cho session hiện tại mà không cần khởi động lại:

```
/model
/model list
/model 3
/model openai/gpt-5.2
/model status
```

Ghi chú:

- `/model` (và `/model list`) là bộ chọn gọn nhẹ, đánh số (họ mô hình + các nhà cung cấp khả dụng).
- `/model <#>` chọn từ bộ chọn đó.
- `/model status` là chế độ xem chi tiết (các ứng viên xác thực và, khi được cấu hình, endpoint nhà cung cấp `baseUrl` + chế độ `api`).
- Tham chiếu mô hình được phân tích bằng cách tách theo `/` **đầu tiên**. Dùng `provider/model` khi gõ `/model <ref>`.
- Nếu chính ID mô hình chứa `/` (kiểu OpenRouter), bạn phải bao gồm tiền tố nhà cung cấp (ví dụ: `/model openrouter/moonshotai/kimi-k2`).
- Nếu bạn bỏ qua nhà cung cấp, OpenClaw coi đầu vào là một bí danh hoặc một mô hình cho **nhà cung cấp mặc định** (chỉ hoạt động khi không có `/` trong ID mô hình).

Hành vi/lựa chọn cấu hình đầy đủ của lệnh: [Slash commands](/tools/slash-commands).

## Lệnh CLI

```bash
openclaw models list
openclaw models status
openclaw models set <provider/model>
openclaw models set-image <provider/model>

openclaw models aliases list
openclaw models aliases add <alias> <provider/model>
openclaw models aliases remove <alias>

openclaw models fallbacks list
openclaw models fallbacks add <provider/model>
openclaw models fallbacks remove <provider/model>
openclaw models fallbacks clear

openclaw models image-fallbacks list
openclaw models image-fallbacks add <provider/model>
openclaw models image-fallbacks remove <provider/model>
openclaw models image-fallbacks clear
```

`openclaw models` (không có subcommand) là lối tắt cho `models status`.

### `models list`

Mặc định hiển thị các mô hình đã cấu hình. Các cờ hữu ích:

- `--all`: toàn bộ catalog
- `--local`: chỉ các nhà cung cấp cục bộ
- `--provider <name>`: lọc theo nhà cung cấp
- `--plain`: mỗi mô hình một dòng
- `--json`: đầu ra đọc được bằng máy

### `models status`

Hiển thị mô hình primary đã resolve, fallbacks, mô hình hình ảnh, và tổng quan xác thực
của các nhà cung cấp đã cấu hình. Nó cũng hiển thị trạng thái hết hạn OAuth cho các hồ sơ
tìm thấy trong kho xác thực (mặc định cảnh báo trong vòng 24h). `--plain` chỉ in ra
mô hình primary đã resolve.
Trạng thái OAuth luôn được hiển thị (và được bao gồm trong đầu ra `--json`). Nếu một
nhà cung cấp đã cấu hình không có thông tin xác thực, `models status` sẽ in ra mục **Missing auth**.
JSON bao gồm `auth.oauth` (cửa sổ cảnh báo + hồ sơ) và `auth.providers`
(xác thực hiệu lực theo từng nhà cung cấp).
Dùng `--check` cho tự động hóa (thoát `1` khi thiếu/hết hạn, `2` khi sắp hết hạn).

Xác thực Anthropic được ưu tiên là Claude Code CLI setup-token (chạy ở bất kỳ đâu; nếu cần thì dán trên host Gateway):

```bash
claude setup-token
openclaw models status
```

## Quét (các mô hình miễn phí của OpenRouter)

`openclaw models scan` kiểm tra **danh mục mô hình miễn phí** của OpenRouter và có thể
tùy chọn probe các mô hình để kiểm tra hỗ trợ công cụ và hình ảnh.

Các cờ chính:

- `--no-probe`: bỏ qua probe trực tiếp (chỉ metadata)
- `--min-params <b>`: kích thước tham số tối thiểu (tỷ)
- `--max-age-days <days>`: bỏ qua các mô hình cũ
- `--provider <name>`: bộ lọc tiền tố nhà cung cấp
- `--max-candidates <n>`: kích thước danh sách fallback
- `--set-default`: đặt `agents.defaults.model.primary` thành lựa chọn đầu tiên
- `--set-image`: đặt `agents.defaults.imageModel.primary` thành lựa chọn hình ảnh đầu tiên

Probe yêu cầu API key OpenRouter (từ hồ sơ xác thực hoặc
`OPENROUTER_API_KEY`). Không có key, dùng `--no-probe` để chỉ liệt kê các ứng viên.

Kết quả quét được xếp hạng theo:

1. Hỗ trợ hình ảnh
2. Độ trễ công cụ
3. Kích thước context
4. Số lượng tham số

Đầu vào

- Danh sách `/models` của OpenRouter (lọc `:free`)
- Yêu cầu API key OpenRouter từ hồ sơ xác thực hoặc `OPENROUTER_API_KEY` (xem [/environment](/environment))
- Bộ lọc tùy chọn: `--max-age-days`, `--min-params`, `--provider`, `--max-candidates`
- Điều khiển probe: `--timeout`, `--concurrency`

Khi chạy trong TTY, bạn có thể chọn fallbacks tương tác. Ở chế độ không tương tác,
truyền `--yes` để chấp nhận mặc định.

## Registry mô hình (`models.json`)

Các nhà cung cấp tùy chỉnh trong `models.providers` được ghi vào `models.json` dưới
thư mục agent (mặc định `~/.openclaw/agents/<agentId>/models.json`). Tệp này
được merge theo mặc định trừ khi `models.mode` được đặt thành `replace`.
