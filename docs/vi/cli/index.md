---
summary: "Tài liệu tham chiếu OpenClaw CLI cho các lệnh, lệnh con và tùy chọn `openclaw`"
read_when:
  - Thêm hoặc sửa đổi các lệnh hay tùy chọn CLI
  - Ghi tài liệu cho các bề mặt lệnh mới
title: "Tham chiếu CLI"
x-i18n:
  source_path: cli/index.md
  source_hash: 973e7806d0261c6a
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:07:28Z
---

# Tham chiếu CLI

Trang này mô tả hành vi CLI hiện tại. Nếu lệnh thay đổi, hãy cập nhật tài liệu này.

## Các trang lệnh

- [`setup`](/cli/setup)
- [`onboard`](/cli/onboard)
- [`configure`](/cli/configure)
- [`config`](/cli/config)
- [`doctor`](/cli/doctor)
- [`dashboard`](/cli/dashboard)
- [`reset`](/cli/reset)
- [`uninstall`](/cli/uninstall)
- [`update`](/cli/update)
- [`message`](/cli/message)
- [`agent`](/cli/agent)
- [`agents`](/cli/agents)
- [`acp`](/cli/acp)
- [`status`](/cli/status)
- [`health`](/cli/health)
- [`sessions`](/cli/sessions)
- [`gateway`](/cli/gateway)
- [`logs`](/cli/logs)
- [`system`](/cli/system)
- [`models`](/cli/models)
- [`memory`](/cli/memory)
- [`nodes`](/cli/nodes)
- [`devices`](/cli/devices)
- [`node`](/cli/node)
- [`approvals`](/cli/approvals)
- [`sandbox`](/cli/sandbox)
- [`tui`](/cli/tui)
- [`browser`](/cli/browser)
- [`cron`](/cli/cron)
- [`dns`](/cli/dns)
- [`docs`](/cli/docs)
- [`hooks`](/cli/hooks)
- [`webhooks`](/cli/webhooks)
- [`pairing`](/cli/pairing)
- [`plugins`](/cli/plugins) (các lệnh plugin)
- [`channels`](/cli/channels)
- [`security`](/cli/security)
- [`skills`](/cli/skills)
- [`voicecall`](/cli/voicecall) (plugin; nếu đã cài)

## Cờ toàn cục

- `--dev`: cô lập trạng thái dưới `~/.openclaw-dev` và dịch các cổng mặc định.
- `--profile <name>`: cô lập trạng thái dưới `~/.openclaw-<name>`.
- `--no-color`: tắt màu ANSI.
- `--update`: viết tắt cho `openclaw update` (chỉ cài đặt từ nguồn).
- `-V`, `--version`, `-v`: in phiên bản và thoát.

## Kiểu hiển thị đầu ra

- Màu ANSI và chỉ báo tiến trình chỉ hiển thị trong phiên TTY.
- Liên kết OSC-8 hiển thị như liên kết có thể bấm trong terminal được hỗ trợ; nếu không, sẽ dùng URL thuần.
- `--json` (và `--plain` khi được hỗ trợ) tắt tạo kiểu để có đầu ra sạch.
- `--no-color` tắt tạo kiểu ANSI; `NO_COLOR=1` cũng được tôn trọng.
- Các lệnh chạy lâu hiển thị chỉ báo tiến trình (OSC 9;4 khi được hỗ trợ).

## Bảng màu

OpenClaw dùng bảng màu lobster cho đầu ra CLI.

- `accent` (#FF5A2D): tiêu đề, nhãn, điểm nhấn chính.
- `accentBright` (#FF7A3D): tên lệnh, nhấn mạnh.
- `accentDim` (#D14A22): văn bản nhấn mạnh phụ.
- `info` (#FF8A5B): giá trị thông tin.
- `success` (#2FBF71): trạng thái thành công.
- `warn` (#FFB020): cảnh báo, phương án dự phòng, chú ý.
- `error` (#E23D2D): lỗi, thất bại.
- `muted` (#8B7F77): giảm nhấn mạnh, metadata.

Nguồn chuẩn của bảng màu: `src/terminal/palette.ts` (còn gọi là “lobster seam”).

## Cây lệnh

```
openclaw [--dev] [--profile <name>] <command>
  setup
  onboard
  configure
  config
    get
    set
    unset
  doctor
  security
    audit
  reset
  uninstall
  update
  channels
    list
    status
    logs
    add
    remove
    login
    logout
  skills
    list
    info
    check
  plugins
    list
    info
    install
    enable
    disable
    doctor
  memory
    status
    index
    search
  message
  agent
  agents
    list
    add
    delete
  acp
  status
  health
  sessions
  gateway
    call
    health
    status
    probe
    discover
    install
    uninstall
    start
    stop
    restart
    run
  logs
  system
    event
    heartbeat last|enable|disable
    presence
  models
    list
    status
    set
    set-image
    aliases list|add|remove
    fallbacks list|add|remove|clear
    image-fallbacks list|add|remove|clear
    scan
    auth add|setup-token|paste-token
    auth order get|set|clear
  sandbox
    list
    recreate
    explain
  cron
    status
    list
    add
    edit
    rm
    enable
    disable
    runs
    run
  nodes
  devices
  node
    run
    status
    install
    uninstall
    start
    stop
    restart
  approvals
    get
    set
    allowlist add|remove
  browser
    status
    start
    stop
    reset-profile
    tabs
    open
    focus
    close
    profiles
    create-profile
    delete-profile
    screenshot
    snapshot
    navigate
    resize
    click
    type
    press
    hover
    drag
    select
    upload
    fill
    dialog
    wait
    evaluate
    console
    pdf
  hooks
    list
    info
    check
    enable
    disable
    install
    update
  webhooks
    gmail setup|run
  pairing
    list
    approve
  docs
  dns
    setup
  tui
```

Lưu ý: plugin có thể thêm các lệnh cấp cao mới (ví dụ `openclaw voicecall`).

## Bảo mật

- `openclaw security audit` — kiểm tra cấu hình + trạng thái cục bộ để phát hiện các lỗi bảo mật thường gặp.
- `openclaw security audit --deep` — thăm dò Gateway trực tiếp theo cách best-effort.
- `openclaw security audit --fix` — siết chặt mặc định an toàn và chmod trạng thái/cấu hình.

## Plugin

Quản lý các phần mở rộng và cấu hình của chúng:

- `openclaw plugins list` — khám phá plugin (dùng `--json` cho đầu ra máy).
- `openclaw plugins info <id>` — hiển thị chi tiết của một plugin.
- `openclaw plugins install <path|.tgz|npm-spec>` — cài plugin (hoặc thêm đường dẫn plugin vào `plugins.load.paths`).
- `openclaw plugins enable <id>` / `disable <id>` — bật/tắt `plugins.entries.<id>.enabled`.
- `openclaw plugins doctor` — báo cáo lỗi tải plugin.

Hầu hết thay đổi plugin cần khởi động lại gateway. Xem [/plugin](/plugin).

## Bộ nhớ

Tìm kiếm vector trên `MEMORY.md` + `memory/*.md`:

- `openclaw memory status` — hiển thị thống kê chỉ mục.
- `openclaw memory index` — lập chỉ mục lại các tệp bộ nhớ.
- `openclaw memory search "<query>"` — tìm kiếm ngữ nghĩa trên bộ nhớ.

## Lệnh slash trong chat

Tin nhắn chat hỗ trợ các lệnh `/...` (văn bản và native). Xem [/tools/slash-commands](/tools/slash-commands).

Điểm nổi bật:

- `/status` để chẩn đoán nhanh.
- `/config` cho thay đổi cấu hình được lưu.
- `/debug` cho ghi đè cấu hình chỉ lúc chạy (trong bộ nhớ, không ghi đĩa; yêu cầu `commands.debug: true`).

## Thiết lập + onboarding

### `setup`

Khởi tạo cấu hình + workspace.

Tùy chọn:

- `--workspace <dir>`: đường dẫn workspace của agent (mặc định `~/.openclaw/workspace`).
- `--wizard`: chạy trình hướng dẫn onboarding.
- `--non-interactive`: chạy trình hướng dẫn không cần nhắc.
- `--mode <local|remote>`: chế độ trình hướng dẫn.
- `--remote-url <url>`: URL Gateway từ xa.
- `--remote-token <token>`: token Gateway từ xa.

Trình hướng dẫn tự chạy khi có bất kỳ cờ wizard nào (`--non-interactive`, `--mode`, `--remote-url`, `--remote-token`).

### `onboard`

Trình hướng dẫn tương tác để thiết lập gateway, workspace và skills.

Tùy chọn:

- `--workspace <dir>`
- `--reset` (đặt lại cấu hình + thông tin xác thực + phiên + workspace trước khi chạy wizard)
- `--non-interactive`
- `--mode <local|remote>`
- `--flow <quickstart|advanced|manual>` (manual là bí danh của advanced)
- `--auth-choice <setup-token|token|chutes|openai-codex|openai-api-key|openrouter-api-key|ai-gateway-api-key|moonshot-api-key|moonshot-api-key-cn|kimi-code-api-key|synthetic-api-key|venice-api-key|gemini-api-key|zai-api-key|apiKey|minimax-api|minimax-api-lightning|opencode-zen|skip>`
- `--token-provider <id>` (không tương tác; dùng với `--auth-choice token`)
- `--token <token>` (không tương tác; dùng với `--auth-choice token`)
- `--token-profile-id <id>` (không tương tác; mặc định: `<provider>:manual`)
- `--token-expires-in <duration>` (không tương tác; ví dụ `365d`, `12h`)
- `--anthropic-api-key <key>`
- `--openai-api-key <key>`
- `--openrouter-api-key <key>`
- `--ai-gateway-api-key <key>`
- `--moonshot-api-key <key>`
- `--kimi-code-api-key <key>`
- `--gemini-api-key <key>`
- `--zai-api-key <key>`
- `--minimax-api-key <key>`
- `--opencode-zen-api-key <key>`
- `--gateway-port <port>`
- `--gateway-bind <loopback|lan|tailnet|auto|custom>`
- `--gateway-auth <token|password>`
- `--gateway-token <token>`
- `--gateway-password <password>`
- `--remote-url <url>`
- `--remote-token <token>`
- `--tailscale <off|serve|funnel>`
- `--tailscale-reset-on-exit`
- `--install-daemon`
- `--no-install-daemon` (bí danh: `--skip-daemon`)
- `--daemon-runtime <node|bun>`
- `--skip-channels`
- `--skip-skills`
- `--skip-health`
- `--skip-ui`
- `--node-manager <npm|pnpm|bun>` (khuyến nghị pnpm; bun không được khuyến nghị cho runtime Gateway)
- `--json`

### `configure`

Trình hướng dẫn cấu hình tương tác (models, channels, skills, gateway).

### `config`

Các trợ giúp cấu hình không tương tác (get/set/unset). Chạy `openclaw config` không có
lệnh con sẽ khởi chạy wizard.

Các lệnh con:

- `config get <path>`: in một giá trị cấu hình (đường dẫn chấm/ngoặc).
- `config set <path> <value>`: đặt một giá trị (JSON5 hoặc chuỗi thô).
- `config unset <path>`: xóa một giá trị.

### `doctor`

Kiểm tra sức khỏe + sửa nhanh (cấu hình + gateway + dịch vụ legacy).

Tùy chọn:

- `--no-workspace-suggestions`: tắt gợi ý bộ nhớ workspace.
- `--yes`: chấp nhận mặc định không cần nhắc (headless).
- `--non-interactive`: bỏ qua nhắc; chỉ áp dụng di trú an toàn.
- `--deep`: quét dịch vụ hệ thống để tìm các cài đặt gateway bổ sung.

## Trợ giúp kênh

### `channels`

Quản lý tài khoản kênh chat (WhatsApp/Telegram/Discord/Google Chat/Slack/Mattermost (plugin)/Signal/iMessage/MS Teams).

Các lệnh con:

- `channels list`: hiển thị các kênh đã cấu hình và hồ sơ xác thực.
- `channels status`: kiểm tra khả năng truy cập gateway và sức khỏe kênh (`--probe` chạy thêm kiểm tra; dùng `openclaw health` hoặc `openclaw status --deep` cho thăm dò sức khỏe gateway).
- Mẹo: `channels status` in cảnh báo kèm đề xuất sửa khi phát hiện cấu hình sai phổ biến (sau đó trỏ bạn tới `openclaw doctor`).
- `channels logs`: hiển thị log kênh gần đây từ tệp log gateway.
- `channels add`: thiết lập theo kiểu wizard khi không truyền cờ; truyền cờ sẽ chuyển sang chế độ không tương tác.
- `channels remove`: mặc định là tắt; truyền `--delete` để xóa mục cấu hình không cần nhắc.
- `channels login`: đăng nhập kênh tương tác (chỉ WhatsApp Web).
- `channels logout`: đăng xuất phiên kênh (nếu được hỗ trợ).

Tùy chọn chung:

- `--channel <name>`: `whatsapp|telegram|discord|googlechat|slack|mattermost|signal|imessage|msteams`
- `--account <id>`: id tài khoản kênh (mặc định `default`)
- `--name <label>`: tên hiển thị cho tài khoản

Tùy chọn `channels login`:

- `--channel <channel>` (mặc định `whatsapp`; hỗ trợ `whatsapp`/`web`)
- `--account <id>`
- `--verbose`

Tùy chọn `channels logout`:

- `--channel <channel>` (mặc định `whatsapp`)
- `--account <id>`

Tùy chọn `channels list`:

- `--no-usage`: bỏ qua snapshot sử dụng/hạn mức của nhà cung cấp model (chỉ OAuth/API-backed).
- `--json`: xuất JSON (bao gồm usage trừ khi đặt `--no-usage`).

Tùy chọn `channels logs`:

- `--channel <name|all>` (mặc định `all`)
- `--lines <n>` (mặc định `200`)
- `--json`

Chi tiết thêm: [/concepts/oauth](/concepts/oauth)

Ví dụ:

```bash
openclaw channels add --channel telegram --account alerts --name "Alerts Bot" --token $TELEGRAM_BOT_TOKEN
openclaw channels add --channel discord --account work --name "Work Bot" --token $DISCORD_BOT_TOKEN
openclaw channels remove --channel discord --account work --delete
openclaw channels status --probe
openclaw status --deep
```

### `skills`

Liệt kê và kiểm tra skills khả dụng cùng thông tin sẵn sàng.

Các lệnh con:

- `skills list`: liệt kê skills (mặc định khi không có lệnh con).
- `skills info <name>`: hiển thị chi tiết một skill.
- `skills check`: tóm tắt trạng thái sẵn sàng so với thiếu yêu cầu.

Tùy chọn:

- `--eligible`: chỉ hiển thị skills sẵn sàng.
- `--json`: xuất JSON (không tạo kiểu).
- `-v`, `--verbose`: bao gồm chi tiết yêu cầu còn thiếu.

Mẹo: dùng `npx clawhub` để tìm kiếm, cài đặt và đồng bộ skills.

### `pairing`

Phê duyệt yêu cầu ghép cặp Tin nhan truc tiep trên các kênh.

Các lệnh con:

- `pairing list <channel> [--json]`
- `pairing approve <channel> <code> [--notify]`

### `webhooks gmail`

Thiết lập + chạy hook Gmail Pub/Sub. Xem [/automation/gmail-pubsub](/automation/gmail-pubsub).

Các lệnh con:

- `webhooks gmail setup` (yêu cầu `--account <email>`; hỗ trợ `--project`, `--topic`, `--subscription`, `--label`, `--hook-url`, `--hook-token`, `--push-token`, `--bind`, `--port`, `--path`, `--include-body`, `--max-bytes`, `--renew-minutes`, `--tailscale`, `--tailscale-path`, `--tailscale-target`, `--push-endpoint`, `--json`)
- `webhooks gmail run` (ghi đè runtime cho cùng các cờ)

### `dns setup`

Trợ giúp DNS khám phá diện rộng (CoreDNS + Tailscale). Xem [/gateway/discovery](/gateway/discovery).

Tùy chọn:

- `--apply`: cài/cập nhật cấu hình CoreDNS (yêu cầu sudo; chỉ macOS).

## Nhắn tin + agent

### `message`

Nhắn tin đi thống nhất + hành động kênh.

Xem: [/cli/message](/cli/message)

Các lệnh con:

- `message send|poll|react|reactions|read|edit|delete|pin|unpin|pins|permissions|search|timeout|kick|ban`
- `message thread <create|list|reply>`
- `message emoji <list|upload>`
- `message sticker <send|upload>`
- `message role <info|add|remove>`
- `message channel <info|list>`
- `message member info`
- `message voice status`
- `message event <list|create>`

Ví dụ:

- `openclaw message send --target +15555550123 --message "Hi"`
- `openclaw message poll --channel discord --target channel:123 --poll-question "Snack?" --poll-option Pizza --poll-option Sushi`

### `agent`

Chạy một lượt agent qua Gateway (hoặc `--local` nhúng).

Bắt buộc:

- `--message <text>`

Tùy chọn:

- `--to <dest>` (cho khóa phiên và phân phối tùy chọn)
- `--session-id <id>`
- `--thinking <off|minimal|low|medium|high|xhigh>` (chỉ các model GPT-5.2 + Codex)
- `--verbose <on|full|off>`
- `--channel <whatsapp|telegram|discord|slack|mattermost|signal|imessage|msteams>`
- `--local`
- `--deliver`
- `--json`
- `--timeout <seconds>`

### `agents`

Quản lý agent cô lập (workspaces + xác thực + định tuyến).

#### `agents list`

Liệt kê các agent đã cấu hình.

Tùy chọn:

- `--json`
- `--bindings`

#### `agents add [name]`

Thêm một agent cô lập mới. Chạy wizard hướng dẫn trừ khi truyền cờ (hoặc `--non-interactive`); `--workspace` là bắt buộc ở chế độ không tương tác.

Tùy chọn:

- `--workspace <dir>`
- `--model <id>`
- `--agent-dir <dir>`
- `--bind <channel[:accountId]>` (có thể lặp)
- `--non-interactive`
- `--json`

Đặc tả binding dùng `channel[:accountId]`. Khi bỏ `accountId` cho WhatsApp, id tài khoản mặc định sẽ được dùng.

#### `agents delete <id>`

Xóa một agent và dọn workspace + trạng thái của nó.

Tùy chọn:

- `--force`
- `--json`

### `acp`

Chạy cầu nối ACP kết nối IDE với Gateway.

Xem [`acp`](/cli/acp) để biết đầy đủ tùy chọn và ví dụ.

### `status`

Hiển thị sức khỏe phiên được liên kết và người nhận gần đây.

Tùy chọn:

- `--json`
- `--all` (chẩn đoán đầy đủ; chỉ đọc, có thể dán)
- `--deep` (thăm dò kênh)
- `--usage` (hiển thị sử dụng/hạn mức nhà cung cấp model)
- `--timeout <ms>`
- `--verbose`
- `--debug` (bí danh cho `--verbose`)

Ghi chú:

- Tổng quan bao gồm trạng thái dịch vụ Gateway + node host khi có.

### Theo dõi sử dụng

OpenClaw có thể hiển thị sử dụng/hạn mức của nhà cung cấp khi có thông tin xác thực OAuth/API.

Các bề mặt:

- `/status` (thêm một dòng sử dụng ngắn của nhà cung cấp khi có)
- `openclaw status --usage` (in phân tích đầy đủ theo nhà cung cấp)
- Thanh menu macOS (mục Usage dưới Context)

Ghi chú:

- Dữ liệu lấy trực tiếp từ endpoint sử dụng của nhà cung cấp (không ước lượng).
- Nhà cung cấp: Anthropic, GitHub Copilot, OpenAI Codex OAuth, cùng Gemini CLI/Antigravity khi các plugin nhà cung cấp đó được bật.
- Nếu không có thông tin xác thực phù hợp, usage sẽ bị ẩn.
- Chi tiết: xem [Usage tracking](/concepts/usage-tracking).

### `health`

Lấy sức khỏe từ Gateway đang chạy.

Tùy chọn:

- `--json`
- `--timeout <ms>`
- `--verbose`

### `sessions`

Liệt kê các phiên hội thoại đã lưu.

Tùy chọn:

- `--json`
- `--verbose`
- `--store <path>`
- `--active <minutes>`

## Đặt lại / Gỡ cài đặt

### `reset`

Đặt lại cấu hình/trạng thái cục bộ (giữ CLI đã cài).

Tùy chọn:

- `--scope <config|config+creds+sessions|full>`
- `--yes`
- `--non-interactive`
- `--dry-run`

Ghi chú:

- `--non-interactive` yêu cầu `--scope` và `--yes`.

### `uninstall`

Gỡ cài đặt dịch vụ gateway + dữ liệu cục bộ (CLI vẫn còn).

Tùy chọn:

- `--service`
- `--state`
- `--workspace`
- `--app`
- `--all`
- `--yes`
- `--non-interactive`
- `--dry-run`

Ghi chú:

- `--non-interactive` yêu cầu `--yes` và phạm vi rõ ràng (hoặc `--all`).

## Gateway

### `gateway`

Chạy WebSocket Gateway.

Tùy chọn:

- `--port <port>`
- `--bind <loopback|tailnet|lan|auto|custom>`
- `--token <token>`
- `--auth <token|password>`
- `--password <password>`
- `--tailscale <off|serve|funnel>`
- `--tailscale-reset-on-exit`
- `--allow-unconfigured`
- `--dev`
- `--reset` (đặt lại cấu hình dev + thông tin xác thực + phiên + workspace)
- `--force` (kết liễu listener hiện có trên cổng)
- `--verbose`
- `--claude-cli-logs`
- `--ws-log <auto|full|compact>`
- `--compact` (bí danh cho `--ws-log compact`)
- `--raw-stream`
- `--raw-stream-path <path>`

### `gateway service`

Quản lý dịch vụ Gateway (launchd/systemd/schtasks).

Các lệnh con:

- `gateway status` (mặc định thăm dò Gateway RPC)
- `gateway install` (cài dịch vụ)
- `gateway uninstall`
- `gateway start`
- `gateway stop`
- `gateway restart`

Ghi chú:

- `gateway status` mặc định thăm dò Gateway RPC bằng cổng/cấu hình đã phân giải của dịch vụ (ghi đè bằng `--url/--token/--password`).
- `gateway status` hỗ trợ `--no-probe`, `--deep` và `--json` cho scripting.
- `gateway status` cũng hiển thị các dịch vụ gateway legacy hoặc bổ sung khi có thể phát hiện (`--deep` thêm quét cấp hệ thống). Các dịch vụ OpenClaw có tên theo profile được coi là hạng nhất và không bị gắn cờ là “extra”.
- `gateway status` in đường dẫn cấu hình CLI dùng so với cấu hình dịch vụ có khả năng dùng (env dịch vụ), cùng URL mục tiêu thăm dò đã phân giải.
- `gateway install|uninstall|start|stop|restart` hỗ trợ `--json` cho scripting (đầu ra mặc định vẫn thân thiện với con người).
- `gateway install` mặc định dùng Node runtime; bun **không được khuyến nghị** (lỗi WhatsApp/Telegram).
- Tùy chọn `gateway install`: `--port`, `--runtime`, `--token`, `--force`, `--json`.

### `logs`

Theo dõi log tệp Gateway qua RPC.

Ghi chú:

- Phiên TTY hiển thị chế độ xem có màu, có cấu trúc; không TTY sẽ dùng văn bản thuần.
- `--json` xuất JSON phân tách theo dòng (mỗi sự kiện log một dòng).

Ví dụ:

```bash
openclaw logs --follow
openclaw logs --limit 200
openclaw logs --plain
openclaw logs --json
openclaw logs --no-color
```

### `gateway <subcommand>`

Trợ giúp Gateway CLI (dùng `--url`, `--token`, `--password`, `--timeout`, `--expect-final` cho các lệnh con RPC).
Khi bạn truyền `--url`, CLI không tự áp dụng cấu hình hay thông tin xác thực môi trường.
Hãy bao gồm `--token` hoặc `--password` một cách tường minh. Thiếu thông tin xác thực tường minh là lỗi.

Các lệnh con:

- `gateway call <method> [--params <json>]`
- `gateway health`
- `gateway status`
- `gateway probe`
- `gateway discover`
- `gateway install|uninstall|start|stop|restart`
- `gateway run`

RPC thường dùng:

- `config.apply` (xác thực + ghi cấu hình + khởi động lại + đánh thức)
- `config.patch` (gộp cập nhật từng phần + khởi động lại + đánh thức)
- `update.run` (chạy cập nhật + khởi động lại + đánh thức)

Mẹo: khi gọi trực tiếp `config.set`/`config.apply`/`config.patch`, hãy truyền `baseHash` từ
`config.get` nếu cấu hình đã tồn tại.

## Models

Xem [/concepts/models](/concepts/models) để biết hành vi fallback và chiến lược quét.

Xác thực Anthropic ưu tiên (setup-token):

```bash
claude setup-token
openclaw models auth setup-token --provider anthropic
openclaw models status
```

### `models` (gốc)

`openclaw models` là bí danh của `models status`.

Tùy chọn gốc:

- `--status-json` (bí danh cho `models status --json`)
- `--status-plain` (bí danh cho `models status --plain`)

### `models list`

Tùy chọn:

- `--all`
- `--local`
- `--provider <name>`
- `--json`
- `--plain`

### `models status`

Tùy chọn:

- `--json`
- `--plain`
- `--check` (thoát 1=hết hạn/thiếu, 2=sắp hết hạn)
- `--probe` (thăm dò trực tiếp các hồ sơ xác thực đã cấu hình)
- `--probe-provider <name>`
- `--probe-profile <id>` (lặp hoặc phân tách bằng dấu phẩy)
- `--probe-timeout <ms>`
- `--probe-concurrency <n>`
- `--probe-max-tokens <n>`

Luôn bao gồm tổng quan xác thực và trạng thái hết hạn OAuth cho các hồ sơ trong kho xác thực.
`--probe` chạy các yêu cầu trực tiếp (có thể tiêu thụ token và kích hoạt giới hạn tốc độ).

### `models set <model>`

Đặt `agents.defaults.model.primary`.

### `models set-image <model>`

Đặt `agents.defaults.imageModel.primary`.

### `models aliases list|add|remove`

Tùy chọn:

- `list`: `--json`, `--plain`
- `add <alias> <model>`
- `remove <alias>`

### `models fallbacks list|add|remove|clear`

Tùy chọn:

- `list`: `--json`, `--plain`
- `add <model>`
- `remove <model>`
- `clear`

### `models image-fallbacks list|add|remove|clear`

Tùy chọn:

- `list`: `--json`, `--plain`
- `add <model>`
- `remove <model>`
- `clear`

### `models scan`

Tùy chọn:

- `--min-params <b>`
- `--max-age-days <days>`
- `--provider <name>`
- `--max-candidates <n>`
- `--timeout <ms>`
- `--concurrency <n>`
- `--no-probe`
- `--yes`
- `--no-input`
- `--set-default`
- `--set-image`
- `--json`

### `models auth add|setup-token|paste-token`

Tùy chọn:

- `add`: trợ giúp xác thực tương tác
- `setup-token`: `--provider <name>` (mặc định `anthropic`), `--yes`
- `paste-token`: `--provider <name>`, `--profile-id <id>`, `--expires-in <duration>`

### `models auth order get|set|clear`

Tùy chọn:

- `get`: `--provider <name>`, `--agent <id>`, `--json`
- `set`: `--provider <name>`, `--agent <id>`, `<profileIds...>`
- `clear`: `--provider <name>`, `--agent <id>`

## Hệ thống

### `system event`

Đưa một sự kiện hệ thống vào hàng đợi và tùy chọn kích hoạt heartbeat (Gateway RPC).

Bắt buộc:

- `--text <text>`

Tùy chọn:

- `--mode <now|next-heartbeat>`
- `--json`
- `--url`, `--token`, `--timeout`, `--expect-final`

### `system heartbeat last|enable|disable`

Điều khiển heartbeat (Gateway RPC).

Tùy chọn:

- `--json`
- `--url`, `--token`, `--timeout`, `--expect-final`

### `system presence`

Liệt kê các mục hiện diện hệ thống (Gateway RPC).

Tùy chọn:

- `--json`
- `--url`, `--token`, `--timeout`, `--expect-final`

## Cron

Quản lý các job theo lịch (Gateway RPC). Xem [/automation/cron-jobs](/automation/cron-jobs).

Các lệnh con:

- `cron status [--json]`
- `cron list [--all] [--json]` (mặc định xuất bảng; dùng `--json` cho raw)
- `cron add` (bí danh: `create`; yêu cầu `--name` và chính xác một trong `--at` | `--every` | `--cron`, và chính xác một payload của `--system-event` | `--message`)
- `cron edit <id>` (vá các trường)
- `cron rm <id>` (bí danh: `remove`, `delete`)
- `cron enable <id>`
- `cron disable <id>`
- `cron runs --id <id> [--limit <n>]`
- `cron run <id> [--force]`

Tất cả các lệnh `cron` chấp nhận `--url`, `--token`, `--timeout`, `--expect-final`.

## Node host

`node` chạy **node host không giao diện** hoặc quản lý nó như một dịch vụ nền. Xem
[`openclaw node`](/cli/node).

Các lệnh con:

- `node run --host <gateway-host> --port 18789`
- `node status`
- `node install [--host <gateway-host>] [--port <port>] [--tls] [--tls-fingerprint <sha256>] [--node-id <id>] [--display-name <name>] [--runtime <node|bun>] [--force]`
- `node uninstall`
- `node stop`
- `node restart`

## Nodes

`nodes` giao tiếp với Gateway và nhắm tới các node đã ghép cặp. Xem [/nodes](/nodes).

Tùy chọn chung:

- `--url`, `--token`, `--timeout`, `--json`

Các lệnh con:

- `nodes status [--connected] [--last-connected <duration>]`
- `nodes describe --node <id|name|ip>`
- `nodes list [--connected] [--last-connected <duration>]`
- `nodes pending`
- `nodes approve <requestId>`
- `nodes reject <requestId>`
- `nodes rename --node <id|name|ip> --name <displayName>`
- `nodes invoke --node <id|name|ip> --command <command> [--params <json>] [--invoke-timeout <ms>] [--idempotency-key <key>]`
- `nodes run --node <id|name|ip> [--cwd <path>] [--env KEY=VAL] [--command-timeout <ms>] [--needs-screen-recording] [--invoke-timeout <ms>] <command...>` (mac node hoặc headless node host)
- `nodes notify --node <id|name|ip> [--title <text>] [--body <text>] [--sound <name>] [--priority <passive|active|timeSensitive>] [--delivery <system|overlay|auto>] [--invoke-timeout <ms>]` (chỉ mac)

Camera:

- `nodes camera list --node <id|name|ip>`
- `nodes camera snap --node <id|name|ip> [--facing front|back|both] [--device-id <id>] [--max-width <px>] [--quality <0-1>] [--delay-ms <ms>] [--invoke-timeout <ms>]`
- `nodes camera clip --node <id|name|ip> [--facing front|back] [--device-id <id>] [--duration <ms|10s|1m>] [--no-audio] [--invoke-timeout <ms>]`

Canvas + màn hình:

- `nodes canvas snapshot --node <id|name|ip> [--format png|jpg|jpeg] [--max-width <px>] [--quality <0-1>] [--invoke-timeout <ms>]`
- `nodes canvas present --node <id|name|ip> [--target <urlOrPath>] [--x <px>] [--y <px>] [--width <px>] [--height <px>] [--invoke-timeout <ms>]`
- `nodes canvas hide --node <id|name|ip> [--invoke-timeout <ms>]`
- `nodes canvas navigate <url> --node <id|name|ip> [--invoke-timeout <ms>]`
- `nodes canvas eval [<js>] --node <id|name|ip> [--js <code>] [--invoke-timeout <ms>]`
- `nodes canvas a2ui push --node <id|name|ip> (--jsonl <path> | --text <text>) [--invoke-timeout <ms>]`
- `nodes canvas a2ui reset --node <id|name|ip> [--invoke-timeout <ms>]`
- `nodes screen record --node <id|name|ip> [--screen <index>] [--duration <ms|10s>] [--fps <n>] [--no-audio] [--out <path>] [--invoke-timeout <ms>]`

Vị trí:

- `nodes location get --node <id|name|ip> [--max-age <ms>] [--accuracy <coarse|balanced|precise>] [--location-timeout <ms>] [--invoke-timeout <ms>]`

## Trình duyệt

CLI điều khiển trình duyệt (Chrome/Brave/Edge/Chromium chuyên dụng). Xem [`openclaw browser`](/cli/browser) và [Browser tool](/tools/browser).

Tùy chọn chung:

- `--url`, `--token`, `--timeout`, `--json`
- `--browser-profile <name>`

Quản lý:

- `browser status`
- `browser start`
- `browser stop`
- `browser reset-profile`
- `browser tabs`
- `browser open <url>`
- `browser focus <targetId>`
- `browser close [targetId]`
- `browser profiles`
- `browser create-profile --name <name> [--color <hex>] [--cdp-url <url>]`
- `browser delete-profile --name <name>`

Kiểm tra:

- `browser screenshot [targetId] [--full-page] [--ref <ref>] [--element <selector>] [--type png|jpeg]`
- `browser snapshot [--format aria|ai] [--target-id <id>] [--limit <n>] [--interactive] [--compact] [--depth <n>] [--selector <sel>] [--out <path>]`

Hành động:

- `browser navigate <url> [--target-id <id>]`
- `browser resize <width> <height> [--target-id <id>]`
- `browser click <ref> [--double] [--button <left|right|middle>] [--modifiers <csv>] [--target-id <id>]`
- `browser type <ref> <text> [--submit] [--slowly] [--target-id <id>]`
- `browser press <key> [--target-id <id>]`
- `browser hover <ref> [--target-id <id>]`
- `browser drag <startRef> <endRef> [--target-id <id>]`
- `browser select <ref> <values...> [--target-id <id>]`
- `browser upload <paths...> [--ref <ref>] [--input-ref <ref>] [--element <selector>] [--target-id <id>] [--timeout-ms <ms>]`
- `browser fill [--fields <json>] [--fields-file <path>] [--target-id <id>]`
- `browser dialog --accept|--dismiss [--prompt <text>] [--target-id <id>] [--timeout-ms <ms>]`
- `browser wait [--time <ms>] [--text <value>] [--text-gone <value>] [--target-id <id>]`
- `browser evaluate --fn <code> [--ref <ref>] [--target-id <id>]`
- `browser console [--level <error|warn|info>] [--target-id <id>]`
- `browser pdf [--target-id <id>]`

## Tìm kiếm tài liệu

### `docs [query...]`

Tìm kiếm chỉ mục tài liệu trực tiếp.

## TUI

### `tui`

Mở giao diện terminal UI kết nối với Gateway.

Tùy chọn:

- `--url <url>`
- `--token <token>`
- `--password <password>`
- `--session <key>`
- `--deliver`
- `--thinking <level>`
- `--message <text>`
- `--timeout-ms <ms>` (mặc định là `agents.defaults.timeoutSeconds`)
- `--history-limit <n>`
