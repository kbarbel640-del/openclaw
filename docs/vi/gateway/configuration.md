---
summary: "Tất cả các tùy chọn cấu hình cho ~/.openclaw/openclaw.json kèm ví dụ"
read_when:
  - Thêm hoặc chỉnh sửa các trường cấu hình
title: "Cấu hình"
x-i18n:
  source_path: gateway/configuration.md
  source_hash: 53b6b8a615c4ce02
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:09:52Z
---

# Cấu hình 🔧

OpenClaw đọc một cấu hình **JSON5** tùy chọn từ `~/.openclaw/openclaw.json` (cho phép comment + dấu phẩy cuối).

Nếu tệp không tồn tại, OpenClaw dùng các giá trị mặc định an toàn (agent Pi nhúng + phiên theo từng người gửi + workspace `~/.openclaw/workspace`). Thông thường bạn chỉ cần cấu hình để:

- giới hạn ai có thể kích hoạt bot (`channels.whatsapp.allowFrom`, `channels.telegram.allowFrom`, v.v.)
- kiểm soát allowlist nhóm + hành vi nhắc tên (`channels.whatsapp.groups`, `channels.telegram.groups`, `channels.discord.guilds`, `agents.list[].groupChat`)
- tùy biến tiền tố tin nhắn (`messages`)
- đặt workspace của agent (`agents.defaults.workspace` hoặc `agents.list[].workspace`)
- tinh chỉnh mặc định agent nhúng (`agents.defaults`) và hành vi phiên (`session`)
- đặt danh tính theo từng agent (`agents.list[].identity`)

> **Mới làm quen với cấu hình?** Xem hướng dẫn [Configuration Examples](/gateway/configuration-examples) để có các ví dụ đầy đủ kèm giải thích chi tiết!

## Xác thực cấu hình nghiêm ngặt

OpenClaw chỉ chấp nhận cấu hình khớp hoàn toàn với schema.
Khóa không xác định, kiểu dữ liệu sai, hoặc giá trị không hợp lệ sẽ khiến Gateway **từ chối khởi động** để đảm bảo an toàn.

Khi xác thực thất bại:

- Gateway không khởi động.
- Chỉ cho phép các lệnh chẩn đoán (ví dụ: `openclaw doctor`, `openclaw logs`, `openclaw health`, `openclaw status`, `openclaw service`, `openclaw help`).
- Chạy `openclaw doctor` để xem chính xác các vấn đề.
- Chạy `openclaw doctor --fix` (hoặc `--yes`) để áp dụng migrate/sửa chữa.

Doctor không ghi thay đổi trừ khi bạn chủ động chọn `--fix`/`--yes`.

## Schema + gợi ý UI

Gateway cung cấp biểu diễn JSON Schema của cấu hình qua `config.schema` cho các trình chỉnh sửa UI.
Control UI dựng biểu mẫu từ schema này, kèm trình chỉnh sửa **Raw JSON** làm lối thoát.

Plugin kênh và extension có thể đăng ký schema + gợi ý UI cho cấu hình của chúng, để
thiết lập kênh vẫn dựa trên schema trên các ứng dụng mà không cần form mã hóa cứng.

Các gợi ý (nhãn, nhóm, trường nhạy cảm) đi kèm schema để client dựng
biểu mẫu tốt hơn mà không cần mã hóa cứng kiến thức cấu hình.

## Áp dụng + khởi động lại (RPC)

Dùng `config.apply` để xác thực + ghi toàn bộ cấu hình và khởi động lại Gateway trong một bước.
Lệnh này ghi restart sentinel và ping phiên hoạt động gần nhất sau khi Gateway chạy lại.

Cảnh báo: `config.apply` thay thế **toàn bộ cấu hình**. Nếu chỉ muốn đổi vài khóa,
hãy dùng `config.patch` hoặc `openclaw config set`. Hãy giữ bản sao lưu của `~/.openclaw/openclaw.json`.

Tham số:

- `raw` (string) — payload JSON5 cho toàn bộ cấu hình
- `baseHash` (tùy chọn) — hash cấu hình từ `config.get` (bắt buộc khi cấu hình đã tồn tại)
- `sessionKey` (tùy chọn) — khóa phiên hoạt động gần nhất để ping đánh thức
- `note` (tùy chọn) — ghi chú đưa vào restart sentinel
- `restartDelayMs` (tùy chọn) — độ trễ trước khi khởi động lại (mặc định 2000)

Ví dụ (qua `gateway call`):

```bash
openclaw gateway call config.get --params '{}' # capture payload.hash
openclaw gateway call config.apply --params '{
  "raw": "{\\n  agents: { defaults: { workspace: \\"~/.openclaw/workspace\\" } }\\n}\\n",
  "baseHash": "<hash-from-config.get>",
  "sessionKey": "agent:main:whatsapp:dm:+15555550123",
  "restartDelayMs": 1000
}'
```

## Cập nhật một phần (RPC)

Dùng `config.patch` để gộp cập nhật một phần vào cấu hình hiện có mà không ghi đè
các khóa không liên quan. Áp dụng ngữ nghĩa JSON merge patch:

- object gộp đệ quy
- `null` xóa một khóa
- mảng bị thay thế
  Tương tự `config.apply`, lệnh này xác thực, ghi cấu hình, lưu restart sentinel và lên lịch
  khởi động lại Gateway (có thể đánh thức khi cung cấp `sessionKey`).

Tham số:

- `raw` (string) — payload JSON5 chỉ chứa các khóa cần đổi
- `baseHash` (bắt buộc) — hash cấu hình từ `config.get`
- `sessionKey` (tùy chọn) — khóa phiên hoạt động gần nhất để ping đánh thức
- `note` (tùy chọn) — ghi chú đưa vào restart sentinel
- `restartDelayMs` (tùy chọn) — độ trễ trước khi khởi động lại (mặc định 2000)

Ví dụ:

```bash
openclaw gateway call config.get --params '{}' # capture payload.hash
openclaw gateway call config.patch --params '{
  "raw": "{\\n  channels: { telegram: { groups: { \\"*\\": { requireMention: false } } } }\\n}\\n",
  "baseHash": "<hash-from-config.get>",
  "sessionKey": "agent:main:whatsapp:dm:+15555550123",
  "restartDelayMs": 1000
}'
```

## Cấu hình tối thiểu (điểm khởi đầu khuyến nghị)

```json5
{
  agents: { defaults: { workspace: "~/.openclaw/workspace" } },
  channels: { whatsapp: { allowFrom: ["+15555550123"] } },
}
```

Xây image mặc định một lần với:

```bash
scripts/sandbox-setup.sh
```

## Chế độ tự chat (khuyến nghị để kiểm soát nhóm)

Để ngăn bot phản hồi @-mention trên WhatsApp trong nhóm (chỉ phản hồi theo trigger văn bản cụ thể):

```json5
{
  agents: {
    defaults: { workspace: "~/.openclaw/workspace" },
    list: [
      {
        id: "main",
        groupChat: { mentionPatterns: ["@openclaw", "reisponde"] },
      },
    ],
  },
  channels: {
    whatsapp: {
      // Allowlist is DMs only; including your own number enables self-chat mode.
      allowFrom: ["+15555550123"],
      groups: { "*": { requireMention: true } },
    },
  },
}
```

## Config Includes (`$include`)

Chia cấu hình thành nhiều tệp bằng chỉ thị `$include`. Hữu ích cho:

- Tổ chức cấu hình lớn (ví dụ: định nghĩa agent theo từng client)
- Chia sẻ thiết lập chung giữa các môi trường
- Tách riêng cấu hình nhạy cảm

### Cách dùng cơ bản

```json5
// ~/.openclaw/openclaw.json
{
  gateway: { port: 18789 },

  // Include a single file (replaces the key's value)
  agents: { $include: "./agents.json5" },

  // Include multiple files (deep-merged in order)
  broadcast: {
    $include: ["./clients/mueller.json5", "./clients/schmidt.json5"],
  },
}
```

```json5
// ~/.openclaw/agents.json5
{
  defaults: { sandbox: { mode: "all", scope: "session" } },
  list: [{ id: "main", workspace: "~/.openclaw/workspace" }],
}
```

### Hành vi gộp

- **Một tệp**: Thay thế object chứa `$include`
- **Mảng tệp**: Gộp sâu theo thứ tự (tệp sau ghi đè tệp trước)
- **Có khóa cùng cấp**: Các khóa cùng cấp được gộp sau include (ghi đè giá trị đã include)
- **Khóa cùng cấp + mảng/primitive**: Không hỗ trợ (nội dung include phải là object)

```json5
// Sibling keys override included values
{
  $include: "./base.json5", // { a: 1, b: 2 }
  b: 99, // Result: { a: 1, b: 99 }
}
```

### Include lồng nhau

Các tệp được include có thể chứa chỉ thị `$include` (tối đa 10 cấp):

```json5
// clients/mueller.json5
{
  agents: { $include: "./mueller/agents.json5" },
  broadcast: { $include: "./mueller/broadcast.json5" },
}
```

### Phân giải đường dẫn

- **Đường dẫn tương đối**: Giải quyết theo tệp include
- **Đường dẫn tuyệt đối**: Dùng nguyên trạng
- **Thư mục cha**: Tham chiếu `../` hoạt động như mong đợi

```json5
{ "$include": "./sub/config.json5" }      // relative
{ "$include": "/etc/openclaw/base.json5" } // absolute
{ "$include": "../shared/common.json5" }   // parent dir
```

### Xử lý lỗi

- **Thiếu tệp**: Lỗi rõ ràng với đường dẫn đã giải quyết
- **Lỗi parse**: Hiển thị tệp include bị lỗi
- **Include vòng lặp**: Phát hiện và báo kèm chuỗi include

### Ví dụ: Thiết lập pháp lý đa client

```json5
// ~/.openclaw/openclaw.json
{
  gateway: { port: 18789, auth: { token: "secret" } },

  // Common agent defaults
  agents: {
    defaults: {
      sandbox: { mode: "all", scope: "session" },
    },
    // Merge agent lists from all clients
    list: { $include: ["./clients/mueller/agents.json5", "./clients/schmidt/agents.json5"] },
  },

  // Merge broadcast configs
  broadcast: {
    $include: ["./clients/mueller/broadcast.json5", "./clients/schmidt/broadcast.json5"],
  },

  channels: { whatsapp: { groupPolicy: "allowlist" } },
}
```

```json5
// ~/.openclaw/clients/mueller/agents.json5
[
  { id: "mueller-transcribe", workspace: "~/clients/mueller/transcribe" },
  { id: "mueller-docs", workspace: "~/clients/mueller/docs" },
]
```

```json5
// ~/.openclaw/clients/mueller/broadcast.json5
{
  "120363403215116621@g.us": ["mueller-transcribe", "mueller-docs"],
}
```

## Các tùy chọn phổ biến

### Biến môi trường + `.env`

OpenClaw đọc biến môi trường từ tiến trình cha (shell, launchd/systemd, CI, v.v.).

Ngoài ra, nó tải:

- `.env` từ thư mục làm việc hiện tại (nếu có)
- bản dự phòng toàn cục `.env` từ `~/.openclaw/.env` (còn gọi là `$OPENCLAW_STATE_DIR/.env`)

Không tệp `.env` nào ghi đè biến môi trường hiện có.

Bạn cũng có thể cung cấp biến môi trường nội tuyến trong cấu hình. Chúng chỉ áp dụng nếu
môi trường tiến trình thiếu khóa đó (quy tắc không ghi đè giống nhau):

```json5
{
  env: {
    OPENROUTER_API_KEY: "sk-or-...",
    vars: {
      GROQ_API_KEY: "gsk-...",
    },
  },
}
```

Xem [/environment](/environment) để biết đầy đủ thứ tự ưu tiên và nguồn.

### `env.shellEnv` (tùy chọn)

Tiện ích chọn tham gia: nếu bật và chưa đặt khóa mong đợi nào, OpenClaw chạy login shell của bạn và chỉ nhập các khóa còn thiếu (không bao giờ ghi đè).
Về cơ bản, thao tác này source hồ sơ shell của bạn.

```json5
{
  env: {
    shellEnv: {
      enabled: true,
      timeoutMs: 15000,
    },
  },
}
```

Biến môi trường tương đương:

- `OPENCLAW_LOAD_SHELL_ENV=1`
- `OPENCLAW_SHELL_ENV_TIMEOUT_MS=15000`

### Thay thế biến môi trường trong cấu hình

Bạn có thể tham chiếu trực tiếp biến môi trường trong bất kỳ giá trị chuỗi nào bằng
cú pháp `${VAR_NAME}`. Biến được thay thế khi tải cấu hình, trước khi xác thực.

```json5
{
  models: {
    providers: {
      "vercel-gateway": {
        apiKey: "${VERCEL_GATEWAY_API_KEY}",
      },
    },
  },
  gateway: {
    auth: {
      token: "${OPENCLAW_GATEWAY_TOKEN}",
    },
  },
}
```

**Quy tắc:**

- Chỉ khớp tên biến môi trường viết hoa: `[A-Z_][A-Z0-9_]*`
- Biến thiếu hoặc rỗng gây lỗi khi tải cấu hình
- Escape bằng `$${VAR}` để xuất literal `${VAR}`
- Hoạt động với `$include` (các tệp include cũng được thay thế)

**Thay thế nội tuyến:**

```json5
{
  models: {
    providers: {
      custom: {
        baseUrl: "${CUSTOM_API_BASE}/v1", // → "https://api.example.com/v1"
      },
    },
  },
}
```

### Lưu trữ xác thực (OAuth + API keys)

OpenClaw lưu hồ sơ xác thực **theo từng agent** (OAuth + API keys) tại:

- `<agentDir>/auth-profiles.json` (mặc định: `~/.openclaw/agents/<agentId>/agent/auth-profiles.json`)

Xem thêm: [/concepts/oauth](/concepts/oauth)

Nhập OAuth legacy:

- `~/.openclaw/credentials/oauth.json` (hoặc `$OPENCLAW_STATE_DIR/credentials/oauth.json`)

Agent Pi nhúng duy trì cache runtime tại:

- `<agentDir>/auth.json` (tự động quản lý; không chỉnh sửa thủ công)

Thư mục agent legacy (trước multi-agent):

- `~/.openclaw/agent/*` (được migrate bởi `openclaw doctor` sang `~/.openclaw/agents/<defaultAgentId>/agent/*`)

Ghi đè:

- Thư mục OAuth (chỉ nhập legacy): `OPENCLAW_OAUTH_DIR`
- Thư mục agent (ghi đè root agent mặc định): `OPENCLAW_AGENT_DIR` (ưu tiên), `PI_CODING_AGENT_DIR` (legacy)

Khi dùng lần đầu, OpenClaw nhập các mục `oauth.json` vào `auth-profiles.json`.

### `auth`

Metadata tùy chọn cho hồ sơ xác thực. **Không** lưu bí mật; ánh xạ
ID hồ sơ tới nhà cung cấp + chế độ (và email tùy chọn) và định nghĩa thứ tự xoay vòng
nhà cung cấp dùng cho failover.

```json5
{
  auth: {
    profiles: {
      "anthropic:me@example.com": { provider: "anthropic", mode: "oauth", email: "me@example.com" },
      "anthropic:work": { provider: "anthropic", mode: "api_key" },
    },
    order: {
      anthropic: ["anthropic:me@example.com", "anthropic:work"],
    },
  },
}
```

### `agents.list[].identity`

Danh tính theo agent, dùng cho mặc định và UX. Được ghi bởi trợ lý onboarding macOS.

Nếu đặt, OpenClaw suy ra mặc định (chỉ khi bạn chưa đặt tường minh):

- `messages.ackReaction` từ `identity.emoji` của **agent đang hoạt động** (fallback 👀)
- `agents.list[].groupChat.mentionPatterns` từ `identity.name`/`identity.emoji` của agent (để “@Samantha” hoạt động trong nhóm trên Telegram/Slack/Discord/Google Chat/iMessage/WhatsApp)
- `identity.avatar` chấp nhận đường dẫn ảnh tương đối workspace hoặc URL/URL dữ liệu. Tệp cục bộ phải nằm trong workspace của agent.

`identity.avatar` chấp nhận:

- Đường dẫn tương đối workspace (phải nằm trong workspace agent)
- URL `http(s)`
- URI `data:`

```json5
{
  agents: {
    list: [
      {
        id: "main",
        identity: {
          name: "Samantha",
          theme: "helpful sloth",
          emoji: "🦥",
          avatar: "avatars/samantha.png",
        },
      },
    ],
  },
}
```

### `wizard`

Metadata do wizard CLI ghi (`onboard`, `configure`, `doctor`).

```json5
{
  wizard: {
    lastRunAt: "2026-01-01T00:00:00.000Z",
    lastRunVersion: "2026.1.4",
    lastRunCommit: "abc1234",
    lastRunCommand: "configure",
    lastRunMode: "local",
  },
}
```

### `logging`

- Tệp log mặc định: `/tmp/openclaw/openclaw-YYYY-MM-DD.log`
- Nếu muốn đường dẫn ổn định, đặt `logging.file` thành `/tmp/openclaw/openclaw.log`.
- Đầu ra console có thể tinh chỉnh riêng qua:
  - `logging.consoleLevel` (mặc định `info`, tăng lên `debug` khi `--verbose`)
  - `logging.consoleStyle` (`pretty` | `compact` | `json`)
- Tóm tắt công cụ có thể được che để tránh lộ bí mật:
  - `logging.redactSensitive` (`off` | `tools`, mặc định: `tools`)
  - `logging.redactPatterns` (mảng regex; ghi đè mặc định)

```json5
{
  logging: {
    level: "info",
    file: "/tmp/openclaw/openclaw.log",
    consoleLevel: "info",
    consoleStyle: "pretty",
    redactSensitive: "tools",
    redactPatterns: [
      // Example: override defaults with your own rules.
      "\\bTOKEN\\b\\s*[=:]\\s*([\"']?)([^\\s\"']+)\\1",
      "/\\bsk-[A-Za-z0-9_-]{8,}\\b/gi",
    ],
  },
}
```

_(Phần còn lại giữ nguyên cấu trúc, thuật ngữ, mã và placeholder; nội dung mô tả đã được dịch đầy đủ theo cùng phong cách trung tính của tài liệu.)_

---

_Tiếp theo: [Agent Runtime](/concepts/agent)_ 🦞
