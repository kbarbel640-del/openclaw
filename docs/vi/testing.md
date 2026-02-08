---
summary: "Bộ kiểm thử: các bộ unit/e2e/live, runner Docker và phạm vi của từng loại kiểm thử"
read_when:
  - Chạy test cục bộ hoặc trong CI
  - Thêm regression cho lỗi model/nhà cung cấp
  - Gỡ lỗi hành vi gateway + agent
title: "Testing"
x-i18n:
  source_path: testing.md
  source_hash: 7a23ced0e6e3be5e
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:09:12Z
---

# Testing

OpenClaw có ba bộ Vitest (unit/integration, e2e, live) và một tập nhỏ các runner Docker.

Tài liệu này là hướng dẫn “cách chúng tôi kiểm thử”:

- Mỗi bộ kiểm thử bao phủ những gì (và cố ý _không_ bao phủ những gì)
- Lệnh cần chạy cho các quy trình phổ biến (cục bộ, trước khi push, gỡ lỗi)
- Cách các bài test live phát hiện thông tin xác thực và chọn model/nhà cung cấp
- Cách thêm regression cho các vấn đề model/nhà cung cấp trong thực tế

## Quick start

Hầu hết các ngày:

- Full gate (mong đợi trước khi push): `pnpm build && pnpm check && pnpm test`

Khi bạn chỉnh sửa test hoặc muốn thêm độ tin cậy:

- Coverage gate: `pnpm test:coverage`
- Bộ E2E: `pnpm test:e2e`

Khi gỡ lỗi các nhà cung cấp/model thực (cần thông tin xác thực thật):

- Bộ live (model + probe công cụ/hình ảnh của gateway): `pnpm test:live`

Mẹo: khi bạn chỉ cần một case lỗi, hãy ưu tiên thu hẹp test live bằng các env var allowlist được mô tả bên dưới.

## Test suites (chạy ở đâu, bao phủ gì)

Hãy xem các bộ test như “mức độ thực tế tăng dần” (và độ flakiness/chi phí cũng tăng):

### Unit / integration (mặc định)

- Lệnh: `pnpm test`
- Cấu hình: `vitest.config.ts`
- File: `src/**/*.test.ts`
- Phạm vi:
  - Unit test thuần
  - Integration test trong cùng tiến trình (xác thực gateway, định tuyến, tooling, parsing, cấu hình)
  - Regression xác định cho các bug đã biết
- Kỳ vọng:
  - Chạy trong CI
  - Không cần khóa thật
  - Nhanh và ổn định

### E2E (gateway smoke)

- Lệnh: `pnpm test:e2e`
- Cấu hình: `vitest.e2e.config.ts`
- File: `src/**/*.e2e.test.ts`
- Phạm vi:
  - Hành vi end-to-end gateway đa instance
  - Bề mặt WebSocket/HTTP, ghép cặp node và networking nặng hơn
- Kỳ vọng:
  - Chạy trong CI (khi được bật trong pipeline)
  - Không cần khóa thật
  - Nhiều thành phần hơn unit test (có thể chậm hơn)

### Live (nhà cung cấp thật + model thật)

- Lệnh: `pnpm test:live`
- Cấu hình: `vitest.live.config.ts`
- File: `src/**/*.live.test.ts`
- Mặc định: **bật** bởi `pnpm test:live` (thiết lập `OPENCLAW_LIVE_TEST=1`)
- Phạm vi:
  - “Nhà cung cấp/model này có thực sự hoạt động _hôm nay_ với thông tin xác thực thật không?”
  - Bắt các thay đổi định dạng của nhà cung cấp, hành vi tool-calling, vấn đề xác thực và giới hạn tốc độ
- Kỳ vọng:
  - Không ổn định cho CI theo thiết kế (mạng thật, chính sách nhà cung cấp thật, hạn mức, sự cố)
  - Tốn chi phí / dùng hạn mức
  - Ưu tiên chạy các tập con thu hẹp thay vì “mọi thứ”
  - Các lần chạy live sẽ nạp `~/.profile` để lấy các API key còn thiếu
  - Xoay vòng khóa Anthropic: đặt `OPENCLAW_LIVE_ANTHROPIC_KEYS="sk-...,sk-..."` (hoặc `OPENCLAW_LIVE_ANTHROPIC_KEY=sk-...`) hoặc nhiều biến `ANTHROPIC_API_KEY*`; test sẽ thử lại khi gặp giới hạn tốc độ

## Tôi nên chạy bộ nào?

Dùng bảng quyết định này:

- Chỉnh sửa logic/test: chạy `pnpm test` (và `pnpm test:coverage` nếu thay đổi nhiều)
- Đụng đến networking gateway / giao thức WS / ghép cặp: thêm `pnpm test:e2e`
- Gỡ lỗi “bot của tôi bị down” / lỗi theo nhà cung cấp / tool calling: chạy `pnpm test:live` đã được thu hẹp

## Live: model smoke (profile keys)

Test live được chia thành hai lớp để cô lập lỗi:

- “Direct model” cho biết nhà cung cấp/model có trả lời được hay không với khóa đã cho.
- “Gateway smoke” cho biết toàn bộ pipeline gateway+agent hoạt động cho model đó (phiên, lịch sử, công cụ, chính sách sandbox, v.v.).

### Lớp 1: Direct model completion (không qua gateway)

- Test: `src/agents/models.profiles.live.test.ts`
- Mục tiêu:
  - Liệt kê các model được phát hiện
  - Dùng `getApiKeyForModel` để chọn các model bạn có thông tin xác thực
  - Chạy một completion nhỏ cho mỗi model (và regression mục tiêu khi cần)
- Cách bật:
  - `pnpm test:live` (hoặc `OPENCLAW_LIVE_TEST=1` nếu gọi Vitest trực tiếp)
- Đặt `OPENCLAW_LIVE_MODELS=modern` (hoặc `all`, alias hiện đại) để thực sự chạy bộ này; nếu không nó sẽ bỏ qua để tập trung `pnpm test:live` vào gateway smoke
- Cách chọn model:
  - `OPENCLAW_LIVE_MODELS=modern` để chạy allowlist hiện đại (Opus/Sonnet/Haiku 4.5, GPT-5.x + Codex, Gemini 3, GLM 4.7, MiniMax M2.1, Grok 4)
  - `OPENCLAW_LIVE_MODELS=all` là alias cho allowlist hiện đại
  - hoặc `OPENCLAW_LIVE_MODELS="openai/gpt-5.2,anthropic/claude-opus-4-6,..."` (allowlist dạng comma)
- Cách chọn nhà cung cấp:
  - `OPENCLAW_LIVE_PROVIDERS="google,google-antigravity,google-gemini-cli"` (allowlist dạng comma)
- Nguồn khóa:
  - Mặc định: kho profile và fallback env
  - Đặt `OPENCLAW_LIVE_REQUIRE_PROFILE_KEYS=1` để ép **chỉ dùng kho profile**
- Lý do tồn tại:
  - Tách “API nhà cung cấp bị hỏng / khóa không hợp lệ” khỏi “pipeline gateway agent bị hỏng”
  - Chứa các regression nhỏ, cô lập (ví dụ: OpenAI Responses/Codex Responses reasoning replay + luồng tool-call)

### Lớp 2: Gateway + dev agent smoke (những gì “@openclaw” thực sự làm)

- Test: `src/gateway/gateway-models.profiles.live.test.ts`
- Mục tiêu:
  - Khởi chạy gateway trong cùng tiến trình
  - Tạo/cập nhật một phiên `agent:dev:*` (ghi đè model theo từng lần chạy)
  - Lặp qua các model có khóa và xác nhận:
    - Phản hồi “có ý nghĩa” (không dùng công cụ)
    - Một lần gọi công cụ thực sự hoạt động (read probe)
    - Các probe công cụ bổ sung tùy chọn (exec+read probe)
    - Các đường regression OpenAI (chỉ tool-call → follow-up) vẫn hoạt động
- Chi tiết probe (để bạn giải thích lỗi nhanh):
  - Probe `read`: test ghi một file nonce trong workspace và yêu cầu agent `read` nó rồi echo nonce.
  - Probe `exec+read`: test yêu cầu agent `exec`-ghi một nonce vào file tạm, sau đó `read` lại.
  - Probe hình ảnh: test đính kèm một PNG được tạo (mèo + mã ngẫu nhiên) và mong model trả về `cat <CODE>`.
  - Tham chiếu triển khai: `src/gateway/gateway-models.profiles.live.test.ts` và `src/gateway/live-image-probe.ts`.
- Cách bật:
  - `pnpm test:live` (hoặc `OPENCLAW_LIVE_TEST=1` nếu gọi Vitest trực tiếp)
- Cách chọn model:
  - Mặc định: allowlist hiện đại (Opus/Sonnet/Haiku 4.5, GPT-5.x + Codex, Gemini 3, GLM 4.7, MiniMax M2.1, Grok 4)
  - `OPENCLAW_LIVE_GATEWAY_MODELS=all` là alias cho allowlist hiện đại
  - Hoặc đặt `OPENCLAW_LIVE_GATEWAY_MODELS="provider/model"` (hoặc danh sách comma) để thu hẹp
- Cách chọn nhà cung cấp (tránh “OpenRouter mọi thứ”):
  - `OPENCLAW_LIVE_GATEWAY_PROVIDERS="google,google-antigravity,google-gemini-cli,openai,anthropic,zai,minimax"` (allowlist dạng comma)
- Probe công cụ + hình ảnh luôn bật trong test live này:
  - Probe `read` + probe `exec+read` (stress công cụ)
  - Probe hình ảnh chạy khi model quảng cáo hỗ trợ input hình ảnh
  - Luồng (mức cao):
    - Test tạo một PNG nhỏ với “CAT” + mã ngẫu nhiên (`src/gateway/live-image-probe.ts`)
    - Gửi qua `agent` `attachments: [{ mimeType: "image/png", content: "<base64>" }]`
    - Gateway phân tích attachment thành `images[]` (`src/gateway/server-methods/agent.ts` + `src/gateway/chat-attachments.ts`)
    - Agent nhúng chuyển tiếp thông điệp người dùng đa phương thức tới model
    - Xác nhận: phản hồi chứa `cat` + mã (dung sai OCR: cho phép lỗi nhỏ)

Mẹo: để xem bạn có thể test gì trên máy của mình (và các id `provider/model` chính xác), hãy chạy:

```bash
openclaw models list
openclaw models list --json
```

## Live: Anthropic setup-token smoke

- Test: `src/agents/anthropic.setup-token.live.test.ts`
- Mục tiêu: xác minh setup-token của Claude Code CLI (hoặc profile setup-token đã dán) có thể hoàn thành một prompt Anthropic.
- Bật:
  - `pnpm test:live` (hoặc `OPENCLAW_LIVE_TEST=1` nếu gọi Vitest trực tiếp)
  - `OPENCLAW_LIVE_SETUP_TOKEN=1`
- Nguồn token (chọn một):
  - Profile: `OPENCLAW_LIVE_SETUP_TOKEN_PROFILE=anthropic:setup-token-test`
  - Token thô: `OPENCLAW_LIVE_SETUP_TOKEN_VALUE=sk-ant-oat01-...`
- Ghi đè model (tùy chọn):
  - `OPENCLAW_LIVE_SETUP_TOKEN_MODEL=anthropic/claude-opus-4-6`

Ví dụ thiết lập:

```bash
openclaw models auth paste-token --provider anthropic --profile-id anthropic:setup-token-test
OPENCLAW_LIVE_SETUP_TOKEN=1 OPENCLAW_LIVE_SETUP_TOKEN_PROFILE=anthropic:setup-token-test pnpm test:live src/agents/anthropic.setup-token.live.test.ts
```

## Live: CLI backend smoke (Claude Code CLI hoặc các CLI cục bộ khác)

- Test: `src/gateway/gateway-cli-backend.live.test.ts`
- Mục tiêu: xác thực pipeline Gateway + agent dùng backend CLI cục bộ, không chạm vào cấu hình mặc định của bạn.
- Bật:
  - `pnpm test:live` (hoặc `OPENCLAW_LIVE_TEST=1` nếu gọi Vitest trực tiếp)
  - `OPENCLAW_LIVE_CLI_BACKEND=1`
- Mặc định:
  - Model: `claude-cli/claude-sonnet-4-5`
  - Lệnh: `claude`
  - Tham số: `["-p","--output-format","json","--dangerously-skip-permissions"]`
- Ghi đè (tùy chọn):
  - `OPENCLAW_LIVE_CLI_BACKEND_MODEL="claude-cli/claude-opus-4-6"`
  - `OPENCLAW_LIVE_CLI_BACKEND_MODEL="codex-cli/gpt-5.3-codex"`
  - `OPENCLAW_LIVE_CLI_BACKEND_COMMAND="/full/path/to/claude"`
  - `OPENCLAW_LIVE_CLI_BACKEND_ARGS='["-p","--output-format","json","--permission-mode","bypassPermissions"]'`
  - `OPENCLAW_LIVE_CLI_BACKEND_CLEAR_ENV='["ANTHROPIC_API_KEY","ANTHROPIC_API_KEY_OLD"]'`
  - `OPENCLAW_LIVE_CLI_BACKEND_IMAGE_PROBE=1` để gửi một attachment hình ảnh thật (đường dẫn được chèn vào prompt).
  - `OPENCLAW_LIVE_CLI_BACKEND_IMAGE_ARG="--image"` để truyền đường dẫn file ảnh như tham số CLI thay vì chèn prompt.
  - `OPENCLAW_LIVE_CLI_BACKEND_IMAGE_MODE="repeat"` (hoặc `"list"`) để kiểm soát cách truyền tham số ảnh khi `IMAGE_ARG` được đặt.
  - `OPENCLAW_LIVE_CLI_BACKEND_RESUME_PROBE=1` để gửi lượt thứ hai và xác thực luồng resume.
- `OPENCLAW_LIVE_CLI_BACKEND_DISABLE_MCP_CONFIG=0` để giữ bật cấu hình MCP của Claude Code CLI (mặc định tắt MCP bằng file rỗng tạm).

Ví dụ:

```bash
OPENCLAW_LIVE_CLI_BACKEND=1 \
  OPENCLAW_LIVE_CLI_BACKEND_MODEL="claude-cli/claude-sonnet-4-5" \
  pnpm test:live src/gateway/gateway-cli-backend.live.test.ts
```

### Công thức live được khuyến nghị

Allowlist hẹp, tường minh là nhanh nhất và ít flake nhất:

- Một model, direct (không gateway):
  - `OPENCLAW_LIVE_MODELS="openai/gpt-5.2" pnpm test:live src/agents/models.profiles.live.test.ts`

- Một model, gateway smoke:
  - `OPENCLAW_LIVE_GATEWAY_MODELS="openai/gpt-5.2" pnpm test:live src/gateway/gateway-models.profiles.live.test.ts`

- Tool calling trên nhiều nhà cung cấp:
  - `OPENCLAW_LIVE_GATEWAY_MODELS="openai/gpt-5.2,anthropic/claude-opus-4-6,google/gemini-3-flash-preview,zai/glm-4.7,minimax/minimax-m2.1" pnpm test:live src/gateway/gateway-models.profiles.live.test.ts`

- Tập trung Google (API key Gemini + Antigravity):
  - Gemini (API key): `OPENCLAW_LIVE_GATEWAY_MODELS="google/gemini-3-flash-preview" pnpm test:live src/gateway/gateway-models.profiles.live.test.ts`
  - Antigravity (OAuth): `OPENCLAW_LIVE_GATEWAY_MODELS="google-antigravity/claude-opus-4-5-thinking,google-antigravity/gemini-3-pro-high" pnpm test:live src/gateway/gateway-models.profiles.live.test.ts`

Ghi chú:

- `google/...` dùng Gemini API (API key).
- `google-antigravity/...` dùng cầu OAuth Antigravity (endpoint agent kiểu Cloud Code Assist).
- `google-gemini-cli/...` dùng Gemini CLI cục bộ trên máy bạn (xác thực riêng + khác biệt tooling).
- Gemini API vs Gemini CLI:
  - API: OpenClaw gọi Gemini API do Google lưu trữ qua HTTP (API key / xác thực profile); đây là điều hầu hết người dùng hiểu là “Gemini”.
  - CLI: OpenClaw gọi shell tới binary `gemini` cục bộ; có xác thực riêng và có thể hành xử khác (streaming/hỗ trợ tool/độ lệch phiên bản).

## Live: model matrix (những gì chúng tôi bao phủ)

Không có “danh sách model CI” cố định (live là opt-in), nhưng đây là các model **được khuyến nghị** nên kiểm tra thường xuyên trên máy dev có khóa.

### Tập smoke hiện đại (tool calling + image)

Đây là lượt chạy “model phổ biến” mà chúng tôi kỳ vọng luôn hoạt động:

- OpenAI (không Codex): `openai/gpt-5.2` (tùy chọn: `openai/gpt-5.1`)
- OpenAI Codex: `openai-codex/gpt-5.3-codex` (tùy chọn: `openai-codex/gpt-5.3-codex-codex`)
- Anthropic: `anthropic/claude-opus-4-6` (hoặc `anthropic/claude-sonnet-4-5`)
- Google (Gemini API): `google/gemini-3-pro-preview` và `google/gemini-3-flash-preview` (tránh Gemini 2.x cũ)
- Google (Antigravity): `google-antigravity/claude-opus-4-5-thinking` và `google-antigravity/gemini-3-flash`
- Z.AI (GLM): `zai/glm-4.7`
- MiniMax: `minimax/minimax-m2.1`

Chạy gateway smoke với tool + image:
`OPENCLAW_LIVE_GATEWAY_MODELS="openai/gpt-5.2,openai-codex/gpt-5.3-codex,anthropic/claude-opus-4-6,google/gemini-3-pro-preview,google/gemini-3-flash-preview,google-antigravity/claude-opus-4-5-thinking,google-antigravity/gemini-3-flash,zai/glm-4.7,minimax/minimax-m2.1" pnpm test:live src/gateway/gateway-models.profiles.live.test.ts`

### Baseline: tool calling (Read + Exec tùy chọn)

Chọn ít nhất một model cho mỗi nhóm nhà cung cấp:

- OpenAI: `openai/gpt-5.2` (hoặc `openai/gpt-5-mini`)
- Anthropic: `anthropic/claude-opus-4-6` (hoặc `anthropic/claude-sonnet-4-5`)
- Google: `google/gemini-3-flash-preview` (hoặc `google/gemini-3-pro-preview`)
- Z.AI (GLM): `zai/glm-4.7`
- MiniMax: `minimax/minimax-m2.1`

Bao phủ bổ sung tùy chọn (nếu có thì tốt):

- xAI: `xai/grok-4` (hoặc bản mới nhất)
- Mistral: `mistral/`… (chọn một model có khả năng tools mà bạn đã bật)
- Cerebras: `cerebras/`… (nếu bạn có quyền truy cập)
- LM Studio: `lmstudio/`… (cục bộ; tool calling phụ thuộc chế độ API)

### Vision: gửi hình ảnh (attachment → thông điệp đa phương thức)

Bao gồm ít nhất một model có khả năng xử lý hình ảnh trong `OPENCLAW_LIVE_GATEWAY_MODELS` (các biến thể Claude/Gemini/OpenAI có vision, v.v.) để chạy probe hình ảnh.

### Aggregator / gateway thay thế

Nếu bạn đã bật khóa, chúng tôi cũng hỗ trợ test qua:

- OpenRouter: `openrouter/...` (hàng trăm model; dùng `openclaw models scan` để tìm ứng viên có tool+image)
- OpenCode Zen: `opencode/...` (xác thực qua `OPENCODE_API_KEY` / `OPENCODE_ZEN_API_KEY`)

Các nhà cung cấp khác có thể đưa vào live matrix (nếu có thông tin xác thực/cấu hình):

- Tích hợp sẵn: `openai`, `openai-codex`, `anthropic`, `google`, `google-vertex`, `google-antigravity`, `google-gemini-cli`, `zai`, `openrouter`, `opencode`, `xai`, `groq`, `cerebras`, `mistral`, `github-copilot`
- Qua `models.providers` (endpoint tùy chỉnh): `minimax` (cloud/API), cùng bất kỳ proxy tương thích OpenAI/Anthropic nào (LM Studio, vLLM, LiteLLM, v.v.)

Mẹo: đừng cố hardcode “tất cả model” trong tài liệu. Danh sách có thẩm quyền là những gì `discoverModels(...)` trả về trên máy của bạn + các khóa hiện có.

## Thông tin xác thực (không bao giờ commit)

Test live phát hiện thông tin xác thực giống như CLI. Hệ quả thực tế:

- Nếu CLI hoạt động, test live sẽ tìm thấy cùng khóa.
- Nếu test live báo “không có creds”, hãy gỡ lỗi giống như khi gỡ lỗi `openclaw models list` / chọn model.

- Kho profile: `~/.openclaw/credentials/` (ưu tiên; đây là ý nghĩa của “profile keys” trong test)
- Cấu hình: `~/.openclaw/openclaw.json` (hoặc `OPENCLAW_CONFIG_PATH`)

Nếu bạn muốn dựa vào khóa env (ví dụ đã export trong `~/.profile`), hãy chạy test cục bộ sau `source ~/.profile`, hoặc dùng các runner Docker bên dưới (chúng có thể mount `~/.profile` vào container).

## Deepgram live (phiên âm audio)

- Test: `src/media-understanding/providers/deepgram/audio.live.test.ts`
- Bật: `DEEPGRAM_API_KEY=... DEEPGRAM_LIVE_TEST=1 pnpm test:live src/media-understanding/providers/deepgram/audio.live.test.ts`

## Docker runners (tùy chọn “chạy được trên Linux”)

Các runner này chạy `pnpm test:live` bên trong image Docker của repo, mount thư mục cấu hình cục bộ và workspace (và nạp `~/.profile` nếu được mount):

- Direct models: `pnpm test:docker:live-models` (script: `scripts/test-live-models-docker.sh`)
- Gateway + dev agent: `pnpm test:docker:live-gateway` (script: `scripts/test-live-gateway-models-docker.sh`)
- Onboarding wizard (TTY, scaffold đầy đủ): `pnpm test:docker:onboard` (script: `scripts/e2e/onboard-docker.sh`)
- Gateway networking (hai container, xác thực WS + health): `pnpm test:docker:gateway-network` (script: `scripts/e2e/gateway-network-docker.sh`)
- Plugins (nạp extension tùy chỉnh + registry smoke): `pnpm test:docker:plugins` (script: `scripts/e2e/plugins-docker.sh`)

Env var hữu ích:

- `OPENCLAW_CONFIG_DIR=...` (mặc định: `~/.openclaw`) mount tới `/home/node/.openclaw`
- `OPENCLAW_WORKSPACE_DIR=...` (mặc định: `~/.openclaw/workspace`) mount tới `/home/node/.openclaw/workspace`
- `OPENCLAW_PROFILE_FILE=...` (mặc định: `~/.profile`) mount tới `/home/node/.profile` và được nạp trước khi chạy test
- `OPENCLAW_LIVE_GATEWAY_MODELS=...` / `OPENCLAW_LIVE_MODELS=...` để thu hẹp lượt chạy
- `OPENCLAW_LIVE_REQUIRE_PROFILE_KEYS=1` để đảm bảo creds đến từ kho profile (không phải env)

## Docs sanity

Chạy kiểm tra tài liệu sau khi chỉnh sửa: `pnpm docs:list`.

## Offline regression (an toàn cho CI)

Đây là các regression “pipeline thật” nhưng không cần nhà cung cấp thật:

- Gateway tool calling (mock OpenAI, gateway + agent loop thật): `src/gateway/gateway.tool-calling.mock-openai.test.ts`
- Gateway wizard (WS `wizard.start`/`wizard.next`, ghi cấu hình + ép xác thực): `src/gateway/gateway.wizard.e2e.test.ts`

## Đánh giá độ tin cậy agent (skills)

Chúng tôi đã có một số test an toàn cho CI hoạt động như “đánh giá độ tin cậy agent”:

- Mock tool-calling qua gateway + agent loop thật (`src/gateway/gateway.tool-calling.mock-openai.test.ts`).
- Luồng wizard end-to-end xác thực wiring phiên và hiệu ứng cấu hình (`src/gateway/gateway.wizard.e2e.test.ts`).

Những gì còn thiếu cho skills (xem [Skills](/tools/skills)):

- **Decisioning:** khi skills được liệt kê trong prompt, agent có chọn đúng skill (hoặc tránh skill không liên quan) không?
- **Compliance:** agent có đọc `SKILL.md` trước khi dùng và tuân theo các bước/tham số bắt buộc không?
- **Workflow contracts:** kịch bản nhiều lượt xác nhận thứ tự công cụ, mang theo lịch sử phiên và ranh giới sandbox.

Các eval trong tương lai nên ưu tiên tính xác định trước:

- Trình chạy kịch bản dùng nhà cung cấp mock để xác nhận các lần gọi công cụ + thứ tự, đọc file skill và wiring phiên.
- Một bộ nhỏ các kịch bản tập trung vào skill (dùng vs tránh, gating, prompt injection).
- Eval live tùy chọn (opt-in, bị chặn bởi env) chỉ sau khi bộ an toàn cho CI đã sẵn sàng.

## Thêm regression (hướng dẫn)

Khi bạn sửa một vấn đề model/nhà cung cấp được phát hiện trong live:

- Thêm một regression an toàn cho CI nếu có thể (mock/stub nhà cung cấp, hoặc ghi lại chính xác phép biến đổi hình dạng request)
- Nếu bản chất chỉ live (giới hạn tốc độ, chính sách xác thực), hãy giữ test live hẹp và opt-in qua env var
- Ưu tiên nhắm vào lớp nhỏ nhất bắt được bug:
  - Bug chuyển đổi/phát lại request của nhà cung cấp → test direct models
  - Bug pipeline phiên/lịch sử/công cụ của gateway → gateway live smoke hoặc test mock gateway an toàn cho CI
