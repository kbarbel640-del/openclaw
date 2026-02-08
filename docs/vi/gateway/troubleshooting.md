---
summary: "Hướng dẫn xử lý sự cố nhanh cho các lỗi OpenClaw phổ biến"
read_when:
  - Khi điều tra các vấn đề hoặc lỗi lúc chạy
title: "Xử lý sự cố"
x-i18n:
  source_path: gateway/troubleshooting.md
  source_hash: a07bb06f0b5ef568
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:08:14Z
---

# Xử lý sự cố 🔧

Khi OpenClaw hoạt động không như mong muốn, đây là cách khắc phục.

Hãy bắt đầu với FAQ [60 giây đầu tiên](/help/faq#first-60-seconds-if-somethings-broken) nếu bạn chỉ cần một công thức kiểm tra nhanh. Trang này đi sâu hơn vào các lỗi lúc chạy và chẩn đoán.

Lối tắt theo từng provider: [/channels/troubleshooting](/channels/troubleshooting)

## Trạng thái & Chẩn đoán

Các lệnh kiểm tra nhanh (theo thứ tự):

| Command                            | Nó cho bạn biết điều gì                                                                                                 | Khi nào dùng                                      |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `openclaw status`                  | Tóm tắt cục bộ: OS + bản cập nhật, khả năng truy cập/chế độ gateway, dịch vụ, agent/phiên, trạng thái cấu hình provider | Kiểm tra đầu tiên, tổng quan nhanh                |
| `openclaw status --all`            | Chẩn đoán cục bộ đầy đủ (chỉ đọc, có thể dán, khá an toàn) kèm log gần nhất                                             | Khi bạn cần chia sẻ báo cáo debug                 |
| `openclaw status --deep`           | Chạy kiểm tra sức khỏe gateway (gồm probe provider; cần gateway truy cập được)                                          | Khi “đã cấu hình” nhưng chưa “hoạt động”          |
| `openclaw gateway probe`           | Khám phá gateway + khả năng truy cập (mục tiêu cục bộ + từ xa)                                                          | Khi bạn nghi ngờ đang probe nhầm gateway          |
| `openclaw channels status --probe` | Hỏi gateway đang chạy về trạng thái channel (và tùy chọn probe)                                                         | Khi gateway truy cập được nhưng channel trục trặc |
| `openclaw gateway status`          | Trạng thái supervisor (launchd/systemd/schtasks), PID/exit lúc chạy, lỗi gateway gần nhất                               | Khi dịch vụ “có vẻ đã load” nhưng không chạy      |
| `openclaw logs --follow`           | Log trực tiếp (tín hiệu tốt nhất cho sự cố lúc chạy)                                                                    | Khi cần lý do lỗi thực tế                         |

**Chia sẻ output:** ưu tiên `openclaw status --all` (đã che token). Nếu bạn dán `openclaw status`, hãy cân nhắc đặt `OPENCLAW_SHOW_SECRETS=0` trước (xem trước token).

Xem thêm: [Health checks](/gateway/health) và [Logging](/logging).

## Các vấn đề thường gặp

### No API key found for provider "anthropic"

Điều này có nghĩa là **kho xác thực của agent trống** hoặc thiếu thông tin đăng nhập Anthropic.
Xác thực là **theo từng agent**, vì vậy agent mới sẽ không kế thừa khóa của agent chính.

Cách khắc phục:

- Chạy lại onboarding và chọn **Anthropic** cho agent đó.
- Hoặc dán setup-token trên **máy host của gateway**:
  ```bash
  openclaw models auth setup-token --provider anthropic
  ```
- Hoặc sao chép `auth-profiles.json` từ thư mục agent chính sang thư mục agent mới.

Xác minh:

```bash
openclaw models status
```

### OAuth token refresh failed (Anthropic Claude subscription)

Điều này có nghĩa là token OAuth Anthropic đã lưu bị hết hạn và việc làm mới thất bại.
Nếu bạn dùng gói Claude subscription (không có API key), cách ổn định nhất là
chuyển sang **Claude Code setup-token** và dán nó trên **gateway host**.

**Khuyến nghị (setup-token):**

```bash
# Run on the gateway host (paste the setup-token)
openclaw models auth setup-token --provider anthropic
openclaw models status
```

Nếu bạn tạo token ở nơi khác:

```bash
openclaw models auth paste-token --provider anthropic
openclaw models status
```

Chi tiết thêm: [Anthropic](/providers/anthropic) và [OAuth](/concepts/oauth).

### Control UI lỗi trên HTTP ("device identity required" / "connect failed")

Nếu bạn mở dashboard qua HTTP thuần (ví dụ `http://<lan-ip>:18789/` hoặc
`http://<tailscale-ip>:18789/`), trình duyệt chạy trong **ngữ cảnh không an toàn** và
chặn WebCrypto, nên không thể tạo device identity.

**Cách khắc phục:**

- Ưu tiên HTTPS qua [Tailscale Serve](/gateway/tailscale).
- Hoặc mở cục bộ trên máy host gateway: `http://127.0.0.1:18789/`.
- Nếu buộc phải dùng HTTP, bật `gateway.controlUi.allowInsecureAuth: true` và
  dùng gateway token (chỉ token; không có device identity/pairing). Xem
  [Control UI](/web/control-ui#insecure-http).

### CI Secrets Scan Failed

Điều này có nghĩa là `detect-secrets` đã phát hiện các ứng viên mới chưa có trong baseline.
Làm theo [Secret scanning](/gateway/security#secret-scanning-detect-secrets).

### Service Installed but Nothing is Running

Nếu dịch vụ gateway đã được cài nhưng tiến trình thoát ngay lập tức, dịch vụ
có thể trông như “đã load” trong khi thực tế không có gì chạy.

**Kiểm tra:**

```bash
openclaw gateway status
openclaw doctor
```

Doctor/dịch vụ sẽ hiển thị trạng thái lúc chạy (PID/lần thoát cuối) và gợi ý log.

**Logs:**

- Ưu tiên: `openclaw logs --follow`
- Log file (luôn có): `/tmp/openclaw/openclaw-YYYY-MM-DD.log` (hoặc `logging.file` bạn cấu hình)
- macOS LaunchAgent (nếu cài): `$OPENCLAW_STATE_DIR/logs/gateway.log` và `gateway.err.log`
- Linux systemd (nếu cài): `journalctl --user -u openclaw-gateway[-<profile>].service -n 200 --no-pager`
- Windows: `schtasks /Query /TN "OpenClaw Gateway (<profile>)" /V /FO LIST`

**Bật thêm logging:**

- Tăng chi tiết log file (JSONL lưu trữ):
  ```json
  { "logging": { "level": "debug" } }
  ```
- Tăng độ verbose console (chỉ output TTY):
  ```json
  { "logging": { "consoleLevel": "debug", "consoleStyle": "pretty" } }
  ```
- Mẹo nhanh: `--verbose` chỉ ảnh hưởng đến output **console**. Log file vẫn do `logging.level` điều khiển.

Xem [/logging](/logging) để có cái nhìn đầy đủ về định dạng, cấu hình và truy cập.

### "Gateway start blocked: set gateway.mode=local"

Điều này có nghĩa là config tồn tại nhưng `gateway.mode` chưa được đặt (hoặc không phải `local`), nên
Gateway từ chối khởi động.

**Cách khắc phục (khuyến nghị):**

- Chạy wizard và đặt chế độ chạy Gateway là **Local**:
  ```bash
  openclaw configure
  ```
- Hoặc đặt trực tiếp:
  ```bash
  openclaw config set gateway.mode local
  ```

**Nếu bạn muốn chạy Gateway từ xa:**

- Đặt URL từ xa và giữ `gateway.mode=remote`:
  ```bash
  openclaw config set gateway.mode remote
  openclaw config set gateway.remote.url "wss://gateway.example.com"
  ```

**Chỉ cho ad-hoc/dev:** truyền `--allow-unconfigured` để khởi động gateway mà không cần
`gateway.mode=local`.

**Chưa có file config?** Chạy `openclaw setup` để tạo config khởi đầu, rồi chạy lại
gateway.

### Môi trường dịch vụ (PATH + runtime)

Dịch vụ gateway chạy với **PATH tối giản** để tránh rác từ shell/manager:

- macOS: `/opt/homebrew/bin`, `/usr/local/bin`, `/usr/bin`, `/bin`
- Linux: `/usr/local/bin`, `/usr/bin`, `/bin`

Điều này cố ý loại trừ các trình quản lý phiên bản (nvm/fnm/volta/asdf) và package
manager (pnpm/npm) vì dịch vụ không load shell init của bạn. Các biến runtime như
`DISPLAY` nên đặt trong `~/.openclaw/.env` (được gateway load sớm).
Exec chạy trên `host=gateway` sẽ merge `PATH` của login-shell vào môi trường exec,
vì vậy nếu thiếu công cụ thì thường là do shell init của bạn không export chúng
(hoặc đặt `tools.exec.pathPrepend`). Xem [/tools/exec](/tools/exec).

Các channel WhatsApp + Telegram yêu cầu **Node**; Bun không được hỗ trợ. Nếu
dịch vụ của bạn được cài bằng Bun hoặc đường dẫn Node do trình quản lý phiên bản,
hãy chạy `openclaw doctor` để chuyển sang Node cài ở hệ thống.

### Skill thiếu API key trong sandbox

**Triệu chứng:** Skill chạy trên host nhưng lỗi trong sandbox vì thiếu API key.

**Nguyên nhân:** exec trong sandbox chạy trong Docker và **không** kế thừa `process.env` của host.

**Cách khắc phục:**

- đặt `agents.defaults.sandbox.docker.env` (hoặc `agents.list[].sandbox.docker.env` theo từng agent)
- hoặc bake key vào image sandbox tùy chỉnh
- sau đó chạy `openclaw sandbox recreate --agent <id>` (hoặc `--all`)

### Service Running but Port Not Listening

Nếu dịch vụ báo **đang chạy** nhưng không có gì lắng nghe ở cổng gateway,
có khả năng Gateway đã từ chối bind.

**Ý nghĩa của “running” ở đây**

- `Runtime: running` nghĩa là supervisor (launchd/systemd/schtasks) nghĩ rằng tiến trình còn sống.
- `RPC probe` nghĩa là CLI thực sự kết nối được WebSocket gateway và gọi `status`.
- Luôn tin `Probe target:` + `Config (service):` như các dòng “chúng ta đã thử gì thực sự?”.

**Kiểm tra:**

- `gateway.mode` phải là `local` cho `openclaw gateway` và dịch vụ.
- Nếu bạn đặt `gateway.mode=remote`, **CLI mặc định** sẽ dùng URL từ xa. Dịch vụ vẫn có thể chạy cục bộ, nhưng CLI của bạn đang probe sai chỗ. Dùng `openclaw gateway status` để xem cổng đã resolve + mục tiêu probe (hoặc truyền `--url`).
- `openclaw gateway status` và `openclaw doctor` hiển thị **lỗi gateway gần nhất** từ log khi dịch vụ trông như đang chạy nhưng cổng đóng.
- Bind không phải loopback (`lan`/`tailnet`/`custom`, hoặc `auto` khi loopback không khả dụng) yêu cầu auth:
  `gateway.auth.token` (hoặc `OPENCLAW_GATEWAY_TOKEN`).
- `gateway.remote.token` chỉ dành cho CLI từ xa; nó **không** bật auth cục bộ.
- `gateway.token` bị bỏ qua; hãy dùng `gateway.auth.token`.

**Nếu `openclaw gateway status` cho thấy config không khớp**

- `Config (cli): ...` và `Config (service): ...` thường phải trùng nhau.
- Nếu không, gần như chắc chắn bạn đang chỉnh một config trong khi dịch vụ chạy config khác.
- Cách sửa: chạy lại `openclaw gateway install --force` từ cùng `--profile` / `OPENCLAW_STATE_DIR` mà bạn muốn dịch vụ dùng.

**Nếu `openclaw gateway status` báo lỗi config dịch vụ**

- Config supervisor (launchd/systemd/schtasks) thiếu các mặc định hiện tại.
- Cách sửa: chạy `openclaw doctor` để cập nhật (hoặc `openclaw gateway install --force` để ghi lại toàn bộ).

**Nếu `Last gateway error:` nhắc “refusing to bind … without auth”**

- Bạn đã đặt `gateway.bind` sang chế độ không loopback (`lan`/`tailnet`/`custom`, hoặc `auto` khi loopback không khả dụng) nhưng chưa cấu hình auth.
- Cách sửa: đặt `gateway.auth.mode` + `gateway.auth.token` (hoặc export `OPENCLAW_GATEWAY_TOKEN`) và khởi động lại dịch vụ.

**Nếu `openclaw gateway status` nói `bind=tailnet` nhưng không tìm thấy interface tailnet**

- Gateway cố bind vào IP Tailscale (100.64.0.0/10) nhưng không phát hiện trên host.
- Cách sửa: bật Tailscale trên máy đó (hoặc đổi `gateway.bind` sang `loopback`/`lan`).

**Nếu `Probe note:` nói probe dùng loopback**

- Điều này là bình thường với `bind=lan`: gateway lắng nghe trên `0.0.0.0` (mọi interface), và loopback vẫn kết nối được cục bộ.
- Với client từ xa, dùng IP LAN thực (không phải `0.0.0.0`) cộng cổng, và đảm bảo đã cấu hình auth.

### Address Already in Use (Port 18789)

Điều này có nghĩa là đã có thứ gì đó đang lắng nghe trên cổng gateway.

**Kiểm tra:**

```bash
openclaw gateway status
```

Nó sẽ hiển thị listener và nguyên nhân khả dĩ (gateway đã chạy, SSH tunnel).
Nếu cần, dừng dịch vụ hoặc chọn cổng khác.

### Extra Workspace Folders Detected

Nếu bạn nâng cấp từ bản cài cũ, có thể vẫn còn `~/openclaw` trên đĩa.
Nhiều thư mục workspace có thể gây trôi trạng thái hoặc auth khó hiểu vì
chỉ một workspace là hoạt động.

**Cách sửa:** giữ một workspace hoạt động duy nhất và lưu trữ/xóa các cái còn lại. Xem
[Agent workspace](/concepts/agent-workspace#extra-workspace-folders).

### Main chat chạy trong workspace sandbox

Triệu chứng: `pwd` hoặc các công cụ file hiển thị `~/.openclaw/sandboxes/...` dù bạn
mong đợi workspace host.

**Nguyên nhân:** `agents.defaults.sandbox.mode: "non-main"` dựa trên `session.mainKey` (mặc định `"main"`).
Các phiên nhóm/channel dùng khóa riêng, nên được xem là không phải main và
được gán workspace sandbox.

**Cách khắc phục:**

- Nếu bạn muốn workspace host cho agent: đặt `agents.list[].sandbox.mode: "off"`.
- Nếu bạn muốn truy cập workspace host bên trong sandbox: đặt `workspaceAccess: "rw"` cho agent đó.

### "Agent was aborted"

Agent bị gián đoạn giữa chừng khi trả lời.

**Nguyên nhân:**

- Người dùng gửi `stop`, `abort`, `esc`, `wait`, hoặc `exit`
- Quá thời gian
- Tiến trình bị crash

**Cách khắc phục:** Chỉ cần gửi lại tin nhắn khác. Phiên vẫn tiếp tục.

### "Agent failed before reply: Unknown model: anthropic/claude-haiku-3-5"

OpenClaw chủ động từ chối **các model cũ/không an toàn** (đặc biệt là những model
dễ bị prompt injection). Nếu thấy lỗi này, tên model không còn được hỗ trợ.

**Cách khắc phục:**

- Chọn model **mới nhất** cho provider và cập nhật config hoặc alias model.
- Nếu bạn không chắc model nào khả dụng, chạy `openclaw models list` hoặc
  `openclaw models scan` và chọn model được hỗ trợ.
- Kiểm tra log gateway để biết lý do lỗi chi tiết.

Xem thêm: [Models CLI](/cli/models) và [Model providers](/concepts/model-providers).

### Messages Not Triggering

**Kiểm tra 1:** Người gửi có trong allowlist không?

```bash
openclaw status
```

Tìm `AllowFrom: ...` trong output.

**Kiểm tra 2:** Với chat nhóm, có yêu cầu mention không?

```bash
# The message must match mentionPatterns or explicit mentions; defaults live in channel groups/guilds.
# Multi-agent: `agents.list[].groupChat.mentionPatterns` overrides global patterns.
grep -n "agents\\|groupChat\\|mentionPatterns\\|channels\\.whatsapp\\.groups\\|channels\\.telegram\\.groups\\|channels\\.imessage\\.groups\\|channels\\.discord\\.guilds" \
  "${OPENCLAW_CONFIG_PATH:-$HOME/.openclaw/openclaw.json}"
```

**Kiểm tra 3:** Kiểm tra log

```bash
openclaw logs --follow
# or if you want quick filters:
tail -f "$(ls -t /tmp/openclaw/openclaw-*.log | head -1)" | grep "blocked\\|skip\\|unauthorized"
```

### Pairing Code Not Arriving

Nếu `dmPolicy` là `pairing`, người gửi chưa biết sẽ nhận mã và tin nhắn của họ bị bỏ qua cho đến khi được duyệt.

**Kiểm tra 1:** Đã có yêu cầu pending nào đang chờ chưa?

```bash
openclaw pairing list <channel>
```

Các yêu cầu pairing DM pending bị giới hạn **3 mỗi channel** theo mặc định. Nếu danh sách đầy, yêu cầu mới sẽ không tạo mã cho đến khi có yêu cầu được duyệt hoặc hết hạn.

**Kiểm tra 2:** Yêu cầu có được tạo nhưng không có phản hồi gửi đi không?

```bash
openclaw logs --follow | grep "pairing request"
```

**Kiểm tra 3:** Xác nhận `dmPolicy` không phải `open`/`allowlist` cho channel đó.

### Image + Mention Not Working

Vấn đề đã biết: Khi bạn gửi ảnh với CHỈ một mention (không có chữ khác), WhatsApp đôi khi không đính kèm metadata mention.

**Cách tạm thời:** Thêm một ít chữ kèm mention:

- ❌ `@openclaw` + ảnh
- ✅ `@openclaw check this` + ảnh

### Session Not Resuming

**Kiểm tra 1:** File session có tồn tại không?

```bash
ls -la ~/.openclaw/agents/<agentId>/sessions/
```

**Kiểm tra 2:** Cửa sổ reset có quá ngắn không?

```json
{
  "session": {
    "reset": {
      "mode": "daily",
      "atHour": 4,
      "idleMinutes": 10080 // 7 days
    }
  }
}
```

**Kiểm tra 3:** Có ai gửi `/new`, `/reset`, hoặc trigger reset không?

### Agent Timing Out

Timeout mặc định là 30 phút. Với tác vụ dài:

```json
{
  "reply": {
    "timeoutSeconds": 3600 // 1 hour
  }
}
```

Hoặc dùng công cụ `process` để chạy nền lệnh dài.

### WhatsApp Disconnected

```bash
# Check local status (creds, sessions, queued events)
openclaw status
# Probe the running gateway + channels (WA connect + Telegram + Discord APIs)
openclaw status --deep

# View recent connection events
openclaw logs --limit 200 | grep "connection\\|disconnect\\|logout"
```

**Cách khắc phục:** Thường sẽ tự kết nối lại khi Gateway chạy. Nếu bị kẹt, khởi động lại tiến trình Gateway (theo cách bạn giám sát), hoặc chạy thủ công với output verbose:

```bash
openclaw gateway --verbose
```

Nếu bạn bị đăng xuất / unlink:

```bash
openclaw channels logout
trash "${OPENCLAW_STATE_DIR:-$HOME/.openclaw}/credentials" # if logout can't cleanly remove everything
openclaw channels login --verbose       # re-scan QR
```

### Media Send Failing

**Kiểm tra 1:** Đường dẫn file có hợp lệ không?

```bash
ls -la /path/to/your/image.jpg
```

**Kiểm tra 2:** Có quá lớn không?

- Ảnh: tối đa 6MB
- Audio/Video: tối đa 16MB
- Tài liệu: tối đa 100MB

**Kiểm tra 3:** Kiểm tra log media

```bash
grep "media\\|fetch\\|download" "$(ls -t /tmp/openclaw/openclaw-*.log | head -1)" | tail -20
```

### High Memory Usage

OpenClaw giữ lịch sử hội thoại trong bộ nhớ.

**Cách khắc phục:** Khởi động lại định kỳ hoặc đặt giới hạn session:

```json
{
  "session": {
    "historyLimit": 100 // Max messages to keep
  }
}
```

## Xử lý sự cố chung

### “Gateway không khởi động — cấu hình không hợp lệ”

OpenClaw hiện từ chối khởi động khi config chứa khóa không xác định, giá trị sai định dạng, hoặc kiểu không hợp lệ.
Điều này là có chủ ý để đảm bảo an toàn.

Sửa bằng Doctor:

```bash
openclaw doctor
openclaw doctor --fix
```

Ghi chú:

- `openclaw doctor` báo cáo mọi mục không hợp lệ.
- `openclaw doctor --fix` áp dụng migration/sửa chữa và ghi lại config.
- Các lệnh chẩn đoán như `openclaw logs`, `openclaw health`, `openclaw status`, `openclaw gateway status`, và `openclaw gateway probe` vẫn chạy ngay cả khi config không hợp lệ.

### “All models failed” — nên kiểm tra gì trước?

- **Thông tin xác thực** có cho provider đang thử (auth profiles + biến môi trường).
- **Định tuyến model**: xác nhận `agents.defaults.model.primary` và fallback là các model bạn có quyền truy cập.
- **Log gateway** trong `/tmp/openclaw/…` để xem lỗi provider chính xác.
- **Trạng thái model**: dùng `/model status` (chat) hoặc `openclaw models status` (CLI).

### Tôi dùng WhatsApp cá nhân — vì sao self-chat kỳ lạ?

Bật chế độ self-chat và allowlist số của chính bạn:

```json5
{
  channels: {
    whatsapp: {
      selfChatMode: true,
      dmPolicy: "allowlist",
      allowFrom: ["+15555550123"],
    },
  },
}
```

Xem [WhatsApp setup](/channels/whatsapp).

### WhatsApp đăng xuất tôi. Làm sao xác thực lại?

Chạy lại lệnh đăng nhập và quét QR code:

```bash
openclaw channels login
```

### Lỗi build trên `main` — lộ trình sửa tiêu chuẩn là gì?

1. `git pull origin main && pnpm install`
2. `openclaw doctor`
3. Kiểm tra GitHub issues hoặc Discord
4. Cách tạm thời: checkout một commit cũ hơn

### npm install thất bại (allow-build-scripts / thiếu tar hoặc yargs). Giờ sao?

Nếu bạn chạy từ source, hãy dùng package manager của repo: **pnpm** (ưu tiên).
Repo khai báo `packageManager: "pnpm@…"`.

Khôi phục thường gặp:

```bash
git status   # ensure you’re in the repo root
pnpm install
pnpm build
openclaw doctor
openclaw gateway restart
```

Lý do: pnpm là package manager được cấu hình cho repo này.

### Làm sao chuyển giữa cài đặt git và cài đặt npm?

Dùng **website installer** và chọn phương thức cài bằng cờ. Nó
nâng cấp tại chỗ và ghi lại dịch vụ gateway để trỏ tới bản cài mới.

Chuyển **sang git install**:

```bash
curl -fsSL https://openclaw.ai/install.sh | bash -s -- --install-method git --no-onboard
```

Chuyển **sang npm global**:

```bash
curl -fsSL https://openclaw.ai/install.sh | bash
```

Ghi chú:

- Luồng git chỉ rebase nếu repo sạch. Commit hoặc stash thay đổi trước.
- Sau khi chuyển, chạy:
  ```bash
  openclaw doctor
  openclaw gateway restart
  ```

### Telegram block streaming không tách text giữa các lần gọi tool. Vì sao?

Block streaming chỉ gửi **các khối text đã hoàn thành**. Các lý do thường gặp khiến bạn chỉ thấy một tin nhắn:

- `agents.defaults.blockStreamingDefault` vẫn là `"off"`.
- `channels.telegram.blockStreaming` được đặt là `false`.
- `channels.telegram.streamMode` là `partial` hoặc `block` **và draft streaming đang bật**
  (chat riêng + topics). Draft streaming vô hiệu block streaming trong trường hợp này.
- Thiết lập `minChars` / coalesce quá cao nên các mảnh bị gộp.
- Model phát ra một khối text lớn (không có điểm flush giữa chừng).

Danh sách sửa:

1. Đặt thiết lập block streaming dưới `agents.defaults`, không phải root.
2. Đặt `channels.telegram.streamMode: "off"` nếu bạn muốn trả lời block nhiều tin nhắn thực sự.
3. Dùng ngưỡng chunk/coalesce nhỏ hơn khi debug.

Xem [Streaming](/concepts/streaming).

### Discord không trả lời trong server dù có `requireMention: false`. Vì sao?

`requireMention` chỉ kiểm soát việc yêu cầu mention **sau khi** channel vượt qua allowlist.
Mặc định `channels.discord.groupPolicy` là **allowlist**, nên guild phải được bật rõ ràng.
Nếu bạn đặt `channels.discord.guilds.<guildId>.channels`, chỉ các channel được liệt kê mới được phép; bỏ nó đi để cho phép mọi channel trong guild.

Danh sách sửa:

1. Đặt `channels.discord.groupPolicy: "open"` **hoặc** thêm mục allowlist cho guild (và tùy chọn allowlist cho channel).
2. Dùng **ID channel dạng số** trong `channels.discord.guilds.<guildId>.channels`.
3. Đặt `requireMention: false` **dưới** `channels.discord.guilds` (toàn cục hoặc theo channel).
   Khóa top-level `channels.discord.requireMention` không được hỗ trợ.
4. Đảm bảo bot có **Message Content Intent** và quyền channel.
5. Chạy `openclaw channels status --probe` để có gợi ý audit.

Tài liệu: [Discord](/channels/discord), [Channels troubleshooting](/channels/troubleshooting).

### Lỗi Cloud Code Assist API: invalid tool schema (400). Giờ sao?

Hầu như luôn là vấn đề **tương thích schema của tool**. Endpoint Cloud Code Assist
chỉ chấp nhận một tập con nghiêm ngặt của JSON Schema. OpenClaw làm sạch/chuẩn hóa
schema tool trong `main` hiện tại, nhưng bản sửa chưa có trong bản phát hành gần nhất (tính đến
13 tháng 1, 2026).

Danh sách sửa:

1. **Cập nhật OpenClaw**:
   - Nếu có thể chạy từ source, pull `main` và khởi động lại gateway.
   - Nếu không, chờ bản phát hành tiếp theo có schema scrubber.
2. Tránh các keyword không được hỗ trợ như `anyOf/oneOf/allOf`, `patternProperties`,
   `additionalProperties`, `minLength`, `maxLength`, `format`, v.v.
3. Nếu bạn định nghĩa tool tùy chỉnh, giữ schema top-level là `type: "object"` với
   `properties` và enum đơn giản.

Xem [Tools](/tools) và [TypeBox schemas](/concepts/typebox).

## Các vấn đề riêng cho macOS

### App crash khi cấp quyền (Speech/Mic)

Nếu app biến mất hoặc hiện "Abort trap 6" khi bạn bấm "Allow" trong hộp thoại quyền riêng tư:

**Cách 1: Reset TCC Cache**

```bash
tccutil reset All bot.molt.mac.debug
```

**Cách 2: Ép Bundle ID mới**
Nếu reset không hiệu quả, đổi `BUNDLE_ID` trong [`scripts/package-mac-app.sh`](https://github.com/openclaw/openclaw/blob/main/scripts/package-mac-app.sh) (ví dụ thêm hậu tố `.test`) và build lại. Điều này buộc macOS coi đây là app mới.

### Gateway kẹt ở "Starting..."

App kết nối tới gateway cục bộ trên cổng `18789`. Nếu bị kẹt:

**Cách 1: Dừng supervisor (ưu tiên)**
Nếu gateway được giám sát bởi launchd, kill PID chỉ khiến nó respawn. Hãy dừng supervisor trước:

```bash
openclaw gateway status
openclaw gateway stop
# Or: launchctl bootout gui/$UID/bot.molt.gateway (replace with bot.molt.<profile>; legacy com.openclaw.* still works)
```

**Cách 2: Cổng đang bận (tìm listener)**

```bash
lsof -nP -iTCP:18789 -sTCP:LISTEN
```

Nếu là tiến trình không được giám sát, thử dừng nhẹ nhàng trước, rồi tăng mức:

```bash
kill -TERM <PID>
sleep 1
kill -9 <PID> # last resort
```

**Cách 3: Kiểm tra cài đặt CLI**
Đảm bảo CLI `openclaw` toàn cục đã được cài và khớp phiên bản với app:

```bash
openclaw --version
npm install -g openclaw@<version>
```

## Debug Mode

Bật logging chi tiết:

```bash
# Turn on trace logging in config:
#   ${OPENCLAW_CONFIG_PATH:-$HOME/.openclaw/openclaw.json} -> { logging: { level: "trace" } }
#
# Then run verbose commands to mirror debug output to stdout:
openclaw gateway --verbose
openclaw channels login --verbose
```

## Vị trí log

| Log                              | Vị trí                                                                                                                                                                                                                                                                                                                       |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Log file Gateway (có cấu trúc)   | `/tmp/openclaw/openclaw-YYYY-MM-DD.log` (hoặc `logging.file`)                                                                                                                                                                                                                                                                |
| Log dịch vụ Gateway (supervisor) | macOS: `$OPENCLAW_STATE_DIR/logs/gateway.log` + `gateway.err.log` (mặc định: `~/.openclaw/logs/...`; profile dùng `~/.openclaw-<profile>/logs/...`)<br />Linux: `journalctl --user -u openclaw-gateway[-<profile>].service -n 200 --no-pager`<br />Windows: `schtasks /Query /TN "OpenClaw Gateway (<profile>)" /V /FO LIST` |
| File session                     | `$OPENCLAW_STATE_DIR/agents/<agentId>/sessions/`                                                                                                                                                                                                                                                                             |
| Media cache                      | `$OPENCLAW_STATE_DIR/media/`                                                                                                                                                                                                                                                                                                 |
| Thông tin xác thực               | `$OPENCLAW_STATE_DIR/credentials/`                                                                                                                                                                                                                                                                                           |

## Health Check

```bash
# Supervisor + probe target + config paths
openclaw gateway status
# Include system-level scans (legacy/extra services, port listeners)
openclaw gateway status --deep

# Is the gateway reachable?
openclaw health --json
# If it fails, rerun with connection details:
openclaw health --verbose

# Is something listening on the default port?
lsof -nP -iTCP:18789 -sTCP:LISTEN

# Recent activity (RPC log tail)
openclaw logs --follow
# Fallback if RPC is down
tail -20 /tmp/openclaw/openclaw-*.log
```

## Reset Everything

Phương án hạt nhân:

```bash
openclaw gateway stop
# If you installed a service and want a clean install:
# openclaw gateway uninstall

trash "${OPENCLAW_STATE_DIR:-$HOME/.openclaw}"
openclaw channels login         # re-pair WhatsApp
openclaw gateway restart           # or: openclaw gateway
```

⚠️ Việc này sẽ mất toàn bộ session và yêu cầu ghép nối lại WhatsApp.

## Nhận trợ giúp

1. Kiểm tra log trước: `/tmp/openclaw/` (mặc định: `openclaw-YYYY-MM-DD.log`, hoặc `logging.file` bạn cấu hình)
2. Tìm trong các issue hiện có trên GitHub
3. Mở issue mới với:
   - Phiên bản OpenClaw
   - Đoạn log liên quan
   - Các bước tái hiện
   - Config của bạn (che bí mật!)

---

_"Bạn đã thử tắt đi bật lại chưa?"_ — Mọi dân IT từ trước tới nay

🦞🔧

### Browser Not Starting (Linux)

Nếu bạn thấy `"Failed to start Chrome CDP on port 18800"`:

**Nguyên nhân rất có thể:** Chromium được đóng gói bằng Snap trên Ubuntu.

**Cách sửa nhanh:** Cài Google Chrome thay thế:

```bash
wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
sudo dpkg -i google-chrome-stable_current_amd64.deb
```

Sau đó đặt trong config:

```json
{
  "browser": {
    "executablePath": "/usr/bin/google-chrome-stable"
  }
}
```

**Hướng dẫn đầy đủ:** Xem [browser-linux-troubleshooting](/tools/browser-linux-troubleshooting)
