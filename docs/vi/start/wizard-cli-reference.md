---
summary: "Tài liệu tham chiếu đầy đủ cho luồng onboarding CLI, thiết lập xác thực/mô hình, đầu ra và nội bộ"
read_when:
  - Bạn cần hành vi chi tiết cho openclaw onboard
  - Bạn đang debug kết quả onboarding hoặc tích hợp các client onboarding
title: "Tham chiếu Onboarding CLI"
sidebarTitle: "Tham chiếu CLI"
x-i18n:
  source_path: start/wizard-cli-reference.md
  source_hash: 0ef6f01c3e29187b
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:08:46Z
---

# Tham chiếu Onboarding CLI

Trang này là tài liệu tham chiếu đầy đủ cho `openclaw onboard`.
Để xem hướng dẫn ngắn, xem [Onboarding Wizard (CLI)](/start/wizard).

## Wizard làm gì

Chế độ local (mặc định) sẽ hướng dẫn bạn qua:

- Thiết lập mô hình và xác thực (OAuth OpenAI Code subscription, Anthropic API key hoặc setup token, cùng các tùy chọn MiniMax, GLM, Moonshot và AI Gateway)
- Vị trí workspace và các file bootstrap
- Cài đặt Gateway (cổng, bind, xác thực, tailscale)
- Kênh và nhà cung cấp (Telegram, WhatsApp, Discord, Google Chat, plugin Mattermost, Signal)
- Cài đặt daemon (LaunchAgent hoặc systemd user unit)
- Kiểm tra sức khỏe
- Thiết lập Skills

Chế độ remote cấu hình máy này để kết nối tới một gateway ở nơi khác.
Nó không cài đặt hay chỉnh sửa bất cứ thứ gì trên host remote.

## Chi tiết luồng local

<Steps>
  <Step title="Phát hiện cấu hình hiện có">
    - Nếu `~/.openclaw/openclaw.json` tồn tại, chọn Giữ nguyên, Chỉnh sửa hoặc Reset.
    - Chạy lại wizard sẽ không xóa gì trừ khi bạn chủ động chọn Reset (hoặc truyền `--reset`).
    - Nếu cấu hình không hợp lệ hoặc chứa các key legacy, wizard sẽ dừng và yêu cầu bạn chạy `openclaw doctor` trước khi tiếp tục.
    - Reset dùng `trash` và cung cấp các phạm vi:
      - Chỉ config
      - Config + thông tin xác thực + session
      - Reset đầy đủ (cũng xóa workspace)
  </Step>
  <Step title="Mô hình và xác thực">
    - Ma trận tùy chọn đầy đủ nằm tại [Tùy chọn xác thực và mô hình](#auth-and-model-options).
  </Step>
  <Step title="Workspace">
    - Mặc định `~/.openclaw/workspace` (có thể cấu hình).
    - Gieo các file workspace cần thiết cho nghi thức bootstrap lần chạy đầu.
    - Bố cục workspace: [Agent workspace](/concepts/agent-workspace).
  </Step>
  <Step title="Gateway">
    - Hỏi cổng, bind, chế độ xác thực và phơi bày tailscale.
    - Khuyến nghị: giữ xác thực bằng token bật ngay cả với loopback để các client WS local phải xác thực.
    - Chỉ tắt xác thực nếu bạn hoàn toàn tin tưởng mọi tiến trình local.
    - Các bind không phải loopback vẫn yêu cầu xác thực.
  </Step>
  <Step title="Kênh">
    - [WhatsApp](/channels/whatsapp): đăng nhập QR tùy chọn
    - [Telegram](/channels/telegram): bot token
    - [Discord](/channels/discord): bot token
    - [Google Chat](/channels/googlechat): JSON service account + webhook audience
    - Plugin [Mattermost](/channels/mattermost): bot token + base URL
    - [Signal](/channels/signal): cài đặt `signal-cli` tùy chọn + cấu hình tài khoản
    - [BlueBubbles](/channels/bluebubbles): khuyến nghị cho iMessage; URL server + mật khẩu + webhook
    - [iMessage](/channels/imessage): đường dẫn CLI `imsg` legacy + truy cập DB
    - Bảo mật DM: mặc định là ghép cặp. DM đầu tiên gửi một mã; phê duyệt qua
      `openclaw pairing approve <channel> <code>` hoặc dùng allowlist.
  </Step>
  <Step title="Cài đặt daemon">
    - macOS: LaunchAgent
      - Yêu cầu phiên người dùng đã đăng nhập; với headless, dùng LaunchDaemon tùy chỉnh (không kèm theo).
    - Linux và Windows qua WSL2: systemd user unit
      - Wizard cố gắng `loginctl enable-linger <user>` để gateway tiếp tục chạy sau khi đăng xuất.
      - Có thể yêu cầu sudo (ghi `/var/lib/systemd/linger`); nó sẽ thử không dùng sudo trước.
    - Chọn runtime: Node (khuyến nghị; bắt buộc cho WhatsApp và Telegram). Bun không được khuyến nghị.
  </Step>
  <Step title="Kiểm tra sức khỏe">
    - Khởi động gateway (nếu cần) và chạy `openclaw health`.
    - `openclaw status --deep` thêm các probe sức khỏe gateway vào đầu ra trạng thái.
  </Step>
  <Step title="Skills">
    - Đọc các skill khả dụng và kiểm tra yêu cầu.
    - Cho phép bạn chọn trình quản lý node: npm hoặc pnpm (bun không được khuyến nghị).
    - Cài đặt các phụ thuộc tùy chọn (một số dùng Homebrew trên macOS).
  </Step>
  <Step title="Hoàn tất">
    - Tóm tắt và các bước tiếp theo, bao gồm các tùy chọn ứng dụng iOS, Android và macOS.
  </Step>
</Steps>

<Note>
Nếu không phát hiện GUI, wizard sẽ in hướng dẫn port-forward SSH cho Control UI thay vì mở trình duyệt.
Nếu thiếu asset Control UI, wizard sẽ cố gắng build chúng; phương án dự phòng là `pnpm ui:build` (tự động cài deps UI).
</Note>

## Chi tiết chế độ remote

Chế độ remote cấu hình máy này để kết nối tới một gateway ở nơi khác.

<Info>
Chế độ remote không cài đặt hay chỉnh sửa bất cứ thứ gì trên host remote.
</Info>

Những gì bạn thiết lập:

- URL gateway remote (`ws://...`)
- Token nếu gateway remote yêu cầu xác thực (khuyến nghị)

<Note>
- Nếu gateway chỉ loopback, dùng SSH tunneling hoặc một tailnet.
- Gợi ý Discovery:
  - macOS: Bonjour (`dns-sd`)
  - Linux: Avahi (`avahi-browse`)
</Note>

## Tùy chọn xác thực và mô hình

<AccordionGroup>
  <Accordion title="Anthropic API key (khuyến nghị)">
    Dùng `ANTHROPIC_API_KEY` nếu có hoặc hỏi key, sau đó lưu để daemon sử dụng.
  </Accordion>
  <Accordion title="Anthropic OAuth (Claude Code CLI)">
    - macOS: kiểm tra mục Keychain "Claude Code-credentials"
    - Linux và Windows: tái sử dụng `~/.claude/.credentials.json` nếu có

    Trên macOS, chọn "Always Allow" để các lần khởi động launchd không bị chặn.

  </Accordion>
  <Accordion title="Anthropic token (dán setup-token)">
    Chạy `claude setup-token` trên bất kỳ máy nào, sau đó dán token.
    Bạn có thể đặt tên; để trống sẽ dùng mặc định.
  </Accordion>
  <Accordion title="OpenAI Code subscription (tái sử dụng Codex CLI)">
    Nếu `~/.codex/auth.json` tồn tại, wizard có thể tái sử dụng.
  </Accordion>
  <Accordion title="OpenAI Code subscription (OAuth)">
    Luồng trình duyệt; dán `code#state`.

    Đặt `agents.defaults.model` thành `openai-codex/gpt-5.3-codex` khi mô hình chưa được đặt hoặc `openai/*`.

  </Accordion>
  <Accordion title="OpenAI API key">
    Dùng `OPENAI_API_KEY` nếu có hoặc hỏi key, sau đó lưu vào
    `~/.openclaw/.env` để launchd có thể đọc.

    Đặt `agents.defaults.model` thành `openai/gpt-5.1-codex` khi mô hình chưa được đặt, `openai/*` hoặc `openai-codex/*`.

  </Accordion>
  <Accordion title="OpenCode Zen">
    Hỏi `OPENCODE_API_KEY` (hoặc `OPENCODE_ZEN_API_KEY`).
    URL thiết lập: [opencode.ai/auth](https://opencode.ai/auth).
  </Accordion>
  <Accordion title="API key (chung)">
    Lưu key cho bạn.
  </Accordion>
  <Accordion title="Vercel AI Gateway">
    Hỏi `AI_GATEWAY_API_KEY`.
    Chi tiết thêm: [Vercel AI Gateway](/providers/vercel-ai-gateway).
  </Accordion>
  <Accordion title="Cloudflare AI Gateway">
    Hỏi account ID, gateway ID và `CLOUDFLARE_AI_GATEWAY_API_KEY`.
    Chi tiết thêm: [Cloudflare AI Gateway](/providers/cloudflare-ai-gateway).
  </Accordion>
  <Accordion title="MiniMax M2.1">
    Cấu hình được ghi tự động.
    Chi tiết thêm: [MiniMax](/providers/minimax).
  </Accordion>
  <Accordion title="Synthetic (tương thích Anthropic)">
    Hỏi `SYNTHETIC_API_KEY`.
    Chi tiết thêm: [Synthetic](/providers/synthetic).
  </Accordion>
  <Accordion title="Moonshot và Kimi Coding">
    Cấu hình Moonshot (Kimi K2) và Kimi Coding được ghi tự động.
    Chi tiết thêm: [Moonshot AI (Kimi + Kimi Coding)](/providers/moonshot).
  </Accordion>
  <Accordion title="Bỏ qua">
    Để trống cấu hình xác thực.
  </Accordion>
</AccordionGroup>

Hành vi mô hình:

- Chọn mô hình mặc định từ các tùy chọn được phát hiện, hoặc nhập nhà cung cấp và mô hình thủ công.
- Wizard chạy kiểm tra mô hình và cảnh báo nếu mô hình đã cấu hình không xác định hoặc thiếu xác thực.

Đường dẫn thông tin xác thực và profile:

- Thông tin xác thực OAuth: `~/.openclaw/credentials/oauth.json`
- Profile xác thực (API key + OAuth): `~/.openclaw/agents/<agentId>/agent/auth-profiles.json`

<Note>
Mẹo cho headless và server: hoàn tất OAuth trên một máy có trình duyệt, sau đó sao chép
`~/.openclaw/credentials/oauth.json` (hoặc `$OPENCLAW_STATE_DIR/credentials/oauth.json`)
sang host gateway.
</Note>

## Đầu ra và nội bộ

Các trường điển hình trong `~/.openclaw/openclaw.json`:

- `agents.defaults.workspace`
- `agents.defaults.model` / `models.providers` (nếu chọn Minimax)
- `gateway.*` (mode, bind, auth, tailscale)
- `channels.telegram.botToken`, `channels.discord.token`, `channels.signal.*`, `channels.imessage.*`
- Allowlist kênh (Slack, Discord, Matrix, Microsoft Teams) khi bạn chọn trong các prompt (tên sẽ được resolve thành ID khi có thể)
- `skills.install.nodeManager`
- `wizard.lastRunAt`
- `wizard.lastRunVersion`
- `wizard.lastRunCommit`
- `wizard.lastRunCommand`
- `wizard.lastRunMode`

`openclaw agents add` ghi `agents.list[]` và tùy chọn `bindings`.

Thông tin xác thực WhatsApp nằm dưới `~/.openclaw/credentials/whatsapp/<accountId>/`.
Các session được lưu dưới `~/.openclaw/agents/<agentId>/sessions/`.

<Note>
Một số kênh được phân phối dưới dạng plugin. Khi được chọn trong quá trình onboarding, wizard
sẽ hỏi cài đặt plugin (npm hoặc đường dẫn local) trước khi cấu hình kênh.
</Note>

Gateway wizard RPC:

- `wizard.start`
- `wizard.next`
- `wizard.cancel`
- `wizard.status`

Các client (ứng dụng macOS và Control UI) có thể render các bước mà không cần tái triển khai logic onboarding.

Hành vi thiết lập Signal:

- Tải xuống asset bản phát hành phù hợp
- Lưu dưới `~/.openclaw/tools/signal-cli/<version>/`
- Ghi `channels.signal.cliPath` trong config
- Bản build JVM yêu cầu Java 21
- Bản build native được dùng khi có
- Windows dùng WSL2 và theo luồng signal-cli Linux bên trong WSL

## Tài liệu liên quan

- Trung tâm onboarding: [Onboarding Wizard (CLI)](/start/wizard)
- Tự động hóa và script: [CLI Automation](/start/wizard-cli-automation)
- Tham chiếu lệnh: [`openclaw onboard`](/cli/onboard)
