---
summary: "Đẩy Gmail Pub/Sub được nối vào webhook OpenClaw qua gogcli"
read_when:
  - Nối các trigger hộp thư Gmail vào OpenClaw
  - Thiết lập Pub/Sub push để đánh thức tác tử
title: "Gmail PubSub"
x-i18n:
  source_path: automation/gmail-pubsub.md
  source_hash: dfb92133b69177e4
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:06:02Z
---

# Gmail Pub/Sub -> OpenClaw

Mục tiêu: theo dõi Gmail -> Pub/Sub push -> `gog gmail watch serve` -> webhook OpenClaw.

## Prereqs

- `gcloud` đã cài đặt và đăng nhập ([hướng dẫn cài đặt](https://docs.cloud.google.com/sdk/docs/install-sdk)).
- `gog` (gogcli) đã cài đặt và được ủy quyền cho tài khoản Gmail ([gogcli.sh](https://gogcli.sh/)).
- Đã bật hook OpenClaw (xem [Webhooks](/automation/webhook)).
- `tailscale` đã đăng nhập ([tailscale.com](https://tailscale.com/)). Thiết lập được hỗ trợ dùng Tailscale Funnel cho endpoint HTTPS công khai.
  Các dịch vụ tunnel khác có thể dùng, nhưng là DIY/không được hỗ trợ và cần nối thủ công.
  Hiện tại, Tailscale là thứ chúng tôi hỗ trợ.

Ví dụ cấu hình hook (bật preset mapping cho Gmail):

```json5
{
  hooks: {
    enabled: true,
    token: "OPENCLAW_HOOK_TOKEN",
    path: "/hooks",
    presets: ["gmail"],
  },
}
```

Để gửi bản tóm tắt Gmail tới bề mặt chat, hãy ghi đè preset bằng một mapping
đặt `deliver` + tùy chọn `channel`/`to`:

```json5
{
  hooks: {
    enabled: true,
    token: "OPENCLAW_HOOK_TOKEN",
    presets: ["gmail"],
    mappings: [
      {
        match: { path: "gmail" },
        action: "agent",
        wakeMode: "now",
        name: "Gmail",
        sessionKey: "hook:gmail:{{messages[0].id}}",
        messageTemplate: "New email from {{messages[0].from}}\nSubject: {{messages[0].subject}}\n{{messages[0].snippet}}\n{{messages[0].body}}",
        model: "openai/gpt-5.2-mini",
        deliver: true,
        channel: "last",
        // to: "+15551234567"
      },
    ],
  },
}
```

Nếu bạn muốn một kênh cố định, đặt `channel` + `to`. Nếu không, `channel: "last"`
sử dụng tuyến gửi cuối cùng (mặc định rơi về WhatsApp).

Để buộc dùng mô hình rẻ hơn cho các lần chạy Gmail, đặt `model` trong mapping
(`provider/model` hoặc alias). Nếu bạn áp dụng `agents.defaults.models`, hãy bao gồm nó ở đó.

Để đặt mô hình mặc định và mức thinking riêng cho hook Gmail, thêm
`hooks.gmail.model` / `hooks.gmail.thinking` vào cấu hình của bạn:

```json5
{
  hooks: {
    gmail: {
      model: "openrouter/meta-llama/llama-3.3-70b-instruct:free",
      thinking: "off",
    },
  },
}
```

Ghi chú:

- `model`/`thinking` theo từng hook trong mapping vẫn ghi đè các mặc định này.
- Thứ tự fallback: `hooks.gmail.model` → `agents.defaults.model.fallbacks` → chính (xác thực/giới hạn tốc độ/timeout).
- Nếu đặt `agents.defaults.models`, mô hình Gmail phải nằm trong allowlist.
- Nội dung hook Gmail mặc định được bọc bởi các ranh giới an toàn nội dung bên ngoài.
  Để tắt (nguy hiểm), đặt `hooks.gmail.allowUnsafeExternalContent: true`.

Để tùy biến xử lý payload sâu hơn, thêm `hooks.mappings` hoặc một module transform JS/TS
dưới `hooks.transformsDir` (xem [Webhooks](/automation/webhook)).

## Wizard (khuyến nghị)

Dùng trợ lý OpenClaw để nối mọi thứ lại với nhau (cài deps trên macOS qua brew):

```bash
openclaw webhooks gmail setup \
  --account openclaw@gmail.com
```

Mặc định:

- Dùng Tailscale Funnel cho endpoint push công khai.
- Ghi cấu hình `hooks.gmail` cho `openclaw webhooks gmail run`.
- Bật preset hook Gmail (`hooks.presets: ["gmail"]`).

Ghi chú về path: khi `tailscale.mode` được bật, OpenClaw tự động đặt
`hooks.gmail.serve.path` thành `/` và giữ path công khai ở
`hooks.gmail.tailscale.path` (mặc định `/gmail-pubsub`) vì Tailscale
loại bỏ tiền tố set-path trước khi proxy.
Nếu bạn cần backend nhận path có tiền tố, hãy đặt
`hooks.gmail.tailscale.target` (hoặc `--tailscale-target`) thành một URL đầy đủ như
`http://127.0.0.1:8788/gmail-pubsub` và khớp `hooks.gmail.serve.path`.

Muốn endpoint tùy chỉnh? Dùng `--push-endpoint <url>` hoặc `--tailscale off`.

Ghi chú nền tảng: trên macOS, wizard cài `gcloud`, `gogcli`, và `tailscale`
qua Homebrew; trên Linux hãy cài thủ công trước.

Tự khởi động Gateway (khuyến nghị):

- Khi `hooks.enabled=true` và `hooks.gmail.account` được đặt, Gateway khởi động
  `gog gmail watch serve` khi boot và tự động gia hạn watch.
- Đặt `OPENCLAW_SKIP_GMAIL_WATCHER=1` để opt out (hữu ích nếu bạn tự chạy daemon).
- Không chạy daemon thủ công cùng lúc, nếu không bạn sẽ gặp
  `listen tcp 127.0.0.1:8788: bind: address already in use`.

Daemon thủ công (khởi động `gog gmail watch serve` + tự động gia hạn):

```bash
openclaw webhooks gmail run
```

## Thiết lập một lần

1. Chọn dự án GCP **sở hữu OAuth client** được dùng bởi `gog`.

```bash
gcloud auth login
gcloud config set project <project-id>
```

Lưu ý: Gmail watch yêu cầu topic Pub/Sub nằm trong cùng dự án với OAuth client.

2. Bật API:

```bash
gcloud services enable gmail.googleapis.com pubsub.googleapis.com
```

3. Tạo topic:

```bash
gcloud pubsub topics create gog-gmail-watch
```

4. Cho phép Gmail push publish:

```bash
gcloud pubsub topics add-iam-policy-binding gog-gmail-watch \
  --member=serviceAccount:gmail-api-push@system.gserviceaccount.com \
  --role=roles/pubsub.publisher
```

## Bắt đầu watch

```bash
gog gmail watch start \
  --account openclaw@gmail.com \
  --label INBOX \
  --topic projects/<project-id>/topics/gog-gmail-watch
```

Lưu `history_id` từ output (để debug).

## Chạy push handler

Ví dụ local (xác thực bằng shared token):

```bash
gog gmail watch serve \
  --account openclaw@gmail.com \
  --bind 127.0.0.1 \
  --port 8788 \
  --path /gmail-pubsub \
  --token <shared> \
  --hook-url http://127.0.0.1:18789/hooks/gmail \
  --hook-token OPENCLAW_HOOK_TOKEN \
  --include-body \
  --max-bytes 20000
```

Ghi chú:

- `--token` bảo vệ endpoint push (`x-gog-token` hoặc `?token=`).
- `--hook-url` trỏ tới OpenClaw `/hooks/gmail` (đã map; chạy cô lập + gửi tóm tắt về chính).
- `--include-body` và `--max-bytes` kiểm soát đoạn body gửi tới OpenClaw.

Khuyến nghị: `openclaw webhooks gmail run` bọc cùng luồng và tự động gia hạn watch.

## Mở endpoint handler (nâng cao, không được hỗ trợ)

Nếu bạn cần tunnel không phải Tailscale, hãy nối thủ công và dùng URL công khai trong
subscription push (không được hỗ trợ, không có guardrail):

```bash
cloudflared tunnel --url http://127.0.0.1:8788 --no-autoupdate
```

Dùng URL được tạo làm push endpoint:

```bash
gcloud pubsub subscriptions create gog-gmail-watch-push \
  --topic gog-gmail-watch \
  --push-endpoint "https://<public-url>/gmail-pubsub?token=<shared>"
```

Môi trường production: dùng endpoint HTTPS ổn định và cấu hình Pub/Sub OIDC JWT, sau đó chạy:

```bash
gog gmail watch serve --verify-oidc --oidc-email <svc@...>
```

## Test

Gửi một email tới hộp thư đang được theo dõi:

```bash
gog gmail send \
  --account openclaw@gmail.com \
  --to openclaw@gmail.com \
  --subject "watch test" \
  --body "ping"
```

Kiểm tra trạng thái watch và lịch sử:

```bash
gog gmail watch status --account openclaw@gmail.com
gog gmail history --account openclaw@gmail.com --since <historyId>
```

## Troubleshooting

- `Invalid topicName`: không khớp dự án (topic không nằm trong dự án của OAuth client).
- `User not authorized`: thiếu `roles/pubsub.publisher` trên topic.
- Tin nhắn trống: Gmail push chỉ cung cấp `historyId`; hãy fetch qua `gog gmail history`.

## Cleanup

```bash
gog gmail watch stop --account openclaw@gmail.com
gcloud pubsub subscriptions delete gog-gmail-watch-push
gcloud pubsub topics delete gog-gmail-watch
```
