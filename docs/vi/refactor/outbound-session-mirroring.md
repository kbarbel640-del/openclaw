---
title: Tái cấu trúc Phản chiếu Phiên Gửi Ra (Issue #1520)
description: Track outbound session mirroring refactor notes, decisions, tests, and open items.
x-i18n:
  source_path: refactor/outbound-session-mirroring.md
  source_hash: b88a72f36f7b6d8a
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:08:17Z
---

# Tái cấu trúc Phản chiếu Phiên Gửi Ra (Issue #1520)

## Trạng thái

- Đang tiến hành.
- Đã cập nhật định tuyến kênh core + plugin cho phản chiếu outbound.
- Gateway send hiện suy ra phiên đích khi sessionKey bị bỏ qua.

## Bối cảnh

Các lần gửi outbound trước đây được phản chiếu vào phiên tác tử _hiện tại_ (khóa phiên của tool) thay vì phiên của kênh đích. Định tuyến inbound sử dụng khóa phiên theo kênh/peer, vì vậy các phản hồi outbound rơi vào sai phiên và các mục tiêu liên hệ lần đầu thường thiếu mục nhập phiên.

## Mục tiêu

- Phản chiếu thông điệp outbound vào khóa phiên của kênh đích.
- Tạo mục nhập phiên khi gửi outbound nếu còn thiếu.
- Giữ phạm vi thread/topic căn chỉnh với các khóa phiên inbound.
- Bao phủ các kênh core và các extension đi kèm.

## Tóm tắt triển khai

- Trợ giúp định tuyến phiên outbound mới:
  - `src/infra/outbound/outbound-session.ts`
  - `resolveOutboundSessionRoute` xây dựng sessionKey đích bằng `buildAgentSessionKey` (dmScope + identityLinks).
  - `ensureOutboundSessionEntry` ghi `MsgContext` tối thiểu thông qua `recordSessionMetaFromInbound`.
- `runMessageAction` (send) suy ra sessionKey đích và truyền nó tới `executeSendAction` để phản chiếu.
- `message-tool` không còn phản chiếu trực tiếp; nó chỉ phân giải agentId từ khóa phiên hiện tại.
- Luồng send của plugin phản chiếu qua `appendAssistantMessageToSessionTranscript` bằng sessionKey đã suy ra.
- Gateway send suy ra khóa phiên đích khi không được cung cấp (agent mặc định) và đảm bảo có mục nhập phiên.

## Xử lý Thread/Topic

- Slack: replyTo/threadId -> `resolveThreadSessionKeys` (hậu tố).
- Discord: threadId/replyTo -> `resolveThreadSessionKeys` với `useSuffix=false` để khớp inbound (id kênh thread đã xác định phạm vi phiên).
- Telegram: ID topic ánh xạ tới `chatId:topic:<id>` thông qua `buildTelegramGroupPeerId`.

## Các Extension được bao phủ

- Matrix, MS Teams, Mattermost, BlueBubbles, Nextcloud Talk, Zalo, Zalo Personal, Nostr, Tlon.
- Ghi chú:
  - Mục tiêu Mattermost hiện loại bỏ `@` để định tuyến khóa phiên DM.
  - Zalo Personal dùng loại peer DM cho mục tiêu 1:1 (chỉ dùng group khi có `group:`).
  - Mục tiêu group của BlueBubbles loại bỏ tiền tố `chat_*` để khớp khóa phiên inbound.
  - Phản chiếu auto-thread của Slack khớp id kênh không phân biệt hoa thường.
  - Gateway send chuyển các khóa phiên được cung cấp sang chữ thường trước khi phản chiếu.

## Quyết định

- **Suy ra phiên cho Gateway send**: nếu cung cấp `sessionKey` thì dùng nó. Nếu bị bỏ qua, suy ra sessionKey từ mục tiêu + agent mặc định và phản chiếu vào đó.
- **Tạo mục nhập phiên**: luôn dùng `recordSessionMetaFromInbound` với `Provider/From/To/ChatType/AccountId/Originating*` căn chỉnh theo định dạng inbound.
- **Chuẩn hóa mục tiêu**: định tuyến outbound dùng các mục tiêu đã được phân giải (sau `resolveChannelTarget`) khi có.
- **Chữ hoa/thường của khóa phiên**: chuẩn hóa khóa phiên về chữ thường khi ghi và trong quá trình migration.

## Các bài test được thêm/cập nhật

- `src/infra/outbound/outbound-session.test.ts`
  - Khóa phiên thread của Slack.
  - Khóa phiên topic của Telegram.
  - dmScope identityLinks với Discord.
- `src/agents/tools/message-tool.test.ts`
  - Suy ra agentId từ khóa phiên (không truyền sessionKey).
- `src/gateway/server-methods/send.test.ts`
  - Suy ra khóa phiên khi bị bỏ qua và tạo mục nhập phiên.

## Hạng mục mở / Theo dõi tiếp

- Plugin voice-call dùng các khóa phiên `voice:<phone>` tùy chỉnh. Ánh xạ outbound chưa được chuẩn hóa ở đây; nếu message-tool cần hỗ trợ gửi voice-call, hãy thêm ánh xạ rõ ràng.
- Xác nhận xem có plugin bên ngoài nào dùng định dạng `From/To` không chuẩn ngoài bộ đi kèm hay không.

## Các tệp đã chạm tới

- `src/infra/outbound/outbound-session.ts`
- `src/infra/outbound/outbound-send-service.ts`
- `src/infra/outbound/message-action-runner.ts`
- `src/agents/tools/message-tool.ts`
- `src/gateway/server-methods/send.ts`
- Tests trong:
  - `src/infra/outbound/outbound-session.test.ts`
  - `src/agents/tools/message-tool.test.ts`
  - `src/gateway/server-methods/send.test.ts`
