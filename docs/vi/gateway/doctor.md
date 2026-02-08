---
summary: "Lenh Doctor: kiem tra suc khoe, di chuyen cau hinh, va cac buoc sua chua"
read_when:
  - Them hoac dieu chinh cac migration cua doctor
  - Gioi thieu cac thay doi cau hinh gay pha vo tuong thich
title: "Doctor"
x-i18n:
  source_path: gateway/doctor.md
  source_hash: df7b25f60fd08d50
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:07:49Z
---

# Doctor

`openclaw doctor` la cong cu sua chua + migration cho OpenClaw. No khac phuc
cau hinh/trang thai loi thoi, kiem tra suc khoe, va dua ra cac buoc sua chua co the thuc hien.

## Quick start

```bash
openclaw doctor
```

### Headless / automation

```bash
openclaw doctor --yes
```

Chap nhan gia tri mac dinh ma khong hoi (bao gom cac buoc khoi dong lai/dich vu/sandbox khi ap dung).

```bash
openclaw doctor --repair
```

Ap dung cac sua chua duoc khuyen nghi ma khong hoi (sua chua + khoi dong lai khi an toan).

```bash
openclaw doctor --repair --force
```

Ap dung ca cac sua chua manh (ghi de cau hinh supervisor tuy chinh).

```bash
openclaw doctor --non-interactive
```

Chay khong hoi va chi ap dung cac migration an toan (chuan hoa cau hinh + di chuyen trang thai tren dia). Bo qua cac hanh dong khoi dong lai/dich vu/sandbox can xac nhan cua con nguoi.
Cac migration trang thai cu se tu dong chay khi duoc phat hien.

```bash
openclaw doctor --deep
```

Quet cac dich vu he thong de tim cac cai dat gateway du thua (launchd/systemd/schtasks).

Neu ban muon xem lai cac thay doi truoc khi ghi, hay mo file cau hinh truoc:

```bash
cat ~/.openclaw/openclaw.json
```

## What it does (summary)

- Cap nhat truoc khi chay (tuy chon) cho cac cai dat git (chi tuong tac).
- Kiem tra do moi cua giao thuc UI (xay dung lai Control UI khi schema giao thuc moi hon).
- Kiem tra suc khoe + goi y khoi dong lai.
- Tong hop trang thai Skills (du dieu kien/thieu/bi chan).
- Chuan hoa cau hinh cho cac gia tri loi thoi.
- Canh bao ghi de nha cung cap OpenCode Zen (`models.providers.opencode`).
- Migration trang thai tren dia cu (sessions/thu muc agent/xac thuc WhatsApp).
- Kiem tra tinh toan ven va quyen han trang thai (sessions, transcripts, thu muc state).
- Kiem tra quyen file cau hinh (chmod 600) khi chay cuc bo.
- Suc khoe xac thuc model: kiem tra het han OAuth, co the lam moi token sap het han, va bao cao trang thai cooldown/bi vo hieu hoa cua ho so xac thuc.
- Phat hien thu muc workspace du (`~/openclaw`).
- Sua chua image Sandbox khi sandboxing duoc bat.
- Migration dich vu cu va phat hien gateway du.
- Kiem tra runtime Gateway (dich vu da cai nhung khong chay; launchd label duoc cache).
- Canh bao trang thai kenh (tham do tu gateway dang chay).
- Kiem toan cau hinh supervisor (launchd/systemd/schtasks) voi tuy chon sua chua.
- Kiem tra thuc hanh tot runtime Gateway (Node vs Bun, duong dan trinh quan ly phien ban).
- Chan doan xung dot cong Gateway (mac dinh `18789`).
- Canh bao bao mat cho cac chinh sach DM mo.
- Canh bao xac thuc Gateway khi khong dat `gateway.auth.token` (che do cuc bo; de xuat tao token).
- Kiem tra systemd linger tren Linux.
- Kiem tra cai dat tu nguon (khong khop pnpm workspace, thieu tai nguyen UI, thieu binary tsx).
- Ghi cau hinh da cap nhat + metadata cua wizard.

## Detailed behavior and rationale

### 0) Optional update (git installs)

Neu day la mot ban checkout git va doctor chay o che do tuong tac, no se de xuat
cap nhat (fetch/rebase/build) truoc khi chay doctor.

### 1) Config normalization

Neu cau hinh chua cac dang gia tri loi thoi (vi du `messages.ackReaction`
ma khong co ghi de theo kenh), doctor se chuan hoa chung theo schema hien tai.

### 2) Legacy config key migrations

Khi cau hinh chua cac khoa da bi loai bo, cac lenh khac se tu choi chay va yeu cau
ban chay `openclaw doctor`.

Doctor se:

- Giai thich cac khoa loi thoi da tim thay.
- Hien thi migration da ap dung.
- Ghi lai `~/.openclaw/openclaw.json` voi schema da cap nhat.

Gateway cung tu dong chay cac migration cua doctor khi khoi dong neu phat hien
dinh dang cau hinh cu, de sua chua cau hinh loi thoi ma khong can can thiep thu cong.

Cac migration hien tai:

- `routing.allowFrom` → `channels.whatsapp.allowFrom`
- `routing.groupChat.requireMention` → `channels.whatsapp/telegram/imessage.groups."*".requireMention`
- `routing.groupChat.historyLimit` → `messages.groupChat.historyLimit`
- `routing.groupChat.mentionPatterns` → `messages.groupChat.mentionPatterns`
- `routing.queue` → `messages.queue`
- `routing.bindings` → cap cao nhat `bindings`
- `routing.agents`/`routing.defaultAgentId` → `agents.list` + `agents.list[].default`
- `routing.agentToAgent` → `tools.agentToAgent`
- `routing.transcribeAudio` → `tools.media.audio.models`
- `bindings[].match.accountID` → `bindings[].match.accountId`
- `identity` → `agents.list[].identity`
- `agent.*` → `agents.defaults` + `tools.*` (tools/elevated/exec/sandbox/subagents)
- `agent.model`/`allowedModels`/`modelAliases`/`modelFallbacks`/`imageModelFallbacks`
  → `agents.defaults.models` + `agents.defaults.model.primary/fallbacks` + `agents.defaults.imageModel.primary/fallbacks`

### 2b) OpenCode Zen provider overrides

Neu ban da tu them `models.providers.opencode` (hoac `opencode-zen`) thu cong, no
se ghi de danh muc OpenCode Zen tich hop tu `@mariozechner/pi-ai`. Dieu do co the
ep moi model dung mot API duy nhat hoac dua chi phi ve 0. Doctor canh bao de ban
co the go bo ghi de va khoi phuc dinh tuyen API + chi phi theo tung model.

### 3) Legacy state migrations (disk layout)

Doctor co the di chuyen cac bo cuc tren dia cu sang cau truc hien tai:

- Kho sessions + transcripts:
  - tu `~/.openclaw/sessions/` sang `~/.openclaw/agents/<agentId>/sessions/`
- Thu muc agent:
  - tu `~/.openclaw/agent/` sang `~/.openclaw/agents/<agentId>/agent/`
- Trang thai xac thuc WhatsApp (Baileys):
  - tu `~/.openclaw/credentials/*.json` cu (tru `oauth.json`)
  - sang `~/.openclaw/credentials/whatsapp/<accountId>/...` (id tai khoan mac dinh: `default`)

Cac migration nay co tinh tot nhat co the va idempotent; doctor se phat canh bao
khi de lai bat ky thu muc cu nao nhu ban sao luu. Gateway/CLI cung tu dong di chuyen
sessions + thu muc agent cu khi khoi dong de lich su/xac thuc/model nam trong
duong dan theo agent ma khong can chay doctor thu cong. Xac thuc WhatsApp chu y
chi duoc di chuyen thong qua `openclaw doctor`.

### 4) State integrity checks (session persistence, routing, and safety)

Thu muc state la trung tam van hanh. Neu no bien mat, ban se mat
sessions, thong tin dang nhap, log, va cau hinh (tru khi co sao luu o noi khac).

Doctor kiem tra:

- **Thieu thu muc state**: canh bao mat trang thai nghiem trong, de xuat tao lai
  thu muc, va nhac rang khong the khoi phuc du lieu da mat.
- **Quyen thu muc state**: xac minh quyen ghi; de xuat sua quyen
  (va dua ra goi y `chown` khi phat hien lech chu so huu/nhom).
- **Thieu thu muc session**: `sessions/` va thu muc session store
  la bat buoc de luu lich su va tranh loi `ENOENT`.
- **Lech transcript**: canh bao khi cac muc session gan day thieu file transcript.
- **Main session “1-line JSONL”**: danh dau khi transcript chinh chi co mot dong
  (lich su khong tich luy).
- **Nhieu thu muc state**: canh bao khi ton tai nhieu thu muc `~/.openclaw`
  tren cac thu muc home khac nhau hoac khi `OPENCLAW_STATE_DIR` chi den noi khac
  (lich su co the bi tach giua cac cai dat).
- **Nhac nho che do tu xa**: neu `gateway.mode=remote`, doctor nhac ban chay
  no tren may chu tu xa (state nam o do).
- **Quyen file cau hinh**: canh bao neu `~/.openclaw/openclaw.json`
  co the doc boi group/world va de xuat that chat ve `600`.

### 5) Model auth health (OAuth expiry)

Doctor kiem tra cac ho so OAuth trong kho xac thuc, canh bao khi token
sap het han/da het han, va co the lam moi khi an toan. Neu ho so Anthropic Claude Code
bi loi thoi, no de xuat chay `claude setup-token` (hoac dan token thiet lap).
Cac nhac lam moi chi xuat hien khi chay tuong tac (TTY); `--non-interactive`
bo qua cac lan thu lam moi.

Doctor cung bao cao cac ho so xac thuc tam thoi khong su dung duoc do:

- cooldown ngan (gioi han toc do/timeout/loi xac thuc)
- vo hieu hoa dai hon (loi thanh toan/credit)

### 6) Hooks model validation

Neu `hooks.gmail.model` duoc dat, doctor xac thuc tham chieu model voi
danh muc va allowlist va canh bao khi no khong the giai quyet hoac bi cam.

### 7) Sandbox image repair

Khi sandboxing duoc bat, doctor kiem tra Docker image va de xuat build hoac
chuyen sang ten cu neu image hien tai bi thieu.

### 8) Gateway service migrations and cleanup hints

Doctor phat hien cac dich vu gateway cu (launchd/systemd/schtasks) va
de xuat go bo chung va cai dat dich vu OpenClaw su dung cong gateway hien tai.
No cung co the quet cac dich vu giong gateway du va in ra goi y don dep.
Cac dich vu OpenClaw gateway dat ten theo profile duoc coi la hop le va
khong bi danh dau la "du".

### 9) Security warnings

Doctor phat canh bao khi nha cung cap mo DMs ma khong co allowlist, hoac
khi chinh sach duoc cau hinh theo cach nguy hiem.

### 10) systemd linger (Linux)

Neu chay duoi dang systemd user service, doctor dam bao linger duoc bat
de gateway tiep tuc chay sau khi dang xuat.

### 11) Skills status

Doctor in ra tong hop nhanh ve cac skills du dieu kien/thieu/bi chan cho workspace hien tai.

### 12) Gateway auth checks (local token)

Doctor canh bao khi `gateway.auth` bi thieu tren gateway cuc bo va de xuat
tao token. Su dung `openclaw doctor --generate-gateway-token` de bat buoc tao token
trong automation.

### 13) Gateway health check + restart

Doctor chay kiem tra suc khoe va de xuat khoi dong lai gateway khi co dau hieu
khong lanh manh.

### 14) Channel status warnings

Neu gateway lanh manh, doctor chay tham do trang thai kenh va bao cao
cac canh bao kem goi y khac phuc.

### 15) Supervisor config audit + repair

Doctor kiem tra cau hinh supervisor da cai (launchd/systemd/schtasks) de tim
cac mac dinh bi thieu hoac loi thoi (vi du, phu thuoc network-online cua systemd
va do tre khoi dong lai). Khi phat hien khong khop, no de xuat cap nhat va co the
ghi lai file dich vu/task theo mac dinh hien tai.

Ghi chu:

- `openclaw doctor` hoi truoc khi ghi lai cau hinh supervisor.
- `openclaw doctor --yes` chap nhan cac goi y sua chua mac dinh.
- `openclaw doctor --repair` ap dung cac sua chua duoc khuyen nghi ma khong hoi.
- `openclaw doctor --repair --force` ghi de cau hinh supervisor tuy chinh.
- Ban luon co the bat buoc ghi lai day du qua `openclaw gateway install --force`.

### 16) Gateway runtime + port diagnostics

Doctor kiem tra runtime dich vu (PID, trang thai thoat gan nhat) va canh bao khi
dich vu da cai nhung thuc te khong chay. No cung kiem tra xung dot cong
tren cong gateway (mac dinh `18789`) va bao cao nguyen nhan kha nghi
(gateway da chay, SSH tunnel).

### 17) Gateway runtime best practices

Doctor canh bao khi dich vu gateway chay tren Bun hoac duong dan Node duoc quan ly
boi trinh quan ly phien ban (`nvm`, `fnm`, `volta`, `asdf`, v.v.). Cac kenh WhatsApp + Telegram can Node,
va duong dan trinh quan ly phien ban co the bi loi sau khi nang cap vi dich vu
khong tai shell init. Doctor de xuat chuyen sang Node he thong khi co san
(Homebrew/apt/choco).

### 18) Config write + wizard metadata

Doctor luu lai moi thay doi cau hinh va dong dau metadata cua wizard de ghi nhan lan chay doctor.

### 19) Workspace tips (backup + memory system)

Doctor de xuat he thong bo nho workspace khi thieu va in meo sao luu
neu workspace chua nam duoi git.

Xem [/concepts/agent-workspace](/concepts/agent-workspace) de biet them chi tiet ve
cau truc workspace va sao luu git (khuyen nghi GitHub hoac GitLab rieng tu).
