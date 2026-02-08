---
summary: "Chạy OpenClaw với LLM cục bộ (LM Studio, vLLM, LiteLLM, các endpoint OpenAI tùy chỉnh)"
read_when:
  - Bạn muốn phục vụ mô hình từ máy GPU riêng
  - Bạn đang kết nối LM Studio hoặc một proxy tương thích OpenAI
  - Bạn cần hướng dẫn an toàn nhất cho mô hình cục bộ
title: "Mô hình cục bộ"
x-i18n:
  source_path: gateway/local-models.md
  source_hash: 63a7cc8b114355c6
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:07:14Z
---

# Mô hình cục bộ

Chạy cục bộ là khả thi, nhưng OpenClaw yêu cầu ngữ cảnh lớn và cơ chế phòng vệ mạnh trước prompt injection. Card nhỏ sẽ cắt ngữ cảnh và làm rò rỉ an toàn. Hãy đặt mục tiêu cao: **≥2 Mac Studio tối đa cấu hình hoặc dàn GPU tương đương (~$30k+)**. Một GPU **24 GB** chỉ phù hợp với prompt nhẹ hơn và độ trễ cao hơn. Hãy dùng **biến thể mô hình lớn/đầy đủ nhất có thể chạy**; các checkpoint bị nén mạnh hoặc “nhỏ” làm tăng rủi ro prompt injection (xem [Security](/gateway/security)).

## Khuyến nghị: LM Studio + MiniMax M2.1 (Responses API, bản đầy đủ)

Ngăn xếp cục bộ tốt nhất hiện nay. Tải MiniMax M2.1 trong LM Studio, bật máy chủ cục bộ (mặc định `http://127.0.0.1:1234`), và dùng Responses API để tách phần suy luận khỏi văn bản cuối.

```json5
{
  agents: {
    defaults: {
      model: { primary: "lmstudio/minimax-m2.1-gs32" },
      models: {
        "anthropic/claude-opus-4-6": { alias: "Opus" },
        "lmstudio/minimax-m2.1-gs32": { alias: "Minimax" },
      },
    },
  },
  models: {
    mode: "merge",
    providers: {
      lmstudio: {
        baseUrl: "http://127.0.0.1:1234/v1",
        apiKey: "lmstudio",
        api: "openai-responses",
        models: [
          {
            id: "minimax-m2.1-gs32",
            name: "MiniMax M2.1 GS32",
            reasoning: false,
            input: ["text"],
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
            contextWindow: 196608,
            maxTokens: 8192,
          },
        ],
      },
    },
  },
}
```

**Danh sách thiết lập**

- Cài LM Studio: https://lmstudio.ai
- Trong LM Studio, tải **bản MiniMax M2.1 lớn nhất có sẵn** (tránh biến thể “small”/nén mạnh), khởi động máy chủ, xác nhận `http://127.0.0.1:1234/v1/models` có liệt kê mô hình.
- Giữ mô hình luôn được nạp; nạp lạnh làm tăng độ trễ khởi động.
- Điều chỉnh `contextWindow`/`maxTokens` nếu bản LM Studio của bạn khác.
- Với WhatsApp, hãy dùng Responses API để chỉ gửi văn bản cuối.

Giữ cấu hình mô hình hosted ngay cả khi chạy cục bộ; dùng `models.mode: "merge"` để các phương án dự phòng luôn sẵn sàng.

### Cấu hình lai: hosted chính, cục bộ dự phòng

```json5
{
  agents: {
    defaults: {
      model: {
        primary: "anthropic/claude-sonnet-4-5",
        fallbacks: ["lmstudio/minimax-m2.1-gs32", "anthropic/claude-opus-4-6"],
      },
      models: {
        "anthropic/claude-sonnet-4-5": { alias: "Sonnet" },
        "lmstudio/minimax-m2.1-gs32": { alias: "MiniMax Local" },
        "anthropic/claude-opus-4-6": { alias: "Opus" },
      },
    },
  },
  models: {
    mode: "merge",
    providers: {
      lmstudio: {
        baseUrl: "http://127.0.0.1:1234/v1",
        apiKey: "lmstudio",
        api: "openai-responses",
        models: [
          {
            id: "minimax-m2.1-gs32",
            name: "MiniMax M2.1 GS32",
            reasoning: false,
            input: ["text"],
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
            contextWindow: 196608,
            maxTokens: 8192,
          },
        ],
      },
    },
  },
}
```

### Ưu tiên cục bộ với lưới an toàn hosted

Hoán đổi thứ tự chính và dự phòng; giữ cùng khối provider và `models.mode: "merge"` để có thể rơi về Sonnet hoặc Opus khi máy cục bộ ngừng hoạt động.

### Lưu trữ theo khu vực / định tuyến dữ liệu

- Các biến thể MiniMax/Kimi/GLM hosted cũng có trên OpenRouter với endpoint cố định theo khu vực (ví dụ: đặt tại Mỹ). Chọn biến thể theo khu vực ở đó để giữ lưu lượng trong phạm vi pháp lý bạn chọn, đồng thời vẫn dùng `models.mode: "merge"` cho các phương án dự phòng Anthropic/OpenAI.
- Chỉ cục bộ vẫn là con đường bảo mật mạnh nhất; định tuyến hosted theo khu vực là phương án trung gian khi bạn cần tính năng của nhà cung cấp nhưng muốn kiểm soát luồng dữ liệu.

## Các proxy cục bộ khác tương thích OpenAI

vLLM, LiteLLM, OAI-proxy hoặc gateway tùy chỉnh đều hoạt động nếu chúng cung cấp endpoint kiểu OpenAI `/v1`. Thay khối provider ở trên bằng endpoint và ID mô hình của bạn:

```json5
{
  models: {
    mode: "merge",
    providers: {
      local: {
        baseUrl: "http://127.0.0.1:8000/v1",
        apiKey: "sk-local",
        api: "openai-responses",
        models: [
          {
            id: "my-local-model",
            name: "Local Model",
            reasoning: false,
            input: ["text"],
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
            contextWindow: 120000,
            maxTokens: 8192,
          },
        ],
      },
    },
  },
}
```

Giữ `models.mode: "merge"` để các mô hình hosted vẫn sẵn sàng làm dự phòng.

## Xử lý sự cố

- Gateway có truy cập được proxy không? `curl http://127.0.0.1:1234/v1/models`.
- Mô hình LM Studio bị dỡ? Nạp lại; khởi động lạnh là nguyên nhân “treo” phổ biến.
- Lỗi ngữ cảnh? Giảm `contextWindow` hoặc tăng giới hạn máy chủ.
- An toàn: mô hình cục bộ bỏ qua bộ lọc phía nhà cung cấp; giữ agent hẹp và bật nén để hạn chế bán kính ảnh hưởng của prompt injection.
