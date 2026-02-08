---
summary: "Cai dat OpenClaw (trinh cai dat duoc khuyen nghi, cai dat toan cuc, hoac tu ma nguon)"
read_when:
  - Cai dat OpenClaw
  - Ban muon cai dat tu GitHub
title: "Tong quan cai dat"
x-i18n:
  source_path: install/index.md
  source_hash: 228056bb0a2176b8
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:07:39Z
---

# Tong quan cai dat

Hay dung trinh cai dat tru khi ban co ly do khac. No se thiet lap CLI va chay huong dan ban dau.

## Cai dat nhanh (khuyen nghi)

```bash
curl -fsSL https://openclaw.ai/install.sh | bash
```

Windows (PowerShell):

```powershell
iwr -useb https://openclaw.ai/install.ps1 | iex
```

Buoc tiep theo (neu ban bo qua huong dan ban dau):

```bash
openclaw onboard --install-daemon
```

## Yeu cau he thong

- **Node >=22**
- macOS, Linux, hoac Windows qua WSL2
- `pnpm` chi can neu ban build tu ma nguon

## Chon cach cai dat

### 1) Script cai dat (khuyen nghi)

Cai dat `openclaw` toan cuc qua npm va chay huong dan ban dau.

```bash
curl -fsSL https://openclaw.ai/install.sh | bash
```

Cac co cua trinh cai dat:

```bash
curl -fsSL https://openclaw.ai/install.sh | bash -s -- --help
```

Chi tiet: [Noi bo trinh cai dat](/install/installer).

Khong tuong tac (bo qua huong dan ban dau):

```bash
curl -fsSL https://openclaw.ai/install.sh | bash -s -- --no-onboard
```

### 2) Cai dat toan cuc (thu cong)

Neu ban da co Node:

```bash
npm install -g openclaw@latest
```

Neu ban da cai dat libvips toan cuc (pho bien tren macOS qua Homebrew) va `sharp` khong cai dat duoc, hay buoc dung binary build san:

```bash
SHARP_IGNORE_GLOBAL_LIBVIPS=1 npm install -g openclaw@latest
```

Neu ban thay `sharp: Please add node-gyp to your dependencies`, hay cai dat cong cu build (macOS: Xcode CLT + `npm install -g node-gyp`) hoac dung giai phap `SHARP_IGNORE_GLOBAL_LIBVIPS=1` o tren de bo qua build native.

Hoac dung pnpm:

```bash
pnpm add -g openclaw@latest
pnpm approve-builds -g                # approve openclaw, node-llama-cpp, sharp, etc.
```

pnpm yeu cau phe duyet ro rang cho cac goi co script build. Sau lan cai dat dau tien hien canh bao "Ignored build scripts", hay chay `pnpm approve-builds -g` va chon cac goi duoc liet ke.

Sau do:

```bash
openclaw onboard --install-daemon
```

### 3) Tu ma nguon (nguoi dong gop/dev)

```bash
git clone https://github.com/openclaw/openclaw.git
cd openclaw
pnpm install
pnpm ui:build # auto-installs UI deps on first run
pnpm build
openclaw onboard --install-daemon
```

Meo: neu ban chua cai dat toan cuc, hay chay cac lenh trong repo bang `pnpm openclaw ...`.

De biet them ve quy trinh phat trien sau hon, xem [Setup](/start/setup).

### 4) Cac tuy chon cai dat khac

- Docker: [Docker](/install/docker)
- Nix: [Nix](/install/nix)
- Ansible: [Ansible](/install/ansible)
- Bun (chi CLI): [Bun](/install/bun)

## Sau khi cai dat

- Chay huong dan ban dau: `openclaw onboard --install-daemon`
- Kiem tra nhanh: `openclaw doctor`
- Kiem tra suc khoe Gateway: `openclaw status` + `openclaw health`
- Mo bang dieu khien: `openclaw dashboard`

## Phuong thuc cai dat: npm vs git (trinh cai dat)

Trinh cai dat ho tro hai phuong thuc:

- `npm` (mac dinh): `npm install -g openclaw@latest`
- `git`: clone/build tu GitHub va chay tu ban checkout ma nguon

### Co CLI

```bash
# Explicit npm
curl -fsSL https://openclaw.ai/install.sh | bash -s -- --install-method npm

# Install from GitHub (source checkout)
curl -fsSL https://openclaw.ai/install.sh | bash -s -- --install-method git
```

Cac co pho bien:

- `--install-method npm|git`
- `--git-dir <path>` (mac dinh: `~/openclaw`)
- `--no-git-update` (bo qua `git pull` khi dung checkout co san)
- `--no-prompt` (tat prompt; bat buoc trong CI/tu dong hoa)
- `--dry-run` (in ra nhung gi se xay ra; khong thay doi gi)
- `--no-onboard` (bo qua huong dan ban dau)

### Bien moi truong

Cac bien moi truong tuong duong (huu ich cho tu dong hoa):

- `OPENCLAW_INSTALL_METHOD=git|npm`
- `OPENCLAW_GIT_DIR=...`
- `OPENCLAW_GIT_UPDATE=0|1`
- `OPENCLAW_NO_PROMPT=1`
- `OPENCLAW_DRY_RUN=1`
- `OPENCLAW_NO_ONBOARD=1`
- `SHARP_IGNORE_GLOBAL_LIBVIPS=0|1` (mac dinh: `1`; tranh `sharp` build dua tren libvips cua he thong)

## Xu ly su co: khong tim thay `openclaw` (PATH)

Chan doan nhanh:

```bash
node -v
npm -v
npm prefix -g
echo "$PATH"
```

Neu `$(npm prefix -g)/bin` (macOS/Linux) hoac `$(npm prefix -g)` (Windows) **khong** ton tai ben trong `echo "$PATH"`, shell cua ban khong the tim cac binary npm toan cuc (bao gom `openclaw`).

Cach sua: them no vao file khoi dong shell (zsh: `~/.zshrc`, bash: `~/.bashrc`):

```bash
# macOS / Linux
export PATH="$(npm prefix -g)/bin:$PATH"
```

Tren Windows, them ket qua cua `npm prefix -g` vao PATH.

Sau do mo terminal moi (hoac `rehash` trong zsh / `hash -r` trong bash).

## Cap nhat / go cai dat

- Cap nhat: [Updating](/install/updating)
- Chuyen sang may moi: [Migrating](/install/migrating)
- Go cai dat: [Uninstall](/install/uninstall)
