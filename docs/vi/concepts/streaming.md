---
summary: "Hành vi streaming + chunking (trả lời theo block, streaming bản nháp, giới hạn)"
read_when:
  - Giải thích cách streaming hoặc chunking hoạt động trên các kênh
  - Thay đổi hành vi streaming theo block hoặc chunking theo kênh
  - Gỡ lỗi việc trả lời block bị trùng/lệch sớm hoặc streaming bản nháp
title: "Streaming và Chunking"
x-i18n:
  source_path: concepts/streaming.md
  source_hash: f014eb1898c4351b
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:07:02Z
---

# Streaming + chunking

OpenClaw có hai lớp “streaming” riêng biệt:

- **Block streaming (các kênh):** phát ra các **block** đã hoàn thành khi trợ lý đang viết. Đây là các tin nhắn kênh thông thường (không phải delta token).
- **Streaming kiểu token (chỉ Telegram):** cập nhật một **bong bóng bản nháp** với văn bản từng phần trong khi tạo; tin nhắn cuối cùng được gửi khi kết thúc.

Hiện tại **không có streaming token thực sự** tới các tin nhắn kênh bên ngoài. Streaming bản nháp của Telegram là bề mặt streaming từng phần duy nhất.

## Block streaming (tin nhắn kênh)

Block streaming gửi đầu ra của trợ lý theo các khối thô khi chúng sẵn sàng.

```
Model output
  └─ text_delta/events
       ├─ (blockStreamingBreak=text_end)
       │    └─ chunker emits blocks as buffer grows
       └─ (blockStreamingBreak=message_end)
            └─ chunker flushes at message_end
                   └─ channel send (block replies)
```

Legend:

- `text_delta/events`: các sự kiện stream của mô hình (có thể thưa thớt với các mô hình không streaming).
- `chunker`: `EmbeddedBlockChunker` áp dụng ràng buộc min/max + ưu tiên điểm ngắt.
- `channel send`: các tin nhắn gửi ra thực tế (trả lời theo block).

**Điều khiển:**

- `agents.defaults.blockStreamingDefault`: `"on"`/`"off"` (mặc định tắt).
- Ghi đè theo kênh: `*.blockStreaming` (và các biến thể theo tài khoản) để buộc `"on"`/`"off"` cho mỗi kênh.
- `agents.defaults.blockStreamingBreak`: `"text_end"` hoặc `"message_end"`.
- `agents.defaults.blockStreamingChunk`: `{ minChars, maxChars, breakPreference? }`.
- `agents.defaults.blockStreamingCoalesce`: `{ minChars?, maxChars?, idleMs? }` (gộp các block stream trước khi gửi).
- Giới hạn cứng theo kênh: `*.textChunkLimit` (ví dụ: `channels.whatsapp.textChunkLimit`).
- Chế độ chunk theo kênh: `*.chunkMode` (`length` mặc định, `newline` tách theo dòng trống (ranh giới đoạn) trước khi chunk theo độ dài).
- Giới hạn mềm của Discord: `channels.discord.maxLinesPerMessage` (mặc định 17) tách các trả lời quá cao để tránh bị cắt UI.

**Ngữ nghĩa ranh giới:**

- `text_end`: stream các block ngay khi bộ chunker phát ra; flush ở mỗi `text_end`.
- `message_end`: đợi đến khi tin nhắn trợ lý hoàn tất, sau đó flush đầu ra đã đệm.

`message_end` vẫn dùng bộ chunker nếu văn bản đệm vượt `maxChars`, nên có thể phát ra nhiều chunk ở cuối.

## Thuật toán chunking (ngưỡng thấp/cao)

Block chunking được triển khai bởi `EmbeddedBlockChunker`:

- **Ngưỡng thấp:** không phát cho đến khi buffer >= `minChars` (trừ khi bị buộc).
- **Ngưỡng cao:** ưu tiên tách trước `maxChars`; nếu bị buộc, tách tại `maxChars`.
- **Ưu tiên điểm ngắt:** `paragraph` → `newline` → `sentence` → `whitespace` → ngắt cứng.
- **Code fences:** không bao giờ tách bên trong fence; khi bị buộc tại `maxChars`, đóng + mở lại fence để giữ Markdown hợp lệ.

`maxChars` bị kẹp theo `textChunkLimit` của kênh, nên bạn không thể vượt quá giới hạn theo kênh.

## Coalescing (gộp các block stream)

Khi bật block streaming, OpenClaw có thể **gộp các chunk block liên tiếp**
trước khi gửi ra. Điều này giảm “spam từng dòng” trong khi vẫn cung cấp
đầu ra tiến triển.

- Coalescing chờ **khoảng trống nhàn rỗi** (`idleMs`) trước khi flush.
- Buffer bị giới hạn bởi `maxChars` và sẽ flush nếu vượt quá.
- `minChars` ngăn các mảnh quá nhỏ được gửi cho đến khi tích lũy đủ văn bản
  (lần flush cuối luôn gửi phần còn lại).
- Ký tự nối được suy ra từ `blockStreamingChunk.breakPreference`
  (`paragraph` → `\n\n`, `newline` → `\n`, `sentence` → dấu cách).
- Có thể ghi đè theo kênh qua `*.blockStreamingCoalesce` (bao gồm cấu hình theo tài khoản).
- `minChars` coalesce mặc định được tăng lên 1500 cho Signal/Slack/Discord trừ khi bị ghi đè.

## Nhịp điệu giống con người giữa các block

Khi bật block streaming, bạn có thể thêm **khoảng dừng ngẫu nhiên**
giữa các trả lời theo block (sau block đầu tiên). Điều này khiến các phản hồi
nhiều bong bóng trông tự nhiên hơn.

- Cấu hình: `agents.defaults.humanDelay` (ghi đè theo tác tử qua `agents.list[].humanDelay`).
- Chế độ: `off` (mặc định), `natural` (800–2500ms), `custom` (`minMs`/`maxMs`).
- Chỉ áp dụng cho **trả lời theo block**, không áp dụng cho trả lời cuối cùng hoặc tóm tắt công cụ.

## “Stream từng chunk hay tất cả”

Ánh xạ như sau:

- **Stream từng chunk:** `blockStreamingDefault: "on"` + `blockStreamingBreak: "text_end"` (phát khi đang tạo). Các kênh không phải Telegram cũng cần `*.blockStreaming: true`.
- **Stream tất cả ở cuối:** `blockStreamingBreak: "message_end"` (flush một lần, có thể nhiều chunk nếu rất dài).
- **Không block streaming:** `blockStreamingDefault: "off"` (chỉ trả lời cuối cùng).

**Lưu ý theo kênh:** Với các kênh không phải Telegram, block streaming **tắt trừ khi**
`*.blockStreaming` được đặt rõ ràng thành `true`. Telegram có thể stream bản nháp
(`channels.telegram.streamMode`) mà không cần trả lời theo block.

Nhắc vị trí cấu hình: các giá trị mặc định của `blockStreaming*` nằm dưới
`agents.defaults`, không phải cấu hình gốc.

## Streaming bản nháp Telegram (kiểu token)

Telegram là kênh duy nhất có streaming bản nháp:

- Sử dụng Bot API `sendMessageDraft` trong **chat riêng có chủ đề**.
- `channels.telegram.streamMode: "partial" | "block" | "off"`.
  - `partial`: cập nhật bản nháp với văn bản stream mới nhất.
  - `block`: cập nhật bản nháp theo các block đã chunk (cùng quy tắc chunker).
  - `off`: không streaming bản nháp.
- Cấu hình chunk cho bản nháp (chỉ cho `streamMode: "block"`): `channels.telegram.draftChunk` (mặc định: `minChars: 200`, `maxChars: 800`).
- Streaming bản nháp tách biệt với block streaming; trả lời theo block tắt theo mặc định và chỉ bật bởi `*.blockStreaming: true` trên các kênh không phải Telegram.
- Trả lời cuối cùng vẫn là một tin nhắn bình thường.
- `/reasoning stream` ghi phần suy luận vào bong bóng bản nháp (chỉ Telegram).

Khi streaming bản nháp đang hoạt động, OpenClaw vô hiệu hóa block streaming cho trả lời đó để tránh streaming kép.

```
Telegram (private + topics)
  └─ sendMessageDraft (draft bubble)
       ├─ streamMode=partial → update latest text
       └─ streamMode=block   → chunker updates draft
  └─ final reply → normal message
```

Legend:

- `sendMessageDraft`: bong bóng bản nháp Telegram (không phải tin nhắn thật).
- `final reply`: gửi tin nhắn Telegram bình thường.
