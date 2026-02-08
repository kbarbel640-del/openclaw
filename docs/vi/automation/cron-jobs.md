---
summary: "Cron jobs + đánh thức cho bộ lập lịch Gateway"
read_when:
  - Lập lịch các tác vụ nền hoặc đánh thức
  - Kết nối tự động hóa cần chạy cùng hoặc song song với heartbeat
  - Quyết định giữa heartbeat và cron cho các tác vụ theo lịch
title: "Cron Jobs"
x-i18n:
  source_path: automation/cron-jobs.md
  source_hash: 523721a7da2c4e27
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:06:22Z
---

# Cron jobs (bộ lập lịch Gateway)

> **Cron hay Heartbeat?** Xem [Cron vs Heartbeat](/automation/cron-vs-heartbeat) để được hướng dẫn khi nào nên dùng mỗi loại.

Cron là bộ lập lịch tích hợp sẵn của Gateway. Nó lưu trữ các job, đánh thức tác tử
đúng thời điểm và có thể tùy chọn gửi kết quả trở lại một cuộc trò chuyện.

Nếu bạn muốn _“chạy việc này mỗi sáng”_ hoặc _“chọc tác tử sau 20 phút”_,
cron là cơ chế phù hợp.

## TL;DR

- Cron chạy **bên trong Gateway** (không chạy bên trong model).
- Job được lưu bền vững dưới `~/.openclaw/cron/` nên việc khởi động lại không làm mất lịch.
- Hai kiểu thực thi:
  - **Phiên chính**: xếp hàng một sự kiện hệ thống, rồi chạy ở heartbeat kế tiếp.
  - **Cô lập**: chạy một lượt tác tử riêng trong `cron:<jobId>`, có phân phối (mặc định là announce hoặc không).
- Wakeup là hạng nhất: một job có thể yêu cầu “đánh thức ngay” so với “heartbeat kế tiếp”.

## Quick start (thực hành ngay)

Tạo một lời nhắc một lần, xác nhận nó tồn tại và chạy ngay lập tức:

```bash
openclaw cron add \
  --name "Reminder" \
  --at "2026-02-01T16:00:00Z" \
  --session main \
  --system-event "Reminder: check the cron docs draft" \
  --wake now \
  --delete-after-run

openclaw cron list
openclaw cron run <job-id> --force
openclaw cron runs --id <job-id>
```

Lập lịch một job cô lập lặp lại với phân phối:

```bash
openclaw cron add \
  --name "Morning brief" \
  --cron "0 7 * * *" \
  --tz "America/Los_Angeles" \
  --session isolated \
  --message "Summarize overnight updates." \
  --announce \
  --channel slack \
  --to "channel:C1234567890"
```

## Tương đương gọi công cụ (Gateway cron tool)

Để xem các dạng JSON chuẩn và ví dụ, xem [JSON schema for tool calls](/automation/cron-jobs#json-schema-for-tool-calls).

## Nơi lưu trữ cron jobs

Cron job được lưu bền vững trên máy chủ Gateway tại `~/.openclaw/cron/jobs.json` theo mặc định.
Gateway nạp tệp vào bộ nhớ và ghi lại khi có thay đổi, vì vậy chỉnh sửa thủ công
chỉ an toàn khi Gateway đã dừng. Ưu tiên dùng `openclaw cron add/edit` hoặc API gọi công cụ cron
để thay đổi.

## Tổng quan dễ hiểu cho người mới

Hãy nghĩ một cron job gồm: **khi nào** chạy + **chạy cái gì**.

1. **Chọn lịch**
   - Lời nhắc một lần → `schedule.kind = "at"` (CLI: `--at`)
   - Job lặp lại → `schedule.kind = "every"` hoặc `schedule.kind = "cron"`
   - Nếu dấu thời gian ISO thiếu múi giờ, nó được coi là **UTC**.

2. **Chọn nơi chạy**
   - `sessionTarget: "main"` → chạy trong heartbeat kế tiếp với ngữ cảnh chính.
   - `sessionTarget: "isolated"` → chạy một lượt tác tử riêng trong `cron:<jobId>`.

3. **Chọn payload**
   - Phiên chính → `payload.kind = "systemEvent"`
   - Phiên cô lập → `payload.kind = "agentTurn"`

Tùy chọn: job một lần (`schedule.kind = "at"`) sẽ xóa sau khi thành công theo mặc định. Đặt
`deleteAfterRun: false` để giữ lại (chúng sẽ bị vô hiệu hóa sau khi thành công).

## Khái niệm

### Jobs

Một cron job là một bản ghi được lưu với:

- một **lịch** (khi nào chạy),
- một **payload** (chạy gì),
- **chế độ phân phối** tùy chọn (announce hoặc none).
- **ràng buộc tác tử** tùy chọn (`agentId`): chạy job dưới một tác tử cụ thể; nếu
  thiếu hoặc không xác định, Gateway sẽ dùng tác tử mặc định.

Job được định danh bằng `jobId` ổn định (dùng bởi CLI/API Gateway).
Trong các gọi công cụ của tác tử, `jobId` là chuẩn; `id` cũ vẫn được chấp nhận để tương thích.
Job một lần tự động xóa sau khi thành công theo mặc định; đặt `deleteAfterRun: false` để giữ lại.

### Lịch

Cron hỗ trợ ba loại lịch:

- `at`: dấu thời gian một lần qua `schedule.at` (ISO 8601).
- `every`: khoảng thời gian cố định (ms).
- `cron`: biểu thức cron 5 trường với múi giờ IANA tùy chọn.

Biểu thức cron dùng `croner`. Nếu bỏ qua múi giờ, múi giờ cục bộ của máy chủ Gateway
sẽ được dùng.

### Thực thi phiên chính vs cô lập

#### Job phiên chính (sự kiện hệ thống)

Job phiên chính xếp hàng một sự kiện hệ thống và có thể đánh thức trình chạy heartbeat.
Chúng phải dùng `payload.kind = "systemEvent"`.

- `wakeMode: "next-heartbeat"` (mặc định): sự kiện chờ đến heartbeat theo lịch kế tiếp.
- `wakeMode: "now"`: sự kiện kích hoạt chạy heartbeat ngay lập tức.

Phù hợp nhất khi bạn muốn prompt heartbeat chuẩn + ngữ cảnh phiên chính.
Xem [Heartbeat](/gateway/heartbeat).

#### Job cô lập (phiên cron riêng)

Job cô lập chạy một lượt tác tử riêng trong phiên `cron:<jobId>`.

Hành vi chính:

- Prompt được thêm tiền tố `[cron:<jobId> <job name>]` để dễ truy vết.
- Mỗi lần chạy bắt đầu một **session id mới** (không mang theo hội thoại trước).
- Hành vi mặc định: nếu bỏ qua `delivery`, job cô lập sẽ announce một bản tóm tắt (`delivery.mode = "announce"`).
- `delivery.mode` (chỉ cô lập) quyết định điều gì xảy ra:
  - `announce`: phân phối bản tóm tắt tới kênh đích và đăng một tóm tắt ngắn lên phiên chính.
  - `none`: chỉ nội bộ (không phân phối, không tóm tắt phiên chính).
- `wakeMode` kiểm soát thời điểm đăng tóm tắt phiên chính:
  - `now`: heartbeat ngay lập tức.
  - `next-heartbeat`: chờ heartbeat theo lịch kế tiếp.

Dùng job cô lập cho các tác vụ ồn ào, tần suất cao, hoặc “việc nền” không nên làm
spam lịch sử chat chính.

### Dạng payload (chạy gì)

Hỗ trợ hai loại payload:

- `systemEvent`: chỉ phiên chính, đi qua prompt heartbeat.
- `agentTurn`: chỉ phiên cô lập, chạy một lượt tác tử riêng.

Các trường `agentTurn` chung:

- `message`: văn bản prompt bắt buộc.
- `model` / `thinking`: ghi đè tùy chọn (xem bên dưới).
- `timeoutSeconds`: ghi đè timeout tùy chọn.

Cấu hình phân phối (chỉ job cô lập):

- `delivery.mode`: `none` | `announce`.
- `delivery.channel`: `last` hoặc một kênh cụ thể.
- `delivery.to`: đích cụ thể theo kênh (id điện thoại/chat/kênh).
- `delivery.bestEffort`: tránh làm job thất bại nếu phân phối announce thất bại.

Phân phối announce sẽ chặn việc gửi công cụ nhắn tin trong lượt chạy; dùng `delivery.channel`/`delivery.to`
để nhắm trực tiếp tới chat. Khi `delivery.mode = "none"`, sẽ không đăng tóm tắt lên phiên chính.

Nếu bỏ qua `delivery` cho job cô lập, OpenClaw mặc định là `announce`.

#### Luồng phân phối announce

Khi `delivery.mode = "announce"`, cron phân phối trực tiếp qua các adapter kênh đầu ra.
Tác tử chính không được khởi tạo để soạn hoặc chuyển tiếp thông điệp.

Chi tiết hành vi:

- Nội dung: phân phối dùng payload đầu ra (văn bản/media) của lượt chạy cô lập với chia nhỏ và
  định dạng kênh bình thường.
- Phản hồi chỉ-heartbeat (`HEARTBEAT_OK` không có nội dung thực) sẽ không được phân phối.
- Nếu lượt chạy cô lập đã gửi một thông điệp tới cùng đích qua công cụ nhắn tin, việc phân phối
  sẽ bị bỏ qua để tránh trùng lặp.
- Đích phân phối thiếu hoặc không hợp lệ sẽ làm job thất bại trừ khi `delivery.bestEffort = true`.
- Một bản tóm tắt ngắn được đăng lên phiên chính chỉ khi `delivery.mode = "announce"`.
- Tóm tắt phiên chính tuân theo `wakeMode`: `now` kích hoạt heartbeat ngay và
  `next-heartbeat` chờ heartbeat theo lịch kế tiếp.

### Ghi đè model và mức thinking

Job cô lập (`agentTurn`) có thể ghi đè model và mức thinking:

- `model`: Chuỗi provider/model (ví dụ: `anthropic/claude-sonnet-4-20250514`) hoặc alias (ví dụ: `opus`)
- `thinking`: Mức thinking (`off`, `minimal`, `low`, `medium`, `high`, `xhigh`; chỉ cho GPT-5.2 + Codex)

Lưu ý: Bạn cũng có thể đặt `model` cho job phiên chính, nhưng điều đó thay đổi model
dùng chung của phiên chính. Chúng tôi khuyến nghị chỉ ghi đè model cho job cô lập để tránh
thay đổi ngữ cảnh không mong muốn.

Thứ tự ưu tiên phân giải:

1. Ghi đè trong payload job (cao nhất)
2. Mặc định theo hook (ví dụ: `hooks.gmail.model`)
3. Mặc định cấu hình tác tử

### Phân phối (kênh + đích)

Job cô lập có thể phân phối đầu ra tới một kênh qua cấu hình cấp cao `delivery`:

- `delivery.mode`: `announce` (phân phối tóm tắt) hoặc `none`.
- `delivery.channel`: `whatsapp` / `telegram` / `discord` / `slack` / `mattermost` (plugin) / `signal` / `imessage` / `last`.
- `delivery.to`: đích người nhận theo kênh.

Cấu hình phân phối chỉ hợp lệ cho job cô lập (`sessionTarget: "isolated"`).

Nếu bỏ qua `delivery.channel` hoặc `delivery.to`, cron có thể quay về “last route”
của phiên chính (nơi cuối cùng tác tử đã trả lời).

Nhắc lại định dạng đích:

- Đích Slack/Discord/Mattermost (plugin) nên dùng tiền tố rõ ràng (ví dụ: `channel:<id>`, `user:<id>`) để tránh mơ hồ.
- Chủ đề Telegram nên dùng dạng `:topic:` (xem bên dưới).

#### Đích phân phối Telegram (chủ đề / luồng diễn đàn)

Telegram hỗ trợ chủ đề diễn đàn qua `message_thread_id`. Với phân phối cron, bạn có thể mã hóa
chủ đề/luồng vào trường `to`:

- `-1001234567890` (chỉ chat id)
- `-1001234567890:topic:123` (ưu tiên: dấu chủ đề tường minh)
- `-1001234567890:123` (viết gọn: hậu tố số)

Các đích có tiền tố như `telegram:...` / `telegram:group:...` cũng được chấp nhận:

- `telegram:group:-1001234567890:topic:123`

## JSON schema cho tool calls

Dùng các dạng này khi gọi trực tiếp công cụ Gateway `cron.*` (gọi công cụ của tác tử hoặc RPC).
Cờ CLI chấp nhận khoảng thời gian dạng người đọc như `20m`, nhưng tool call nên dùng chuỗi ISO 8601
cho `schedule.at` và mili giây cho `schedule.everyMs`.

### Tham số cron.add

Job một lần, phiên chính (sự kiện hệ thống):

```json
{
  "name": "Reminder",
  "schedule": { "kind": "at", "at": "2026-02-01T16:00:00Z" },
  "sessionTarget": "main",
  "wakeMode": "now",
  "payload": { "kind": "systemEvent", "text": "Reminder text" },
  "deleteAfterRun": true
}
```

Job lặp lại, cô lập với phân phối:

```json
{
  "name": "Morning brief",
  "schedule": { "kind": "cron", "expr": "0 7 * * *", "tz": "America/Los_Angeles" },
  "sessionTarget": "isolated",
  "wakeMode": "next-heartbeat",
  "payload": {
    "kind": "agentTurn",
    "message": "Summarize overnight updates."
  },
  "delivery": {
    "mode": "announce",
    "channel": "slack",
    "to": "channel:C1234567890",
    "bestEffort": true
  }
}
```

Ghi chú:

- `schedule.kind`: `at` (`at`), `every` (`everyMs`), hoặc `cron` (`expr`, tùy chọn `tz`).
- `schedule.at` chấp nhận ISO 8601 (múi giờ tùy chọn; coi là UTC khi bỏ qua).
- `everyMs` là mili giây.
- `sessionTarget` phải là `"main"` hoặc `"isolated"` và phải khớp `payload.kind`.
- Trường tùy chọn: `agentId`, `description`, `enabled`, `deleteAfterRun` (mặc định true cho `at`),
  `delivery`.
- `wakeMode` mặc định là `"next-heartbeat"` khi bỏ qua.

### Tham số cron.update

```json
{
  "jobId": "job-123",
  "patch": {
    "enabled": false,
    "schedule": { "kind": "every", "everyMs": 3600000 }
  }
}
```

Ghi chú:

- `jobId` là chuẩn; `id` được chấp nhận để tương thích.
- Dùng `agentId: null` trong patch để xóa ràng buộc tác tử.

### Tham số cron.run và cron.remove

```json
{ "jobId": "job-123", "mode": "force" }
```

```json
{ "jobId": "job-123" }
```

## Lưu trữ & lịch sử

- Kho job: `~/.openclaw/cron/jobs.json` (JSON do Gateway quản lý).
- Lịch sử chạy: `~/.openclaw/cron/runs/<jobId>.jsonl` (JSONL, tự động dọn).
- Ghi đè đường dẫn lưu trữ: `cron.store` trong cấu hình.

## Cấu hình

```json5
{
  cron: {
    enabled: true, // default true
    store: "~/.openclaw/cron/jobs.json",
    maxConcurrentRuns: 1, // default 1
  },
}
```

Vô hiệu hóa cron hoàn toàn:

- `cron.enabled: false` (cấu hình)
- `OPENCLAW_SKIP_CRON=1` (env)

## CLI quickstart

Lời nhắc một lần (ISO UTC, tự xóa sau khi thành công):

```bash
openclaw cron add \
  --name "Send reminder" \
  --at "2026-01-12T18:00:00Z" \
  --session main \
  --system-event "Reminder: submit expense report." \
  --wake now \
  --delete-after-run
```

Lời nhắc một lần (phiên chính, đánh thức ngay):

```bash
openclaw cron add \
  --name "Calendar check" \
  --at "20m" \
  --session main \
  --system-event "Next heartbeat: check calendar." \
  --wake now
```

Job cô lập lặp lại (announce tới WhatsApp):

```bash
openclaw cron add \
  --name "Morning status" \
  --cron "0 7 * * *" \
  --tz "America/Los_Angeles" \
  --session isolated \
  --message "Summarize inbox + calendar for today." \
  --announce \
  --channel whatsapp \
  --to "+15551234567"
```

Job cô lập lặp lại (phân phối tới một chủ đề Telegram):

```bash
openclaw cron add \
  --name "Nightly summary (topic)" \
  --cron "0 22 * * *" \
  --tz "America/Los_Angeles" \
  --session isolated \
  --message "Summarize today; send to the nightly topic." \
  --announce \
  --channel telegram \
  --to "-1001234567890:topic:123"
```

Job cô lập với ghi đè model và thinking:

```bash
openclaw cron add \
  --name "Deep analysis" \
  --cron "0 6 * * 1" \
  --tz "America/Los_Angeles" \
  --session isolated \
  --message "Weekly deep analysis of project progress." \
  --model "opus" \
  --thinking high \
  --announce \
  --channel whatsapp \
  --to "+15551234567"
```

Chọn tác tử (thiết lập nhiều tác tử):

```bash
# Pin a job to agent "ops" (falls back to default if that agent is missing)
openclaw cron add --name "Ops sweep" --cron "0 6 * * *" --session isolated --message "Check ops queue" --agent ops

# Switch or clear the agent on an existing job
openclaw cron edit <jobId> --agent ops
openclaw cron edit <jobId> --clear-agent
```

Chạy thủ công (debug):

```bash
openclaw cron run <jobId> --force
```

Chỉnh sửa một job hiện có (patch các trường):

```bash
openclaw cron edit <jobId> \
  --message "Updated prompt" \
  --model "opus" \
  --thinking low
```

Lịch sử chạy:

```bash
openclaw cron runs --id <jobId> --limit 50
```

Sự kiện hệ thống ngay lập tức không cần tạo job:

```bash
openclaw system event --mode now --text "Next heartbeat: check battery."
```

## Bề mặt API Gateway

- `cron.list`, `cron.status`, `cron.add`, `cron.update`, `cron.remove`
- `cron.run` (force hoặc due), `cron.runs`
  Với sự kiện hệ thống ngay lập tức không cần job, dùng [`openclaw system event`](/cli/system).

## Troubleshooting

### “Không có gì chạy”

- Kiểm tra cron đã bật: `cron.enabled` và `OPENCLAW_SKIP_CRON`.
- Kiểm tra Gateway đang chạy liên tục (cron chạy bên trong tiến trình Gateway).
- Với lịch `cron`: xác nhận múi giờ (`--tz`) so với múi giờ máy chủ.

### Telegram phân phối sai chỗ

- Với chủ đề diễn đàn, dùng `-100…:topic:<id>` để rõ ràng và không mơ hồ.
- Nếu bạn thấy tiền tố `telegram:...` trong log hoặc các đích “last route” đã lưu, đó là bình thường;
  phân phối cron chấp nhận chúng và vẫn phân tích đúng ID chủ đề.
