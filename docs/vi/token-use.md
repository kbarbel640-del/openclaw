---
summary: "Cách OpenClaw xây dựng ngữ cảnh prompt và báo cáo mức sử dụng token + chi phí"
read_when:
  - Giải thích về mức sử dụng token, chi phí hoặc cửa sổ ngữ cảnh
  - Gỡ lỗi sự tăng trưởng hoặc hành vi nén ngữ cảnh
title: "Sử dụng token và chi phí"
x-i18n:
  source_path: token-use.md
  source_hash: cc914080a809ada2
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:08:39Z
---

# Sử dụng token & chi phí

OpenClaw theo dõi **token**, không phải ký tự. Token phụ thuộc vào từng mô hình, nhưng hầu hết
các mô hình kiểu OpenAI trung bình ~4 ký tự cho mỗi token đối với văn bản tiếng Anh.

## Cách system prompt được xây dựng

OpenClaw tự lắp ráp system prompt của riêng nó cho mỗi lần chạy. Nó bao gồm:

- Danh sách công cụ + mô tả ngắn
- Danh sách Skills (chỉ metadata; hướng dẫn được tải theo yêu cầu với `read`)
- Hướng dẫn tự cập nhật
- Workspace + các tệp bootstrap (`AGENTS.md`, `SOUL.md`, `TOOLS.md`, `IDENTITY.md`, `USER.md`, `HEARTBEAT.md`, `BOOTSTRAP.md` khi mới). Các tệp lớn được cắt ngắn bởi `agents.defaults.bootstrapMaxChars` (mặc định: 20000).
- Thời gian (UTC + múi giờ người dùng)
- Thẻ trả lời + hành vi heartbeat
- Metadata runtime (host/OS/model/thinking)

Xem phân tích đầy đủ tại [System Prompt](/concepts/system-prompt).

## Những gì được tính trong cửa sổ ngữ cảnh

Mọi thứ mà mô hình nhận được đều được tính vào giới hạn ngữ cảnh:

- System prompt (tất cả các phần được liệt kê ở trên)
- Lịch sử hội thoại (tin nhắn người dùng + trợ lý)
- Lệnh gọi công cụ và kết quả công cụ
- Tệp đính kèm/bản ghi (hình ảnh, âm thanh, tệp)
- Tóm tắt nén và các tạo phẩm cắt tỉa
- Wrapper của nhà cung cấp hoặc header an toàn (không hiển thị, nhưng vẫn được tính)

Để xem phân tích thực tế (theo từng tệp được chèn, công cụ, Skills và kích thước system prompt), hãy dùng `/context list` hoặc `/context detail`. Xem [Context](/concepts/context).

## Cách xem mức sử dụng token hiện tại

Dùng các lệnh sau trong chat:

- `/status` → **thẻ trạng thái nhiều emoji** với mô hình của phiên, mức sử dụng ngữ cảnh,
  token đầu vào/đầu ra của phản hồi gần nhất và **chi phí ước tính** (chỉ với API key).
- `/usage off|tokens|full` → thêm **footer mức sử dụng theo từng phản hồi** vào mọi câu trả lời.
  - Duy trì theo phiên (được lưu dưới dạng `responseUsage`).
  - Xác thực OAuth **ẩn chi phí** (chỉ hiển thị token).
- `/usage cost` → hiển thị bản tổng hợp chi phí cục bộ từ log phiên OpenClaw.

Các bề mặt khác:

- **TUI/Web TUI:** hỗ trợ `/status` + `/usage`.
- **CLI:** `openclaw status --usage` và `openclaw channels list` hiển thị
  cửa sổ hạn ngạch của nhà cung cấp (không phải chi phí theo từng phản hồi).

## Ước tính chi phí (khi được hiển thị)

Chi phí được ước tính từ cau hinh giá mô hình của bạn:

```
models.providers.<provider>.models[].cost
```

Đây là **USD trên mỗi 1M token** cho `input`, `output`, `cacheRead` và
`cacheWrite`. Nếu thiếu giá, OpenClaw chỉ hiển thị token. Token OAuth
không bao giờ hiển thị chi phí bằng đô la.

## TTL cache và tác động của việc cắt tỉa

Cache prompt của nhà cung cấp chỉ áp dụng trong khoảng thời gian TTL của cache. OpenClaw có thể
tùy chọn chạy **cache-ttl pruning**: nó cắt tỉa phiên sau khi TTL của cache
hết hạn, rồi đặt lại cửa sổ cache để các yêu cầu tiếp theo có thể tái sử dụng
ngữ cảnh vừa được cache mới thay vì phải cache lại toàn bộ lịch sử. Điều này giúp
giảm chi phí ghi cache khi một phiên bị nhàn rỗi quá TTL.

Cấu hình trong [Gateway configuration](/gateway/configuration) và xem chi tiết hành vi tại [Session pruning](/concepts/session-pruning).

Heartbeat có thể giữ cache **ấm** qua các khoảng nhàn rỗi. Nếu TTL cache của mô hình là
`1h`, việc đặt khoảng heartbeat thấp hơn một chút (ví dụ: `55m`) có thể tránh
việc cache lại toàn bộ prompt, từ đó giảm chi phí ghi cache.

Đối với giá API Anthropic, việc đọc cache rẻ hơn đáng kể so với token đầu vào,
trong khi ghi cache được tính phí với hệ số cao hơn. Xem bảng giá prompt caching của Anthropic để biết
mức giá và hệ số TTL mới nhất:
https://docs.anthropic.com/docs/build-with-claude/prompt-caching

### Ví dụ: giữ cache 1h ấm bằng heartbeat

```yaml
agents:
  defaults:
    model:
      primary: "anthropic/claude-opus-4-6"
    models:
      "anthropic/claude-opus-4-6":
        params:
          cacheRetention: "long"
    heartbeat:
      every: "55m"
```

## Mẹo giảm áp lực token

- Dùng `/compact` để tóm tắt các phiên dài.
- Cắt gọn các đầu ra công cụ lớn trong workflow của bạn.
- Giữ mô tả skill ngắn gọn (danh sách skill được chèn vào prompt).
- Ưu tiên các mô hình nhỏ hơn cho công việc thăm dò, nhiều lời.

Xem [Skills](/tools/skills) để biết công thức chi phí overhead của danh sách skill chính xác.
