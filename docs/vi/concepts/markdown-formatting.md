---
summary: "Pipeline định dạng Markdown cho các kênh gửi ra"
read_when:
  - Bạn đang thay đổi định dạng Markdown hoặc cơ chế chunking cho các kênh gửi ra
  - Bạn đang thêm một formatter kênh mới hoặc ánh xạ style
  - Bạn đang debug lỗi hồi quy định dạng giữa các kênh
title: "Định dạng Markdown"
x-i18n:
  source_path: concepts/markdown-formatting.md
  source_hash: f9cbf9b744f9a218
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:06:48Z
---

# Định dạng Markdown

OpenClaw định dạng Markdown gửi ra bằng cách chuyển đổi nó thành một biểu diễn trung gian dùng chung
(intermediate representation – IR) trước khi render đầu ra theo từng kênh. IR giữ nguyên
văn bản nguồn đồng thời mang theo các span style/liên kết để việc chunking và render có thể
nhất quán giữa các kênh.

## Mục tiêu

- **Tính nhất quán:** một bước parse, nhiều renderer.
- **Chunking an toàn:** tách văn bản trước khi render để định dạng inline không bao giờ
  bị vỡ giữa các chunk.
- **Phù hợp kênh:** ánh xạ cùng một IR sang Slack mrkdwn, Telegram HTML và các dải style của Signal
  mà không cần parse lại Markdown.

## Pipeline

1. **Parse Markdown -> IR**
   - IR là văn bản thuần cộng với các span style (bold/italic/strike/code/spoiler) và span liên kết.
   - Offset dùng đơn vị UTF-16 code unit để các dải style của Signal khớp với API của nó.
   - Bảng chỉ được parse khi kênh chọn tham gia chuyển đổi bảng.
2. **Chunk IR (ưu tiên định dạng)**
   - Chunking diễn ra trên văn bản IR trước khi render.
   - Định dạng inline không bị tách qua các chunk; các span được cắt theo từng chunk.
3. **Render theo kênh**
   - **Slack:** token mrkdwn (bold/italic/strike/code), liên kết dưới dạng `<url|label>`.
   - **Telegram:** thẻ HTML (`<b>`, `<i>`, `<s>`, `<code>`, `<pre><code>`, `<a href>`).
   - **Signal:** văn bản thuần + các dải `text-style`; liên kết trở thành `label (url)` khi nhãn khác URL.

## Ví dụ IR

Markdown đầu vào:

```markdown
Hello **world** — see [docs](https://docs.openclaw.ai).
```

IR (sơ đồ):

```json
{
  "text": "Hello world — see docs.",
  "styles": [{ "start": 6, "end": 11, "style": "bold" }],
  "links": [{ "start": 19, "end": 23, "href": "https://docs.openclaw.ai" }]
}
```

## Nơi được sử dụng

- Các adapter gửi ra của Slack, Telegram và Signal render từ IR.
- Các kênh khác (WhatsApp, iMessage, MS Teams, Discord) vẫn dùng văn bản thuần hoặc
  quy tắc định dạng riêng của chúng, với việc chuyển đổi bảng Markdown được áp dụng trước
  khi chunking khi được bật.

## Xử lý bảng

Bảng Markdown không được hỗ trợ nhất quán giữa các ứng dụng chat. Sử dụng
`markdown.tables` để kiểm soát chuyển đổi theo từng kênh (và theo từng tài khoản).

- `code`: render bảng dưới dạng code block (mặc định cho hầu hết các kênh).
- `bullets`: chuyển mỗi hàng thành các gạch đầu dòng (mặc định cho Signal + WhatsApp).
- `off`: tắt parse và chuyển đổi bảng; văn bản bảng thô được giữ nguyên.

Các khóa cấu hình:

```yaml
channels:
  discord:
    markdown:
      tables: code
    accounts:
      work:
        markdown:
          tables: off
```

## Quy tắc chunking

- Giới hạn chunk đến từ adapter/cấu hình của kênh và được áp dụng cho văn bản IR.
- Code fence được giữ nguyên thành một khối duy nhất với dấu xuống dòng ở cuối để các kênh
  render chính xác.
- Tiền tố danh sách và tiền tố blockquote là một phần của văn bản IR, vì vậy chunking
  không cắt giữa chừng tiền tố.
- Các style inline (bold/italic/strike/inline-code/spoiler) không bao giờ bị tách qua
  các chunk; renderer sẽ mở lại style bên trong mỗi chunk.

Nếu bạn cần biết thêm về hành vi chunking giữa các kênh, xem
[Streaming + chunking](/concepts/streaming).

## Chính sách liên kết

- **Slack:** `[label](url)` -> `<url|label>`; URL trần được giữ nguyên. Autolink
  bị tắt trong quá trình parse để tránh tạo liên kết kép.
- **Telegram:** `[label](url)` -> `<a href="url">label</a>` (chế độ parse HTML).
- **Signal:** `[label](url)` -> `label (url)` trừ khi nhãn trùng với URL.

## Spoiler

Dấu spoiler (`||spoiler||`) chỉ được parse cho Signal, nơi chúng ánh xạ sang
các dải style SPOILER. Các kênh khác coi chúng là văn bản thuần.

## Cách thêm hoặc cập nhật một formatter kênh

1. **Parse một lần:** dùng helper dùng chung `markdownToIR(...)` với các tùy chọn phù hợp kênh
   (autolink, kiểu heading, tiền tố blockquote).
2. **Render:** triển khai một renderer với `renderMarkdownWithMarkers(...)` và một
   bản đồ marker style (hoặc các dải style của Signal).
3. **Chunk:** gọi `chunkMarkdownIR(...)` trước khi render; render từng chunk.
4. **Kết nối adapter:** cập nhật adapter gửi ra của kênh để dùng chunker
   và renderer mới.
5. **Kiểm thử:** thêm hoặc cập nhật test định dạng và test gửi ra nếu kênh
   có dùng chunking.

## Các lỗi thường gặp

- Các token ngoặc nhọn của Slack (`<@U123>`, `<#C123>`, `<https://...>`) phải được
  giữ nguyên; hãy escape HTML thô một cách an toàn.
- Telegram HTML yêu cầu escape văn bản bên ngoài thẻ để tránh hỏng markup.
- Các dải style của Signal phụ thuộc vào offset UTF-16; không dùng offset theo code point.
- Giữ dấu xuống dòng ở cuối cho code block dạng fence để marker đóng nằm trên dòng riêng.
