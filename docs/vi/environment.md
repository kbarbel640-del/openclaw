---
summary: "Noi OpenClaw tai bien moi truong va thu tu uu tien"
read_when:
  - Ban can biet nhung bien moi truong nao duoc tai, va theo thu tu nao
  - Ban dang xu ly su co thieu API key trong Gateway
  - Ban dang tai lieu hoa xac thuc nha cung cap hoac moi truong trien khai
title: "Bien moi truong"
x-i18n:
  source_path: environment.md
  source_hash: b49ae50e5d306612
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:07:00Z
---

# Bien moi truong

OpenClaw tai bien moi truong tu nhieu nguon. Quy tac la **khong bao gio ghi de cac gia tri hien co**.

## Thu tu uu tien (cao → thap)

1. **Moi truong tien trinh** (nhung gi tien trinh Gateway da co tu shell/daemon cha).
2. **`.env` trong thu muc lam viec hien tai** (mac dinh dotenv; khong ghi de).
3. **`.env` toan cuc** tai `~/.openclaw/.env` (con goi la `$OPENCLAW_STATE_DIR/.env`; khong ghi de).
4. **Khoi cau hinh `env`** trong `~/.openclaw/openclaw.json` (chi ap dung neu thieu).
5. **Nhap tu login-shell tuy chon** (`env.shellEnv.enabled` hoac `OPENCLAW_LOAD_SHELL_ENV=1`), chi ap dung cho cac khoa mong doi bi thieu.

Neu file cau hinh bi thieu hoan toan, buoc 4 se bi bo qua; viec nhap tu shell van chay neu duoc bat.

## Khoi cau hinh `env`

Hai cach tuong duong de dat bien moi truong noi tuyen (ca hai deu khong ghi de):

```json5
{
  env: {
    OPENROUTER_API_KEY: "sk-or-...",
    vars: {
      GROQ_API_KEY: "gsk-...",
    },
  },
}
```

## Nhap bien moi truong tu shell

`env.shellEnv` chay login shell cua ban va chi nhap cac khoa mong doi **bi thieu**:

```json5
{
  env: {
    shellEnv: {
      enabled: true,
      timeoutMs: 15000,
    },
  },
}
```

Cac bien moi truong tuong duong:

- `OPENCLAW_LOAD_SHELL_ENV=1`
- `OPENCLAW_SHELL_ENV_TIMEOUT_MS=15000`

## Thay the bien moi truong trong cau hinh

Ban co the tham chieu truc tiep bien moi truong trong cac gia tri chuoi cua cau hinh bang cu phap `${VAR_NAME}`:

```json5
{
  models: {
    providers: {
      "vercel-gateway": {
        apiKey: "${VERCEL_GATEWAY_API_KEY}",
      },
    },
  },
}
```

Xem [Cau hinh: Thay the bien moi truong](/gateway/configuration#env-var-substitution-in-config) de biet them chi tiet.

## Lien quan

- [Cau hinh Gateway](/gateway/configuration)
- [FAQ: bien moi truong va tai .env](/help/faq#env-vars-and-env-loading)
- [Tong quan mo hinh](/concepts/models)
