---
summary: "OpenProse: quy trình .prose, lệnh gạch chéo và trạng thái trong OpenClaw"
read_when:
  - Bạn muốn chạy hoặc viết các quy trình .prose
  - Bạn muốn bật plugin OpenProse
  - Bạn cần hiểu về lưu trữ trạng thái
title: "OpenProse"
x-i18n:
  source_path: prose.md
  source_hash: cf7301e927b9a463
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:08:03Z
---

# OpenProse

OpenProse là một định dạng quy trình làm việc di động, ưu tiên markdown để điều phối các phiên AI. Trong OpenClaw, nó được cung cấp dưới dạng một plugin cài đặt một gói Skills OpenProse cùng với một lệnh gạch chéo `/prose`. Các chương trình nằm trong các tệp `.prose` và có thể tạo nhiều tác tử con với luồng điều khiển rõ ràng.

Trang chính thức: https://www.prose.md

## Những gì nó có thể làm

- Nghiên cứu + tổng hợp đa tác tử với khả năng song song hóa rõ ràng.
- Các quy trình có thể lặp lại và an toàn cho phê duyệt (đánh giá mã, phân loại sự cố, pipeline nội dung).
- Các chương trình `.prose` có thể tái sử dụng để chạy trên các runtime tác tử được hỗ trợ.

## Cài đặt + bật

Các plugin đi kèm bị tắt theo mặc định. Bật OpenProse:

```bash
openclaw plugins enable open-prose
```

Khởi động lại Gateway sau khi bật plugin.

Bản checkout dev/local: `openclaw plugins install ./extensions/open-prose`

Tài liệu liên quan: [Plugins](/plugin), [Plugin manifest](/plugins/manifest), [Skills](/tools/skills).

## Lệnh gạch chéo

OpenProse đăng ký `/prose` như một lệnh Skills mà người dùng có thể gọi. Nó định tuyến đến các chỉ dẫn của OpenProse VM và sử dụng các công cụ OpenClaw ở phía dưới.

Các lệnh phổ biến:

```
/prose help
/prose run <file.prose>
/prose run <handle/slug>
/prose run <https://example.com/file.prose>
/prose compile <file.prose>
/prose examples
/prose update
```

## Ví dụ: một tệp `.prose` đơn giản

```prose
# Research + synthesis with two agents running in parallel.

input topic: "What should we research?"

agent researcher:
  model: sonnet
  prompt: "You research thoroughly and cite sources."

agent writer:
  model: opus
  prompt: "You write a concise summary."

parallel:
  findings = session: researcher
    prompt: "Research {topic}."
  draft = session: writer
    prompt: "Summarize {topic}."

session "Merge the findings + draft into a final answer."
context: { findings, draft }
```

## Vị trí tệp

OpenProse lưu trạng thái dưới `.prose/` trong workspace của bạn:

```
.prose/
├── .env
├── runs/
│   └── {YYYYMMDD}-{HHMMSS}-{random}/
│       ├── program.prose
│       ├── state.md
│       ├── bindings/
│       └── agents/
└── agents/
```

Các tác tử bền vững ở cấp người dùng nằm tại:

```
~/.prose/agents/
```

## Chế độ trạng thái

OpenProse hỗ trợ nhiều backend trạng thái:

- **filesystem** (mặc định): `.prose/runs/...`
- **in-context**: tạm thời, cho các chương trình nhỏ
- **sqlite** (thử nghiệm): yêu cầu binary `sqlite3`
- **postgres** (thử nghiệm): yêu cầu `psql` và một chuỗi kết nối

Ghi chú:

- sqlite/postgres là tùy chọn và ở trạng thái thử nghiệm.
- Thông tin xác thực postgres đi vào log của tác tử con; hãy dùng DB chuyên dụng với quyền tối thiểu cần thiết.

## Chương trình từ xa

`/prose run <handle/slug>` được phân giải thành `https://p.prose.md/<handle>/<slug>`.
Các URL trực tiếp được tải nguyên trạng. Điều này sử dụng công cụ `web_fetch` (hoặc `exec` cho POST).

## Ánh xạ runtime OpenClaw

Các chương trình OpenProse ánh xạ sang các nguyên thủy của OpenClaw:

| Khái niệm OpenProse      | Công cụ OpenClaw |
| ------------------------ | ---------------- |
| Tạo phiên / Công cụ Task | `sessions_spawn` |
| Đọc/ghi tệp              | `read` / `write` |
| Tải web                  | `web_fetch`      |

Nếu allowlist công cụ của bạn chặn các công cụ này, các chương trình OpenProse sẽ thất bại. Xem [Skills config](/tools/skills-config).

## Bảo mật + phê duyệt

Hãy coi các tệp `.prose` như mã nguồn. Xem xét trước khi chạy. Sử dụng allowlist công cụ của OpenClaw và các cổng phê duyệt để kiểm soát tác dụng phụ.

Đối với các quy trình mang tính xác định và có cổng phê duyệt, hãy so sánh với [Lobster](/tools/lobster).
