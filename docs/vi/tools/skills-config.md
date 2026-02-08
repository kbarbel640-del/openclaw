---
summary: "Lược đồ cau hinh Skills và ví dụ"
read_when:
  - Thêm hoặc chỉnh sửa cau hinh Skills
  - Điều chỉnh allowlist đi kèm hoặc hành vi cài đặt
title: "Cau hinh Skills"
x-i18n:
  source_path: tools/skills-config.md
  source_hash: e265c93da7856887
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:08:44Z
---

# Cau hinh Skills

Tất cả cấu hình liên quan đến skills nằm dưới `skills` trong `~/.openclaw/openclaw.json`.

```json5
{
  skills: {
    allowBundled: ["gemini", "peekaboo"],
    load: {
      extraDirs: ["~/Projects/agent-scripts/skills", "~/Projects/oss/some-skill-pack/skills"],
      watch: true,
      watchDebounceMs: 250,
    },
    install: {
      preferBrew: true,
      nodeManager: "npm", // npm | pnpm | yarn | bun (Gateway runtime still Node; bun not recommended)
    },
    entries: {
      "nano-banana-pro": {
        enabled: true,
        apiKey: "GEMINI_KEY_HERE",
        env: {
          GEMINI_API_KEY: "GEMINI_KEY_HERE",
        },
      },
      peekaboo: { enabled: true },
      sag: { enabled: false },
    },
  },
}
```

## Các trường

- `allowBundled`: allowlist tùy chọn chỉ dành cho các skills **bundled**. Khi được đặt, chỉ
  các bundled skills trong danh sách mới đủ điều kiện (skills managed/workspace không bị ảnh hưởng).
- `load.extraDirs`: các thư mục skills bổ sung để quét (độ ưu tiên thấp nhất).
- `load.watch`: theo dõi các thư mục skill và làm mới snapshot skills (mặc định: true).
- `load.watchDebounceMs`: thời gian debounce cho các sự kiện watcher của skill tính bằng mili giây (mặc định: 250).
- `install.preferBrew`: ưu tiên trình cài đặt brew khi có sẵn (mặc định: true).
- `install.nodeManager`: tuỳ chọn trình cài đặt node (`npm` | `pnpm` | `yarn` | `bun`, mặc định: npm).
  Tuỳ chọn này chỉ ảnh hưởng đến **việc cài đặt skill**; runtime Gateway vẫn nên là Node
  (không khuyến nghị Bun cho WhatsApp/Telegram).
- `entries.<skillKey>`: ghi đè theo từng skill.

Các trường theo từng skill:

- `enabled`: đặt `false` để vô hiệu hoá một skill ngay cả khi nó được bundled/cài đặt.
- `env`: các biến môi trường được inject cho lần chạy agent (chỉ khi chưa được đặt).
- `apiKey`: tuỳ chọn tiện lợi cho các skills khai báo một biến môi trường chính.

## Ghi chú

- Các khoá dưới `entries` mặc định ánh xạ theo tên skill. Nếu một skill định nghĩa
  `metadata.openclaw.skillKey`, hãy dùng khoá đó thay thế.
- Các thay đổi đối với skills sẽ được áp dụng ở lượt agent tiếp theo khi watcher được bật.

### Skills trong sandbox + biến môi trường

Khi một phiên được chạy **trong sandbox**, các tiến trình skill chạy bên trong Docker. Sandbox
**không** kế thừa `process.env` của máy host.

Hãy dùng một trong các cách sau:

- `agents.defaults.sandbox.docker.env` (hoặc `agents.list[].sandbox.docker.env` theo từng agent)
- bake các biến môi trường vào image sandbox tuỳ chỉnh của bạn

`env` và `skills.entries.<skill>.env/apiKey` toàn cục chỉ áp dụng cho các lần chạy trên **host**.
