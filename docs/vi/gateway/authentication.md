---
summary: "Xac thuc mo hinh: OAuth, khoa API va setup-token"
read_when:
  - Xu ly su co xac thuc mo hinh hoac het han OAuth
  - Tai lieu hoa xac thuc hoac luu tru thong tin dang nhap
title: "Xac thuc"
x-i18n:
  source_path: gateway/authentication.md
  source_hash: 66fa2c64ff374c9c
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:07:12Z
---

# Xac thuc

OpenClaw ho tro OAuth va khoa API cho cac nha cung cap mo hinh. Doi voi tai khoan
Anthropic, chung toi khuyen nghi su dung **khoa API**. Doi voi quyen truy cap goi
Claude subscription, hay su dung token ton tai lau dai duoc tao boi `claude setup-token`.

Xem [/concepts/oauth](/concepts/oauth) de biet toan bo luong OAuth va bo cuc luu tru.

## Thiet lap Anthropic duoc khuyen nghi (khoa API)

Neu ban su dung Anthropic truc tiep, hay dung khoa API.

1. Tao mot khoa API trong Anthropic Console.
2. Dat no tren **gateway host** (may dang chay `openclaw gateway`).

```bash
export ANTHROPIC_API_KEY="..."
openclaw models status
```

3. Neu Gateway chay duoi systemd/launchd, hay uu tien dat khoa trong
   `~/.openclaw/.env` de daemon co the doc:

```bash
cat >> ~/.openclaw/.env <<'EOF'
ANTHROPIC_API_KEY=...
EOF
```

Sau do khoi dong lai daemon (hoac khoi dong lai tien trinh Gateway) va kiem tra lai:

```bash
openclaw models status
openclaw doctor
```

Neu ban khong muon tu quan ly bien moi truong, trinh huong dan onboarding co the luu
khoa API de daemon su dung: `openclaw onboard`.

Xem [Help](/help) de biet chi tiet ve ke thua env (`env.shellEnv`,
`~/.openclaw/.env`, systemd/launchd).

## Anthropic: setup-token (xac thuc subscription)

Doi voi Anthropic, con duong duoc khuyen nghi la **khoa API**. Neu ban dang su dung
Claude subscription, luong setup-token cung duoc ho tro. Hay chay tren **gateway host**:

```bash
claude setup-token
```

Sau do dan vao OpenClaw:

```bash
openclaw models auth setup-token --provider anthropic
```

Neu token duoc tao tren mot may khac, hay dan thu cong:

```bash
openclaw models auth paste-token --provider anthropic
```

Neu ban thay loi Anthropic nhu:

```
This credential is only authorized for use with Claude Code and cannot be used for other API requests.
```

…hay su dung khoa API Anthropic thay the.

Nhap token thu cong (bat ky nha cung cap; ghi `auth-profiles.json` + cap nhat cau hinh):

```bash
openclaw models auth paste-token --provider anthropic
openclaw models auth paste-token --provider openrouter
```

Kiem tra than thien voi tu dong hoa (thoat `1` khi het han/thieu, `2` khi sap het han):

```bash
openclaw models status --check
```

Cac script van hanh tuy chon (systemd/Termux) duoc tai lieu hoa tai day:
[/automation/auth-monitoring](/automation/auth-monitoring)

> `claude setup-token` yeu cau TTY tuong tac.

## Kiem tra trang thai xac thuc mo hinh

```bash
openclaw models status
openclaw doctor
```

## Dieu khien thong tin dang nhap duoc su dung

### Theo phien (lenh chat)

Su dung `/model <alias-or-id>@<profileId>` de co dinh mot thong tin dang nhap cua nha cung cap cu the
cho phien hien tai (vi du id ho so: `anthropic:default`, `anthropic:work`).

Su dung `/model` (hoac `/model list`) cho bo chon gon nhe; su dung
`/model status` cho che do xem day du (cac ung vien + ho so xac thuc tiep theo,
kem chi tiet endpoint cua nha cung cap khi da cau hinh).

### Theo tac tu (ghi de CLI)

Dat ghi de thu tu ho so xac thuc ro rang cho mot tac tu (duoc luu trong `auth-profiles.json` cua tac tu do):

```bash
openclaw models auth order get --provider anthropic
openclaw models auth order set --provider anthropic anthropic:default
openclaw models auth order clear --provider anthropic
```

Su dung `--agent <id>` de nham den mot tac tu cu the; bo qua no de su dung tac tu mac dinh da cau hinh.

## Xu ly su co

### “Khong tim thay thong tin dang nhap”

Neu ho so token Anthropic bi thieu, hay chay `claude setup-token` tren
**gateway host**, sau do kiem tra lai:

```bash
openclaw models status
```

### Token sap het han/da het han

Chay `openclaw models status` de xac nhan ho so nao dang sap het han. Neu ho so
bi thieu, hay chay lai `claude setup-token` va dan token lan nua.

## Yeu cau

- Claude Max hoac Pro subscription (cho `claude setup-token`)
- Claude Code CLI da duoc cai dat (co san lenh `claude`)
