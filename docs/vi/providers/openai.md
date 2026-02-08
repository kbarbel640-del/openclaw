---
summary: "Sử dụng OpenAI qua khóa API hoặc đăng ký Codex trong OpenClaw"
read_when:
  - Bạn muốn sử dụng các mô hình OpenAI trong OpenClaw
  - Bạn muốn xác thực bằng đăng ký Codex thay vì khóa API
title: "OpenAI"
x-i18n:
  source_path: providers/openai.md
  source_hash: 13d8fd7f1f935b0a
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:08:05Z
---

# OpenAI

OpenAI cung cấp các API cho nhà phát triển đối với các mô hình GPT. Codex hỗ trợ **đăng nhập ChatGPT** cho quyền truy cập theo đăng ký hoặc **đăng nhập bằng khóa API** cho quyền truy cập tính phí theo mức sử dụng. Codex cloud yêu cầu đăng nhập ChatGPT.

## Tùy chọn A: Khóa API OpenAI (Nền tảng OpenAI)

**Phù hợp nhất cho:** truy cập API trực tiếp và thanh toán theo mức sử dụng.
Lấy khóa API của bạn từ bảng điều khiển OpenAI.

### Thiết lập CLI

```bash
openclaw onboard --auth-choice openai-api-key
# or non-interactive
openclaw onboard --openai-api-key "$OPENAI_API_KEY"
```

### Đoạn cấu hình

```json5
{
  env: { OPENAI_API_KEY: "sk-..." },
  agents: { defaults: { model: { primary: "openai/gpt-5.1-codex" } } },
}
```

## Tùy chọn B: Đăng ký OpenAI Code (Codex)

**Phù hợp nhất cho:** sử dụng quyền truy cập theo đăng ký ChatGPT/Codex thay vì khóa API.
Codex cloud yêu cầu đăng nhập ChatGPT, trong khi Codex CLI hỗ trợ đăng nhập bằng ChatGPT hoặc khóa API.

### Thiết lập CLI

```bash
# Run Codex OAuth in the wizard
openclaw onboard --auth-choice openai-codex

# Or run OAuth directly
openclaw models auth login --provider openai-codex
```

### Đoạn cấu hình

```json5
{
  agents: { defaults: { model: { primary: "openai-codex/gpt-5.3-codex" } } },
}
```

## Ghi chú

- Tham chiếu mô hình luôn sử dụng `provider/model` (xem [/concepts/models](/concepts/models)).
- Chi tiết xác thực + quy tắc tái sử dụng nằm tại [/concepts/oauth](/concepts/oauth).
