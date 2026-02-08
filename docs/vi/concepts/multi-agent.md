---
summary: "Định tuyến đa tác tử: tác tử cô lập, tài khoản kênh và các ràng buộc"
title: Định tuyến Đa Tác Tử
read_when: "Bạn muốn nhiều tác tử cô lập (workspace + xác thực) trong một tiến trình gateway."
status: active
x-i18n:
  source_path: concepts/multi-agent.md
  source_hash: 49b3ba55d8a7f0b3
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:06:57Z
---

# Định tuyến Đa Tác Tử

Mục tiêu: nhiều tác tử _cô lập_ (workspace riêng + `agentDir` + phiên), cùng nhiều tài khoản kênh (ví dụ hai WhatsApp) trong một Gateway đang chạy. Lưu lượng vào được định tuyến đến một tác tử thông qua các ràng buộc.

## “Một tác tử” là gì?

Một **tác tử** là một “bộ não” được phạm vi hóa đầy đủ với:

- **Workspace** (tệp, AGENTS.md/SOUL.md/USER.md, ghi chú cục bộ, quy tắc persona).
- **Thư mục trạng thái** (`agentDir`) cho hồ sơ xác thực, registry mô hình và cấu hình theo tác tử.
- **Kho phiên** (lịch sử chat + trạng thái định tuyến) dưới `~/.openclaw/agents/<agentId>/sessions`.

Hồ sơ xác thực là **theo từng tác tử**. Mỗi tác tử đọc từ:

```
~/.openclaw/agents/<agentId>/agent/auth-profiles.json
```

Thông tin xác thực của tác tử chính **không** được chia sẻ tự động. Không bao giờ tái sử dụng `agentDir`
giữa các tác tử (gây xung đột xác thực/phiên). Nếu bạn muốn chia sẻ thông tin xác thực,
hãy sao chép `auth-profiles.json` vào `agentDir` của tác tử kia.

Skills là theo từng tác tử thông qua thư mục `skills/` của mỗi workspace, với các skills dùng chung
có sẵn từ `~/.openclaw/skills`. Xem [Skills: theo tác tử vs dùng chung](/tools/skills#per-agent-vs-shared-skills).

Gateway có thể host **một tác tử** (mặc định) hoặc **nhiều tác tử** song song.

**Lưu ý về workspace:** workspace của mỗi tác tử là **cwd mặc định**, không phải
sandbox cứng. Đường dẫn tương đối được phân giải trong workspace, nhưng đường dẫn tuyệt đối
có thể truy cập các vị trí khác trên host trừ khi bật sandboxing. Xem
[Sandboxing](/gateway/sandboxing).

## Đường dẫn (bản đồ nhanh)

- Cấu hình: `~/.openclaw/openclaw.json` (hoặc `OPENCLAW_CONFIG_PATH`)
- Thư mục trạng thái: `~/.openclaw` (hoặc `OPENCLAW_STATE_DIR`)
- Workspace: `~/.openclaw/workspace` (hoặc `~/.openclaw/workspace-<agentId>`)
- Thư mục tác tử: `~/.openclaw/agents/<agentId>/agent` (hoặc `agents.list[].agentDir`)
- Phiên: `~/.openclaw/agents/<agentId>/sessions`

### Chế độ một tác tử (mặc định)

Nếu bạn không làm gì, OpenClaw chạy một tác tử duy nhất:

- `agentId` mặc định là **`main`**.
- Phiên được khóa theo `agent:main:<mainKey>`.
- Workspace mặc định là `~/.openclaw/workspace` (hoặc `~/.openclaw/workspace-<profile>` khi `OPENCLAW_PROFILE` được đặt).
- Trạng thái mặc định là `~/.openclaw/agents/main/agent`.

## Trợ lý tác tử

Dùng trình hướng dẫn tác tử để thêm một tác tử cô lập mới:

```bash
openclaw agents add work
```

Sau đó thêm `bindings` (hoặc để trình hướng dẫn làm) để định tuyến tin nhắn vào.

Xác minh bằng:

```bash
openclaw agents list --bindings
```

## Nhiều tác tử = nhiều người, nhiều cá tính

Với **nhiều tác tử**, mỗi `agentId` trở thành một **persona cô lập hoàn toàn**:

- **Số điện thoại/tài khoản khác nhau** (theo từng kênh `accountId`).
- **Cá tính khác nhau** (tệp workspace theo tác tử như `AGENTS.md` và `SOUL.md`).
- **Xác thực + phiên tách biệt** (không giao thoa trừ khi bật rõ ràng).

Điều này cho phép **nhiều người** dùng chung một máy chủ Gateway trong khi vẫn giữ “bộ não” AI và dữ liệu tách biệt.

## Một số WhatsApp, nhiều người (tách DM)

Bạn có thể định tuyến **các DM WhatsApp khác nhau** đến các tác tử khác nhau trong khi vẫn dùng **một tài khoản WhatsApp**. So khớp theo E.164 của người gửi (như `+15551234567`) với `peer.kind: "dm"`. Phản hồi vẫn xuất phát từ cùng một số WhatsApp (không có danh tính người gửi theo tác tử).

Chi tiết quan trọng: chat trực tiếp sẽ gộp về **khóa phiên chính** của tác tử, vì vậy để cô lập thực sự cần **một tác tử cho mỗi người**.

Ví dụ:

```json5
{
  agents: {
    list: [
      { id: "alex", workspace: "~/.openclaw/workspace-alex" },
      { id: "mia", workspace: "~/.openclaw/workspace-mia" },
    ],
  },
  bindings: [
    { agentId: "alex", match: { channel: "whatsapp", peer: { kind: "dm", id: "+15551230001" } } },
    { agentId: "mia", match: { channel: "whatsapp", peer: { kind: "dm", id: "+15551230002" } } },
  ],
  channels: {
    whatsapp: {
      dmPolicy: "allowlist",
      allowFrom: ["+15551230001", "+15551230002"],
    },
  },
}
```

Ghi chú:

- Kiểm soát truy cập DM là **toàn cục theo tài khoản WhatsApp** (ghép cặp/danh sách cho phép), không theo tác tử.
- Với nhóm dùng chung, hãy gán nhóm cho một tác tử hoặc dùng [Broadcast groups](/broadcast-groups).

## Quy tắc định tuyến (cách tin nhắn chọn tác tử)

Các ràng buộc là **xác định** và **cụ thể hơn sẽ thắng**:

1. Khớp `peer` (ID DM/nhóm/kênh chính xác)
2. `guildId` (Discord)
3. `teamId` (Slack)
4. Khớp `accountId` cho một kênh
5. Khớp cấp kênh (`accountId: "*"`)
6. Rơi về tác tử mặc định (`agents.list[].default`, nếu không thì mục đầu tiên trong danh sách, mặc định: `main`)

## Nhiều tài khoản / số điện thoại

Các kênh hỗ trợ **nhiều tài khoản** (ví dụ WhatsApp) dùng `accountId` để nhận diện
mỗi lần đăng nhập. Mỗi `accountId` có thể được định tuyến đến một tác tử khác nhau, vì vậy một máy chủ có thể host
nhiều số điện thoại mà không trộn lẫn phiên.

## Khái niệm

- `agentId`: một “bộ não” (workspace, xác thực theo tác tử, kho phiên theo tác tử).
- `accountId`: một thực thể tài khoản kênh (ví dụ tài khoản WhatsApp `"personal"` so với `"biz"`).
- `binding`: định tuyến tin nhắn vào đến một `agentId` theo `(channel, accountId, peer)` và tùy chọn theo ID guild/team.
- Chat trực tiếp gộp về `agent:<agentId>:<mainKey>` (phiên “chính” theo tác tử; `session.mainKey`).

## Ví dụ: hai WhatsApp → hai tác tử

`~/.openclaw/openclaw.json` (JSON5):

```js
{
  agents: {
    list: [
      {
        id: "home",
        default: true,
        name: "Home",
        workspace: "~/.openclaw/workspace-home",
        agentDir: "~/.openclaw/agents/home/agent",
      },
      {
        id: "work",
        name: "Work",
        workspace: "~/.openclaw/workspace-work",
        agentDir: "~/.openclaw/agents/work/agent",
      },
    ],
  },

  // Deterministic routing: first match wins (most-specific first).
  bindings: [
    { agentId: "home", match: { channel: "whatsapp", accountId: "personal" } },
    { agentId: "work", match: { channel: "whatsapp", accountId: "biz" } },

    // Optional per-peer override (example: send a specific group to work agent).
    {
      agentId: "work",
      match: {
        channel: "whatsapp",
        accountId: "personal",
        peer: { kind: "group", id: "1203630...@g.us" },
      },
    },
  ],

  // Off by default: agent-to-agent messaging must be explicitly enabled + allowlisted.
  tools: {
    agentToAgent: {
      enabled: false,
      allow: ["home", "work"],
    },
  },

  channels: {
    whatsapp: {
      accounts: {
        personal: {
          // Optional override. Default: ~/.openclaw/credentials/whatsapp/personal
          // authDir: "~/.openclaw/credentials/whatsapp/personal",
        },
        biz: {
          // Optional override. Default: ~/.openclaw/credentials/whatsapp/biz
          // authDir: "~/.openclaw/credentials/whatsapp/biz",
        },
      },
    },
  },
}
```

## Ví dụ: WhatsApp chat hằng ngày + Telegram làm việc sâu

Chia theo kênh: định tuyến WhatsApp đến tác tử nhanh cho sinh hoạt hằng ngày và Telegram đến tác tử Opus.

```json5
{
  agents: {
    list: [
      {
        id: "chat",
        name: "Everyday",
        workspace: "~/.openclaw/workspace-chat",
        model: "anthropic/claude-sonnet-4-5",
      },
      {
        id: "opus",
        name: "Deep Work",
        workspace: "~/.openclaw/workspace-opus",
        model: "anthropic/claude-opus-4-6",
      },
    ],
  },
  bindings: [
    { agentId: "chat", match: { channel: "whatsapp" } },
    { agentId: "opus", match: { channel: "telegram" } },
  ],
}
```

Ghi chú:

- Nếu bạn có nhiều tài khoản cho một kênh, thêm `accountId` vào ràng buộc (ví dụ `{ channel: "whatsapp", accountId: "personal" }`).
- Để định tuyến một DM/nhóm cụ thể sang Opus trong khi giữ phần còn lại ở chat, thêm ràng buộc `match.peer` cho peer đó; khớp theo peer luôn thắng các quy tắc toàn kênh.

## Ví dụ: cùng kênh, một peer sang Opus

Giữ WhatsApp ở tác tử nhanh, nhưng định tuyến một DM sang Opus:

```json5
{
  agents: {
    list: [
      {
        id: "chat",
        name: "Everyday",
        workspace: "~/.openclaw/workspace-chat",
        model: "anthropic/claude-sonnet-4-5",
      },
      {
        id: "opus",
        name: "Deep Work",
        workspace: "~/.openclaw/workspace-opus",
        model: "anthropic/claude-opus-4-6",
      },
    ],
  },
  bindings: [
    { agentId: "opus", match: { channel: "whatsapp", peer: { kind: "dm", id: "+15551234567" } } },
    { agentId: "chat", match: { channel: "whatsapp" } },
  ],
}
```

Ràng buộc theo peer luôn thắng, vì vậy hãy đặt chúng phía trên quy tắc toàn kênh.

## Tác tử gia đình gắn với một nhóm WhatsApp

Gắn một tác tử gia đình chuyên dụng vào một nhóm WhatsApp duy nhất, với chặn theo mention
và chính sách công cụ chặt chẽ hơn:

```json5
{
  agents: {
    list: [
      {
        id: "family",
        name: "Family",
        workspace: "~/.openclaw/workspace-family",
        identity: { name: "Family Bot" },
        groupChat: {
          mentionPatterns: ["@family", "@familybot", "@Family Bot"],
        },
        sandbox: {
          mode: "all",
          scope: "agent",
        },
        tools: {
          allow: [
            "exec",
            "read",
            "sessions_list",
            "sessions_history",
            "sessions_send",
            "sessions_spawn",
            "session_status",
          ],
          deny: ["write", "edit", "apply_patch", "browser", "canvas", "nodes", "cron"],
        },
      },
    ],
  },
  bindings: [
    {
      agentId: "family",
      match: {
        channel: "whatsapp",
        peer: { kind: "group", id: "120363999999999999@g.us" },
      },
    },
  ],
}
```

Ghi chú:

- Danh sách cho phép/từ chối công cụ là **tools**, không phải skills. Nếu một skill cần chạy
  binary, hãy đảm bảo `exec` được cho phép và binary tồn tại trong sandbox.
- Để chặn nghiêm ngặt hơn, đặt `agents.list[].groupChat.mentionPatterns` và giữ
  danh sách cho phép nhóm được bật cho kênh.

## Sandbox theo tác tử và cấu hình công cụ

Bắt đầu từ v2026.1.6, mỗi tác tử có thể có sandbox và hạn chế công cụ riêng:

```js
{
  agents: {
    list: [
      {
        id: "personal",
        workspace: "~/.openclaw/workspace-personal",
        sandbox: {
          mode: "off",  // No sandbox for personal agent
        },
        // No tool restrictions - all tools available
      },
      {
        id: "family",
        workspace: "~/.openclaw/workspace-family",
        sandbox: {
          mode: "all",     // Always sandboxed
          scope: "agent",  // One container per agent
          docker: {
            // Optional one-time setup after container creation
            setupCommand: "apt-get update && apt-get install -y git curl",
          },
        },
        tools: {
          allow: ["read"],                    // Only read tool
          deny: ["exec", "write", "edit", "apply_patch"],    // Deny others
        },
      },
    ],
  },
}
```

Lưu ý: `setupCommand` nằm dưới `sandbox.docker` và chạy một lần khi tạo container.
Các ghi đè `sandbox.docker.*` theo tác tử sẽ bị bỏ qua khi phạm vi được giải quyết là `"shared"`.

**Lợi ích:**

- **Cô lập bảo mật**: Hạn chế công cụ cho các tác tử không đáng tin
- **Kiểm soát tài nguyên**: Sandbox các tác tử cụ thể trong khi giữ tác tử khác trên host
- **Chính sách linh hoạt**: Quyền hạn khác nhau theo từng tác tử

Lưu ý: `tools.elevated` là **toàn cục** và dựa trên người gửi; không thể cấu hình theo tác tử.
Nếu bạn cần ranh giới theo tác tử, hãy dùng `agents.list[].tools` để chặn `exec`.
Để nhắm mục tiêu theo nhóm, dùng `agents.list[].groupChat.mentionPatterns` để @mention ánh xạ rõ ràng đến tác tử dự định.

Xem [Multi-Agent Sandbox & Tools](/multi-agent-sandbox-tools) để biết ví dụ chi tiết.
