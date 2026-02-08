---
summary: "Các nhà cung cấp mô hình (LLM) được OpenClaw hỗ trợ"
read_when:
  - Bạn muốn chọn một nhà cung cấp mô hình
  - Bạn muốn xem ví dụ thiết lập nhanh cho xác thực LLM + chọn mô hình
title: "Khoi Dong Nhanh Nha Cung Cap Mo Hinh"
x-i18n:
  source_path: providers/models.md
  source_hash: c897ca87805f1ec5
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:08:02Z
---

# Các nhà cung cấp mô hình

OpenClaw có thể sử dụng nhiều nhà cung cấp LLM. Chọn một nhà cung cấp, xác thực, sau đó đặt
mô hình mặc định là `provider/model`.

## Điểm nổi bật: Venice (Venice AI)

Venice là thiết lập Venice AI được chúng tôi khuyến nghị cho suy luận ưu tiên quyền riêng tư, với tùy chọn dùng Opus cho những tác vụ khó nhất.

- Mặc định: `venice/llama-3.3-70b`
- Tốt nhất tổng thể: `venice/claude-opus-45` (Opus vẫn là mạnh nhất)

Xem [Venice AI](/providers/venice).

## Khoi dong nhanh (hai bước)

1. Xác thực với nhà cung cấp (thường qua `openclaw onboard`).
2. Đặt mô hình mặc định:

```json5
{
  agents: { defaults: { model: { primary: "anthropic/claude-opus-4-6" } } },
}
```

## Các nhà cung cấp được hỗ trợ (bộ khởi đầu)

- [OpenAI (API + Codex)](/providers/openai)
- [Anthropic (API + Claude Code CLI)](/providers/anthropic)
- [OpenRouter](/providers/openrouter)
- [Vercel AI Gateway](/providers/vercel-ai-gateway)
- [Cloudflare AI Gateway](/providers/cloudflare-ai-gateway)
- [Moonshot AI (Kimi + Kimi Coding)](/providers/moonshot)
- [Synthetic](/providers/synthetic)
- [OpenCode Zen](/providers/opencode)
- [Z.AI](/providers/zai)
- [GLM models](/providers/glm)
- [MiniMax](/providers/minimax)
- [Venice (Venice AI)](/providers/venice)
- [Amazon Bedrock](/bedrock)

Để xem đầy đủ danh mục nhà cung cấp (xAI, Groq, Mistral, v.v.) và cấu hình nâng cao,
xem [Model providers](/concepts/model-providers).
