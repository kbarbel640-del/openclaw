---
summary: "Workspace của agent: vị trí, bố cục và chiến lược sao lưu"
read_when:
  - Bạn cần giải thích workspace của agent hoặc bố cục tệp của nó
  - Bạn muốn sao lưu hoặc di chuyển workspace của agent
title: "Workspace của Agent"
x-i18n:
  source_path: concepts/agent-workspace.md
  source_hash: 84c550fd89b5f247
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:06:50Z
---

# Workspace của agent

Workspace là ngôi nhà của agent. Đây là thư mục làm việc duy nhất được dùng cho
các công cụ tệp và cho ngữ cảnh workspace. Hãy giữ riêng tư và coi nó như bộ nhớ.

Phần này tách biệt với `~/.openclaw/`, nơi lưu trữ cấu hình, thông tin xác thực và
các phiên.

**Quan trọng:** workspace là **cwd mặc định**, không phải một sandbox cứng. Các công cụ
giải quyết đường dẫn tương đối dựa trên workspace, nhưng đường dẫn tuyệt đối vẫn có
thể truy cập nơi khác trên máy chủ trừ khi bật sandboxing. Nếu bạn cần cô lập, hãy dùng
[`agents.defaults.sandbox`](/gateway/sandboxing) (và/hoặc cấu hình sandbox theo từng agent).
Khi sandboxing được bật và `workspaceAccess` không phải là `"rw"`, các công cụ sẽ
hoạt động bên trong một workspace sandbox dưới `~/.openclaw/sandboxes`, không phải workspace
trên máy chủ của bạn.

## Vị trí mặc định

- Mặc định: `~/.openclaw/workspace`
- Nếu `OPENCLAW_PROFILE` được đặt và không phải `"default"`, mặc định sẽ là
  `~/.openclaw/workspace-<profile>`.
- Ghi đè trong `~/.openclaw/openclaw.json`:

```json5
{
  agent: {
    workspace: "~/.openclaw/workspace",
  },
}
```

`openclaw onboard`, `openclaw configure` hoặc `openclaw setup` sẽ tạo workspace và gieo các
tệp bootstrap nếu chúng bị thiếu.

Nếu bạn đã tự quản lý các tệp workspace, bạn có thể tắt việc tạo tệp bootstrap:

```json5
{ agent: { skipBootstrap: true } }
```

## Thư mục workspace bổ sung

Các bản cài đặt cũ có thể đã tạo `~/openclaw`. Việc giữ nhiều thư mục workspace có
thể gây nhầm lẫn về xác thực hoặc trôi trạng thái, vì tại một thời điểm chỉ có một
workspace đang hoạt động.

**Khuyến nghị:** chỉ giữ một workspace đang hoạt động. Nếu bạn không còn dùng các thư
mục bổ sung, hãy lưu trữ hoặc chuyển chúng vào Thùng rác (ví dụ `trash ~/openclaw`).
Nếu bạn cố ý giữ nhiều workspace, hãy đảm bảo
`agents.defaults.workspace` trỏ tới workspace đang hoạt động.

`openclaw doctor` sẽ cảnh báo khi phát hiện các thư mục workspace bổ sung.

## Bản đồ tệp workspace (ý nghĩa của từng tệp)

Đây là các tệp tiêu chuẩn mà OpenClaw mong đợi bên trong workspace:

- `AGENTS.md`
  - Hướng dẫn vận hành cho agent và cách sử dụng bộ nhớ.
  - Được tải khi bắt đầu mỗi phiên.
  - Nơi phù hợp để đặt các quy tắc, ưu tiên và chi tiết “cách hành xử”.

- `SOUL.md`
  - Persona, giọng điệu và ranh giới.
  - Được tải ở mỗi phiên.

- `USER.md`
  - Người dùng là ai và cách xưng hô.
  - Được tải ở mỗi phiên.

- `IDENTITY.md`
  - Tên agent, phong cách và emoji.
  - Được tạo/cập nhật trong nghi thức bootstrap.

- `TOOLS.md`
  - Ghi chú về các công cụ và quy ước cục bộ của bạn.
  - Không kiểm soát khả dụng của công cụ; chỉ mang tính hướng dẫn.

- `HEARTBEAT.md`
  - Danh sách kiểm tra nhỏ tùy chọn cho các lần chạy heartbeat.
  - Giữ ngắn để tránh tiêu tốn token.

- `BOOT.md`
  - Danh sách kiểm tra khởi động tùy chọn được thực thi khi Gateway khởi động lại
    khi các hook nội bộ được bật.
  - Giữ ngắn; dùng công cụ message cho việc gửi ra ngoài.

- `BOOTSTRAP.md`
  - Nghi thức chạy lần đầu một lần duy nhất.
  - Chỉ được tạo cho workspace hoàn toàn mới.
  - Xóa sau khi nghi thức hoàn tất.

- `memory/YYYY-MM-DD.md`
  - Nhật ký bộ nhớ hằng ngày (mỗi ngày một tệp).
  - Khuyến nghị đọc hôm nay + hôm qua khi bắt đầu phiên.

- `MEMORY.md` (tùy chọn)
  - Bộ nhớ dài hạn được tuyển chọn.
  - Chỉ tải trong phiên chính, riêng tư (không dùng cho ngữ cảnh chia sẻ/nhóm).

Xem [Memory](/concepts/memory) để biết quy trình làm việc và cơ chế xả bộ nhớ tự động.

- `skills/` (tùy chọn)
  - Skills theo workspace.
  - Ghi đè các skills được quản lý/đóng gói khi trùng tên.

- `canvas/` (tùy chọn)
  - Các tệp UI Canvas cho hiển thị node (ví dụ `canvas/index.html`).

Nếu bất kỳ tệp bootstrap nào bị thiếu, OpenClaw sẽ chèn một dấu hiệu “thiếu tệp”
vào phiên và tiếp tục. Các tệp bootstrap lớn sẽ bị cắt ngắn khi chèn;
điều chỉnh giới hạn bằng `agents.defaults.bootstrapMaxChars` (mặc định: 20000).
`openclaw setup` có thể tạo lại các mặc định bị thiếu mà không ghi đè các tệp hiện có.

## Những gì KHÔNG nằm trong workspace

Những mục này nằm dưới `~/.openclaw/` và KHÔNG nên được commit vào repo workspace:

- `~/.openclaw/openclaw.json` (cấu hình)
- `~/.openclaw/credentials/` (token OAuth, khóa API)
- `~/.openclaw/agents/<agentId>/sessions/` (bản ghi phiên + metadata)
- `~/.openclaw/skills/` (skills được quản lý)

Nếu bạn cần di chuyển các phiên hoặc cấu hình, hãy sao chép chúng riêng và giữ
ngoài kiểm soát phiên bản.

## Sao lưu Git (khuyến nghị, riêng tư)

Hãy coi workspace là bộ nhớ riêng tư. Đặt nó trong một repo git **riêng tư** để
được sao lưu và có thể khôi phục.

Thực hiện các bước này trên máy nơi Gateway chạy (đó là nơi workspace tồn tại).

### 1) Khởi tạo repo

Nếu git đã được cài đặt, các workspace hoàn toàn mới sẽ được khởi tạo tự động.
Nếu workspace này chưa phải là repo, hãy chạy:

```bash
cd ~/.openclaw/workspace
git init
git add AGENTS.md SOUL.md TOOLS.md IDENTITY.md USER.md HEARTBEAT.md memory/
git commit -m "Add agent workspace"
```

### 2) Thêm remote riêng tư (tùy chọn thân thiện cho người mới)

Tùy chọn A: GitHub web UI

1. Tạo một repository **riêng tư** mới trên GitHub.
2. Không khởi tạo với README (tránh xung đột merge).
3. Sao chép URL remote HTTPS.
4. Thêm remote và push:

```bash
git branch -M main
git remote add origin <https-url>
git push -u origin main
```

Tùy chọn B: GitHub CLI (`gh`)

```bash
gh auth login
gh repo create openclaw-workspace --private --source . --remote origin --push
```

Tùy chọn C: GitLab web UI

1. Tạo một repository **riêng tư** mới trên GitLab.
2. Không khởi tạo với README (tránh xung đột merge).
3. Sao chép URL remote HTTPS.
4. Thêm remote và push:

```bash
git branch -M main
git remote add origin <https-url>
git push -u origin main
```

### 3) Cập nhật định kỳ

```bash
git status
git add .
git commit -m "Update memory"
git push
```

## Không commit bí mật

Ngay cả trong repo riêng tư, hãy tránh lưu trữ bí mật trong workspace:

- Khóa API, token OAuth, mật khẩu hoặc thông tin xác thực riêng tư.
- Bất kỳ thứ gì dưới `~/.openclaw/`.
- Bản dump thô của cuộc trò chuyện hoặc tệp đính kèm nhạy cảm.

Nếu buộc phải lưu các tham chiếu nhạy cảm, hãy dùng placeholder và giữ bí mật
thật ở nơi khác (trình quản lý mật khẩu, biến môi trường hoặc `~/.openclaw/`).

Gợi ý mẫu khởi đầu `.gitignore`:

```gitignore
.DS_Store
.env
**/*.key
**/*.pem
**/secrets*
```

## Di chuyển workspace sang máy mới

1. Clone repo tới đường dẫn mong muốn (mặc định `~/.openclaw/workspace`).
2. Đặt `agents.defaults.workspace` tới đường dẫn đó trong `~/.openclaw/openclaw.json`.
3. Chạy `openclaw setup --workspace <path>` để gieo các tệp còn thiếu.
4. Nếu cần các phiên, hãy sao chép `~/.openclaw/agents/<agentId>/sessions/` từ
   máy cũ một cách riêng biệt.

## Ghi chú nâng cao

- Định tuyến đa agent có thể dùng các workspace khác nhau cho mỗi agent. Xem
  [Channel routing](/concepts/channel-routing) để biết cấu hình định tuyến.
- Nếu `agents.defaults.sandbox` được bật, các phiên không phải phiên chính có thể dùng
  workspace sandbox theo phiên dưới `agents.defaults.sandbox.workspaceRoot`.
