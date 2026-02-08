---
summary: "Chay OpenClaw Gateway 24/7 tren VPS Hetzner gia re (Docker) voi trang thai ben vung va cac nhi phan duoc dong san"
read_when:
  - Ban muon OpenClaw chay 24/7 tren VPS dam may (khong phai laptop)
  - Ban muon mot Gateway luon bat, cap do san xuat tren VPS rieng
  - Ban muon toan quyen kiem soat viec luu tru, nhi phan va hanh vi khoi dong lai
  - Ban dang chay OpenClaw trong Docker tren Hetzner hoac nha cung cap tuong tu
title: "Hetzner"
x-i18n:
  source_path: install/hetzner.md
  source_hash: 84d9f24f1a803aa1
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:07:44Z
---

# OpenClaw tren Hetzner (Docker, Huong dan VPS san xuat)

## Muc tieu

Chay mot OpenClaw Gateway ben vung tren VPS Hetzner su dung Docker, voi trang thai ben vung, nhi phan duoc dong san va hanh vi khoi dong lai an toan.

Neu ban muon “OpenClaw 24/7 voi ~5$”, day la cau hinh don gian va dang tin cay nhat.
Gia Hetzner co the thay doi; hay chon VPS Debian/Ubuntu nho nhat va nang cap neu gap OOM.

## Chung ta dang lam gi (noi don gian)?

- Thue mot may chu Linux nho (VPS Hetzner)
- Cai Docker (moi truong chay ung dung tach biet)
- Khoi dong OpenClaw Gateway trong Docker
- Luu ben vung `~/.openclaw` + `~/.openclaw/workspace` tren host (ton tai qua cac lan khoi dong/xay dung lai)
- Truy cap Control UI tu laptop qua SSH tunnel

Gateway co the duoc truy cap qua:

- Chuyen tiep cong SSH tu laptop
- Mo cong truc tiep neu ban tu quan ly firewall va token

Huong dan nay gia dinh Ubuntu hoac Debian tren Hetzner.  
Neu ban dung VPS Linux khac, hay anh xa goi tuong ung.
Voi luong Docker tong quat, xem [Docker](/install/docker).

---

## Duong nhanh (nguoi van hanh co kinh nghiem)

1. Tao VPS Hetzner
2. Cai Docker
3. Clone kho luu tru OpenClaw
4. Tao cac thu muc host luu ben vung
5. Cau hinh `.env` va `docker-compose.yml`
6. Dong san cac nhi phan can thiet vao image
7. `docker compose up -d`
8. Xac minh luu ben vung va truy cap Gateway

---

## Ban can gi

- VPS Hetzner co quyen root
- Truy cap SSH tu laptop
- Thoai mai co ban voi SSH + copy/paste
- ~20 phut
- Docker va Docker Compose
- Thong tin xac thuc mo hinh
- Thong tin nha cung cap tuy chon
  - WhatsApp QR
  - Telegram bot token
  - Gmail OAuth

---

## 1) Tao VPS

Tao mot VPS Ubuntu hoac Debian tren Hetzner.

Ket noi voi quyen root:

```bash
ssh root@YOUR_VPS_IP
```

Huong dan nay gia dinh VPS co tinh trang thai.
Khong coi no la ha tang co the bo di.

---

## 2) Cai Docker (tren VPS)

```bash
apt-get update
apt-get install -y git curl ca-certificates
curl -fsSL https://get.docker.com | sh
```

Xac minh:

```bash
docker --version
docker compose version
```

---

## 3) Clone kho luu tru OpenClaw

```bash
git clone https://github.com/openclaw/openclaw.git
cd openclaw
```

Huong dan nay gia dinh ban se xay dung mot image tuy chinh de dam bao luu ben vung nhi phan.

---

## 4) Tao cac thu muc host luu ben vung

Container Docker la tam thoi.
Tat ca trang thai lau dai phai nam tren host.

```bash
mkdir -p /root/.openclaw
mkdir -p /root/.openclaw/workspace

# Set ownership to the container user (uid 1000):
chown -R 1000:1000 /root/.openclaw
chown -R 1000:1000 /root/.openclaw/workspace
```

---

## 5) Cau hinh bien moi truong

Tao `.env` tai thu muc goc cua kho.

```bash
OPENCLAW_IMAGE=openclaw:latest
OPENCLAW_GATEWAY_TOKEN=change-me-now
OPENCLAW_GATEWAY_BIND=lan
OPENCLAW_GATEWAY_PORT=18789

OPENCLAW_CONFIG_DIR=/root/.openclaw
OPENCLAW_WORKSPACE_DIR=/root/.openclaw/workspace

GOG_KEYRING_PASSWORD=change-me-now
XDG_CONFIG_HOME=/home/node/.openclaw
```

Tao cac bi mat manh:

```bash
openssl rand -hex 32
```

**Khong commit tep nay.**

---

## 6) Cau hinh Docker Compose

Tao hoac cap nhat `docker-compose.yml`.

```yaml
services:
  openclaw-gateway:
    image: ${OPENCLAW_IMAGE}
    build: .
    restart: unless-stopped
    env_file:
      - .env
    environment:
      - HOME=/home/node
      - NODE_ENV=production
      - TERM=xterm-256color
      - OPENCLAW_GATEWAY_BIND=${OPENCLAW_GATEWAY_BIND}
      - OPENCLAW_GATEWAY_PORT=${OPENCLAW_GATEWAY_PORT}
      - OPENCLAW_GATEWAY_TOKEN=${OPENCLAW_GATEWAY_TOKEN}
      - GOG_KEYRING_PASSWORD=${GOG_KEYRING_PASSWORD}
      - XDG_CONFIG_HOME=${XDG_CONFIG_HOME}
      - PATH=/home/linuxbrew/.linuxbrew/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
    volumes:
      - ${OPENCLAW_CONFIG_DIR}:/home/node/.openclaw
      - ${OPENCLAW_WORKSPACE_DIR}:/home/node/.openclaw/workspace
    ports:
      # Recommended: keep the Gateway loopback-only on the VPS; access via SSH tunnel.
      # To expose it publicly, remove the `127.0.0.1:` prefix and firewall accordingly.
      - "127.0.0.1:${OPENCLAW_GATEWAY_PORT}:18789"

      # Optional: only if you run iOS/Android nodes against this VPS and need Canvas host.
      # If you expose this publicly, read /gateway/security and firewall accordingly.
      # - "18793:18793"
    command:
      [
        "node",
        "dist/index.js",
        "gateway",
        "--bind",
        "${OPENCLAW_GATEWAY_BIND}",
        "--port",
        "${OPENCLAW_GATEWAY_PORT}",
      ]
```

---

## 7) Dong san cac nhi phan can thiet vao image (quan trong)

Cai dat nhi phan ben trong container dang chay la mot cai bay.
Bat cu thu gi cai luc runtime se bi mat khi khoi dong lai.

Tat ca cac nhi phan ben ngoai ma Skills can phai duoc cai tai thoi diem build image.

Vi du duoi day chi minh hoa ba nhi phan pho bien:

- `gog` cho truy cap Gmail
- `goplaces` cho Google Places
- `wacli` cho WhatsApp

Day chi la vi du, khong phai danh sach day du.
Ban co the cai nhieu nhi phan tuy y theo cung mot mau.

Neu sau nay ban them Skills moi phu thuoc vao nhi phan bo sung, ban phai:

1. Cap nhat Dockerfile
2. Build lai image
3. Khoi dong lai cac container

**Vi du Dockerfile**

```dockerfile
FROM node:22-bookworm

RUN apt-get update && apt-get install -y socat && rm -rf /var/lib/apt/lists/*

# Example binary 1: Gmail CLI
RUN curl -L https://github.com/steipete/gog/releases/latest/download/gog_Linux_x86_64.tar.gz \
  | tar -xz -C /usr/local/bin && chmod +x /usr/local/bin/gog

# Example binary 2: Google Places CLI
RUN curl -L https://github.com/steipete/goplaces/releases/latest/download/goplaces_Linux_x86_64.tar.gz \
  | tar -xz -C /usr/local/bin && chmod +x /usr/local/bin/goplaces

# Example binary 3: WhatsApp CLI
RUN curl -L https://github.com/steipete/wacli/releases/latest/download/wacli_Linux_x86_64.tar.gz \
  | tar -xz -C /usr/local/bin && chmod +x /usr/local/bin/wacli

# Add more binaries below using the same pattern

WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY ui/package.json ./ui/package.json
COPY scripts ./scripts

RUN corepack enable
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build
RUN pnpm ui:install
RUN pnpm ui:build

ENV NODE_ENV=production

CMD ["node","dist/index.js"]
```

---

## 8) Build va khoi dong

```bash
docker compose build
docker compose up -d openclaw-gateway
```

Xac minh nhi phan:

```bash
docker compose exec openclaw-gateway which gog
docker compose exec openclaw-gateway which goplaces
docker compose exec openclaw-gateway which wacli
```

Ket qua mong doi:

```
/usr/local/bin/gog
/usr/local/bin/goplaces
/usr/local/bin/wacli
```

---

## 9) Xac minh Gateway

```bash
docker compose logs -f openclaw-gateway
```

Thanh cong:

```
[gateway] listening on ws://0.0.0.0:18789
```

Tu laptop cua ban:

```bash
ssh -N -L 18789:127.0.0.1:18789 root@YOUR_VPS_IP
```

Mo:

`http://127.0.0.1:18789/`

Dan token gateway cua ban.

---

## Cac thanh phan duoc luu o dau (nguon chan ly)

OpenClaw chay trong Docker, nhung Docker khong phai la nguon chan ly.
Tat ca trang thai lau dai phai ton tai qua cac lan khoi dong, xay dung lai va reboot.

| Thanh phan                | Vi tri                            | Co che luu ben vung    | Ghi chu                        |
| ------------------------- | --------------------------------- | ---------------------- | ------------------------------ |
| Cau hinh Gateway          | `/home/node/.openclaw/`           | Gan volume host        | Bao gom `openclaw.json`, token |
| Ho so xac thuc mo hinh    | `/home/node/.openclaw/`           | Gan volume host        | OAuth token, API key           |
| Cau hinh Skill            | `/home/node/.openclaw/skills/`    | Gan volume host        | Trang thai cap Skill           |
| Khong gian lam viec agent | `/home/node/.openclaw/workspace/` | Gan volume host        | Ma va hien vat agent           |
| Phien WhatsApp            | `/home/node/.openclaw/`           | Gan volume host        | Giu dang nhap QR               |
| Keyring Gmail             | `/home/node/.openclaw/`           | Volume host + mat khau | Yeu cau `GOG_KEYRING_PASSWORD` |
| Nhi phan ben ngoai        | `/usr/local/bin/`                 | Docker image           | Phai dong san khi build        |
| Node runtime              | He thong tep container            | Docker image           | Duoc build lai moi lan         |
| Goi he dieu hanh          | He thong tep container            | Docker image           | Khong cai luc runtime          |
| Docker container          | Tam thoi                          | Co the khoi dong lai   | An toan de huy                 |
