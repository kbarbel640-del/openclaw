---
title: Sandbox CLI
summary: "Quan ly cac container sandbox va kiem tra chinh sach sandbox hieu luc"
read_when: "Khi ban dang quan ly cac container sandbox hoac debug hanh vi sandbox/chinh sach cong cu."
status: active
x-i18n:
  source_path: cli/sandbox.md
  source_hash: 6e1186f26c77e188
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:06:37Z
---

# Sandbox CLI

Quan ly cac container sandbox dua tren Docker cho viec thuc thi tac tu co lap.

## Tong quan

OpenClaw co the chay cac tac tu trong cac container Docker co lap de tang bao mat. Cac lenh `sandbox` giup ban quan ly cac container nay, dac biet sau khi cap nhat hoac thay doi cau hinh.

## Lenh

### `openclaw sandbox explain`

Kiem tra che do/pham vi/truy cap workspace sandbox **hieu luc**, chinh sach cong cu sandbox, va cac gate dac quyen (kem duong dan khoa cau hinh fix-it).

```bash
openclaw sandbox explain
openclaw sandbox explain --session agent:main:main
openclaw sandbox explain --agent work
openclaw sandbox explain --json
```

### `openclaw sandbox list`

Liet ke tat ca cac container sandbox cung trang thai va cau hinh cua chung.

```bash
openclaw sandbox list
openclaw sandbox list --browser  # List only browser containers
openclaw sandbox list --json     # JSON output
```

**Dau ra bao gom:**

- Ten container va trang thai (dang chay/dung)
- Image Docker va lieu no co khop voi cau hinh hay khong
- Tuoi doi (thoi gian ke tu khi tao)
- Thoi gian nhan roi (thoi gian ke tu lan su dung cuoi)
- Phien/tac tu lien ket

### `openclaw sandbox recreate`

Xoa cac container sandbox de bat buoc tao lai voi image/cau hinh da cap nhat.

```bash
openclaw sandbox recreate --all                # Recreate all containers
openclaw sandbox recreate --session main       # Specific session
openclaw sandbox recreate --agent mybot        # Specific agent
openclaw sandbox recreate --browser            # Only browser containers
openclaw sandbox recreate --all --force        # Skip confirmation
```

**Tuy chon:**

- `--all`: Tao lai tat ca cac container sandbox
- `--session <key>`: Tao lai container cho phien cu the
- `--agent <id>`: Tao lai cac container cho tac tu cu the
- `--browser`: Chi tao lai cac container trinh duyet
- `--force`: Bo qua hoi xac nhan

**Quan trong:** Cac container se duoc tao lai tu dong khi tac tu duoc su dung lan tiep theo.

## Tinh huong su dung

### Sau khi cap nhat image Docker

```bash
# Pull new image
docker pull openclaw-sandbox:latest
docker tag openclaw-sandbox:latest openclaw-sandbox:bookworm-slim

# Update config to use new image
# Edit config: agents.defaults.sandbox.docker.image (or agents.list[].sandbox.docker.image)

# Recreate containers
openclaw sandbox recreate --all
```

### Sau khi thay doi cau hinh sandbox

```bash
# Edit config: agents.defaults.sandbox.* (or agents.list[].sandbox.*)

# Recreate to apply new config
openclaw sandbox recreate --all
```

### Sau khi thay doi setupCommand

```bash
openclaw sandbox recreate --all
# or just one agent:
openclaw sandbox recreate --agent family
```

### Chi cho mot tac tu cu the

```bash
# Update only one agent's containers
openclaw sandbox recreate --agent alfred
```

## Tai sao can thiet?

**Van de:** Khi ban cap nhat image Docker sandbox hoac cau hinh:

- Cac container hien tai tiep tuc chay voi thiet lap cu
- Cac container chi duoc don dep sau 24 gio khong hoat dong
- Cac tac tu duoc su dung thuong xuyen giu cac container cu chay vo thoi han

**Giai phap:** Su dung `openclaw sandbox recreate` de buoc xoa cac container cu. Chung se duoc tao lai tu dong voi thiet lap hien tai khi can dung.

Meo: uu tien `openclaw sandbox recreate` hon `docker rm` thu cong. No su dung cach dat ten container cua Gateway va tranh lech khi cac khoa scope/phien thay doi.

## Cau hinh

Cac thiet lap sandbox nam trong `~/.openclaw/openclaw.json` duoi `agents.defaults.sandbox` (ghi de theo tung tac tu nam trong `agents.list[].sandbox`):

```jsonc
{
  "agents": {
    "defaults": {
      "sandbox": {
        "mode": "all", // off, non-main, all
        "scope": "agent", // session, agent, shared
        "docker": {
          "image": "openclaw-sandbox:bookworm-slim",
          "containerPrefix": "openclaw-sbx-",
          // ... more Docker options
        },
        "prune": {
          "idleHours": 24, // Auto-prune after 24h idle
          "maxAgeDays": 7, // Auto-prune after 7 days
        },
      },
    },
  },
}
```

## Xem them

- [Tai lieu Sandbox](/gateway/sandboxing)
- [Cau hinh Tac tu](/concepts/agent-workspace)
- [Lenh Doctor](/gateway/doctor) - Kiem tra thiet lap sandbox
