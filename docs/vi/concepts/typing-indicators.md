---
summary: "Khi OpenClaw hiển thị chỉ báo đang gõ và cách tinh chỉnh chúng"
read_when:
  - Thay đổi hành vi hoặc mặc định của chỉ báo đang gõ
title: "Chỉ báo đang gõ"
x-i18n:
  source_path: concepts/typing-indicators.md
  source_hash: 8ee82d02829c4ff5
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:06:55Z
---

# Chỉ báo đang gõ

Chỉ báo đang gõ được gửi tới kênh chat khi một run đang hoạt động. Dùng
`agents.defaults.typingMode` để kiểm soát **khi nào** bắt đầu hiển thị đang gõ và `typingIntervalSeconds`
để kiểm soát **tần suất** làm mới.

## Mặc định

Khi `agents.defaults.typingMode` **chưa được đặt**, OpenClaw giữ hành vi cũ:

- **Chat trực tiếp**: bắt đầu hiển thị đang gõ ngay khi vòng lặp mô hình bắt đầu.
- **Chat nhóm có nhắc tên**: bắt đầu hiển thị ngay.
- **Chat nhóm không nhắc tên**: chỉ bắt đầu hiển thị khi văn bản tin nhắn bắt đầu stream.
- **Run heartbeat**: tắt chỉ báo đang gõ.

## Chế độ

Đặt `agents.defaults.typingMode` thành một trong các giá trị:

- `never` — không bao giờ hiển thị chỉ báo đang gõ.
- `instant` — bắt đầu hiển thị **ngay khi vòng lặp mô hình bắt đầu**, ngay cả khi run
  sau đó chỉ trả về token phản hồi im lặng.
- `thinking` — bắt đầu hiển thị ở **delta suy luận đầu tiên** (yêu cầu
  `reasoningLevel: "stream"` cho run).
- `message` — bắt đầu hiển thị ở **delta văn bản không im lặng đầu tiên** (bỏ qua
  token im lặng `NO_REPLY`).

Thứ tự theo “mức độ kích hoạt sớm”:
`never` → `message` → `thinking` → `instant`

## Cấu hình

```json5
{
  agent: {
    typingMode: "thinking",
    typingIntervalSeconds: 6,
  },
}
```

Bạn có thể ghi đè chế độ hoặc nhịp làm mới theo từng phiên:

```json5
{
  session: {
    typingMode: "message",
    typingIntervalSeconds: 4,
  },
}
```

## Ghi chú

- Chế độ `message` sẽ không hiển thị đang gõ cho các phản hồi chỉ-im-lặng (ví dụ token
  `NO_REPLY` dùng để ẩn đầu ra).
- `thinking` chỉ kích hoạt nếu run stream suy luận (`reasoningLevel: "stream"`).
  Nếu mô hình không phát ra các delta suy luận, chỉ báo đang gõ sẽ không bắt đầu.
- Heartbeat không bao giờ hiển thị đang gõ, bất kể chế độ nào.
- `typingIntervalSeconds` kiểm soát **nhịp làm mới**, không phải thời điểm bắt đầu.
  Mặc định là 6 giây.
