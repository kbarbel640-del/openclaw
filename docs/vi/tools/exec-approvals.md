---
summary: "Phê duyệt exec, allowlist và các prompt thoát sandbox"
read_when:
  - Cấu hình phê duyệt exec hoặc allowlist
  - Triển khai UX phê duyệt exec trong ứng dụng macOS
  - Xem xét các prompt thoát sandbox và tác động của chúng
title: "Phê duyệt Exec"
x-i18n:
  source_path: tools/exec-approvals.md
  source_hash: 97736427752eb905
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:08:54Z
---

# Phê duyệt exec

Phê duyệt exec là **lan can an toàn của ứng dụng đồng hành / node host** để cho phép một tác tử trong sandbox chạy
lệnh trên máy chủ thực (`gateway` hoặc `node`). Hãy coi nó như một khóa an toàn:
lệnh chỉ được phép khi **chính sách + allowlist + (tùy chọn) phê duyệt người dùng** đều đồng ý.
Phê duyệt exec **bổ sung** cho chính sách tool và cơ chế elevated (trừ khi elevated được đặt là `full`, khi đó bỏ qua phê duyệt).
Chính sách hiệu lực là **nghiêm ngặt hơn** giữa `tools.exec.*` và giá trị mặc định của phê duyệt; nếu một trường phê duyệt bị bỏ qua, giá trị `tools.exec` sẽ được dùng.

Nếu UI của ứng dụng đồng hành **không khả dụng**, mọi yêu cầu cần hiển thị prompt sẽ
được xử lý bằng **ask fallback** (mặc định: từ chối).

## Phạm vi áp dụng

Phê duyệt exec được thực thi cục bộ trên máy chủ thực thi:

- **gateway host** → tiến trình `openclaw` trên máy gateway
- **node host** → node runner (ứng dụng đồng hành macOS hoặc node host headless)

Phân tách trên macOS:

- **dịch vụ node host** chuyển tiếp `system.run` tới **ứng dụng macOS** qua IPC cục bộ.
- **ứng dụng macOS** thực thi phê duyệt + chạy lệnh trong ngữ cảnh UI.

## Cài đặt và lưu trữ

Các phê duyệt nằm trong một tệp JSON cục bộ trên máy chủ thực thi:

`~/.openclaw/exec-approvals.json`

Ví dụ schema:

```json
{
  "version": 1,
  "socket": {
    "path": "~/.openclaw/exec-approvals.sock",
    "token": "base64url-token"
  },
  "defaults": {
    "security": "deny",
    "ask": "on-miss",
    "askFallback": "deny",
    "autoAllowSkills": false
  },
  "agents": {
    "main": {
      "security": "allowlist",
      "ask": "on-miss",
      "askFallback": "deny",
      "autoAllowSkills": true,
      "allowlist": [
        {
          "id": "B0C8C0B3-2C2D-4F8A-9A3C-5A4B3C2D1E0F",
          "pattern": "~/Projects/**/bin/rg",
          "lastUsedAt": 1737150000000,
          "lastUsedCommand": "rg -n TODO",
          "lastResolvedPath": "/Users/user/Projects/.../bin/rg"
        }
      ]
    }
  }
}
```

## Các nút điều khiển chính sách

### Bảo mật (`exec.security`)

- **deny**: chặn mọi yêu cầu exec trên host.
- **allowlist**: chỉ cho phép các lệnh nằm trong allowlist.
- **full**: cho phép mọi thứ (tương đương elevated).

### Ask (`exec.ask`)

- **off**: không bao giờ hỏi.
- **on-miss**: chỉ hỏi khi allowlist không khớp.
- **always**: hỏi với mọi lệnh.

### Ask fallback (`askFallback`)

Nếu cần prompt nhưng không có UI nào truy cập được, fallback quyết định:

- **deny**: chặn.
- **allowlist**: chỉ cho phép nếu allowlist khớp.
- **full**: cho phép.

## Allowlist (theo tác tử)

Allowlist là **theo từng tác tử**. Nếu có nhiều tác tử, hãy chuyển tác tử bạn đang
chỉnh sửa trong ứng dụng macOS. Mẫu là **glob không phân biệt hoa thường**.
Mẫu phải phân giải thành **đường dẫn binary** (các mục chỉ có basename sẽ bị bỏ qua).
Các mục `agents.default` cũ sẽ được migrate sang `agents.main` khi tải.

Ví dụ:

- `~/Projects/**/bin/bird`
- `~/.local/bin/*`
- `/opt/homebrew/bin/rg`

Mỗi mục allowlist theo dõi:

- **id** UUID ổn định dùng cho định danh UI (tùy chọn)
- **last used** dấu thời gian lần dùng gần nhất
- **last used command**
- **last resolved path**

## Tự động cho phép CLI của Skills

Khi **Auto-allow skill CLIs** được bật, các executable được tham chiếu bởi Skills đã biết
được xem như nằm trong allowlist trên các node (node macOS hoặc node host headless). Cơ chế này dùng
`skills.bins` qua Gateway RPC để lấy danh sách bin của skill. Hãy tắt nếu bạn muốn allowlist thủ công nghiêm ngặt.

## Safe bins (chỉ stdin)

`tools.exec.safeBins` định nghĩa một danh sách nhỏ các binary **chỉ đọc stdin** (ví dụ `jq`)
có thể chạy ở chế độ allowlist **mà không cần** mục allowlist tường minh. Safe bins từ chối
tham số vị trí là tệp và các token dạng đường dẫn, vì vậy chúng chỉ có thể thao tác trên luồng vào.
Chuỗi lệnh shell và chuyển hướng không được tự động cho phép trong chế độ allowlist.

Chuỗi lệnh shell (`&&`, `||`, `;`) được phép khi mọi phân đoạn cấp cao nhất đều thỏa mãn allowlist
(bao gồm safe bins hoặc auto-allow từ Skills). Chuyển hướng vẫn không được hỗ trợ trong chế độ allowlist.
Thay thế lệnh (`$()` / backticks) bị từ chối trong quá trình phân tích allowlist, kể cả bên trong
dấu ngoặc kép; hãy dùng dấu nháy đơn nếu bạn cần văn bản `$()` theo nghĩa đen.

Safe bins mặc định: `jq`, `grep`, `cut`, `sort`, `uniq`, `head`, `tail`, `tr`, `wc`.

## Chỉnh sửa trong Control UI

Dùng thẻ **Control UI → Nodes → Exec approvals** để chỉnh sửa giá trị mặc định,
ghi đè theo tác tử và allowlist. Chọn một phạm vi (Defaults hoặc một tác tử), điều chỉnh chính sách,
thêm/xóa mẫu allowlist, rồi **Save**. UI hiển thị metadata **last used**
theo từng mẫu để bạn giữ danh sách gọn gàng.

Bộ chọn mục tiêu cho phép chọn **Gateway** (phê duyệt cục bộ) hoặc một **Node**. Các node
phải quảng bá `system.execApprovals.get/set` (ứng dụng macOS hoặc node host headless).
Nếu một node chưa quảng bá phê duyệt exec, hãy chỉnh sửa trực tiếp
`~/.openclaw/exec-approvals.json` cục bộ của nó.

CLI: `openclaw approvals` hỗ trợ chỉnh sửa gateway hoặc node (xem [Approvals CLI](/cli/approvals)).

## Luồng phê duyệt

Khi cần hiển thị prompt, gateway phát `exec.approval.requested` tới các client của người vận hành.
Control UI và ứng dụng macOS xử lý thông qua `exec.approval.resolve`, sau đó gateway chuyển tiếp
yêu cầu đã được phê duyệt tới node host.

Khi cần phê duyệt, tool exec trả về ngay với một approval id. Dùng id đó để
liên kết các sự kiện hệ thống về sau (`Exec finished` / `Exec denied`). Nếu không có quyết định trước khi
hết thời gian chờ, yêu cầu sẽ được xem là timeout phê duyệt và hiển thị như một lý do bị từ chối.

Hộp thoại xác nhận bao gồm:

- lệnh + tham số
- cwd
- id tác tử
- đường dẫn executable đã phân giải
- metadata host + chính sách

Hành động:

- **Allow once** → chạy ngay
- **Always allow** → thêm vào allowlist + chạy
- **Deny** → chặn

## Chuyển tiếp phê duyệt tới các kênh chat

Bạn có thể chuyển tiếp các prompt phê duyệt exec tới bất kỳ kênh chat nào (kể cả kênh plugin) và phê duyệt
chúng bằng `/approve`. Cơ chế này dùng pipeline gửi ra ngoài tiêu chuẩn.

Cấu hình:

```json5
{
  approvals: {
    exec: {
      enabled: true,
      mode: "session", // "session" | "targets" | "both"
      agentFilter: ["main"],
      sessionFilter: ["discord"], // substring or regex
      targets: [
        { channel: "slack", to: "U12345678" },
        { channel: "telegram", to: "123456789" },
      ],
    },
  },
}
```

Trả lời trong chat:

```
/approve <id> allow-once
/approve <id> allow-always
/approve <id> deny
```

### Luồng IPC trên macOS

```
Gateway -> Node Service (WS)
                 |  IPC (UDS + token + HMAC + TTL)
                 v
             Mac App (UI + approvals + system.run)
```

Ghi chú bảo mật:

- Chế độ Unix socket `0600`, token được lưu trong `exec-approvals.json`.
- Kiểm tra peer cùng UID.
- Thách thức/đáp ứng (nonce + token HMAC + hash yêu cầu) + TTL ngắn.

## Sự kiện hệ thống

Vòng đời exec được hiển thị dưới dạng thông điệp hệ thống:

- `Exec running` (chỉ khi lệnh vượt ngưỡng thông báo đang chạy)
- `Exec finished`
- `Exec denied`

Các thông điệp này được đăng vào session của tác tử sau khi node báo cáo sự kiện.
Phê duyệt exec trên gateway host phát cùng các sự kiện vòng đời khi lệnh kết thúc (và tùy chọn khi chạy lâu hơn ngưỡng).
Các exec bị chặn bởi phê duyệt tái sử dụng approval id làm `runId` trong các thông điệp này để dễ liên kết.

## Hệ quả

- **full** rất mạnh; ưu tiên dùng allowlist khi có thể.
- **ask** giúp bạn luôn nắm được tình hình mà vẫn cho phép phê duyệt nhanh.
- Allowlist theo tác tử ngăn việc phê duyệt của tác tử này rò rỉ sang tác tử khác.
- Phê duyệt chỉ áp dụng cho các yêu cầu exec trên host từ **nguồn gửi được ủy quyền**. Nguồn gửi không được ủy quyền không thể phát `/exec`.
- `/exec security=full` là tiện ích cấp session cho các người vận hành được ủy quyền và cố ý bỏ qua phê duyệt.
  Để chặn cứng exec trên host, đặt bảo mật phê duyệt thành `deny` hoặc từ chối tool `exec` thông qua chính sách tool.

Liên quan:

- [Exec tool](/tools/exec)
- [Elevated mode](/tools/elevated)
- [Skills](/tools/skills)
