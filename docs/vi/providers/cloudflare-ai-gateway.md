---
title: "Cloudflare AI Gateway"
summary: "Thiết lập Cloudflare AI Gateway (xác thực + chọn mô hình)"
read_when:
  - Bạn muốn sử dụng Cloudflare AI Gateway với OpenClaw
  - Bạn cần account ID, gateway ID, hoặc biến môi trường API key
x-i18n:
  source_path: providers/cloudflare-ai-gateway.md
  source_hash: db77652c37652ca2
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:07:59Z
---

# Cloudflare AI Gateway

Cloudflare AI Gateway đứng trước các API của nhà cung cấp và cho phép bạn thêm phân tích, bộ nhớ đệm và các kiểm soát. Với Anthropic, OpenClaw sử dụng Anthropic Messages API thông qua endpoint Gateway của bạn.

- Provider: `cloudflare-ai-gateway`
- Base URL: `https://gateway.ai.cloudflare.com/v1/<account_id>/<gateway_id>/anthropic`
- Default model: `cloudflare-ai-gateway/claude-sonnet-4-5`
- API key: `CLOUDFLARE_AI_GATEWAY_API_KEY` (API key của nhà cung cấp cho các yêu cầu đi qua Gateway)

Với các mô hình Anthropic, hãy sử dụng Anthropic API key của bạn.

## Khoi dong nhanh

1. Thiết lập API key của nhà cung cấp và chi tiết Gateway:

```bash
openclaw onboard --auth-choice cloudflare-ai-gateway-api-key
```

2. Thiết lập mô hình mặc định:

```json5
{
  agents: {
    defaults: {
      model: { primary: "cloudflare-ai-gateway/claude-sonnet-4-5" },
    },
  },
}
```

## Ví dụ không tương tác

```bash
openclaw onboard --non-interactive \
  --mode local \
  --auth-choice cloudflare-ai-gateway-api-key \
  --cloudflare-ai-gateway-account-id "your-account-id" \
  --cloudflare-ai-gateway-gateway-id "your-gateway-id" \
  --cloudflare-ai-gateway-api-key "$CLOUDFLARE_AI_GATEWAY_API_KEY"
```

## Gateway có xác thực

Nếu bạn đã bật xác thực Gateway trong Cloudflare, hãy thêm header `cf-aig-authorization` (điều này là bổ sung ngoài API key của nhà cung cấp).

```json5
{
  models: {
    providers: {
      "cloudflare-ai-gateway": {
        headers: {
          "cf-aig-authorization": "Bearer <cloudflare-ai-gateway-token>",
        },
      },
    },
  },
}
```

## Ghi chú về môi trường

Nếu Gateway chạy như một daemon (launchd/systemd), hãy đảm bảo `CLOUDFLARE_AI_GATEWAY_API_KEY` có sẵn cho tiến trình đó (ví dụ, trong `~/.openclaw/.env` hoặc thông qua `env.shellEnv`).
