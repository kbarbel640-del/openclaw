---
summary: "Ghi chú nghiên cứu: hệ thống bộ nhớ offline cho workspace Clawd (Markdown làm nguồn chân lý + chỉ mục dẫn xuất)"
read_when:
  - Thiết kế bộ nhớ workspace (~/.openclaw/workspace) vượt ra ngoài các log Markdown hằng ngày
  - Quyết định: CLI độc lập hay tích hợp sâu với OpenClaw
  - Thêm khả năng ghi nhớ + suy ngẫm offline (retain/recall/reflect)
title: "Nghiên cứu bộ nhớ Workspace"
x-i18n:
  source_path: experiments/research/memory.md
  source_hash: 1753c8ee6284999f
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:07:25Z
---

# Workspace Memory v2 (offline): ghi chú nghiên cứu

Mục tiêu: workspace kiểu Clawd (`agents.defaults.workspace`, mặc định `~/.openclaw/workspace`) nơi “bộ nhớ” được lưu dưới dạng một file Markdown mỗi ngày (`memory/YYYY-MM-DD.md`) cùng với một tập nhỏ các file ổn định (ví dụ: `memory.md`, `SOUL.md`).

Tài liệu này đề xuất một kiến trúc bộ nhớ **ưu tiên offline**, giữ Markdown làm nguồn chân lý chuẩn, có thể xem lại bởi con người, nhưng bổ sung **khả năng recall có cấu trúc** (tìm kiếm, tóm tắt theo thực thể, cập nhật độ tin cậy) thông qua một chỉ mục dẫn xuất.

## Vì sao cần thay đổi?

Thiết lập hiện tại (mỗi ngày một file) rất tốt cho:

- ghi chép “append-only”
- chỉnh sửa bởi con người
- độ bền + khả năng kiểm toán nhờ git
- ghi nhận nhanh, ít ma sát (“cứ viết xuống”)

Nhưng nó yếu ở:

- truy xuất cần độ bao phủ cao (“chúng ta đã quyết định gì về X?”, “lần trước thử Y là khi nào?”)
- trả lời theo thực thể (“kể tôi nghe về Alice / The Castle / warelay”) mà không phải đọc lại nhiều file
- độ ổn định của ý kiến/sở thích (và bằng chứng khi nó thay đổi)
- ràng buộc thời gian (“điều gì đúng vào tháng 11 năm 2025?”) và giải quyết xung đột

## Mục tiêu thiết kế

- **Offline**: hoạt động không cần mạng; chạy được trên laptop/Castle; không phụ thuộc cloud.
- **Có thể giải thích**: các mục được truy xuất phải truy nguyên được (file + vị trí) và tách bạch khỏi suy luận.
- **Ít nghi thức**: ghi log hằng ngày vẫn là Markdown, không cần schema nặng nề.
- **Gia tăng dần**: v1 đã hữu ích chỉ với FTS; semantic/vector và đồ thị là nâng cấp tùy chọn.
- **Thân thiện với agent**: giúp “recall trong giới hạn token” dễ dàng (trả về các gói fact nhỏ).

## Mô hình sao Bắc Đẩu (Hindsight × Letta)

Hai mảnh ghép cần hòa trộn:

1. **Vòng điều khiển kiểu Letta/MemGPT**

- giữ một “core” nhỏ luôn nằm trong ngữ cảnh (persona + các fact quan trọng về người dùng)
- mọi thứ khác nằm ngoài ngữ cảnh và được truy xuất qua tool
- ghi bộ nhớ là các lời gọi tool tường minh (append/replace/insert), được lưu bền, rồi tiêm lại vào lượt tiếp theo

2. **Nền bộ nhớ kiểu Hindsight**

- tách bạch cái được quan sát vs cái được tin vs cái được tóm tắt
- hỗ trợ retain/recall/reflect
- các ý kiến có độ tin cậy và có thể tiến hóa theo bằng chứng
- truy xuất nhận biết thực thể + truy vấn theo thời gian (ngay cả khi chưa có knowledge graph đầy đủ)

## Kiến trúc đề xuất (Markdown làm nguồn chân lý + chỉ mục dẫn xuất)

### Kho lưu trữ chuẩn (thân thiện với git)

Giữ `~/.openclaw/workspace` làm bộ nhớ chuẩn, dễ đọc cho con người.

Bố cục workspace gợi ý:

```
~/.openclaw/workspace/
  memory.md                    # small: durable facts + preferences (core-ish)
  memory/
    YYYY-MM-DD.md              # daily log (append; narrative)
  bank/                        # “typed” memory pages (stable, reviewable)
    world.md                   # objective facts about the world
    experience.md              # what the agent did (first-person)
    opinions.md                # subjective prefs/judgments + confidence + evidence pointers
    entities/
      Peter.md
      The-Castle.md
      warelay.md
      ...
```

Ghi chú:

- **Log hằng ngày vẫn là log hằng ngày**. Không cần biến nó thành JSON.
- Các file `bank/` được **chắt lọc**, tạo ra bởi các job reflect, và vẫn có thể chỉnh sửa thủ công.
- `memory.md` vẫn giữ “nhỏ + kiểu core”: những thứ bạn muốn Clawd thấy ở mỗi phiên.

### Kho dẫn xuất (recall cho máy)

Thêm một chỉ mục dẫn xuất dưới workspace (không nhất thiết được git theo dõi):

```
~/.openclaw/workspace/.memory/index.sqlite
```

Nền tảng gồm:

- schema SQLite cho fact + liên kết thực thể + metadata ý kiến
- SQLite **FTS5** cho recall từ vựng (nhanh, nhỏ, offline)
- bảng embedding tùy chọn cho recall ngữ nghĩa (vẫn offline)

Chỉ mục này luôn **có thể xây dựng lại từ Markdown**.

## Retain / Recall / Reflect (vòng vận hành)

### Retain: chuẩn hóa log hằng ngày thành “fact”

Insight quan trọng của Hindsight ở đây: lưu **fact dạng tường thuật, tự chứa**, không phải các mảnh nhỏ li ti.

Quy tắc thực tế cho `memory/YYYY-MM-DD.md`:

- cuối ngày (hoặc trong ngày), thêm một mục `## Retain` với 2–5 gạch đầu dòng:
  - có tính tường thuật (giữ được ngữ cảnh xuyên lượt)
  - tự chứa (đọc độc lập vẫn hiểu)
  - được gắn loại + nhắc tới thực thể

Ví dụ:

```
## Retain
- W @Peter: Currently in Marrakech (Nov 27–Dec 1, 2025) for Andy’s birthday.
- B @warelay: I fixed the Baileys WS crash by wrapping connection.update handlers in try/catch (see memory/2025-11-27.md).
- O(c=0.95) @Peter: Prefers concise replies (&lt;1500 chars) on WhatsApp; long content goes into files.
```

Phân tích tối thiểu:

- Tiền tố loại: `W` (world), `B` (experience/biographical), `O` (opinion), `S` (observation/summary; thường được tạo tự động)
- Thực thể: `@Peter`, `@warelay`, v.v. (slug ánh xạ tới `bank/entities/*.md`)
- Độ tin cậy của ý kiến: `O(c=0.0..1.0)` (tùy chọn)

Nếu bạn không muốn tác giả phải nghĩ nhiều: job reflect có thể suy ra các gạch đầu dòng này từ phần còn lại của log, nhưng việc có một mục `## Retain` tường minh là “đòn bẩy chất lượng” dễ nhất.

### Recall: truy vấn trên chỉ mục dẫn xuất

Recall nên hỗ trợ:

- **từ vựng**: “tìm thuật ngữ / tên / lệnh chính xác” (FTS5)
- **theo thực thể**: “kể tôi nghe về X” (trang thực thể + các fact liên kết thực thể)
- **theo thời gian**: “chuyện gì xảy ra quanh 27/11” / “kể từ tuần trước”
- **ý kiến**: “Peter thích gì?” (kèm độ tin cậy + bằng chứng)

Định dạng trả về nên thân thiện với agent và có trích dẫn nguồn:

- `kind` (`world|experience|opinion|observation`)
- `timestamp` (ngày nguồn, hoặc khoảng thời gian trích xuất nếu có)
- `entities` (`["Peter","warelay"]`)
- `content` (fact dạng tường thuật)
- `source` (`memory/2025-11-27.md#L12` v.v.)

### Reflect: tạo trang ổn định + cập nhật niềm tin

Reflect là một job theo lịch (hằng ngày hoặc nhịp `ultrathink`) để:

- cập nhật `bank/entities/*.md` từ các fact gần đây (tóm tắt theo thực thể)
- cập nhật độ tin cậy `bank/opinions.md` dựa trên củng cố/mâu thuẫn
- tùy chọn đề xuất chỉnh sửa `memory.md` (các fact bền, “kiểu core”)

Tiến hóa ý kiến (đơn giản, dễ giải thích):

- mỗi ý kiến có:
  - phát biểu
  - độ tin cậy `c ∈ [0,1]`
  - last_updated
  - liên kết bằng chứng (fact ID ủng hộ + phản bác)
- khi có fact mới:
  - tìm các ý kiến ứng viên theo chồng lấn thực thể + độ tương đồng (FTS trước, embedding sau)
  - cập nhật độ tin cậy theo các delta nhỏ; bước nhảy lớn cần mâu thuẫn mạnh + bằng chứng lặp lại

## Tích hợp CLI: độc lập vs tích hợp sâu

Khuyến nghị: **tích hợp sâu trong OpenClaw**, nhưng giữ một thư viện lõi có thể tách rời.

### Vì sao tích hợp vào OpenClaw?

- OpenClaw đã biết:
  - đường dẫn workspace (`agents.defaults.workspace`)
  - mô hình phiên + heartbeat
  - các mẫu logging + troubleshooting
- Bạn muốn chính agent gọi các tool:
  - `openclaw memory recall "…" --k 25 --since 30d`
  - `openclaw memory reflect --since 7d`

### Vì sao vẫn tách thư viện?

- giữ logic bộ nhớ có thể test mà không cần gateway/runtime
- tái sử dụng cho bối cảnh khác (script local, app desktop tương lai, v.v.)

Hình dạng:
Bộ công cụ bộ nhớ dự kiến là một lớp CLI + thư viện nhỏ, nhưng đây mới chỉ là thăm dò.

## “S-Collide” / SuCo: khi nào nên dùng (nghiên cứu)

Nếu “S-Collide” ám chỉ **SuCo (Subspace Collision)**: đây là một cách truy xuất ANN nhắm tới cân bằng tốt giữa recall/độ trễ bằng cách dùng va chạm có học/có cấu trúc trong các không gian con (bài báo: arXiv 2411.14754, 2024).

Góc nhìn thực dụng cho `~/.openclaw/workspace`:

- **đừng bắt đầu** với SuCo.
- bắt đầu với SQLite FTS + (tùy chọn) embedding đơn giản; bạn sẽ có ngay phần lớn lợi ích UX.
- chỉ cân nhắc các giải pháp lớp SuCo/HNSW/ScaNN khi:
  - corpus lớn (hàng chục/hàng trăm nghìn chunk)
  - tìm kiếm embedding brute-force trở nên quá chậm
  - chất lượng recall thực sự bị nghẽn bởi tìm kiếm từ vựng

Các lựa chọn thay thế thân thiện offline (tăng dần độ phức tạp):

- SQLite FTS5 + bộ lọc metadata (không ML)
- Embedding + brute force (đi khá xa nếu số chunk thấp)
- Chỉ mục HNSW (phổ biến, vững; cần binding thư viện)
- SuCo (mức nghiên cứu; hấp dẫn nếu có implementation tốt để nhúng)

Câu hỏi mở:

- đâu là mô hình embedding offline **tốt nhất** cho “bộ nhớ trợ lý cá nhân” trên máy của bạn (laptop + desktop)?
  - nếu đã có Ollama: embed bằng model local; nếu không, đóng gói một model embedding nhỏ trong toolchain.

## Bản pilot nhỏ nhất nhưng hữu ích

Nếu bạn muốn một phiên bản tối thiểu mà vẫn có giá trị:

- Thêm các trang thực thể `bank/` và một mục `## Retain` trong log hằng ngày.
- Dùng SQLite FTS cho recall kèm trích dẫn (đường dẫn + số dòng).
- Chỉ thêm embedding nếu chất lượng recall hoặc quy mô đòi hỏi.

## Tài liệu tham khảo

- Khái niệm Letta / MemGPT: “core memory blocks” + “archival memory” + bộ nhớ tự chỉnh sửa dựa trên tool.
- Báo cáo kỹ thuật Hindsight: “retain / recall / reflect”, bộ nhớ bốn mạng, trích xuất fact dạng tường thuật, tiến hóa độ tin cậy của ý kiến.
- SuCo: arXiv 2411.14754 (2024): “Subspace Collision” cho truy xuất láng giềng gần đúng.
