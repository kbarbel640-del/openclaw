---
summary: "Onboarding theo kịch bản và thiết lập tác tử cho OpenClaw CLI"
read_when:
  - Ban dang tu dong hoa onboarding trong script hoac CI
  - Ban can vi du khong tuong tac cho cac nha cung cap cu the
title: "Tu dong hoa CLI"
sidebarTitle: "CLI automation"
x-i18n:
  source_path: start/wizard-cli-automation.md
  source_hash: 5b5463359a87cfe6
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:08:31Z
---

# Tự động hóa CLI

Sử dụng `--non-interactive` để tự động hóa `openclaw onboard`.

<Note>
`--json` không có nghĩa là chế độ không tương tác. Hãy dùng `--non-interactive` (và `--workspace`) cho các script.
</Note>

## Ví dụ cơ bản không tương tác

```bash
openclaw onboard --non-interactive \
  --mode local \
  --auth-choice apiKey \
  --anthropic-api-key "$ANTHROPIC_API_KEY" \
  --gateway-port 18789 \
  --gateway-bind loopback \
  --install-daemon \
  --daemon-runtime node \
  --skip-skills
```

Thêm `--json` để có bản tóm tắt dạng máy đọc được.

## Ví dụ theo từng nhà cung cấp

<AccordionGroup>
  <Accordion title="Ví dụ Gemini">
    ```bash
    openclaw onboard --non-interactive \
      --mode local \
      --auth-choice gemini-api-key \
      --gemini-api-key "$GEMINI_API_KEY" \
      --gateway-port 18789 \
      --gateway-bind loopback
    ```
  </Accordion>
  <Accordion title="Ví dụ Z.AI">
    ```bash
    openclaw onboard --non-interactive \
      --mode local \
      --auth-choice zai-api-key \
      --zai-api-key "$ZAI_API_KEY" \
      --gateway-port 18789 \
      --gateway-bind loopback
    ```
  </Accordion>
  <Accordion title="Ví dụ Vercel AI Gateway">
    ```bash
    openclaw onboard --non-interactive \
      --mode local \
      --auth-choice ai-gateway-api-key \
      --ai-gateway-api-key "$AI_GATEWAY_API_KEY" \
      --gateway-port 18789 \
      --gateway-bind loopback
    ```
  </Accordion>
  <Accordion title="Ví dụ Cloudflare AI Gateway">
    ```bash
    openclaw onboard --non-interactive \
      --mode local \
      --auth-choice cloudflare-ai-gateway-api-key \
      --cloudflare-ai-gateway-account-id "your-account-id" \
      --cloudflare-ai-gateway-gateway-id "your-gateway-id" \
      --cloudflare-ai-gateway-api-key "$CLOUDFLARE_AI_GATEWAY_API_KEY" \
      --gateway-port 18789 \
      --gateway-bind loopback
    ```
  </Accordion>
  <Accordion title="Ví dụ Moonshot">
    ```bash
    openclaw onboard --non-interactive \
      --mode local \
      --auth-choice moonshot-api-key \
      --moonshot-api-key "$MOONSHOT_API_KEY" \
      --gateway-port 18789 \
      --gateway-bind loopback
    ```
  </Accordion>
  <Accordion title="Ví dụ Synthetic">
    ```bash
    openclaw onboard --non-interactive \
      --mode local \
      --auth-choice synthetic-api-key \
      --synthetic-api-key "$SYNTHETIC_API_KEY" \
      --gateway-port 18789 \
      --gateway-bind loopback
    ```
  </Accordion>
  <Accordion title="Ví dụ OpenCode Zen">
    ```bash
    openclaw onboard --non-interactive \
      --mode local \
      --auth-choice opencode-zen \
      --opencode-zen-api-key "$OPENCODE_API_KEY" \
      --gateway-port 18789 \
      --gateway-bind loopback
    ```
  </Accordion>
</AccordionGroup>

## Thêm một tác tử khác

Sử dụng `openclaw agents add <name>` để tạo một tác tử riêng với workspace,
các phiên và hồ sơ xác thực riêng. Chạy không có `--workspace` sẽ khởi chạy trình hướng dẫn.

```bash
openclaw agents add work \
  --workspace ~/.openclaw/workspace-work \
  --model openai/gpt-5.2 \
  --bind whatsapp:biz \
  --non-interactive \
  --json
```

Những gì nó thiết lập:

- `agents.list[].name`
- `agents.list[].workspace`
- `agents.list[].agentDir`

Ghi chú:

- Workspace mặc định tuân theo `~/.openclaw/workspace-<agentId>`.
- Thêm `bindings` để định tuyến tin nhắn đến (trình hướng dẫn có thể làm việc này).
- Các cờ không tương tác: `--model`, `--agent-dir`, `--bind`, `--non-interactive`.

## Tài liệu liên quan

- Trung tâm onboarding: [Trình hướng dẫn Onboarding (CLI)](/start/wizard)
- Tham chiếu đầy đủ: [Tham chiếu Onboarding CLI](/start/wizard-cli-reference)
- Tham chiếu lệnh: [`openclaw onboard`](/cli/onboard)
