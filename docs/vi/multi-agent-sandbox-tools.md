---
summary: "Sandbox theo từng agent + hạn chế công cụ, thứ tự ưu tiên và ví dụ"
title: Sandbox & Công cụ cho Nhiều Agent
read_when: "Bạn muốn sandbox theo từng agent hoặc chính sách cho phép/từ chối công cụ theo từng agent trong một Gateway nhiều agent."
status: active
x-i18n:
  source_path: multi-agent-sandbox-tools.md
  source_hash: f602cb6192b84b40
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:07:46Z
---

# Cấu hình Sandbox & Công cụ cho Nhiều Agent

## Tổng quan

Mỗi agent trong thiết lập nhiều agent giờ đây có thể có riêng:

- **Cấu hình Sandbox** (`agents.list[].sandbox` ghi đè `agents.defaults.sandbox`)
- **Hạn chế công cụ** (`tools.allow` / `tools.deny`, cộng thêm `agents.list[].tools`)

Điều này cho phép bạn chạy nhiều agent với các hồ sơ bảo mật khác nhau:

- Trợ lý cá nhân với quyền truy cập đầy đủ
- Agent gia đình/công việc với công cụ bị hạn chế
- Agent hướng công khai chạy trong sandbox

`setupCommand` thuộc `sandbox.docker` (toàn cục hoặc theo agent) và chỉ chạy một lần
khi container được tạo.

Xác thực là theo từng agent: mỗi agent đọc từ kho xác thực `agentDir` riêng tại:

```
~/.openclaw/agents/<agentId>/agent/auth-profiles.json
```

Thông tin xác thực **không** được chia sẻ giữa các agent. Không bao giờ tái sử dụng `agentDir` giữa các agent.
Nếu bạn muốn chia sẻ creds, hãy sao chép `auth-profiles.json` sang `agentDir` của agent kia.

Để hiểu hành vi sandboxing khi chạy, xem [Sandboxing](/gateway/sandboxing).
Để gỡ lỗi “vì sao bị chặn?”, xem [Sandbox vs Tool Policy vs Elevated](/gateway/sandbox-vs-tool-policy-vs-elevated) và `openclaw sandbox explain`.

---

## Ví dụ cấu hình

### Ví dụ 1: Agent Cá nhân + Agent Gia đình bị hạn chế

```json
{
  "agents": {
    "list": [
      {
        "id": "main",
        "default": true,
        "name": "Personal Assistant",
        "workspace": "~/.openclaw/workspace",
        "sandbox": { "mode": "off" }
      },
      {
        "id": "family",
        "name": "Family Bot",
        "workspace": "~/.openclaw/workspace-family",
        "sandbox": {
          "mode": "all",
          "scope": "agent"
        },
        "tools": {
          "allow": ["read"],
          "deny": ["exec", "write", "edit", "apply_patch", "process", "browser"]
        }
      }
    ]
  },
  "bindings": [
    {
      "agentId": "family",
      "match": {
        "provider": "whatsapp",
        "accountId": "*",
        "peer": {
          "kind": "group",
          "id": "120363424282127706@g.us"
        }
      }
    }
  ]
}
```

**Kết quả:**

- Agent `main`: Chạy trên host, truy cập đầy đủ công cụ
- Agent `family`: Chạy trong Docker (mỗi agent một container), chỉ có công cụ `read`

---

### Ví dụ 2: Agent Công việc dùng Sandbox chung

```json
{
  "agents": {
    "list": [
      {
        "id": "personal",
        "workspace": "~/.openclaw/workspace-personal",
        "sandbox": { "mode": "off" }
      },
      {
        "id": "work",
        "workspace": "~/.openclaw/workspace-work",
        "sandbox": {
          "mode": "all",
          "scope": "shared",
          "workspaceRoot": "/tmp/work-sandboxes"
        },
        "tools": {
          "allow": ["read", "write", "apply_patch", "exec"],
          "deny": ["browser", "gateway", "discord"]
        }
      }
    ]
  }
}
```

---

### Ví dụ 2b: Hồ sơ coding toàn cục + agent chỉ nhắn tin

```json
{
  "tools": { "profile": "coding" },
  "agents": {
    "list": [
      {
        "id": "support",
        "tools": { "profile": "messaging", "allow": ["slack"] }
      }
    ]
  }
}
```

**Kết quả:**

- agent mặc định có các công cụ coding
- agent `support` chỉ nhắn tin (+ công cụ Slack)

---

### Ví dụ 3: Các chế độ Sandbox khác nhau theo Agent

```json
{
  "agents": {
    "defaults": {
      "sandbox": {
        "mode": "non-main", // Global default
        "scope": "session"
      }
    },
    "list": [
      {
        "id": "main",
        "workspace": "~/.openclaw/workspace",
        "sandbox": {
          "mode": "off" // Override: main never sandboxed
        }
      },
      {
        "id": "public",
        "workspace": "~/.openclaw/workspace-public",
        "sandbox": {
          "mode": "all", // Override: public always sandboxed
          "scope": "agent"
        },
        "tools": {
          "allow": ["read"],
          "deny": ["exec", "write", "edit", "apply_patch"]
        }
      }
    ]
  }
}
```

---

## Thứ tự ưu tiên cấu hình

Khi tồn tại cả cấu hình toàn cục (`agents.defaults.*`) và cấu hình theo agent (`agents.list[].*`):

### Cấu hình Sandbox

Thiết lập theo agent ghi đè toàn cục:

```
agents.list[].sandbox.mode > agents.defaults.sandbox.mode
agents.list[].sandbox.scope > agents.defaults.sandbox.scope
agents.list[].sandbox.workspaceRoot > agents.defaults.sandbox.workspaceRoot
agents.list[].sandbox.workspaceAccess > agents.defaults.sandbox.workspaceAccess
agents.list[].sandbox.docker.* > agents.defaults.sandbox.docker.*
agents.list[].sandbox.browser.* > agents.defaults.sandbox.browser.*
agents.list[].sandbox.prune.* > agents.defaults.sandbox.prune.*
```

**Ghi chú:**

- `agents.list[].sandbox.{docker,browser,prune}.*` ghi đè `agents.defaults.sandbox.{docker,browser,prune}.*` cho agent đó (bị bỏ qua khi phạm vi sandbox giải quyết thành `"shared"`).

### Hạn chế công cụ

Thứ tự lọc là:

1. **Hồ sơ công cụ** (`tools.profile` hoặc `agents.list[].tools.profile`)
2. **Hồ sơ công cụ theo nhà cung cấp** (`tools.byProvider[provider].profile` hoặc `agents.list[].tools.byProvider[provider].profile`)
3. **Chính sách công cụ toàn cục** (`tools.allow` / `tools.deny`)
4. **Chính sách công cụ theo nhà cung cấp** (`tools.byProvider[provider].allow/deny`)
5. **Chính sách công cụ theo agent** (`agents.list[].tools.allow/deny`)
6. **Chính sách nhà cung cấp theo agent** (`agents.list[].tools.byProvider[provider].allow/deny`)
7. **Chính sách công cụ của Sandbox** (`tools.sandbox.tools` hoặc `agents.list[].tools.sandbox.tools`)
8. **Chính sách công cụ của subagent** (`tools.subagents.tools`, nếu áp dụng)

Mỗi cấp có thể tiếp tục siết chặt công cụ, nhưng không thể cấp lại các công cụ đã bị từ chối ở các cấp trước.
Nếu đặt `agents.list[].tools.sandbox.tools`, nó sẽ thay thế `tools.sandbox.tools` cho agent đó.
Nếu đặt `agents.list[].tools.profile`, nó sẽ ghi đè `tools.profile` cho agent đó.
Khóa công cụ theo nhà cung cấp chấp nhận `provider` (ví dụ `google-antigravity`) hoặc `provider/model` (ví dụ `openai/gpt-5.2`).

### Nhóm công cụ (viết tắt)

Chính sách công cụ (toàn cục, theo agent, sandbox) hỗ trợ các mục `group:*` mở rộng thành nhiều công cụ cụ thể:

- `group:runtime`: `exec`, `bash`, `process`
- `group:fs`: `read`, `write`, `edit`, `apply_patch`
- `group:sessions`: `sessions_list`, `sessions_history`, `sessions_send`, `sessions_spawn`, `session_status`
- `group:memory`: `memory_search`, `memory_get`
- `group:ui`: `browser`, `canvas`
- `group:automation`: `cron`, `gateway`
- `group:messaging`: `message`
- `group:nodes`: `nodes`
- `group:openclaw`: tất cả công cụ OpenClaw tích hợp (không bao gồm plugin nhà cung cấp)

### Chế độ Elevated

`tools.elevated` là mức nền toàn cục (allowlist theo người gửi). `agents.list[].tools.elevated` có thể tiếp tục hạn chế elevated cho các agent cụ thể (cả hai đều phải cho phép).

Các mẫu giảm thiểu:

- Từ chối `exec` cho các agent không đáng tin (`agents.list[].tools.deny: ["exec"]`)
- Tránh allowlist các người gửi định tuyến tới agent bị hạn chế
- Tắt elevated toàn cục (`tools.elevated.enabled: false`) nếu bạn chỉ muốn thực thi trong sandbox
- Tắt elevated theo agent (`agents.list[].tools.elevated.enabled: false`) cho các hồ sơ nhạy cảm

---

## Di chuyển từ Agent Đơn

**Trước (agent đơn):**

```json
{
  "agents": {
    "defaults": {
      "workspace": "~/.openclaw/workspace",
      "sandbox": {
        "mode": "non-main"
      }
    }
  },
  "tools": {
    "sandbox": {
      "tools": {
        "allow": ["read", "write", "apply_patch", "exec"],
        "deny": []
      }
    }
  }
}
```

**Sau (nhiều agent với các hồ sơ khác nhau):**

```json
{
  "agents": {
    "list": [
      {
        "id": "main",
        "default": true,
        "workspace": "~/.openclaw/workspace",
        "sandbox": { "mode": "off" }
      }
    ]
  }
}
```

Các cấu hình `agent.*` cũ được `openclaw doctor` chuyển đổi; về sau nên ưu tiên `agents.defaults` + `agents.list`.

---

## Ví dụ hạn chế công cụ

### Agent chỉ đọc

```json
{
  "tools": {
    "allow": ["read"],
    "deny": ["exec", "write", "edit", "apply_patch", "process"]
  }
}
```

### Agent thực thi an toàn (không sửa đổi tệp)

```json
{
  "tools": {
    "allow": ["read", "exec", "process"],
    "deny": ["write", "edit", "apply_patch", "browser", "gateway"]
  }
}
```

### Agent chỉ giao tiếp

```json
{
  "tools": {
    "allow": ["sessions_list", "sessions_send", "sessions_history", "session_status"],
    "deny": ["exec", "write", "edit", "apply_patch", "read", "browser"]
  }
}
```

---

## Lỗi thường gặp: "non-main"

`agents.defaults.sandbox.mode: "non-main"` dựa trên `session.mainKey` (mặc định `"main"`),
không phải id agent. Các phiên nhóm/kenh luôn có khóa riêng, vì vậy
chúng được xem là non-main và sẽ bị sandbox. Nếu bạn muốn một agent
không bao giờ vào sandbox, hãy đặt `agents.list[].sandbox.mode: "off"`.

---

## Kiểm thử

Sau khi cấu hình sandbox và công cụ cho nhiều agent:

1. **Kiểm tra phân giải agent:**

   ```exec
   openclaw agents list --bindings
   ```

2. **Xác minh container sandbox:**

   ```exec
   docker ps --filter "name=openclaw-sbx-"
   ```

3. **Kiểm tra hạn chế công cụ:**
   - Gửi một tin nhắn yêu cầu công cụ bị hạn chế
   - Xác minh agent không thể dùng các công cụ bị từ chối

4. **Theo dõi log:**
   ```exec
   tail -f "${OPENCLAW_STATE_DIR:-$HOME/.openclaw}/logs/gateway.log" | grep -E "routing|sandbox|tools"
   ```

---

## Xử lý sự cố

### Agent không bị sandbox dù có `mode: "all"`

- Kiểm tra xem có `agents.defaults.sandbox.mode` toàn cục ghi đè hay không
- Cấu hình theo agent có ưu tiên cao hơn, vì vậy hãy đặt `agents.list[].sandbox.mode: "all"`

### Công cụ vẫn khả dụng dù có danh sách từ chối

- Kiểm tra thứ tự lọc công cụ: toàn cục → agent → sandbox → subagent
- Mỗi cấp chỉ có thể siết chặt thêm, không thể cấp lại
- Xác minh bằng log: `[tools] filtering tools for agent:${agentId}`

### Container không được cô lập theo agent

- Đặt `scope: "agent"` trong cấu hình sandbox theo agent
- Mặc định là `"session"` tạo một container cho mỗi phiên

---

## Xem thêm

- [Định tuyến Nhiều Agent](/concepts/multi-agent)
- [Cấu hình Sandbox](/gateway/configuration#agentsdefaults-sandbox)
- [Quản lý Phiên](/concepts/session)
