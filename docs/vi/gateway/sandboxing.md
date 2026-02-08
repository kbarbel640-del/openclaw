---
summary: "Cách sandboxing của OpenClaw hoạt động: các chế độ, phạm vi, quyền truy cập workspace và image"
title: Sandboxing
read_when: "Bạn muốn một giải thích chuyên sâu về sandboxing hoặc cần tinh chỉnh agents.defaults.sandbox."
status: active
x-i18n:
  source_path: gateway/sandboxing.md
  source_hash: 184fc53001fc6b28
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:07:28Z
---

# Sandboxing

OpenClaw có thể chạy **tools bên trong container Docker** để giảm phạm vi ảnh hưởng.
Điều này là **tùy chọn** và được điều khiển bằng cấu hình (`agents.defaults.sandbox` hoặc
`agents.list[].sandbox`). Nếu sandboxing tắt, tools sẽ chạy trên host.
Gateway vẫn ở trên host; việc thực thi tool sẽ chạy trong sandbox cô lập
khi được bật.

Đây không phải là ranh giới bảo mật hoàn hảo, nhưng nó hạn chế đáng kể quyền truy cập
hệ thống tệp và tiến trình khi mô hình làm điều gì đó không khôn ngoan.

## Những gì được sandbox

- Thực thi tool (`exec`, `read`, `write`, `edit`, `apply_patch`, `process`, v.v.).
- Trình duyệt sandbox tùy chọn (`agents.defaults.sandbox.browser`).
  - Theo mặc định, trình duyệt sandbox tự khởi động (đảm bảo CDP có thể truy cập) khi tool trình duyệt cần.
    Cấu hình qua `agents.defaults.sandbox.browser.autoStart` và `agents.defaults.sandbox.browser.autoStartTimeoutMs`.
  - `agents.defaults.sandbox.browser.allowHostControl` cho phép các phiên sandbox nhắm tới trình duyệt trên host một cách tường minh.
  - Các allowlist tùy chọn kiểm soát `target: "custom"`: `allowedControlUrls`, `allowedControlHosts`, `allowedControlPorts`.

Không được sandbox:

- Chính tiến trình Gateway.
- Bất kỳ tool nào được cho phép rõ ràng chạy trên host (ví dụ: `tools.elevated`).
  - **Thực thi nâng quyền chạy trên host và bỏ qua sandboxing.**
  - Nếu sandboxing tắt, `tools.elevated` không thay đổi cách thực thi (vốn đã chạy trên host). Xem [Elevated Mode](/tools/elevated).

## Các chế độ

`agents.defaults.sandbox.mode` điều khiển **khi nào** sandboxing được sử dụng:

- `"off"`: không sandboxing.
- `"non-main"`: chỉ sandbox các phiên **không phải phiên chính** (mặc định nếu bạn muốn các cuộc trò chuyện bình thường chạy trên host).
- `"all"`: mọi phiên đều chạy trong sandbox.
  Lưu ý: `"non-main"` dựa trên `session.mainKey` (mặc định `"main"`), không phải id của agent.
  Các phiên nhóm/kênh dùng khóa riêng, vì vậy chúng được tính là không-phải-chính và sẽ bị sandbox.

## Phạm vi

`agents.defaults.sandbox.scope` điều khiển **số lượng container** được tạo:

- `"session"` (mặc định): một container cho mỗi phiên.
- `"agent"`: một container cho mỗi agent.
- `"shared"`: một container dùng chung cho tất cả các phiên sandbox.

## Quyền truy cập workspace

`agents.defaults.sandbox.workspaceAccess` điều khiển **những gì sandbox có thể thấy**:

- `"none"` (mặc định): tools nhìn thấy một workspace sandbox dưới `~/.openclaw/sandboxes`.
- `"ro"`: mount workspace của agent ở chế độ chỉ đọc tại `/agent` (vô hiệu `write`/`edit`/`apply_patch`).
- `"rw"`: mount workspace của agent ở chế độ đọc/ghi tại `/workspace`.

Media đi vào được sao chép vào workspace sandbox đang hoạt động (`media/inbound/*`).
Lưu ý về Skills: tool `read` được gắn gốc theo sandbox. Với `workspaceAccess: "none"`,
OpenClaw phản chiếu các skills đủ điều kiện vào workspace sandbox (`.../skills`) để
có thể đọc. Với `"rw"`, các skills trong workspace có thể đọc từ
`/workspace/skills`.

## Custom bind mounts

`agents.defaults.sandbox.docker.binds` mount thêm các thư mục trên host vào container.
Định dạng: `host:container:mode` (ví dụ: `"/home/user/source:/source:rw"`).

Các bind toàn cục và theo agent được **gộp** (không bị thay thế). Dưới `scope: "shared"`, các bind theo agent bị bỏ qua.

Ví dụ (nguồn chỉ đọc + docker socket):

```json5
{
  agents: {
    defaults: {
      sandbox: {
        docker: {
          binds: ["/home/user/source:/source:ro", "/var/run/docker.sock:/var/run/docker.sock"],
        },
      },
    },
    list: [
      {
        id: "build",
        sandbox: {
          docker: {
            binds: ["/mnt/cache:/cache:rw"],
          },
        },
      },
    ],
  },
}
```

Ghi chú bảo mật:

- Các bind bỏ qua hệ thống tệp của sandbox: chúng phơi bày các đường dẫn host với chế độ bạn đặt (`:ro` hoặc `:rw`).
- Các mount nhạy cảm (ví dụ: `docker.sock`, secrets, khóa SSH) nên để `:ro` trừ khi thực sự cần.
- Kết hợp với `workspaceAccess: "ro"` nếu bạn chỉ cần quyền đọc workspace; chế độ bind vẫn độc lập.
- Xem [Sandbox vs Tool Policy vs Elevated](/gateway/sandbox-vs-tool-policy-vs-elevated) để biết cách các bind tương tác với tool policy và elevated exec.

## Images + thiết lập

Image mặc định: `openclaw-sandbox:bookworm-slim`

Build một lần:

```bash
scripts/sandbox-setup.sh
```

Lưu ý: image mặc định **không** bao gồm Node. Nếu một skill cần Node (hoặc
các runtime khác), hãy tạo image tùy chỉnh hoặc cài đặt qua
`sandbox.docker.setupCommand` (yêu cầu cho phép truy cập mạng + root có thể ghi +
người dùng root).

Image trình duyệt sandbox:

```bash
scripts/sandbox-browser-setup.sh
```

Theo mặc định, các container sandbox chạy với **không có mạng**.
Ghi đè bằng `agents.defaults.sandbox.docker.network`.

Cài đặt Docker và Gateway chạy trong container nằm tại:
[Docker](/install/docker)

## setupCommand (thiết lập container một lần)

`setupCommand` chạy **một lần** sau khi container sandbox được tạo (không chạy mỗi lần).
Nó thực thi bên trong container thông qua `sh -lc`.

Đường dẫn:

- Toàn cục: `agents.defaults.sandbox.docker.setupCommand`
- Theo agent: `agents.list[].sandbox.docker.setupCommand`

Các lỗi thường gặp:

- Mặc định `docker.network` là `"none"` (không có egress), nên việc cài gói sẽ thất bại.
- `readOnlyRoot: true` ngăn ghi; hãy đặt `readOnlyRoot: false` hoặc tạo image tùy chỉnh.
- `user` phải là root để cài gói (bỏ `user` hoặc đặt `user: "0:0"`).
- Thực thi sandbox **không** kế thừa `process.env` của host. Hãy dùng
  `agents.defaults.sandbox.docker.env` (hoặc image tùy chỉnh) cho khóa API của skill.

## Tool policy + lối thoát

Chính sách cho phép/từ chối tool vẫn được áp dụng trước các quy tắc sandbox. Nếu một tool bị từ chối
toàn cục hoặc theo agent, sandboxing sẽ không khôi phục nó.

`tools.elevated` là một lối thoát tường minh cho phép chạy `exec` trên host.
Các chỉ thị `/exec` chỉ áp dụng cho người gửi được ủy quyền và tồn tại theo phiên; để vô hiệu hóa cứng
`exec`, hãy dùng tool policy deny (xem [Sandbox vs Tool Policy vs Elevated](/gateway/sandbox-vs-tool-policy-vs-elevated)).

Gỡ lỗi:

- Dùng `openclaw sandbox explain` để kiểm tra chế độ sandbox hiệu lực, tool policy và các khóa cấu hình khắc phục.
- Xem [Sandbox vs Tool Policy vs Elevated](/gateway/sandbox-vs-tool-policy-vs-elevated) để có mô hình tư duy “vì sao cái này bị chặn?”.
  Hãy giữ cấu hình chặt chẽ.

## Ghi đè cho nhiều agent

Mỗi agent có thể ghi đè sandbox + tools:
`agents.list[].sandbox` và `agents.list[].tools` (cùng `agents.list[].tools.sandbox.tools` cho tool policy của sandbox).
Xem [Multi-Agent Sandbox & Tools](/multi-agent-sandbox-tools) để biết thứ tự ưu tiên.

## Ví dụ bật tối thiểu

```json5
{
  agents: {
    defaults: {
      sandbox: {
        mode: "non-main",
        scope: "session",
        workspaceAccess: "none",
      },
    },
  },
}
```

## Tài liệu liên quan

- [Sandbox Configuration](/gateway/configuration#agentsdefaults-sandbox)
- [Multi-Agent Sandbox & Tools](/multi-agent-sandbox-tools)
- [Security](/gateway/security)
