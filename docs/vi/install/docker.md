---
summary: "Thiết lập và onboarding dựa trên Docker (tùy chọn) cho OpenClaw"
read_when:
  - Bạn muốn một Gateway dạng container thay vì cài đặt cục bộ
  - Bạn đang kiểm tra luồng Docker
title: "Docker"
x-i18n:
  source_path: install/docker.md
  source_hash: 021ec5aa78e1a6eb
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:07:56Z
---

# Docker (tùy chọn)

Docker là **tùy chọn**. Chỉ sử dụng nếu bạn muốn một Gateway dạng container hoặc để kiểm tra luồng Docker.

## Docker có phù hợp với tôi không?

- **Có**: bạn muốn một môi trường Gateway cô lập, có thể xóa bỏ dễ dàng, hoặc muốn chạy OpenClaw trên một máy chủ không cài đặt cục bộ.
- **Không**: bạn đang chạy trên máy cá nhân và chỉ muốn vòng lặp dev nhanh nhất. Hãy dùng luồng cài đặt thông thường.
- **Lưu ý về sandboxing**: sandboxing cho agent cũng dùng Docker, nhưng **không** yêu cầu toàn bộ Gateway phải chạy trong Docker. Xem [Sandboxing](/gateway/sandboxing).

Hướng dẫn này bao gồm:

- Gateway dạng container (toàn bộ OpenClaw trong Docker)
- Sandbox Agent theo từng phiên (Gateway trên host + công cụ agent được cô lập bằng Docker)

Chi tiết sandboxing: [Sandboxing](/gateway/sandboxing)

## Yêu cầu

- Docker Desktop (hoặc Docker Engine) + Docker Compose v2
- Đủ dung lượng đĩa cho image + log

## Gateway dạng container (Docker Compose)

### Khoi dong nhanh (khuyến nghị)

Từ thư mục gốc của repo:

```bash
./docker-setup.sh
```

Script này sẽ:

- build image Gateway
- chạy trình hướng dẫn onboarding
- in ra các gợi ý thiết lập provider (tùy chọn)
- khởi động Gateway qua Docker Compose
- tạo token Gateway và ghi vào `.env`

Biến môi trường tùy chọn:

- `OPENCLAW_DOCKER_APT_PACKAGES` — cài thêm các gói apt trong quá trình build
- `OPENCLAW_EXTRA_MOUNTS` — thêm các bind mount từ host
- `OPENCLAW_HOME_VOLUME` — lưu `/home/node` trong một named volume

Sau khi hoàn tất:

- Mở `http://127.0.0.1:18789/` trong trình duyệt.
- Dán token vào Control UI (Settings → token).
- Cần lại URL? Chạy `docker compose run --rm openclaw-cli dashboard --no-open`.

Cấu hình/workspace được ghi trên host:

- `~/.openclaw/`
- `~/.openclaw/workspace`

Chạy trên VPS? Xem [Hetzner (Docker VPS)](/install/hetzner).

### Luồng thủ công (compose)

```bash
docker build -t openclaw:local -f Dockerfile .
docker compose run --rm openclaw-cli onboard
docker compose up -d openclaw-gateway
```

Lưu ý: chạy `docker compose ...` từ thư mục gốc repo. Nếu bạn bật
`OPENCLAW_EXTRA_MOUNTS` hoặc `OPENCLAW_HOME_VOLUME`, script thiết lập sẽ ghi
`docker-compose.extra.yml`; hãy include file này khi chạy Compose ở nơi khác:

```bash
docker compose -f docker-compose.yml -f docker-compose.extra.yml <command>
```

### Token Control UI + ghép cặp (Docker)

Nếu bạn thấy “unauthorized” hoặc “disconnected (1008): pairing required”, hãy lấy
link dashboard mới và phê duyệt thiết bị trình duyệt:

```bash
docker compose run --rm openclaw-cli dashboard --no-open
docker compose run --rm openclaw-cli devices list
docker compose run --rm openclaw-cli devices approve <requestId>
```

Chi tiết thêm: [Dashboard](/web/dashboard), [Devices](/cli/devices).

### Extra mounts (tùy chọn)

Nếu bạn muốn mount thêm các thư mục host vào container, hãy đặt
`OPENCLAW_EXTRA_MOUNTS` trước khi chạy `docker-setup.sh`. Biến này nhận
danh sách bind mount Docker, phân tách bằng dấu phẩy, và áp dụng cho cả
`openclaw-gateway` và `openclaw-cli` bằng cách tạo `docker-compose.extra.yml`.

Ví dụ:

```bash
export OPENCLAW_EXTRA_MOUNTS="$HOME/.codex:/home/node/.codex:ro,$HOME/github:/home/node/github:rw"
./docker-setup.sh
```

Ghi chú:

- Đường dẫn phải được chia sẻ với Docker Desktop trên macOS/Windows.
- Nếu bạn chỉnh sửa `OPENCLAW_EXTRA_MOUNTS`, hãy chạy lại `docker-setup.sh` để tạo lại
  file compose bổ sung.
- `docker-compose.extra.yml` được tạo tự động. Đừng chỉnh sửa thủ công.

### Lưu toàn bộ home của container (tùy chọn)

Nếu bạn muốn `/home/node` được giữ lại khi container bị tạo lại, hãy đặt một
named volume qua `OPENCLAW_HOME_VOLUME`. Việc này sẽ tạo một Docker volume và mount vào
`/home/node`, đồng thời vẫn giữ các bind mount config/workspace tiêu chuẩn.
Hãy dùng named volume ở đây (không dùng bind path); với bind mount, hãy dùng
`OPENCLAW_EXTRA_MOUNTS`.

Ví dụ:

```bash
export OPENCLAW_HOME_VOLUME="openclaw_home"
./docker-setup.sh
```

Bạn có thể kết hợp với extra mounts:

```bash
export OPENCLAW_HOME_VOLUME="openclaw_home"
export OPENCLAW_EXTRA_MOUNTS="$HOME/.codex:/home/node/.codex:ro,$HOME/github:/home/node/github:rw"
./docker-setup.sh
```

Ghi chú:

- Nếu bạn thay đổi `OPENCLAW_HOME_VOLUME`, hãy chạy lại `docker-setup.sh` để tạo lại
  file compose bổ sung.
- Named volume tồn tại cho đến khi bị xóa bằng `docker volume rm <name>`.

### Cài thêm gói apt (tùy chọn)

Nếu bạn cần các gói hệ thống trong image (ví dụ: công cụ build hoặc thư viện media),
hãy đặt `OPENCLAW_DOCKER_APT_PACKAGES` trước khi chạy `docker-setup.sh`.
Các gói này được cài trong quá trình build image, vì vậy sẽ tồn tại ngay cả khi
container bị xóa.

Ví dụ:

```bash
export OPENCLAW_DOCKER_APT_PACKAGES="ffmpeg build-essential"
./docker-setup.sh
```

Ghi chú:

- Biến này nhận danh sách tên gói apt, phân tách bằng dấu cách.
- Nếu bạn thay đổi `OPENCLAW_DOCKER_APT_PACKAGES`, hãy chạy lại `docker-setup.sh` để build lại
  image.

### Container nâng cao / đầy đủ tính năng (tùy chọn)

Docker image mặc định ưu tiên **bảo mật** và chạy với user không phải root là `node`.
Điều này giảm bề mặt tấn công, nhưng đồng nghĩa:

- không cài gói hệ thống lúc runtime
- không có Homebrew theo mặc định
- không kèm Chromium/Playwright browsers

Nếu bạn muốn container đầy đủ tính năng hơn, hãy dùng các tùy chọn opt-in sau:

1. **Lưu `/home/node`** để các bản tải browser và cache công cụ được giữ lại:

```bash
export OPENCLAW_HOME_VOLUME="openclaw_home"
./docker-setup.sh
```

2. **Đóng gói dependency hệ thống vào image** (lặp lại được + bền vững):

```bash
export OPENCLAW_DOCKER_APT_PACKAGES="git curl jq"
./docker-setup.sh
```

3. **Cài Playwright browsers không dùng `npx`** (tránh xung đột override npm):

```bash
docker compose run --rm openclaw-cli \
  node /app/node_modules/playwright-core/cli.js install chromium
```

Nếu bạn cần Playwright cài dependency hệ thống, hãy build lại image với
`OPENCLAW_DOCKER_APT_PACKAGES` thay vì dùng `--with-deps` lúc runtime.

4. **Lưu các bản tải browser của Playwright**:

- Đặt `PLAYWRIGHT_BROWSERS_PATH=/home/node/.cache/ms-playwright` trong
  `docker-compose.yml`.
- Đảm bảo `/home/node` được lưu qua `OPENCLAW_HOME_VOLUME`, hoặc mount
  `/home/node/.cache/ms-playwright` qua `OPENCLAW_EXTRA_MOUNTS`.

### Quyền truy cập + EACCES

Image chạy với user `node` (uid 1000). Nếu bạn thấy lỗi quyền truy cập trên
`/home/node/.openclaw`, hãy đảm bảo các bind mount trên host thuộc sở hữu uid 1000.

Ví dụ (host Linux):

```bash
sudo chown -R 1000:1000 /path/to/openclaw-config /path/to/openclaw-workspace
```

Nếu bạn chọn chạy với quyền root cho tiện lợi, bạn chấp nhận đánh đổi về bảo mật.

### Build lại nhanh hơn (khuyến nghị)

Để tăng tốc build lại, hãy sắp xếp Dockerfile sao cho các layer dependency được cache.
Điều này tránh việc chạy lại `pnpm install` trừ khi lockfile thay đổi:

```dockerfile
FROM node:22-bookworm

# Install Bun (required for build scripts)
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:${PATH}"

RUN corepack enable

WORKDIR /app

# Cache dependencies unless package metadata changes
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY ui/package.json ./ui/package.json
COPY scripts ./scripts

RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build
RUN pnpm ui:install
RUN pnpm ui:build

ENV NODE_ENV=production

CMD ["node","dist/index.js"]
```

### Thiết lập channel (tùy chọn)

Dùng CLI container để cấu hình channel, sau đó khởi động lại Gateway nếu cần.

WhatsApp (QR):

```bash
docker compose run --rm openclaw-cli channels login
```

Telegram (bot token):

```bash
docker compose run --rm openclaw-cli channels add --channel telegram --token "<token>"
```

Discord (bot token):

```bash
docker compose run --rm openclaw-cli channels add --channel discord --token "<token>"
```

Tài liệu: [WhatsApp](/channels/whatsapp), [Telegram](/channels/telegram), [Discord](/channels/discord)

### OpenAI Codex OAuth (Docker không có giao diện)

Nếu bạn chọn OpenAI Codex OAuth trong wizard, nó sẽ mở một URL trình duyệt và cố
bắt callback tại `http://127.0.0.1:1455/auth/callback`. Trong Docker hoặc các thiết lập headless,
callback này có thể hiển thị lỗi trình duyệt. Hãy sao chép toàn bộ URL redirect
mà bạn nhận được và dán lại vào wizard để hoàn tất xác thực.

### Health check

```bash
docker compose exec openclaw-gateway node dist/index.js health --token "$OPENCLAW_GATEWAY_TOKEN"
```

### E2E smoke test (Docker)

```bash
scripts/e2e/onboard-docker.sh
```

### QR import smoke test (Docker)

```bash
pnpm test:docker:qr
```

### Ghi chú

- Gateway bind mặc định là `lan` cho môi trường container.
- Dockerfile CMD dùng `--allow-unconfigured`; cấu hình được mount với `gateway.mode` chứ không phải `local` vẫn sẽ khởi động. Hãy override CMD để ép kiểm tra.
- Gateway container là nguồn sự thật cho các session (`~/.openclaw/agents/<agentId>/sessions/`).

## Agent Sandbox (Gateway trên host + công cụ Docker)

Đào sâu: [Sandboxing](/gateway/sandboxing)

### Chức năng

Khi `agents.defaults.sandbox` được bật, **các session không phải main** sẽ chạy công cụ bên
trong container Docker. Gateway vẫn chạy trên host, nhưng việc thực thi công cụ
được cô lập:

- phạm vi: `"agent"` theo mặc định (một container + workspace cho mỗi agent)
- phạm vi: `"session"` cho cô lập theo từng session
- thư mục workspace theo phạm vi được mount tại `/workspace`
- truy cập workspace agent tùy chọn (`agents.defaults.sandbox.workspaceAccess`)
- chính sách cho phép/từ chối công cụ (deny được ưu tiên)
- media đầu vào được sao chép vào workspace sandbox đang hoạt động (`media/inbound/*`) để công cụ có thể đọc (với `workspaceAccess: "rw"`, dữ liệu này nằm trong workspace agent)

Cảnh báo: `scope: "shared"` vô hiệu hóa cô lập giữa các session. Tất cả session dùng
chung một container và một workspace.

### Hồ sơ sandbox theo agent (đa agent)

Nếu bạn dùng định tuyến đa agent, mỗi agent có thể override thiết lập sandbox + công cụ:
`agents.list[].sandbox` và `agents.list[].tools` (kèm `agents.list[].tools.sandbox.tools`). Điều này cho phép
chạy nhiều mức truy cập trong cùng một Gateway:

- Toàn quyền (agent cá nhân)
- Công cụ chỉ đọc + workspace chỉ đọc (agent gia đình/công việc)
- Không có công cụ filesystem/shell (agent công khai)

Xem [Multi-Agent Sandbox & Tools](/multi-agent-sandbox-tools) để biết ví dụ,
thứ tự ưu tiên và cách xử lý sự cố.

### Hành vi mặc định

- Image: `openclaw-sandbox:bookworm-slim`
- Một container cho mỗi agent
- Truy cập workspace agent: `workspaceAccess: "none"` (mặc định) dùng `~/.openclaw/sandboxes`
  - `"ro"` giữ workspace sandbox tại `/workspace` và mount workspace agent chỉ đọc tại `/agent` (vô hiệu `write`/`edit`/`apply_patch`)
  - `"rw"` mount workspace agent đọc/ghi tại `/workspace`
- Auto-prune: idle > 24h HOẶC tuổi > 7 ngày
- Network: `none` theo mặc định (chỉ opt-in khi cần egress)
- Cho phép mặc định: `exec`, `process`, `read`, `write`, `edit`, `sessions_list`, `sessions_history`, `sessions_send`, `sessions_spawn`, `session_status`
- Từ chối mặc định: `browser`, `canvas`, `nodes`, `cron`, `discord`, `gateway`

### Bật sandboxing

Nếu bạn dự định cài gói trong `setupCommand`, lưu ý:

- `docker.network` mặc định là `"none"` (không egress).
- `readOnlyRoot: true` chặn việc cài gói.
- `user` phải là root để dùng `apt-get` (bỏ `user` hoặc đặt `user: "0:0"`).
  OpenClaw tự động tạo lại container khi `setupCommand` (hoặc cấu hình Docker) thay đổi
  trừ khi container vừa được sử dụng **gần đây** (trong ~5 phút). Container đang hoạt động
  sẽ ghi log cảnh báo kèm lệnh `openclaw sandbox recreate ...` chính xác.

```json5
{
  agents: {
    defaults: {
      sandbox: {
        mode: "non-main", // off | non-main | all
        scope: "agent", // session | agent | shared (agent is default)
        workspaceAccess: "none", // none | ro | rw
        workspaceRoot: "~/.openclaw/sandboxes",
        docker: {
          image: "openclaw-sandbox:bookworm-slim",
          workdir: "/workspace",
          readOnlyRoot: true,
          tmpfs: ["/tmp", "/var/tmp", "/run"],
          network: "none",
          user: "1000:1000",
          capDrop: ["ALL"],
          env: { LANG: "C.UTF-8" },
          setupCommand: "apt-get update && apt-get install -y git curl jq",
          pidsLimit: 256,
          memory: "1g",
          memorySwap: "2g",
          cpus: 1,
          ulimits: {
            nofile: { soft: 1024, hard: 2048 },
            nproc: 256,
          },
          seccompProfile: "/path/to/seccomp.json",
          apparmorProfile: "openclaw-sandbox",
          dns: ["1.1.1.1", "8.8.8.8"],
          extraHosts: ["internal.service:10.0.0.5"],
        },
        prune: {
          idleHours: 24, // 0 disables idle pruning
          maxAgeDays: 7, // 0 disables max-age pruning
        },
      },
    },
  },
  tools: {
    sandbox: {
      tools: {
        allow: [
          "exec",
          "process",
          "read",
          "write",
          "edit",
          "sessions_list",
          "sessions_history",
          "sessions_send",
          "sessions_spawn",
          "session_status",
        ],
        deny: ["browser", "canvas", "nodes", "cron", "discord", "gateway"],
      },
    },
  },
}
```

Các nút hardening nằm dưới `agents.defaults.sandbox.docker`:
`network`, `user`, `pidsLimit`, `memory`, `memorySwap`, `cpus`, `ulimits`,
`seccompProfile`, `apparmorProfile`, `dns`, `extraHosts`.

Đa agent: override `agents.defaults.sandbox.{docker,browser,prune}.*` theo từng agent qua `agents.list[].sandbox.{docker,browser,prune}.*`
(bị bỏ qua khi `agents.defaults.sandbox.scope` / `agents.list[].sandbox.scope` là `"shared"`).

### Build image sandbox mặc định

```bash
scripts/sandbox-setup.sh
```

Lệnh này build `openclaw-sandbox:bookworm-slim` bằng `Dockerfile.sandbox`.

### Image sandbox chung (tùy chọn)

Nếu bạn muốn một image sandbox có sẵn công cụ build phổ biến (Node, Go, Rust, v.v.),
hãy build image chung:

```bash
scripts/sandbox-common-setup.sh
```

Lệnh này build `openclaw-sandbox-common:bookworm-slim`. Để sử dụng:

```json5
{
  agents: {
    defaults: {
      sandbox: { docker: { image: "openclaw-sandbox-common:bookworm-slim" } },
    },
  },
}
```

### Image browser cho sandbox

Để chạy công cụ browser bên trong sandbox, hãy build image browser:

```bash
scripts/sandbox-browser-setup.sh
```

Lệnh này build `openclaw-sandbox-browser:bookworm-slim` bằng
`Dockerfile.sandbox-browser`. Container chạy Chromium với CDP được bật và
tùy chọn quan sát noVNC (headful qua Xvfb).

Ghi chú:

- Headful (Xvfb) giảm khả năng bị chặn bot so với headless.
- Headless vẫn dùng được bằng cách đặt `agents.defaults.sandbox.browser.headless=true`.
- Không cần môi trường desktop đầy đủ (GNOME); Xvfb cung cấp display.

Dùng cấu hình:

```json5
{
  agents: {
    defaults: {
      sandbox: {
        browser: { enabled: true },
      },
    },
  },
}
```

Image browser tùy chỉnh:

```json5
{
  agents: {
    defaults: {
      sandbox: { browser: { image: "my-openclaw-browser" } },
    },
  },
}
```

Khi bật, agent sẽ nhận được:

- URL điều khiển browser trong sandbox (cho công cụ `browser`)
- URL noVNC (nếu bật và headless=false)

Lưu ý: nếu bạn dùng allowlist cho công cụ, hãy thêm `browser` (và gỡ khỏi
deny) nếu không công cụ sẽ vẫn bị chặn.
Quy tắc prune (`agents.defaults.sandbox.prune`) cũng áp dụng cho container browser.

### Image sandbox tùy chỉnh

Build image của riêng bạn và trỏ cấu hình tới nó:

```bash
docker build -t my-openclaw-sbx -f Dockerfile.sandbox .
```

```json5
{
  agents: {
    defaults: {
      sandbox: { docker: { image: "my-openclaw-sbx" } },
    },
  },
}
```

### Chính sách công cụ (allow/deny)

- `deny` được ưu tiên hơn `allow`.
- Nếu `allow` rỗng: tất cả công cụ (trừ deny) đều khả dụng.
- Nếu `allow` không rỗng: chỉ các công cụ trong `allow` khả dụng (trừ deny).

### Chiến lược pruning

Hai tham số:

- `prune.idleHours`: xóa container không dùng trong X giờ (0 = tắt)
- `prune.maxAgeDays`: xóa container cũ hơn X ngày (0 = tắt)

Ví dụ:

- Giữ session đang bận nhưng giới hạn vòng đời:
  `idleHours: 24`, `maxAgeDays: 7`
- Không bao giờ prune:
  `idleHours: 0`, `maxAgeDays: 0`

### Ghi chú bảo mật

- Tường cứng chỉ áp dụng cho **công cụ** (exec/read/write/edit/apply_patch).
- Các công cụ chỉ chạy trên host như browser/camera/canvas bị chặn theo mặc định.
- Cho phép `browser` trong sandbox sẽ **phá vỡ cô lập** (browser chạy trên host).

## Xử lý sự cố

- Thiếu image: build bằng [`scripts/sandbox-setup.sh`](https://github.com/openclaw/openclaw/blob/main/scripts/sandbox-setup.sh) hoặc đặt `agents.defaults.sandbox.docker.image`.
- Container không chạy: nó sẽ tự tạo theo session khi cần.
- Lỗi quyền trong sandbox: đặt `docker.user` thành UID:GID khớp với quyền sở hữu
  workspace được mount (hoặc chown thư mục workspace).
- Không tìm thấy công cụ tùy chỉnh: OpenClaw chạy lệnh với `sh -lc` (login shell),
  shell này source `/etc/profile` và có thể reset PATH. Hãy đặt `docker.env.PATH` để prepend
  đường dẫn công cụ tùy chỉnh (ví dụ: `/custom/bin:/usr/local/share/npm-global/bin`), hoặc thêm
  một script dưới `/etc/profile.d/` trong Dockerfile của bạn.
