---
summary: "Sử dụng MiniMax M2.1 trong OpenClaw"
read_when:
  - Bạn muốn dùng các mô hình MiniMax trong OpenClaw
  - Bạn cần hướng dẫn thiết lập MiniMax
title: "MiniMax"
x-i18n:
  source_path: providers/minimax.md
  source_hash: 5bbd47fa3327e40c
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:08:12Z
---

# MiniMax

MiniMax là một công ty AI xây dựng họ mô hình **M2/M2.1**. Bản phát hành hiện tại tập trung vào lập trình là **MiniMax M2.1** (23 tháng 12, 2025), được xây dựng cho các tác vụ phức tạp trong thế giới thực.

Nguồn: [Ghi chú phát hành MiniMax M2.1](https://www.minimax.io/news/minimax-m21)

## Tổng quan mô hình (M2.1)

MiniMax nêu bật các cải tiến sau trong M2.1:

- **Lập trình đa ngôn ngữ** mạnh hơn (Rust, Java, Go, C++, Kotlin, Objective-C, TS/JS).
- **Phát triển web/app** tốt hơn và chất lượng đầu ra thẩm mỹ cao hơn (bao gồm mobile native).
- Cải thiện xử lý **chỉ dẫn tổng hợp** cho các quy trình làm việc kiểu văn phòng, dựa trên tư duy đan xen và thực thi ràng buộc tích hợp.
- **Phản hồi súc tích hơn** với mức sử dụng token thấp hơn và vòng lặp lặp lại nhanh hơn.
- Khả năng tương thích **framework tool/agent** và quản lý ngữ cảnh mạnh hơn (Claude Code, Droid/Factory AI, Cline, Kilo Code, Roo Code, BlackBox).
- Đầu ra **đối thoại và viết kỹ thuật** chất lượng cao hơn.

## MiniMax M2.1 so với MiniMax M2.1 Lightning

- **Tốc độ:** Lightning là biến thể “nhanh” trong tài liệu giá của MiniMax.
- **Chi phí:** Bảng giá cho thấy cùng chi phí đầu vào, nhưng Lightning có chi phí đầu ra cao hơn.
- **Định tuyến gói lập trình:** Backend Lightning không khả dụng trực tiếp trong gói lập trình MiniMax. MiniMax tự động định tuyến hầu hết yêu cầu sang Lightning, nhưng sẽ quay về backend M2.1 thông thường khi lưu lượng tăng đột biến.

## Chọn cách thiết lập

### MiniMax OAuth (Coding Plan) — khuyến nghị

**Phù hợp nhất cho:** thiết lập nhanh với MiniMax Coding Plan qua OAuth, không cần API key.

Bật plugin OAuth đi kèm và xác thực:

```bash
openclaw plugins enable minimax-portal-auth  # skip if already loaded.
openclaw gateway restart  # restart if gateway is already running
openclaw onboard --auth-choice minimax-portal
```

Bạn sẽ được nhắc chọn một endpoint:

- **Global** - Người dùng quốc tế (`api.minimax.io`)
- **CN** - Người dùng tại Trung Quốc (`api.minimaxi.com`)

Xem chi tiết tại [README plugin MiniMax OAuth](https://github.com/openclaw/openclaw/tree/main/extensions/minimax-portal-auth).

### MiniMax M2.1 (API key)

**Phù hợp nhất cho:** MiniMax được lưu trữ với API tương thích Anthropic.

Cấu hình qua CLI:

- Chạy `openclaw configure`
- Chọn **Model/auth**
- Chọn **MiniMax M2.1**

```json5
{
  env: { MINIMAX_API_KEY: "sk-..." },
  agents: { defaults: { model: { primary: "minimax/MiniMax-M2.1" } } },
  models: {
    mode: "merge",
    providers: {
      minimax: {
        baseUrl: "https://api.minimax.io/anthropic",
        apiKey: "${MINIMAX_API_KEY}",
        api: "anthropic-messages",
        models: [
          {
            id: "MiniMax-M2.1",
            name: "MiniMax M2.1",
            reasoning: false,
            input: ["text"],
            cost: { input: 15, output: 60, cacheRead: 2, cacheWrite: 10 },
            contextWindow: 200000,
            maxTokens: 8192,
          },
        ],
      },
    },
  },
}
```

### MiniMax M2.1 làm dự phòng (Opus chính)

**Phù hợp nhất cho:** giữ Opus 4.6 làm chính, chuyển sang MiniMax M2.1 khi gặp sự cố.

```json5
{
  env: { MINIMAX_API_KEY: "sk-..." },
  agents: {
    defaults: {
      models: {
        "anthropic/claude-opus-4-6": { alias: "opus" },
        "minimax/MiniMax-M2.1": { alias: "minimax" },
      },
      model: {
        primary: "anthropic/claude-opus-4-6",
        fallbacks: ["minimax/MiniMax-M2.1"],
      },
    },
  },
}
```

### Tùy chọn: Cục bộ qua LM Studio (thủ công)

**Phù hợp nhất cho:** suy luận cục bộ với LM Studio.
Chúng tôi đã thấy kết quả rất tốt với MiniMax M2.1 trên phần cứng mạnh (ví dụ:
máy bàn/máy chủ) khi dùng máy chủ cục bộ của LM Studio.

Cấu hình thủ công qua `openclaw.json`:

```json5
{
  agents: {
    defaults: {
      model: { primary: "lmstudio/minimax-m2.1-gs32" },
      models: { "lmstudio/minimax-m2.1-gs32": { alias: "Minimax" } },
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

## Cấu hình qua `openclaw configure`

Dùng trình hướng dẫn cấu hình tương tác để thiết lập MiniMax mà không cần chỉnh JSON:

1. Chạy `openclaw configure`.
2. Chọn **Model/auth**.
3. Chọn **MiniMax M2.1**.
4. Chọn mô hình mặc định khi được nhắc.

## Tùy chọn cấu hình

- `models.providers.minimax.baseUrl`: ưu tiên `https://api.minimax.io/anthropic` (tương thích Anthropic); `https://api.minimax.io/v1` là tùy chọn cho payload tương thích OpenAI.
- `models.providers.minimax.api`: ưu tiên `anthropic-messages`; `openai-completions` là tùy chọn cho payload tương thích OpenAI.
- `models.providers.minimax.apiKey`: API key MiniMax (`MINIMAX_API_KEY`).
- `models.providers.minimax.models`: định nghĩa `id`, `name`, `reasoning`, `contextWindow`, `maxTokens`, `cost`.
- `agents.defaults.models`: đặt bí danh cho các mô hình bạn muốn trong allowlist.
- `models.mode`: giữ `merge` nếu bạn muốn thêm MiniMax song song với các mô hình tích hợp sẵn.

## Ghi chú

- Tham chiếu mô hình là `minimax/<model>`.
- API sử dụng Coding Plan: `https://api.minimaxi.com/v1/api/openplatform/coding_plan/remains` (yêu cầu khóa coding plan).
- Cập nhật giá trong `models.json` nếu bạn cần theo dõi chi phí chính xác.
- Link giới thiệu cho MiniMax Coding Plan (giảm 10%): https://platform.minimax.io/subscribe/coding-plan?code=DbXJTRClnb&source=link
- Xem [/concepts/model-providers](/concepts/model-providers) để biết quy tắc nhà cung cấp.
- Dùng `openclaw models list` và `openclaw models set minimax/MiniMax-M2.1` để chuyển đổi.

## Xử lý sự cố

### “Unknown model: minimax/MiniMax-M2.1”

Điều này thường có nghĩa là **nhà cung cấp MiniMax chưa được cấu hình** (không có mục provider
và không tìm thấy hồ sơ xác thực MiniMax/khóa env). Bản sửa cho việc phát hiện này có trong
**2026.1.12** (chưa phát hành tại thời điểm viết). Cách khắc phục:

- Nâng cấp lên **2026.1.12** (hoặc chạy từ mã nguồn `main`), sau đó khởi động lại gateway.
- Chạy `openclaw configure` và chọn **MiniMax M2.1**, hoặc
- Thêm khối `models.providers.minimax` thủ công, hoặc
- Thiết lập `MINIMAX_API_KEY` (hoặc một hồ sơ xác thực MiniMax) để provider có thể được chèn vào.

Đảm bảo id mô hình **phân biệt chữ hoa/chữ thường**:

- `minimax/MiniMax-M2.1`
- `minimax/MiniMax-M2.1-lightning`

Sau đó kiểm tra lại bằng:

```bash
openclaw models list
```
