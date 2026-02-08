---
summary: "Hành vi và cấu hình cho việc xử lý tin nhắn nhóm WhatsApp (mentionPatterns được dùng chung trên các bề mặt)"
read_when:
  - Thay đổi quy tắc tin nhắn nhóm hoặc lượt nhắc
title: "Tin nhắn nhóm"
x-i18n:
  source_path: concepts/group-messages.md
  source_hash: 181a72f12f5021af
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:06:48Z
---

# Tin nhắn nhóm (kênh WhatsApp web)

Mục tiêu: để Clawd tham gia các nhóm WhatsApp, chỉ thức dậy khi được ping, và giữ luồng đó tách biệt khỏi phiên DM cá nhân.

Lưu ý: `agents.list[].groupChat.mentionPatterns` hiện cũng được dùng cho Telegram/Discord/Slack/iMessage; tài liệu này tập trung vào hành vi riêng của WhatsApp. Với thiết lập nhiều tác tử, đặt `agents.list[].groupChat.mentionPatterns` cho từng tác tử (hoặc dùng `messages.groupChat.mentionPatterns` làm phương án dự phòng toàn cục).

## Những gì đã triển khai (2025-12-03)

- Chế độ kích hoạt: `mention` (mặc định) hoặc `always`. `mention` yêu cầu một ping (nhắc @ WhatsApp thật qua `mentionedJids`, các mẫu regex, hoặc số E.164 của bot xuất hiện ở bất kỳ đâu trong văn bản). `always` đánh thức tác tử với mọi tin nhắn nhưng chỉ nên trả lời khi có thể thêm giá trị đáng kể; nếu không sẽ trả về token im lặng `NO_REPLY`. Giá trị mặc định có thể đặt trong cấu hình (`channels.whatsapp.groups`) và ghi đè theo từng nhóm qua `/activation`. Khi đặt `channels.whatsapp.groups`, nó cũng hoạt động như danh sách cho phép của nhóm (bao gồm `"*"` để cho phép tất cả).
- Chính sách nhóm: `channels.whatsapp.groupPolicy` kiểm soát việc có chấp nhận tin nhắn nhóm hay không (`open|disabled|allowlist`). `allowlist` dùng `channels.whatsapp.groupAllowFrom` (dự phòng: `channels.whatsapp.allowFrom` rõ ràng). Mặc định là `allowlist` (bị chặn cho đến khi bạn thêm người gửi).
- Phiên theo từng nhóm: khóa phiên có dạng `agent:<agentId>:whatsapp:group:<jid>` nên các lệnh như `/verbose on` hoặc `/think high` (gửi như tin nhắn độc lập) được áp dụng trong phạm vi nhóm đó; trạng thái DM cá nhân không bị ảnh hưởng. Heartbeat bị bỏ qua cho các luồng nhóm.
- Tiêm ngữ cảnh: các tin nhắn nhóm **chưa xử lý** (pending-only) (mặc định 50) mà _không_ kích hoạt một lần chạy sẽ được tiền tố dưới `[Chat messages since your last reply - for context]`, với dòng kích hoạt nằm dưới `[Current message - respond to this]`. Các tin nhắn đã có trong phiên sẽ không được tiêm lại.
- Hiển thị người gửi: mỗi lô tin nhắn nhóm giờ kết thúc bằng `[from: Sender Name (+E164)]` để Pi biết ai đang nói.
- Tin nhắn tạm thời/xem một lần: chúng tôi mở gói chúng trước khi trích xuất văn bản/lượt nhắc, vì vậy ping bên trong vẫn kích hoạt.
- Prompt hệ thống cho nhóm: ở lượt đầu tiên của một phiên nhóm (và bất cứ khi nào `/activation` thay đổi chế độ) chúng tôi chèn một đoạn ngắn vào prompt hệ thống như `You are replying inside the WhatsApp group "<subject>". Group members: Alice (+44...), Bob (+43...), … Activation: trigger-only … Address the specific sender noted in the message context.`. Nếu không có metadata, chúng tôi vẫn cho tác tử biết đây là cuộc trò chuyện nhóm.

## Ví dụ cấu hình (WhatsApp)

Thêm một khối `groupChat` vào `~/.openclaw/openclaw.json` để ping theo tên hiển thị hoạt động ngay cả khi WhatsApp loại bỏ `@` trực quan trong thân văn bản:

```json5
{
  channels: {
    whatsapp: {
      groups: {
        "*": { requireMention: true },
      },
    },
  },
  agents: {
    list: [
      {
        id: "main",
        groupChat: {
          historyLimit: 50,
          mentionPatterns: ["@?openclaw", "\\+?15555550123"],
        },
      },
    ],
  },
}
```

Ghi chú:

- Các regex không phân biệt hoa thường; chúng bao phủ một ping theo tên hiển thị như `@openclaw` và số thô có hoặc không có `+`/khoảng trắng.
- WhatsApp vẫn gửi lượt nhắc chuẩn qua `mentionedJids` khi ai đó chạm vào liên hệ, vì vậy phương án dự phòng bằng số hiếm khi cần nhưng là một lưới an toàn hữu ích.

### Lệnh kích hoạt (chỉ chủ sở hữu)

Dùng lệnh trong chat nhóm:

- `/activation mention`
- `/activation always`

Chỉ số chủ sở hữu (từ `channels.whatsapp.allowFrom`, hoặc E.164 của chính bot khi chưa đặt) mới có thể thay đổi điều này. Gửi `/status` như một tin nhắn độc lập trong nhóm để xem chế độ kích hoạt hiện tại.

## Cách sử dụng

1. Thêm tài khoản WhatsApp của bạn (tài khoản chạy OpenClaw) vào nhóm.
2. Nói `@openclaw …` (hoặc bao gồm số). Chỉ những người gửi trong danh sách cho phép mới có thể kích hoạt trừ khi bạn đặt `groupPolicy: "open"`.
3. Prompt của tác tử sẽ bao gồm ngữ cảnh nhóm gần đây cùng với dấu `[from: …]` ở cuối để có thể trả lời đúng người.
4. Các chỉ thị cấp phiên (`/verbose on`, `/think high`, `/new` hoặc `/reset`, `/compact`) chỉ áp dụng cho phiên của nhóm đó; gửi chúng như tin nhắn độc lập để chúng được ghi nhận. Phiên DM cá nhân của bạn vẫn độc lập.

## Kiểm thử / xác minh

- Smoke test thủ công:
  - Gửi một ping `@openclaw` trong nhóm và xác nhận có phản hồi tham chiếu đến tên người gửi.
  - Gửi ping thứ hai và xác minh khối lịch sử được bao gồm rồi được xóa ở lượt tiếp theo.
- Kiểm tra log Gateway (chạy với `--verbose`) để xem các mục `inbound web message` hiển thị `from: <groupJid>` và hậu tố `[from: …]`.

## Các lưu ý đã biết

- Heartbeat được cố ý bỏ qua cho nhóm để tránh phát tán ồn ào.
- Chặn lặp echo dùng chuỗi lô kết hợp; nếu bạn gửi cùng một văn bản hai lần mà không có lượt nhắc, chỉ lần đầu nhận được phản hồi.
- Các mục lưu trữ phiên sẽ xuất hiện dưới dạng `agent:<agentId>:whatsapp:group:<jid>` trong kho phiên (`~/.openclaw/agents/<agentId>/sessions/sessions.json` theo mặc định); việc thiếu mục chỉ có nghĩa là nhóm chưa kích hoạt một lần chạy nào.
- Chỉ báo đang gõ trong nhóm tuân theo `agents.defaults.typingMode` (mặc định: `message` khi không được nhắc).
