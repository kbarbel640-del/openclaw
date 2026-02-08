---
summary: "Slash command: văn bản so với native, cấu hình và các lệnh được hỗ trợ"
read_when:
  - Khi sử dụng hoặc cấu hình lệnh chat
  - Khi gỡ lỗi định tuyến lệnh hoặc quyền
title: "Slash Commands"
x-i18n:
  source_path: tools/slash-commands.md
  source_hash: ca0deebf89518e8c
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:09:12Z
---

# Slash commands

Các lệnh được xử lý bởi Gateway. Hầu hết lệnh phải được gửi dưới dạng một tin nhắn **độc lập** bắt đầu bằng `/`.
Lệnh chat bash chỉ dành cho host dùng `! <cmd>` (với `/bash <cmd>` là bí danh).

Có hai hệ thống liên quan:

- **Commands**: các tin nhắn `/...` độc lập.
- **Directives**: `/think`, `/verbose`, `/reasoning`, `/elevated`, `/exec`, `/model`, `/queue`.
  - Directives bị loại bỏ khỏi tin nhắn trước khi mô hình nhìn thấy.
  - Trong tin nhắn chat thông thường (không chỉ có directive), chúng được xem là “gợi ý nội tuyến” và **không** lưu thiết lập phiên.
  - Trong tin nhắn chỉ chứa directive (tin nhắn chỉ có directive), chúng được lưu vào phiên và trả lời bằng một thông báo xác nhận.
  - Directives chỉ được áp dụng cho **người gửi được ủy quyền** (allowlist/kết đôi kênh cộng với `commands.useAccessGroups`).
    Người gửi không được ủy quyền sẽ thấy directive bị xử lý như văn bản thường.

Ngoài ra còn có một vài **lối tắt nội tuyến** (chỉ người gửi trong allowlist/được ủy quyền): `/help`, `/commands`, `/status`, `/whoami` (`/id`).
Chúng chạy ngay lập tức, bị loại bỏ trước khi mô hình nhìn thấy tin nhắn, và phần văn bản còn lại tiếp tục theo luồng bình thường.

## Config

```json5
{
  commands: {
    native: "auto",
    nativeSkills: "auto",
    text: true,
    bash: false,
    bashForegroundMs: 2000,
    config: false,
    debug: false,
    restart: false,
    useAccessGroups: true,
  },
}
```

- `commands.text` (mặc định `true`) bật việc phân tích `/...` trong tin nhắn chat.
  - Trên các nền tảng không có lệnh native (WhatsApp/WebChat/Signal/iMessage/Google Chat/MS Teams), lệnh văn bản vẫn hoạt động ngay cả khi bạn đặt giá trị này thành `false`.
- `commands.native` (mặc định `"auto"`) đăng ký các lệnh native.
  - Tự động: bật cho Discord/Telegram; tắt cho Slack (cho đến khi bạn thêm slash command); bỏ qua với các nhà cung cấp không hỗ trợ native.
  - Đặt `channels.discord.commands.native`, `channels.telegram.commands.native` hoặc `channels.slack.commands.native` để ghi đè theo từng nhà cung cấp (bool hoặc `"auto"`).
  - `false` xóa các lệnh đã đăng ký trước đó trên Discord/Telegram khi khởi động. Lệnh Slack được quản lý trong ứng dụng Slack và không bị gỡ tự động.
- `commands.nativeSkills` (mặc định `"auto"`) đăng ký các lệnh **skill** theo dạng native khi được hỗ trợ.
  - Tự động: bật cho Discord/Telegram; tắt cho Slack (Slack yêu cầu tạo một slash command cho mỗi skill).
  - Đặt `channels.discord.commands.nativeSkills`, `channels.telegram.commands.nativeSkills` hoặc `channels.slack.commands.nativeSkills` để ghi đè theo từng nhà cung cấp (bool hoặc `"auto"`).
- `commands.bash` (mặc định `false`) cho phép `! <cmd>` chạy các lệnh shell của host (`/bash <cmd>` là bí danh; yêu cầu allowlist `tools.elevated`).
- `commands.bashForegroundMs` (mặc định `2000`) kiểm soát thời gian bash chờ trước khi chuyển sang chế độ nền (`0` đưa xuống nền ngay lập tức).
- `commands.config` (mặc định `false`) bật `/config` (đọc/ghi `openclaw.json`).
- `commands.debug` (mặc định `false`) bật `/debug` (ghi đè chỉ trong runtime).
- `commands.useAccessGroups` (mặc định `true`) thực thi allowlist/chính sách cho các lệnh.

## Danh sách lệnh

Văn bản + native (khi bật):

- `/help`
- `/commands`
- `/skill <name> [input]` (chạy một skill theo tên)
- `/status` (hiển thị trạng thái hiện tại; bao gồm mức sử dụng/hạn ngạch của nhà cung cấp cho mô hình hiện tại khi có)
- `/allowlist` (liệt kê/thêm/xóa mục allowlist)
- `/approve <id> allow-once|allow-always|deny` (giải quyết các lời nhắc phê duyệt exec)
- `/context [list|detail|json]` (giải thích “context”; `detail` hiển thị kích thước theo từng tệp + từng công cụ + từng skill + system prompt)
- `/whoami` (hiển thị sender id của bạn; bí danh: `/id`)
- `/subagents list|stop|log|info|send` (kiểm tra, dừng, ghi log hoặc nhắn tin các lần chạy sub-agent cho phiên hiện tại)
- `/config show|get|set|unset` (lưu cấu hình xuống đĩa, chỉ owner; yêu cầu `commands.config: true`)
- `/debug show|set|unset|reset` (ghi đè runtime, chỉ owner; yêu cầu `commands.debug: true`)
- `/usage off|tokens|full|cost` (chân trang mức sử dụng theo từng phản hồi hoặc tóm tắt chi phí cục bộ)
- `/tts off|always|inbound|tagged|status|provider|limit|summary|audio` (điều khiển TTS; xem [/tts](/tts))
  - Discord: lệnh native là `/voice` (Discord dành riêng `/tts`); lệnh văn bản `/tts` vẫn hoạt động.
- `/stop`
- `/restart`
- `/dock-telegram` (bí danh: `/dock_telegram`) (chuyển phản hồi sang Telegram)
- `/dock-discord` (bí danh: `/dock_discord`) (chuyển phản hồi sang Discord)
- `/dock-slack` (bí danh: `/dock_slack`) (chuyển phản hồi sang Slack)
- `/activation mention|always` (chỉ nhóm)
- `/send on|off|inherit` (chỉ owner)
- `/reset` hoặc `/new [model]` (gợi ý mô hình tùy chọn; phần còn lại được chuyển tiếp)
- `/think <off|minimal|low|medium|high|xhigh>` (lựa chọn động theo mô hình/nhà cung cấp; bí danh: `/thinking`, `/t`)
- `/verbose on|full|off` (bí danh: `/v`)
- `/reasoning on|off|stream` (bí danh: `/reason`; khi bật, gửi một tin nhắn riêng bắt đầu bằng `Reasoning:`; `stream` = chỉ bản nháp Telegram)
- `/elevated on|off|ask|full` (bí danh: `/elev`; `full` bỏ qua phê duyệt exec)
- `/exec host=<sandbox|gateway|node> security=<deny|allowlist|full> ask=<off|on-miss|always> node=<id>` (gửi `/exec` để hiển thị hiện tại)
- `/model <name>` (bí danh: `/models`; hoặc `/<alias>` từ `agents.defaults.models.*.alias`)
- `/queue <mode>` (kèm các tùy chọn như `debounce:2s cap:25 drop:summarize`; gửi `/queue` để xem cài đặt hiện tại)
- `/bash <command>` (chỉ host; bí danh cho `! <command>`; yêu cầu allowlist `commands.bash: true` + `tools.elevated`)

Chỉ văn bản:

- `/compact [instructions]` (xem [/concepts/compaction](/concepts/compaction))
- `! <command>` (chỉ host; mỗi lần một lệnh; dùng `!poll` + `!stop` cho các job chạy lâu)
- `!poll` (kiểm tra đầu ra / trạng thái; chấp nhận `sessionId` tùy chọn; `/bash poll` cũng hoạt động)
- `!stop` (dừng job bash đang chạy; chấp nhận `sessionId` tùy chọn; `/bash stop` cũng hoạt động)

Ghi chú:

- Lệnh chấp nhận `:` tùy chọn giữa lệnh và đối số (ví dụ: `/think: high`, `/send: on`, `/help:`).
- `/new <model>` chấp nhận bí danh mô hình, `provider/model`, hoặc tên nhà cung cấp (khớp mờ); nếu không khớp, văn bản được xem là nội dung tin nhắn.
- Để xem chi tiết đầy đủ về mức sử dụng theo nhà cung cấp, dùng `openclaw status --usage`.
- `/allowlist add|remove` yêu cầu `commands.config=true` và tuân theo `configWrites` của kênh.
- `/usage` kiểm soát chân trang mức sử dụng theo phản hồi; `/usage cost` in ra tóm tắt chi phí cục bộ từ log phiên OpenClaw.
- `/restart` bị tắt theo mặc định; đặt `commands.restart: true` để bật.
- `/verbose` предназнач để gỡ lỗi và tăng khả năng quan sát; hãy giữ **tắt** trong sử dụng bình thường.
- `/reasoning` (và `/verbose`) rủi ro trong bối cảnh nhóm: chúng có thể làm lộ suy luận nội bộ hoặc đầu ra công cụ mà bạn không định chia sẻ. Nên để tắt, đặc biệt trong chat nhóm.
- **Fast path:** tin nhắn chỉ có lệnh từ người gửi trong allowlist được xử lý ngay (bỏ qua hàng đợi + mô hình).
- **Group mention gating:** tin nhắn chỉ có lệnh từ người gửi trong allowlist bỏ qua yêu cầu mention.
- **Inline shortcuts (chỉ người gửi trong allowlist):** một số lệnh cũng hoạt động khi được nhúng trong tin nhắn bình thường và bị loại bỏ trước khi mô hình thấy phần văn bản còn lại.
  - Ví dụ: `hey /status` kích hoạt phản hồi trạng thái, và phần văn bản còn lại tiếp tục theo luồng bình thường.
- Hiện tại: `/help`, `/commands`, `/status`, `/whoami` (`/id`).
- Tin nhắn chỉ có lệnh từ người không được ủy quyền sẽ bị bỏ qua im lặng, và các token nội tuyến `/...` được xử lý như văn bản thường.
- **Skill commands:** các skill `user-invocable` được lộ ra dưới dạng slash command. Tên được làm sạch thành `a-z0-9_` (tối đa 32 ký tự); trùng tên sẽ được gắn hậu tố số (ví dụ: `_2`).
  - `/skill <name> [input]` chạy một skill theo tên (hữu ích khi giới hạn lệnh native ngăn việc tạo lệnh cho từng skill).
  - Theo mặc định, lệnh skill được chuyển tới mô hình như một yêu cầu bình thường.
  - Skill có thể tùy chọn khai báo `command-dispatch: tool` để định tuyến lệnh trực tiếp tới một tool (xác định, không qua mô hình).
  - Ví dụ: `/prose` (plugin OpenProse) — xem [OpenProse](/prose).
- **Đối số lệnh native:** Discord dùng autocomplete cho các tùy chọn động (và menu nút khi bạn bỏ qua đối số bắt buộc). Telegram và Slack hiển thị menu nút khi lệnh hỗ trợ lựa chọn và bạn bỏ qua đối số.

## Bề mặt sử dụng (hiển thị ở đâu)

- **Mức sử dụng/hạn ngạch theo nhà cung cấp** (ví dụ: “Claude còn 80%”) hiển thị trong `/status` cho nhà cung cấp mô hình hiện tại khi bật theo dõi sử dụng.
- **Token/chi phí theo phản hồi** được kiểm soát bởi `/usage off|tokens|full` (được gắn vào phản hồi bình thường).
- `/model status` nói về **mô hình/xác thực/endpoint**, không phải mức sử dụng.

## Chọn mô hình (`/model`)

`/model` được triển khai như một directive.

Ví dụ:

```
/model
/model list
/model 3
/model openai/gpt-5.2
/model opus@anthropic:default
/model status
```

Ghi chú:

- `/model` và `/model list` hiển thị bộ chọn gọn, có đánh số (họ mô hình + các nhà cung cấp khả dụng).
- `/model <#>` chọn từ bộ chọn đó (và ưu tiên nhà cung cấp hiện tại khi có thể).
- `/model status` hiển thị chế độ xem chi tiết, bao gồm endpoint nhà cung cấp đã cấu hình (`baseUrl`) và chế độ API (`api`) khi có.

## Ghi đè gỡ lỗi

`/debug` cho phép bạn đặt ghi đè cấu hình **chỉ trong runtime** (bộ nhớ, không ghi đĩa). Chỉ owner. Tắt theo mặc định; bật bằng `commands.debug: true`.

Ví dụ:

```
/debug show
/debug set messages.responsePrefix="[openclaw]"
/debug set channels.whatsapp.allowFrom=["+1555","+4477"]
/debug unset messages.responsePrefix
/debug reset
```

Ghi chú:

- Ghi đè áp dụng ngay cho các lần đọc cấu hình mới, nhưng **không** ghi vào `openclaw.json`.
- Dùng `/debug reset` để xóa tất cả ghi đè và quay lại cấu hình trên đĩa.

## Cập nhật cấu hình

`/config` ghi vào cấu hình trên đĩa của bạn (`openclaw.json`). Chỉ owner. Tắt theo mặc định; bật bằng `commands.config: true`.

Ví dụ:

```
/config show
/config show messages.responsePrefix
/config get messages.responsePrefix
/config set messages.responsePrefix="[openclaw]"
/config unset messages.responsePrefix
```

Ghi chú:

- Cấu hình được kiểm tra hợp lệ trước khi ghi; thay đổi không hợp lệ sẽ bị từ chối.
- Các cập nhật `/config` được giữ qua các lần khởi động lại.

## Ghi chú theo bề mặt

- **Lệnh văn bản** chạy trong phiên chat bình thường (DMs chia sẻ `main`, nhóm có phiên riêng).
- **Lệnh native** dùng các phiên cô lập:
  - Discord: `agent:<agentId>:discord:slash:<userId>`
  - Slack: `agent:<agentId>:slack:slash:<userId>` (tiền tố cấu hình qua `channels.slack.slashCommand.sessionPrefix`)
  - Telegram: `telegram:slash:<userId>` (nhắm vào phiên chat qua `CommandTargetSessionKey`)
- **`/stop`** nhắm vào phiên chat đang hoạt động để có thể hủy lần chạy hiện tại.
- **Slack:** `channels.slack.slashCommand` vẫn được hỗ trợ cho một lệnh kiểu `/openclaw` duy nhất. Nếu bạn bật `commands.native`, bạn phải tạo một Slack slash command cho mỗi lệnh tích hợp sẵn (cùng tên với `/help`). Menu đối số lệnh cho Slack được gửi dưới dạng các nút Block Kit tạm thời.
