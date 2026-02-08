---
summary: "Trình hướng dẫn onboarding CLI: thiết lập có hướng dẫn cho gateway, workspace, kênh và skills"
read_when:
  - Chạy hoặc cấu hình trình hướng dẫn onboarding
  - Thiết lập một máy mới
title: "Trình hướng dẫn Onboarding (CLI)"
sidebarTitle: "Onboarding: CLI"
x-i18n:
  source_path: start/wizard.md
  source_hash: 5495d951a2d78ffb
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:08:36Z
---

# Trình hướng dẫn Onboarding (CLI)

Trình hướng dẫn onboarding là cách **được khuyến nghị** để thiết lập OpenClaw trên macOS,
Linux hoặc Windows (qua WSL2; rất khuyến nghị).
Nó cấu hình một Gateway cục bộ hoặc kết nối Gateway từ xa, cùng với các kênh, skills
và mặc định workspace trong một luồng có hướng dẫn.

```bash
openclaw onboard
```

<Info>
Cách nhanh nhất để có cuộc trò chuyện đầu tiên: mở Control UI (không cần thiết lập kênh). Chạy
`openclaw dashboard` và trò chuyện trong trình duyệt. Tài liệu: [Dashboard](/web/dashboard).
</Info>

Để cấu hình lại sau:

```bash
openclaw configure
openclaw agents add <name>
```

<Note>
`--json` không có nghĩa là chế độ không tương tác. Với script, hãy dùng `--non-interactive`.
</Note>

<Tip>
Khuyến nghị: thiết lập khóa API Brave Search để tác tử có thể dùng `web_search`
(`web_fetch` hoạt động không cần khóa). Cách dễ nhất: `openclaw configure --section web`
lưu trữ `tools.web.search.apiKey`. Tài liệu: [Web tools](/tools/web).
</Tip>

## QuickStart vs Advanced

Trình hướng dẫn bắt đầu với **QuickStart** (mặc định) so với **Advanced** (toàn quyền kiểm soát).

<Tabs>
  <Tab title="QuickStart (mặc định)">
    - Gateway cục bộ (loopback)
    - Workspace mặc định (hoặc workspace hiện có)
    - Cổng Gateway **18789**
    - Xác thực Gateway **Token** (tự tạo, kể cả trên loopback)
    - Mở Tailscale **Tắt**
    - Telegram + WhatsApp DMs mặc định **allowlist** (bạn sẽ được nhắc nhập số điện thoại)
  </Tab>
  <Tab title="Advanced (toàn quyền kiểm soát)">
    - Mở ra mọi bước (chế độ, workspace, gateway, kênh, daemon, skills).
  </Tab>
</Tabs>

## Những gì trình hướng dẫn cấu hình

**Chế độ cục bộ (mặc định)** dẫn bạn qua các bước sau:

1. **Model/Auth** — Khóa API Anthropic (khuyến nghị), OAuth, OpenAI hoặc nhà cung cấp khác. Chọn mô hình mặc định.
2. **Workspace** — Vị trí cho các tệp tác tử (mặc định `~/.openclaw/workspace`). Khởi tạo các tệp bootstrap.
3. **Gateway** — Cổng, địa chỉ bind, chế độ xác thực, mở Tailscale.
4. **Kênh** — WhatsApp, Telegram, Discord, Google Chat, Mattermost, Signal, BlueBubbles hoặc iMessage.
5. **Daemon** — Cài đặt LaunchAgent (macOS) hoặc systemd user unit (Linux/WSL2).
6. **Health check** — Khởi động Gateway và xác minh nó đang chạy.
7. **Skills** — Cài đặt các skills được khuyến nghị và các phụ thuộc tùy chọn.

<Note>
Chạy lại trình hướng dẫn **không** xóa gì trừ khi bạn chủ động chọn **Reset** (hoặc truyền `--reset`).
Nếu cấu hình không hợp lệ hoặc chứa khóa legacy, trình hướng dẫn sẽ yêu cầu bạn chạy `openclaw doctor` trước.
</Note>

**Chế độ từ xa** chỉ cấu hình client cục bộ để kết nối tới một Gateway ở nơi khác.
Nó **không** cài đặt hoặc thay đổi bất cứ thứ gì trên máy chủ từ xa.

## Thêm một tác tử khác

Dùng `openclaw agents add <name>` để tạo một tác tử riêng với workspace,
các phiên và hồ sơ xác thực của riêng nó. Chạy không có `--workspace` sẽ khởi chạy trình hướng dẫn.

Những gì nó thiết lập:

- `agents.list[].name`
- `agents.list[].workspace`
- `agents.list[].agentDir`

Ghi chú:

- Workspace mặc định tuân theo `~/.openclaw/workspace-<agentId>`.
- Thêm `bindings` để định tuyến tin nhắn vào (trình hướng dẫn có thể làm việc này).
- Cờ không tương tác: `--model`, `--agent-dir`, `--bind`, `--non-interactive`.

## Tham chiếu đầy đủ

Để xem phân tích chi tiết từng bước, script không tương tác, thiết lập Signal,
RPC API và danh sách đầy đủ các trường cấu hình mà trình hướng dẫn ghi, xem
[Wizard Reference](/reference/wizard).

## Tài liệu liên quan

- Tham chiếu lệnh CLI: [`openclaw onboard`](/cli/onboard)
- Onboarding ứng dụng macOS: [Onboarding](/start/onboarding)
- Nghi thức chạy lần đầu của tác tử: [Agent Bootstrapping](/start/bootstrapping)
