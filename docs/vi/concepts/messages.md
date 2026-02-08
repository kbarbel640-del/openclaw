---
summary: "Luồng tin nhắn, phiên, xếp hàng và khả năng hiển thị lập luận"
read_when:
  - Giải thích cách tin nhắn đến trở thành phản hồi
  - Làm rõ phiên, các chế độ xếp hàng hoặc hành vi streaming
  - Tài liệu hóa khả năng hiển thị lập luận và các tác động khi sử dụng
title: "Tin nhắn"
x-i18n:
  source_path: concepts/messages.md
  source_hash: 32a1b0c50616c550
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:06:52Z
---

# Tin nhắn

Trang này kết nối cách OpenClaw xử lý tin nhắn đến, phiên, xếp hàng,
streaming và khả năng hiển thị lập luận.

## Luồng tin nhắn (mức cao)

```
Inbound message
  -> routing/bindings -> session key
  -> queue (if a run is active)
  -> agent run (streaming + tools)
  -> outbound replies (channel limits + chunking)
```

Các nút điều chỉnh chính nằm trong cấu hình:

- `messages.*` cho tiền tố, xếp hàng và hành vi nhóm.
- `agents.defaults.*` cho streaming theo khối và mặc định chia khối.
- Ghi đè theo kênh (`channels.whatsapp.*`, `channels.telegram.*`, v.v.) cho giới hạn và công tắc streaming.

Xem [Configuration](/gateway/configuration) để biết đầy đủ schema.

## Khử trùng lặp tin nhắn đến

Các kênh có thể gửi lại cùng một tin nhắn sau khi kết nối lại. OpenClaw giữ một
bộ nhớ đệm tồn tại ngắn hạn theo khóa kênh/tài khoản/đối tác/phiên/id tin nhắn để
các lần gửi trùng lặp không kích hoạt một lượt chạy agent khác.

## Debounce tin nhắn đến

Các tin nhắn liên tiếp nhanh từ **cùng người gửi** có thể được gom thành một lượt
agent duy nhất thông qua `messages.inbound`. Debounce được phạm vi theo kênh + cuộc trò chuyện
và dùng tin nhắn mới nhất cho việc gắn luồng trả lời/ID.

Cấu hình (mặc định toàn cục + ghi đè theo kênh):

```json5
{
  messages: {
    inbound: {
      debounceMs: 2000,
      byChannel: {
        whatsapp: 5000,
        slack: 1500,
        discord: 1500,
      },
    },
  },
}
```

Ghi chú:

- Debounce áp dụng cho **chỉ văn bản**; media/tệp đính kèm sẽ xả ngay.
- Lệnh điều khiển bỏ qua debounce để luôn là các lượt độc lập.

## Phiên và thiết bị

Phiên thuộc về gateway, không thuộc về client.

- Trò chuyện trực tiếp gộp vào khóa phiên chính của agent.
- Nhóm/kênh có khóa phiên riêng.
- Kho phiên và bản ghi hội thoại nằm trên máy chủ gateway.

Nhiều thiết bị/kênh có thể ánh xạ tới cùng một phiên, nhưng lịch sử không được
đồng bộ đầy đủ về mọi client. Khuyến nghị: dùng một thiết bị chính cho các cuộc
trò chuyện dài để tránh ngữ cảnh bị phân kỳ. Control UI và TUI luôn hiển thị bản
ghi phiên do gateway lưu trữ, vì vậy chúng là nguồn sự thật.

Chi tiết: [Session management](/concepts/session).

## Nội dung tin nhắn đến và ngữ cảnh lịch sử

OpenClaw tách **phần thân prompt** khỏi **phần thân lệnh**:

- `Body`: văn bản prompt gửi tới agent. Có thể bao gồm bao bì kênh và
  các wrapper lịch sử tùy chọn.
- `CommandBody`: văn bản thô của người dùng cho việc phân tích chỉ thị/lệnh.
- `RawBody`: bí danh kế thừa của `CommandBody` (giữ để tương thích).

Khi kênh cung cấp lịch sử, nó dùng một wrapper dùng chung:

- `[Chat messages since your last reply - for context]`
- `[Current message - respond to this]`

Đối với **không phải trò chuyện trực tiếp** (nhóm/kênh/phòng), **phần thân tin nhắn hiện tại**
được thêm tiền tố nhãn người gửi (cùng kiểu dùng cho các mục lịch sử). Điều này giữ cho
tin nhắn thời gian thực và tin nhắn xếp hàng/lịch sử nhất quán trong prompt của agent.

Bộ đệm lịch sử là **chỉ-pending**: chúng bao gồm các tin nhắn nhóm _không_
kích hoạt một lượt chạy (ví dụ: tin nhắn bị chặn theo mention) và **loại trừ** các
tin nhắn đã có trong bản ghi phiên.

Việc loại bỏ chỉ thị chỉ áp dụng cho **phần tin nhắn hiện tại** để lịch sử
được giữ nguyên. Các kênh bọc lịch sử nên đặt `CommandBody` (hoặc
`RawBody`) thành văn bản tin nhắn gốc và giữ `Body` là prompt kết hợp.
Bộ đệm lịch sử có thể cấu hình qua `messages.groupChat.historyLimit` (mặc định
toàn cục) và các ghi đè theo kênh như `channels.slack.historyLimit` hoặc
`channels.telegram.accounts.<id>.historyLimit` (đặt `0` để tắt).

## Xếp hàng và lượt theo sau

Nếu một lượt chạy đã đang hoạt động, các tin nhắn đến có thể được xếp hàng, điều
hướng vào lượt hiện tại, hoặc thu thập cho một lượt theo sau.

- Cấu hình qua `messages.queue` (và `messages.queue.byChannel`).
- Các chế độ: `interrupt`, `steer`, `followup`, `collect`, kèm các biến thể backlog.

Chi tiết: [Queueing](/concepts/queue).

## Streaming, chia khối và gom lô

Streaming theo khối gửi các phản hồi từng phần khi mô hình tạo ra các khối văn bản.
Chia khối tôn trọng giới hạn văn bản của kênh và tránh tách code có hàng rào.

Thiết lập chính:

- `agents.defaults.blockStreamingDefault` (`on|off`, mặc định tắt)
- `agents.defaults.blockStreamingBreak` (`text_end|message_end`)
- `agents.defaults.blockStreamingChunk` (`minChars|maxChars|breakPreference`)
- `agents.defaults.blockStreamingCoalesce` (gom lô dựa trên trạng thái nhàn rỗi)
- `agents.defaults.humanDelay` (khoảng dừng giống con người giữa các khối trả lời)
- Ghi đè theo kênh: `*.blockStreaming` và `*.blockStreamingCoalesce` (các kênh không phải Telegram yêu cầu đặt rõ `*.blockStreaming: true`)

Chi tiết: [Streaming + chunking](/concepts/streaming).

## Khả năng hiển thị lập luận và token

OpenClaw có thể hiển thị hoặc ẩn lập luận của mô hình:

- `/reasoning on|off|stream` điều khiển khả năng hiển thị.
- Nội dung lập luận vẫn được tính vào mức sử dụng token khi mô hình tạo ra.
- Telegram hỗ trợ streaming lập luận vào bong bóng bản nháp.

Chi tiết: [Thinking + reasoning directives](/tools/thinking) và [Token use](/token-use).

## Tiền tố, gắn luồng và trả lời

Định dạng tin nhắn đi được tập trung trong `messages`:

- `messages.responsePrefix`, `channels.<channel>.responsePrefix` và `channels.<channel>.accounts.<id>.responsePrefix` (chuỗi tiền tố đi), cùng `channels.whatsapp.messagePrefix` (tiền tố đến của WhatsApp)
- Gắn luồng trả lời qua `replyToMode` và mặc định theo kênh

Chi tiết: [Configuration](/gateway/configuration#messages) và tài liệu kênh.
