---
title: Sandbox vs Chinh Sach Cong Cu vs Nang Cao
summary: "Vì sao một công cụ bị chặn: runtime sandbox, chính sách cho phép/từ chối công cụ, và các cổng thực thi nâng cao"
read_when: "Khi bạn gặp 'sandbox jail' hoặc thấy công cụ/elevated bị từ chối và muốn biết chính xác khóa cấu hình cần thay đổi."
status: active
x-i18n:
  source_path: gateway/sandbox-vs-tool-policy-vs-elevated.md
  source_hash: 863ea5e6d137dfb6
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:07:26Z
---

# Sandbox vs Tool Policy vs Elevated

OpenClaw có ba cơ chế liên quan (nhưng khác nhau):

1. **Sandbox** (`agents.defaults.sandbox.*` / `agents.list[].sandbox.*`) quyết định **công cụ chạy ở đâu** (Docker hay host).
2. **Tool policy** (`tools.*`, `tools.sandbox.tools.*`, `agents.list[].tools.*`) quyết định **những công cụ nào có sẵn/được phép**.
3. **Elevated** (`tools.elevated.*`, `agents.list[].tools.elevated.*`) là một **lối thoát chỉ cho exec** để chạy trên host khi bạn đang bị sandbox.

## Quick debug

Dùng inspector để xem OpenClaw _thực sự_ đang làm gì:

```bash
openclaw sandbox explain
openclaw sandbox explain --session agent:main:main
openclaw sandbox explain --agent work
openclaw sandbox explain --json
```

Nó in ra:

- chế độ/phạm vi sandbox hiệu lực/quyền truy cập workspace
- liệu session hiện tại có đang bị sandbox (main vs non-main)
- allow/deny công cụ trong sandbox hiệu lực (và nó đến từ agent/global/default)
- các cổng elevated và đường dẫn khóa cấu hình để khắc phục

## Sandbox: nơi công cụ chạy

Sandboxing được điều khiển bởi `agents.defaults.sandbox.mode`:

- `"off"`: mọi thứ chạy trên host.
- `"non-main"`: chỉ các session không phải main bị sandbox (thường gây “bất ngờ” cho nhóm/kênh).
- `"all"`: mọi thứ đều bị sandbox.

Xem [Sandboxing](/gateway/sandboxing) để biết ma trận đầy đủ (phạm vi, mount workspace, image).

### Bind mounts (kiểm tra nhanh về bảo mật)

- `docker.binds` _xuyên thủng_ filesystem của sandbox: bất cứ thứ gì bạn mount sẽ hiển thị bên trong container với chế độ bạn đặt (`:ro` hoặc `:rw`).
- Mặc định là đọc-ghi nếu bạn bỏ qua chế độ; nên ưu tiên `:ro` cho mã nguồn/bí mật.
- `scope: "shared"` bỏ qua bind theo từng agent (chỉ áp dụng bind global).
- Bind `/var/run/docker.sock` về cơ bản trao quyền kiểm soát host cho sandbox; chỉ làm điều này khi có chủ đích.
- Quyền truy cập workspace (`workspaceAccess: "ro"`/`"rw"`) độc lập với chế độ bind.

## Tool policy: những công cụ nào tồn tại/có thể gọi

Hai lớp quan trọng:

- **Tool profile**: `tools.profile` và `agents.list[].tools.profile` (allowlist nền)
- **Provider tool profile**: `tools.byProvider[provider].profile` và `agents.list[].tools.byProvider[provider].profile`
- **Chính sách công cụ global/theo agent**: `tools.allow`/`tools.deny` và `agents.list[].tools.allow`/`agents.list[].tools.deny`
- **Chính sách công cụ theo provider**: `tools.byProvider[provider].allow/deny` và `agents.list[].tools.byProvider[provider].allow/deny`
- **Chính sách công cụ trong sandbox** (chỉ áp dụng khi bị sandbox): `tools.sandbox.tools.allow`/`tools.sandbox.tools.deny` và `agents.list[].tools.sandbox.tools.*`

Quy tắc kinh nghiệm:

- `deny` luôn thắng.
- Nếu `allow` không rỗng, mọi thứ khác được coi là bị chặn.
- Tool policy là điểm dừng cứng: `/exec` không thể ghi đè một công cụ `exec` đã bị từ chối.
- `/exec` chỉ thay đổi mặc định của session cho người gửi được ủy quyền; nó không cấp quyền truy cập công cụ.
  Khóa công cụ theo provider chấp nhận `provider` (ví dụ: `google-antigravity`) hoặc `provider/model` (ví dụ: `openai/gpt-5.2`).

### Tool groups (viết tắt)

Chính sách công cụ (global, agent, sandbox) hỗ trợ các mục `group:*` mở rộng thành nhiều công cụ:

```json5
{
  tools: {
    sandbox: {
      tools: {
        allow: ["group:runtime", "group:fs", "group:sessions", "group:memory"],
      },
    },
  },
}
```

Các nhóm khả dụng:

- `group:runtime`: `exec`, `bash`, `process`
- `group:fs`: `read`, `write`, `edit`, `apply_patch`
- `group:sessions`: `sessions_list`, `sessions_history`, `sessions_send`, `sessions_spawn`, `session_status`
- `group:memory`: `memory_search`, `memory_get`
- `group:ui`: `browser`, `canvas`
- `group:automation`: `cron`, `gateway`
- `group:messaging`: `message`
- `group:nodes`: `nodes`
- `group:openclaw`: tất cả công cụ OpenClaw tích hợp sẵn (không bao gồm plugin của provider)

## Elevated: exec-only “chạy trên host”

Elevated **không** cấp thêm công cụ; nó chỉ ảnh hưởng đến `exec`.

- Nếu bạn đang bị sandbox, `/elevated on` (hoặc `exec` với `elevated: true`) sẽ chạy trên host (có thể vẫn cần phê duyệt).
- Dùng `/elevated full` để bỏ qua phê duyệt exec cho session.
- Nếu bạn đã chạy trực tiếp, elevated về cơ bản là không làm gì (vẫn bị chặn bởi cổng).
- Elevated **không** theo phạm vi skill và **không** ghi đè allow/deny của công cụ.
- `/exec` tách biệt với elevated. Nó chỉ điều chỉnh mặc định exec theo từng session cho người gửi được ủy quyền.

Các cổng:

- Bật/tắt: `tools.elevated.enabled` (và tùy chọn `agents.list[].tools.elevated.enabled`)
- Allowlist người gửi: `tools.elevated.allowFrom.<provider>` (và tùy chọn `agents.list[].tools.elevated.allowFrom.<provider>`)

Xem [Elevated Mode](/tools/elevated).

## Các cách khắc phục “sandbox jail” thường gặp

### “Công cụ X bị chặn bởi sandbox tool policy”

Khóa cần sửa (chọn một):

- Tắt sandbox: `agents.defaults.sandbox.mode=off` (hoặc theo agent `agents.list[].sandbox.mode=off`)
- Cho phép công cụ trong sandbox:
  - gỡ nó khỏi `tools.sandbox.tools.deny` (hoặc theo agent `agents.list[].tools.sandbox.tools.deny`)
  - hoặc thêm nó vào `tools.sandbox.tools.allow` (hoặc allow theo agent)

### “Tôi tưởng đây là main, sao lại bị sandbox?”

Ở chế độ `"non-main"`, các khóa nhóm/kênh _không_ phải main. Hãy dùng khóa session main (hiển thị bởi `sandbox explain`) hoặc chuyển chế độ sang `"off"`.
