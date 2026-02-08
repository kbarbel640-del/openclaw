---
summary: "Bộ công cụ kiểm thử: các suite unit/e2e/live, runner Docker, và phạm vi của từng bài test"
read_when:
  - Chạy test cục bộ hoặc trong CI
  - Thêm hồi quy cho lỗi mô hình/nhà cung cấp
  - Gỡ lỗi hành vi Gateway + tác tử
title: "Kiểm thử"
x-i18n:
  source_path: help/testing.md
  source_hash: 9bb77454e18e1d0b
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T08:16:40Z
---

# Kiểm thử

OpenClaw có ba suite Vitest (unit/integration, e2e, live) và một số runner Docker nhỏ.

Tài liệu này là hướng dẫn “chúng tôi kiểm thử như thế nào”:

- Mỗi suite bao phủ những gì (và cố ý _không_ bao phủ những gì)
- Lệnh cần chạy cho các quy trình phổ biến (cục bộ, trước khi push, gỡ lỗi)
- Cách test live phát hiện thông tin xác thực và chọn mô hình/nhà cung cấp
- Cách thêm hồi quy cho các vấn đề mô hình/nhà cung cấp trong thực tế

## Khởi động nhanh

Hầu hết các ngày:

- Cổng đầy đủ (mong đợi trước khi push): `pnpm build && pnpm check && pnpm test`

Khi bạn chỉnh sửa test hoặc muốn thêm độ tin cậy:

- Cổng độ bao phủ: `pnpm test:coverage`
- Suite E2E: `pnpm test:e2e`

Khi gỡ lỗi nhà cung cấp/mô hình thực (cần creds thật):

- Suite live (mô hình + probe công cụ/hình ảnh của gateway): `pnpm test:live`

Mẹo: khi chỉ cần một ca lỗi, hãy ưu tiên thu hẹp test live bằng các biến môi trường allowlist mô tả bên dưới.

## Các suite kiểm thử (chạy ở đâu)

Hãy coi các suite như “mức độ thực tế tăng dần” (và độ flaky/chi phí cũng tăng):

### Unit / integration (mặc định)

- Lệnh: `pnpm test`
- Cấu hình: `vitest.config.ts`
- Tệp: `src/**/*.test.ts`
- Phạm vi:
  - Test unit thuần
  - Test tích hợp trong tiến trình (xác thực gateway, định tuyến, công cụ, phân tích cú pháp, cấu hình)
  - Hồi quy xác định cho các lỗi đã biết
- Kỳ vọng:
  - Chạy trong CI
  - Không cần khóa thật
  - Nhanh và ổn định

### E2E (smoke gateway)

- Lệnh: `pnpm test:e2e`
- Cấu hình: `vitest.e2e.config.ts`
- Tệp: `src/**/*.e2e.test.ts`
- Phạm vi:
  - Hành vi end-to-end của gateway đa phiên bản
  - Bề mặt WebSocket/HTTP, ghép cặp node và mạng nặng hơn
- Kỳ vọng:
  - Chạy trong CI (khi được bật trong pipeline)
  - Không cần khóa thật
  - Nhiều thành phần hơn unit test (có thể chậm hơn)

### Live (nhà cung cấp thật + mô hình thật)

- Lệnh: `pnpm test:live`
- Cấu hình: `vitest.live.config.ts`
- Tệp: `src/**/*.live.test.ts`
- Mặc định: **bật** bởi `pnpm test:live` (thiết lập `OPENCLAW_LIVE_TEST=1`)
- Phạm vi:
  - “Nhà cung cấp/mô hình này có thực sự hoạt động _hôm nay_ với creds thật không?”
  - Bắt các thay đổi định dạng của nhà cung cấp, đặc thù gọi công cụ, vấn đề xác thực và hành vi giới hạn tốc độ
- Kỳ vọng:
  - Không ổn định CI theo thiết kế (mạng thật, chính sách nhà cung cấp thật, hạn mức, sự cố)
  - Tốn chi phí / dùng hạn mức
  - Ưu tiên chạy các tập con thu hẹp thay vì “tất cả”
  - Lần chạy live sẽ source `~/.profile` để lấy các khóa API còn thiếu
  - Xoay vòng khóa Anthropic: đặt `OPENCLAW_LIVE_ANTHROPIC_KEYS="sk-...,sk-..."` (hoặc `OPENCLAW_LIVE_ANTHROPIC_KEY=sk-...`) hoặc nhiều biến `ANTHROPIC_API_KEY*`; test sẽ thử lại khi gặp giới hạn tốc độ

## Tôi nên chạy suite nào?

Dùng bảng quyết định này:

- Chỉnh sửa logic/test: chạy `pnpm test` (và `pnpm test:coverage` nếu bạn thay đổi nhiều)
- Động chạm mạng gateway / giao thức WS / ghép cặp: thêm `pnpm test:e2e`
- Gỡ lỗi “bot của tôi bị down” / lỗi theo nhà cung cấp / gọi công cụ: chạy `pnpm test:live` đã được thu hẹp

## Live: smoke mô hình (khóa hồ sơ)

Test live được chia thành hai lớp để cô lập lỗi:

- “Direct model” cho biết nhà cung cấp/mô hình có trả lời được hay không với khóa đã cho.
- “Gateway smoke” cho biết toàn bộ pipeline gateway+tác tử hoạt động cho mô hình đó (phiên, lịch sử, công cụ, chính sách sandbox, v.v.).

### Lớp 1: Hoàn thành mô hình trực tiếp (không qua gateway)

- Test: `src/agents/models.profiles.live.test.ts`
- Mục tiêu:
  - Liệt kê các mô hình được phát hiện
  - Dùng `getApiKeyForModel` để chọn mô hình bạn có creds
  - Chạy một completion nhỏ cho mỗi mô hình (và hồi quy có mục tiêu khi cần)
- Cách bật:
  - `pnpm test:live` (hoặc `OPENCLAW_LIVE_TEST=1` nếu gọi Vitest trực tiếp)
- Đặt `OPENCLAW_LIVE_MODELS=modern` (hoặc `all`, alias cho hiện đại) để thực sự chạy suite này; nếu không nó sẽ bỏ qua để giữ `pnpm test:live` tập trung vào gateway smoke
- Cách chọn mô hình:
  - `OPENCLAW_LIVE_MODELS=modern` để chạy allowlist hiện đại (Opus/Sonnet/Haiku 4.5, GPT-5.x + Codex, Gemini 3, GLM 4.7, MiniMax M2.1, Grok 4)
  - `OPENCLAW_LIVE_MODELS=all` là alias cho allowlist hiện đại
  - hoặc `OPENCLAW_LIVE_MODELS="openai/gpt-5.2,anthropic/claude-opus-4-6,..."` (allowlist phân tách bằng dấu phẩy)
- Cách chọn nhà cung cấp:
  - `OPENCLAW_LIVE_PROVIDERS="google,google-antigravity,google-gemini-cli"` (allowlist phân tách bằng dấu phẩy)
- Nguồn khóa:
  - Mặc định: kho hồ sơ và fallback biến môi trường
  - Đặt `OPENCLAW_LIVE_REQUIRE_PROFILE_KEYS=1` để buộc **chỉ dùng kho hồ sơ**
- Vì sao tồn tại:
  - Tách “API nhà cung cấp bị hỏng / khóa không hợp lệ” khỏi “pipeline tác tử gateway bị hỏng”
  - Chứa các hồi quy nhỏ, cô lập (ví dụ: phát lại suy luận OpenAI Responses/Codex Responses + luồng gọi công cụ)

### Lớp 2: Gateway + smoke tác tử dev (những gì “@openclaw” thực sự làm)

- Test: `src/gateway/gateway-models.profiles.live.test.ts`
- Mục tiêu:
  - Khởi chạy gateway trong tiến trình
  - Tạo/patch một phiên `agent:dev:*` (ghi đè mô hình theo mỗi lần chạy)
  - Lặp qua các mô hình có khóa và khẳng định:
    - phản hồi “có ý nghĩa” (không dùng công cụ)
    - một lần gọi công cụ thật hoạt động (probe đọc)
    - các probe công cụ bổ sung tùy chọn (probe exec+read)
    - các đường hồi quy OpenAI (chỉ gọi công cụ → theo sau) tiếp tục hoạt động
- Chi tiết probe (để bạn giải thích lỗi nhanh):
  - Probe `read`: test ghi một tệp nonce trong workspace và yêu cầu tác tử `read` nó và echo nonce lại.
  - Probe `exec+read`: test yêu cầu tác tử `exec`-ghi một nonce vào tệp tạm, rồi `read` lại.
  - Probe hình ảnh: test đính kèm một PNG được tạo (mèo + mã ngẫu nhiên) và mong mô hình trả về `cat <CODE>`.
  - Tham chiếu triển khai: `src/gateway/gateway-models.profiles.live.test.ts` và `src/gateway/live-image-probe.ts`.
- Cách bật:
  - `pnpm test:live` (hoặc `OPENCLAW_LIVE_TEST=1` nếu gọi Vitest trực tiếp)
- Cách chọn mô hình:
  - Mặc định: allowlist hiện đại (Opus/Sonnet/Haiku 4.5, GPT-5.x + Codex, Gemini 3, GLM 4.7, MiniMax M2.1, Grok 4)
  - `OPENCLAW_LIVE_GATEWAY_MODELS=all` là alias cho allowlist hiện đại
  - Hoặc đặt `OPENCLAW_LIVE_GATEWAY_MODELS="provider/model"` (hoặc danh sách phân tách bằng dấu phẩy) để thu hẹp
- Cách chọn nhà cung cấp (tránh “OpenRouter tất cả”):
  - `OPENCLAW_LIVE_GATEWAY_PROVIDERS="google,google-antigravity,google-gemini-cli,openai,anthropic,zai,minimax"` (allowlist phân tách bằng dấu phẩy)
- Probe công cụ + hình ảnh luôn bật trong test live này:
  - Probe `read` + probe `exec+read` (stress công cụ)
  - Probe hình ảnh chạy khi mô hình quảng bá hỗ trợ đầu vào hình ảnh
  - Luồng (ở mức cao):
    - Test tạo một PNG nhỏ với “CAT” + mã ngẫu nhiên (`src/gateway/live-image-probe.ts`)
    - Gửi qua `agent` `attachments: [{ mimeType: "image/png", content: "<base64>" }]`
    - Gateway phân tích tệp đính kèm thành `images[]` (`src/gateway/server-methods/agent.ts` + `src/gateway/chat-attachments.ts`)
    - Tác tử nhúng chuyển tiếp thông điệp người dùng đa phương thức tới mô hình
    - Khẳng định: phản hồi chứa `cat` + mã (dung sai OCR: cho phép lỗi nhỏ)

Mẹo: để xem bạn có thể test những gì trên máy (và các id `provider/model` chính xác), chạy:

```bash
openclaw models list
openclaw models list --json
```

## Live: smoke setup-token Anthropic

- Test: `src/agents/anthropic.setup-token.live.test.ts`
- Mục tiêu: xác minh setup-token của Claude Code CLI (hoặc hồ sơ setup-token đã dán) có thể hoàn thành một prompt Anthropic.
- Bật:
  - `pnpm test:live` (hoặc `OPENCLAW_LIVE_TEST=1` nếu gọi Vitest trực tiếp)
  - `OPENCLAW_LIVE_SETUP_TOKEN=1`
- Nguồn token (chọn một):
  - Hồ sơ: `OPENCLAW_LIVE_SETUP_TOKEN_PROFILE=anthropic:setup-token-test`
  - Token thô: `OPENCLAW_LIVE_SETUP_TOKEN_VALUE=sk-ant-oat01-...`
- Ghi đè mô hình (tùy chọn):
  - `OPENCLAW_LIVE_SETUP_TOKEN_MODEL=anthropic/claude-opus-4-6`

Ví dụ thiết lập:

```bash
openclaw models auth paste-token --provider anthropic --profile-id anthropic:setup-token-test
OPENCLAW_LIVE_SETUP_TOKEN=1 OPENCLAW_LIVE_SETUP_TOKEN_PROFILE=anthropic:setup-token-test pnpm test:live src/agents/anthropic.setup-token.live.test.ts
```

## Live: smoke backend CLI (Claude Code CLI hoặc CLI cục bộ khác)

- Test: `src/gateway/gateway-cli-backend.live.test.ts`
- Mục tiêu: xác thực pipeline Gateway + tác tử dùng backend CLI cục bộ, không chạm cấu hình mặc định của bạn.
- Bật:
  - `pnpm test:live` (hoặc `OPENCLAW_LIVE_TEST=1` nếu gọi Vitest trực tiếp)
  - `OPENCLAW_LIVE_CLI_BACKEND=1`
- Mặc định:
  - Mô hình: `claude-cli/claude-sonnet-4-5`
  - Lệnh: `claude`
  - Tham số: `["-p","--output-format","json","--dangerously-skip-permissions"]`
- Ghi đè (tùy chọn):
  - `OPENCLAW_LIVE_CLI_BACKEND_MODEL="claude-cli/claude-opus-4-6"`
  - `OPENCLAW_LIVE_CLI_BACKEND_MODEL="codex-cli/gpt-5.3-codex"`
  - `OPENCLAW_LIVE_CLI_BACKEND_COMMAND="/full/path/to/claude"`
  - `OPENCLAW_LIVE_CLI_BACKEND_ARGS='["-p","--output-format","json","--permission-mode","bypassPermissions"]'`
  - `OPENCLAW_LIVE_CLI_BACKEND_CLEAR_ENV='["ANTHROPIC_API_KEY","ANTHROPIC_API_KEY_OLD"]'`
  - `OPENCLAW_LIVE_CLI_BACKEND_IMAGE_PROBE=1` để gửi tệp đính kèm hình ảnh thật (đường dẫn được chèn vào prompt).
  - `OPENCLAW_LIVE_CLI_BACKEND_IMAGE_ARG="--image"` để truyền đường dẫn tệp hình ảnh như tham số CLI thay vì chèn prompt.
  - `OPENCLAW_LIVE_CLI_BACKEND_IMAGE_MODE="repeat"` (hoặc `"list"`) để điều khiển cách truyền tham số hình ảnh khi đặt `IMAGE_ARG`.
  - `OPENCLAW_LIVE_CLI_BACKEND_RESUME_PROBE=1` để gửi lượt thứ hai và xác thực luồng resume.
- `OPENCLAW_LIVE_CLI_BACKEND_DISABLE_MCP_CONFIG=0` để giữ cấu hình MCP của Claude Code CLI được bật (mặc định vô hiệu MCP bằng một tệp rỗng tạm).

Ví dụ:

```bash
OPENCLAW_LIVE_CLI_BACKEND=1 \
  OPENCLAW_LIVE_CLI_BACKEND_MODEL="claude-cli/claude-sonnet-4-5" \
  pnpm test:live src/gateway/gateway-cli-backend.live.test.ts
```

### Công thức live khuyến nghị

Allowlist hẹp, tường minh là nhanh nhất và ít flaky nhất:

- Một mô hình, trực tiếp (không gateway):
  - `OPENCLAW_LIVE_MODELS="openai/gpt-5.2" pnpm test:live src/agents/models.profiles.live.test.ts`

- Một mô hình, gateway smoke:
  - `OPENCLAW_LIVE_GATEWAY_MODELS="openai/gpt-5.2" pnpm test:live src/gateway/gateway-models.profiles.live.test.ts`

- Gọi công cụ qua nhiều nhà cung cấp:
  - `OPENCLAW_LIVE_GATEWAY_MODELS="openai/gpt-5.2,anthropic/claude-opus-4-6,google/gemini-3-flash-preview,zai/glm-4.7,minimax/minimax-m2.1" pnpm test:live src/gateway/gateway-models.profiles.live.test.ts`

- Tập trung Google (khóa API Gemini + Antigravity):
  - Gemini (API key): `OPENCLAW_LIVE_GATEWAY_MODELS="google/gemini-3-flash-preview" pnpm test:live src/gateway/gateway-models.profiles.live.test.ts`
  - Antigravity (OAuth): `OPENCLAW_LIVE_GATEWAY_MODELS="google-antigravity/claude-opus-4-6-thinking,google-antigravity/gemini-3-pro-high" pnpm test:live src/gateway/gateway-models.profiles.live.test.ts`

Ghi chú:

- `google/...` dùng Gemini API (API key).
- `google-antigravity/...` dùng cầu OAuth Antigravity (endpoint tác tử kiểu Cloud Code Assist).
- `google-gemini-cli/...` dùng Gemini CLI cục bộ trên máy bạn (xác thực + đặc thù công cụ riêng).
- Gemini API vs Gemini CLI:
  - API: OpenClaw gọi Gemini API được Google lưu trữ qua HTTP (API key / xác thực hồ sơ); đây là điều đa số người dùng gọi là “Gemini”.
  - CLI: OpenClaw gọi shell tới một binary `gemini` cục bộ; có xác thực riêng và có thể hành xử khác (streaming/hỗ trợ công cụ/độ lệch phiên bản).

## Live: ma trận mô hình (chúng tôi bao phủ gì)

Không có “danh sách mô hình CI” cố định (live là opt-in), nhưng đây là các mô hình **khuyến nghị** nên bao phủ thường xuyên trên máy dev có khóa.

### Bộ smoke hiện đại (gọi công cụ + hình ảnh)

Đây là lượt chạy “mô hình phổ biến” mà chúng tôi mong luôn hoạt động:

- OpenAI (không Codex): `openai/gpt-5.2` (tùy chọn: `openai/gpt-5.1`)
- OpenAI Codex: `openai-codex/gpt-5.3-codex` (tùy chọn: `openai-codex/gpt-5.3-codex-codex`)
- Anthropic: `anthropic/claude-opus-4-6` (hoặc `anthropic/claude-sonnet-4-5`)
- Google (Gemini API): `google/gemini-3-pro-preview` và `google/gemini-3-flash-preview` (tránh Gemini 2.x cũ)
- Google (Antigravity): `google-antigravity/claude-opus-4-6-thinking` và `google-antigravity/gemini-3-flash`
- Z.AI (GLM): `zai/glm-4.7`
- MiniMax: `minimax/minimax-m2.1`

Chạy gateway smoke với công cụ + hình ảnh:
`OPENCLAW_LIVE_GATEWAY_MODELS="openai/gpt-5.2,openai-codex/gpt-5.3-codex,anthropic/claude-opus-4-6,google/gemini-3-pro-preview,google/gemini-3-flash-preview,google-antigravity/claude-opus-4-6-thinking,google-antigravity/gemini-3-flash,zai/glm-4.7,minimax/minimax-m2.1" pnpm test:live src/gateway/gateway-models.profiles.live.test.ts`

### Cơ sở: gọi công cụ (Read + Exec tùy chọn)

Chọn ít nhất một mô hình cho mỗi họ nhà cung cấp:

- OpenAI: `openai/gpt-5.2` (hoặc `openai/gpt-5-mini`)
- Anthropic: `anthropic/claude-opus-4-6` (hoặc `anthropic/claude-sonnet-4-5`)
- Google: `google/gemini-3-flash-preview` (hoặc `google/gemini-3-pro-preview`)
- Z.AI (GLM): `zai/glm-4.7`
- MiniMax: `minimax/minimax-m2.1`

Bao phủ bổ sung tùy chọn (có thì tốt):

- xAI: `xai/grok-4` (hoặc bản mới nhất có sẵn)
- Mistral: `mistral/`… (chọn một mô hình “tools” bạn đã bật)
- Cerebras: `cerebras/`… (nếu bạn có quyền truy cập)
- LM Studio: `lmstudio/`… (cục bộ; gọi công cụ phụ thuộc chế độ API)

### Thị giác: gửi hình ảnh (đính kèm → thông điệp đa phương thức)

Bao gồm ít nhất một mô hình có khả năng hình ảnh trong `OPENCLAW_LIVE_GATEWAY_MODELS` (các biến thể Claude/Gemini/OpenAI hỗ trợ thị giác, v.v.) để chạy probe hình ảnh.

### Trình tổng hợp / gateway thay thế

Nếu bạn đã bật khóa, chúng tôi cũng hỗ trợ test qua:

- OpenRouter: `openrouter/...` (hàng trăm mô hình; dùng `openclaw models scan` để tìm ứng viên có công cụ+hình ảnh)
- OpenCode Zen: `opencode/...` (xác thực qua `OPENCODE_API_KEY` / `OPENCODE_ZEN_API_KEY`)

Nhiều nhà cung cấp khác bạn có thể đưa vào ma trận live (nếu có creds/cấu hình):

- Tích hợp sẵn: `openai`, `openai-codex`, `anthropic`, `google`, `google-vertex`, `google-antigravity`, `google-gemini-cli`, `zai`, `openrouter`, `opencode`, `xai`, `groq`, `cerebras`, `mistral`, `github-copilot`
- Qua `models.providers` (endpoint tùy chỉnh): `minimax` (cloud/API), cùng bất kỳ proxy tương thích OpenAI/Anthropic nào (LM Studio, vLLM, LiteLLM, v.v.)

Mẹo: đừng cố hardcode “tất cả mô hình” trong tài liệu. Danh sách chuẩn là những gì `discoverModels(...)` trả về trên máy bạn + các khóa sẵn có.

## Thông tin xác thực (không bao giờ commit)

Test live phát hiện thông tin xác thực giống hệt CLI. Hệ quả thực tế:

- Nếu CLI chạy được, test live sẽ tìm thấy cùng khóa.
- Nếu test live báo “không có creds”, hãy gỡ lỗi giống như khi gỡ lỗi `openclaw models list` / chọn mô hình.

- Kho hồ sơ: `~/.openclaw/credentials/` (ưu tiên; đây là ý nghĩa của “khóa hồ sơ” trong test)
- Cấu hình: `~/.openclaw/openclaw.json` (hoặc `OPENCLAW_CONFIG_PATH`)

Nếu bạn muốn dựa vào khóa env (ví dụ đã export trong `~/.profile`), hãy chạy test cục bộ sau `source ~/.profile`, hoặc dùng các runner Docker bên dưới (chúng có thể mount `~/.profile` vào container).

## Deepgram live (chuyển giọng nói thành văn bản)

- Test: `src/media-understanding/providers/deepgram/audio.live.test.ts`
- Bật: `DEEPGRAM_API_KEY=... DEEPGRAM_LIVE_TEST=1 pnpm test:live src/media-understanding/providers/deepgram/audio.live.test.ts`

## Docker runners (tùy chọn “kiểm tra chạy được trên Linux”)

Các runner này chạy `pnpm test:live` bên trong image Docker của repo, mount thư mục cấu hình và workspace cục bộ của bạn (và source `~/.profile` nếu được mount):

- Mô hình trực tiếp: `pnpm test:docker:live-models` (script: `scripts/test-live-models-docker.sh`)
- Gateway + tác tử dev: `pnpm test:docker:live-gateway` (script: `scripts/test-live-gateway-models-docker.sh`)
- Trình hướng dẫn onboarding (TTY, scaffold đầy đủ): `pnpm test:docker:onboard` (script: `scripts/e2e/onboard-docker.sh`)
- Mạng gateway (hai container, WS auth + health): `pnpm test:docker:gateway-network` (script: `scripts/e2e/gateway-network-docker.sh`)
- Plugin (tải extension tùy chỉnh + smoke registry): `pnpm test:docker:plugins` (script: `scripts/e2e/plugins-docker.sh`)

Biến môi trường hữu ích:

- `OPENCLAW_CONFIG_DIR=...` (mặc định: `~/.openclaw`) mount vào `/home/node/.openclaw`
- `OPENCLAW_WORKSPACE_DIR=...` (mặc định: `~/.openclaw/workspace`) mount vào `/home/node/.openclaw/workspace`
- `OPENCLAW_PROFILE_FILE=...` (mặc định: `~/.profile`) mount vào `/home/node/.profile` và được source trước khi chạy test
- `OPENCLAW_LIVE_GATEWAY_MODELS=...` / `OPENCLAW_LIVE_MODELS=...` để thu hẹp lần chạy
- `OPENCLAW_LIVE_REQUIRE_PROFILE_KEYS=1` để đảm bảo creds đến từ kho hồ sơ (không phải env)

## Kiểm tra độ hợp lệ tài liệu

Chạy kiểm tra docs sau khi chỉnh sửa tài liệu: `pnpm docs:list`.

## Hồi quy offline (an toàn CI)

Đây là các hồi quy “pipeline thật” nhưng không dùng nhà cung cấp thật:

- Gọi công cụ gateway (mock OpenAI, gateway + vòng lặp tác tử thật): `src/gateway/gateway.tool-calling.mock-openai.test.ts`
- Trình hướng dẫn gateway (WS `wizard.start`/`wizard.next`, ghi cấu hình + cưỡng chế xác thực): `src/gateway/gateway.wizard.e2e.test.ts`

## Đánh giá độ tin cậy tác tử (skills)

Chúng tôi đã có một vài test an toàn CI hoạt động như “đánh giá độ tin cậy tác tử”:

- Mock gọi công cụ qua gateway + vòng lặp tác tử thật (`src/gateway/gateway.tool-calling.mock-openai.test.ts`).
- Luồng wizard end-to-end xác thực nối phiên và hiệu ứng cấu hình (`src/gateway/gateway.wizard.e2e.test.ts`).

Những gì còn thiếu cho skills (xem [Skills](/tools/skills)):

- **Quyết định:** khi skills được liệt kê trong prompt, tác tử có chọn đúng skill (hoặc tránh skill không liên quan) không?
- **Tuân thủ:** tác tử có đọc `SKILL.md` trước khi dùng và tuân theo các bước/tham số bắt buộc không?
- **Hợp đồng quy trình:** kịch bản nhiều lượt khẳng định thứ tự công cụ, kế thừa lịch sử phiên và ranh giới sandbox.

Các đánh giá tương lai nên ưu tiên tính xác định trước:

- Trình chạy kịch bản dùng nhà cung cấp mock để khẳng định gọi công cụ + thứ tự, đọc tệp skill và nối phiên.
- Một bộ nhỏ các kịch bản tập trung vào skill (dùng vs tránh, gating, prompt injection).
- Đánh giá live tùy chọn (opt-in, qua env) chỉ sau khi có bộ an toàn CI.

## Thêm hồi quy (hướng dẫn)

Khi bạn sửa một vấn đề nhà cung cấp/mô hình phát hiện trong live:

- Thêm một hồi quy an toàn CI nếu có thể (mock/stub nhà cung cấp, hoặc chụp chính xác phép biến đổi hình dạng request)
- Nếu bản chất chỉ có thể live (giới hạn tốc độ, chính sách xác thực), hãy giữ test live hẹp và opt-in qua biến env
- Ưu tiên nhắm vào lớp nhỏ nhất bắt được lỗi:
  - lỗi chuyển đổi/phát lại request của nhà cung cấp → test mô hình trực tiếp
  - lỗi pipeline phiên/lịch sử/công cụ của gateway → gateway live smoke hoặc test mock gateway an toàn CI
