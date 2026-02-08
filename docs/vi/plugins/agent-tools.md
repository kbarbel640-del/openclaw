---
summary: "Viết công cụ tác tử trong một plugin (schema, công cụ tùy chọn, allowlist)"
read_when:
  - Bạn muốn thêm một công cụ tác tử mới trong một plugin
  - Bạn cần biến một công cụ thành tùy chọn thông qua allowlist
title: "Công cụ tác tử của plugin"
x-i18n:
  source_path: plugins/agent-tools.md
  source_hash: 4479462e9d8b17b6
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:07:58Z
---

# Công cụ tác tử của plugin

Các plugin OpenClaw có thể đăng ký **công cụ tác tử** (hàm JSON‑schema) được phơi bày
cho LLM trong quá trình chạy tác tử. Công cụ có thể là **bắt buộc** (luôn sẵn sàng) hoặc
**tùy chọn** (opt‑in).

Công cụ tác tử được cấu hình dưới `tools` trong cấu hình chính, hoặc theo từng tác tử dưới
`agents.list[].tools`. Chính sách allowlist/denylist kiểm soát những công cụ mà tác tử
có thể gọi.

## Công cụ cơ bản

```ts
import { Type } from "@sinclair/typebox";

export default function (api) {
  api.registerTool({
    name: "my_tool",
    description: "Do a thing",
    parameters: Type.Object({
      input: Type.String(),
    }),
    async execute(_id, params) {
      return { content: [{ type: "text", text: params.input }] };
    },
  });
}
```

## Công cụ tùy chọn (opt‑in)

Công cụ tùy chọn **không bao giờ** được bật tự động. Người dùng phải thêm chúng vào
allowlist của tác tử.

```ts
export default function (api) {
  api.registerTool(
    {
      name: "workflow_tool",
      description: "Run a local workflow",
      parameters: {
        type: "object",
        properties: {
          pipeline: { type: "string" },
        },
        required: ["pipeline"],
      },
      async execute(_id, params) {
        return { content: [{ type: "text", text: params.pipeline }] };
      },
    },
    { optional: true },
  );
}
```

Bật công cụ tùy chọn trong `agents.list[].tools.allow` (hoặc toàn cục `tools.allow`):

```json5
{
  agents: {
    list: [
      {
        id: "main",
        tools: {
          allow: [
            "workflow_tool", // specific tool name
            "workflow", // plugin id (enables all tools from that plugin)
            "group:plugins", // all plugin tools
          ],
        },
      },
    ],
  },
}
```

Các nút cấu hình khác ảnh hưởng đến khả năng sẵn sàng của công cụ:

- Allowlists chỉ nêu tên công cụ plugin được xem là opt‑in cho plugin; các công cụ lõi vẫn
  được bật trừ khi bạn cũng đưa công cụ lõi hoặc nhóm vào allowlist.
- `tools.profile` / `agents.list[].tools.profile` (allowlist cơ sở)
- `tools.byProvider` / `agents.list[].tools.byProvider` (cho phép/từ chối theo nhà cung cấp)
- `tools.sandbox.tools.*` (chính sách công cụ sandbox khi trong sandbox)

## Quy tắc + mẹo

- Tên công cụ **không** được trùng với tên công cụ lõi; các công cụ xung đột sẽ bị bỏ qua.
- ID plugin dùng trong allowlist không được trùng với tên công cụ lõi.
- Ưu tiên `optional: true` cho các công cụ gây ra tác dụng phụ hoặc yêu cầu thêm
  binary/thông tin xác thực.
