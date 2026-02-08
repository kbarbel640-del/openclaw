---
title: Lobster
summary: "Runtime quy trình làm việc có kiểu cho OpenClaw với các cổng phê duyệt có thể tiếp tục."
description: Runtime quy trình làm việc có kiểu cho OpenClaw — các pipeline có thể kết hợp với cổng phê duyệt.
read_when:
  - Bạn muốn các quy trình nhiều bước mang tính xác định với phê duyệt rõ ràng
  - Bạn cần tiếp tục một quy trình mà không phải chạy lại các bước trước đó
x-i18n:
  source_path: tools/lobster.md
  source_hash: ff84e65f4be162ad
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:08:56Z
---

# Lobster

Lobster là một workflow shell cho phép OpenClaw chạy các chuỗi công cụ nhiều bước như một thao tác duy nhất, mang tính xác định, với các điểm kiểm tra phê duyệt rõ ràng.

## Hook

Trợ lý của bạn có thể tự xây dựng các công cụ để quản lý chính nó. Yêu cầu một workflow, và 30 phút sau bạn đã có một CLI cùng các pipeline chạy trong một lệnh duy nhất. Lobster là mảnh ghép còn thiếu: pipeline xác định, phê duyệt rõ ràng, và trạng thái có thể tiếp tục.

## Why

Ngày nay, các workflow phức tạp đòi hỏi nhiều lượt gọi công cụ qua lại. Mỗi lượt gọi đều tốn token, và LLM phải điều phối từng bước. Lobster chuyển việc điều phối đó vào một runtime có kiểu:

- **Một lần gọi thay vì nhiều lần**: OpenClaw chạy một lần gọi công cụ Lobster và nhận về kết quả có cấu trúc.
- **Phê duyệt tích hợp sẵn**: Các tác vụ có side effect (gửi email, đăng bình luận) sẽ dừng workflow cho đến khi được phê duyệt rõ ràng.
- **Có thể tiếp tục**: Workflow bị dừng trả về một token; phê duyệt và tiếp tục mà không cần chạy lại mọi thứ.

## Vì sao dùng DSL thay vì chương trình thông thường?

Lobster được cố ý giữ nhỏ gọn. Mục tiêu không phải là “một ngôn ngữ mới”, mà là một đặc tả pipeline có thể dự đoán, thân thiện với AI, với phê duyệt hạng nhất và token tiếp tục.

- **Phê duyệt/tiếp tục được tích hợp sẵn**: Chương trình thông thường có thể hỏi con người, nhưng không thể _tạm dừng và tiếp tục_ với một token bền vững nếu bạn không tự xây dựng runtime đó.
- **Tính xác định + khả năng kiểm toán**: Pipeline là dữ liệu, nên dễ ghi log, so sánh diff, chạy lại và review.
- **Bề mặt hạn chế cho AI**: Ngữ pháp nhỏ + truyền JSON giảm các nhánh code “sáng tạo” và giúp việc xác thực trở nên khả thi.
- **Chính sách an toàn được nướng sẵn**: Timeout, giới hạn output, kiểm tra sandbox và allowlist được runtime áp dụng, không phải từng script.
- **Vẫn có thể lập trình**: Mỗi bước có thể gọi bất kỳ CLI hoặc script nào. Nếu bạn muốn JS/TS, hãy sinh các file `.lobster` từ code.

## Cách hoạt động

OpenClaw khởi chạy CLI `lobster` cục bộ ở **tool mode** và phân tích một JSON envelope từ stdout.  
Nếu pipeline tạm dừng để chờ phê duyệt, công cụ sẽ trả về một `resumeToken` để bạn có thể tiếp tục sau.

## Mẫu hình: CLI nhỏ + pipe JSON + phê duyệt

Xây dựng các lệnh nhỏ nói chuyện bằng JSON, rồi nối chúng thành một lần gọi Lobster duy nhất. (Tên lệnh bên dưới chỉ là ví dụ — hãy thay bằng của bạn.)

```bash
inbox list --json
inbox categorize --json
inbox apply --json
```

```json
{
  "action": "run",
  "pipeline": "exec --json --shell 'inbox list --json' | exec --stdin json --shell 'inbox categorize --json' | exec --stdin json --shell 'inbox apply --json' | approve --preview-from-stdin --limit 5 --prompt 'Apply changes?'",
  "timeoutMs": 30000
}
```

Nếu pipeline yêu cầu phê duyệt, tiếp tục với token:

```json
{
  "action": "resume",
  "token": "<resumeToken>",
  "approve": true
}
```

AI kích hoạt workflow; Lobster thực thi các bước. Các cổng phê duyệt giữ cho side effect rõ ràng và có thể kiểm toán.

Ví dụ: ánh xạ các mục đầu vào thành các lượt gọi công cụ:

```bash
gog.gmail.search --query 'newer_than:1d' \
  | openclaw.invoke --tool message --action send --each --item-key message --args-json '{"provider":"telegram","to":"..."}'
```

## Các bước LLM chỉ dùng JSON (llm-task)

Với các workflow cần **một bước LLM có cấu trúc**, hãy bật công cụ plugin tùy chọn
`llm-task` và gọi nó từ Lobster. Điều này giữ workflow mang tính xác định trong khi vẫn cho phép bạn phân loại/tóm tắt/soạn thảo bằng mô hình.

Bật công cụ:

```json
{
  "plugins": {
    "entries": {
      "llm-task": { "enabled": true }
    }
  },
  "agents": {
    "list": [
      {
        "id": "main",
        "tools": { "allow": ["llm-task"] }
      }
    ]
  }
}
```

Sử dụng trong một pipeline:

```lobster
openclaw.invoke --tool llm-task --action json --args-json '{
  "prompt": "Given the input email, return intent and draft.",
  "input": { "subject": "Hello", "body": "Can you help?" },
  "schema": {
    "type": "object",
    "properties": {
      "intent": { "type": "string" },
      "draft": { "type": "string" }
    },
    "required": ["intent", "draft"],
    "additionalProperties": false
  }
}'
```

Xem [LLM Task](/tools/llm-task) để biết chi tiết và các tùy chọn cấu hình.

## Tệp workflow (.lobster)

Lobster có thể chạy các tệp workflow YAML/JSON với các trường `name`, `args`, `steps`, `env`, `condition` và `approval`. Trong các lượt gọi công cụ OpenClaw, đặt `pipeline` thành đường dẫn tệp.

```yaml
name: inbox-triage
args:
  tag:
    default: "family"
steps:
  - id: collect
    command: inbox list --json
  - id: categorize
    command: inbox categorize --json
    stdin: $collect.stdout
  - id: approve
    command: inbox apply --approve
    stdin: $categorize.stdout
    approval: required
  - id: execute
    command: inbox apply --execute
    stdin: $categorize.stdout
    condition: $approve.approved
```

Ghi chú:

- `stdin: $step.stdout` và `stdin: $step.json` truyền output của bước trước.
- `condition` (hoặc `when`) có thể chặn các bước dựa trên `$step.approved`.

## Cài đặt Lobster

Cài đặt CLI Lobster trên **cùng máy chủ** chạy OpenClaw Gateway (xem [repo Lobster](https://github.com/openclaw/lobster)), và đảm bảo `lobster` nằm trên `PATH`.  
Nếu bạn muốn dùng vị trí binary tùy chỉnh, hãy truyền một `lobsterPath` **tuyệt đối** trong lượt gọi công cụ.

## Bật công cụ

Lobster là một công cụ plugin **tùy chọn** (không bật theo mặc định).

Khuyến nghị (cộng thêm, an toàn):

```json
{
  "tools": {
    "alsoAllow": ["lobster"]
  }
}
```

Hoặc theo từng agent:

```json
{
  "agents": {
    "list": [
      {
        "id": "main",
        "tools": {
          "alsoAllow": ["lobster"]
        }
      }
    ]
  }
}
```

Tránh dùng `tools.allow: ["lobster"]` trừ khi bạn có ý định chạy ở chế độ allowlist hạn chế.

Lưu ý: allowlist là tùy chọn cho các plugin tùy chọn. Nếu allowlist của bạn chỉ nêu tên
các công cụ plugin (như `lobster`), OpenClaw vẫn giữ các công cụ lõi được bật. Để hạn chế
các công cụ lõi, hãy đưa cả các công cụ hoặc nhóm lõi bạn muốn vào allowlist.

## Ví dụ: Phân loại email

Không dùng Lobster:

```
User: "Check my email and draft replies"
→ openclaw calls gmail.list
→ LLM summarizes
→ User: "draft replies to #2 and #5"
→ LLM drafts
→ User: "send #2"
→ openclaw calls gmail.send
(repeat daily, no memory of what was triaged)
```

Dùng Lobster:

```json
{
  "action": "run",
  "pipeline": "email.triage --limit 20",
  "timeoutMs": 30000
}
```

Trả về một JSON envelope (đã rút gọn):

```json
{
  "ok": true,
  "status": "needs_approval",
  "output": [{ "summary": "5 need replies, 2 need action" }],
  "requiresApproval": {
    "type": "approval_request",
    "prompt": "Send 2 draft replies?",
    "items": [],
    "resumeToken": "..."
  }
}
```

Người dùng phê duyệt → tiếp tục:

```json
{
  "action": "resume",
  "token": "<resumeToken>",
  "approve": true
}
```

Một workflow. Xác định. An toàn.

## Tham số công cụ

### `run`

Chạy một pipeline ở tool mode.

```json
{
  "action": "run",
  "pipeline": "gog.gmail.search --query 'newer_than:1d' | email.triage",
  "cwd": "/path/to/workspace",
  "timeoutMs": 30000,
  "maxStdoutBytes": 512000
}
```

Chạy một tệp workflow với args:

```json
{
  "action": "run",
  "pipeline": "/path/to/inbox-triage.lobster",
  "argsJson": "{\"tag\":\"family\"}"
}
```

### `resume`

Tiếp tục một workflow đã bị dừng sau khi được phê duyệt.

```json
{
  "action": "resume",
  "token": "<resumeToken>",
  "approve": true
}
```

### Đầu vào tùy chọn

- `lobsterPath`: Đường dẫn tuyệt đối đến binary Lobster (bỏ qua để dùng `PATH`).
- `cwd`: Thư mục làm việc cho pipeline (mặc định là thư mục làm việc của tiến trình hiện tại).
- `timeoutMs`: Kết liễu subprocess nếu vượt quá thời lượng này (mặc định: 20000).
- `maxStdoutBytes`: Kết liễu subprocess nếu stdout vượt quá kích thước này (mặc định: 512000).
- `argsJson`: Chuỗi JSON được truyền cho `lobster run --args-json` (chỉ cho workflow file).

## Output envelope

Lobster trả về một JSON envelope với một trong ba trạng thái:

- `ok` → hoàn thành thành công
- `needs_approval` → tạm dừng; cần `requiresApproval.resumeToken` để tiếp tục
- `cancelled` → bị từ chối hoặc hủy rõ ràng

Công cụ hiển thị envelope ở cả `content` (JSON đẹp) và `details` (đối tượng thô).

## Phê duyệt

Nếu `requiresApproval` xuất hiện, hãy xem prompt và quyết định:

- `approve: true` → tiếp tục và cho phép side effect
- `approve: false` → hủy và kết thúc workflow

Dùng `approve --preview-from-stdin --limit N` để đính kèm bản xem trước JSON vào các yêu cầu phê duyệt mà không cần glue jq/heredoc tùy chỉnh. Token tiếp tục giờ đã gọn nhẹ: Lobster lưu trạng thái tiếp tục workflow dưới thư mục state của nó và trả về một khóa token nhỏ.

## OpenProse

OpenProse kết hợp rất tốt với Lobster: dùng `/prose` để điều phối chuẩn bị nhiều agent, sau đó chạy một pipeline Lobster cho các phê duyệt xác định. Nếu một chương trình Prose cần Lobster, hãy cho phép công cụ `lobster` cho các sub-agent thông qua `tools.subagents.tools`. Xem [OpenProse](/prose).

## An toàn

- **Chỉ subprocess cục bộ** — bản thân plugin không thực hiện gọi mạng.
- **Không có bí mật** — Lobster không quản lý OAuth; nó gọi các công cụ OpenClaw làm việc đó.
- **Nhận biết sandbox** — bị vô hiệu khi ngữ cảnh công cụ ở trong sandbox.
- **Gia cố** — `lobsterPath` phải là đường dẫn tuyệt đối nếu được chỉ định; timeout và giới hạn output được áp dụng.

## Xử lý sự cố

- **`lobster subprocess timed out`** → tăng `timeoutMs`, hoặc chia nhỏ một pipeline dài.
- **`lobster output exceeded maxStdoutBytes`** → tăng `maxStdoutBytes` hoặc giảm kích thước output.
- **`lobster returned invalid JSON`** → đảm bảo pipeline chạy ở tool mode và chỉ in JSON.
- **`lobster failed (code …)`** → chạy cùng pipeline đó trong terminal để kiểm tra stderr.

## Tìm hiểu thêm

- [Plugins](/plugin)
- [Plugin tool authoring](/plugins/agent-tools)

## Case study: workflow cộng đồng

Một ví dụ công khai: một CLI “second brain” + các pipeline Lobster quản lý ba kho Markdown (cá nhân, đối tác, chia sẻ). CLI phát JSON cho thống kê, danh sách inbox và quét mục cũ; Lobster nối các lệnh đó thành các workflow như `weekly-review`, `inbox-triage`, `memory-consolidation` và `shared-task-sync`, mỗi workflow đều có cổng phê duyệt. AI xử lý phần phán đoán (phân loại) khi có thể và quay về các quy tắc xác định khi không.

- Thread: https://x.com/plattenschieber/status/2014508656335770033
- Repo: https://github.com/bloomedai/brain-cli
