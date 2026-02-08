---
title: "Node.js + npm (kiem tra PATH)"
summary: "Kiem tra cai dat Node.js + npm: phien ban, PATH va cai dat toan cuc"
read_when:
  - "Ban da cai dat OpenClaw nhung `openclaw` bao “command not found”"
  - "Ban dang thiet lap Node.js/npm tren mot may moi"
  - "npm install -g ... that bai do quyen hoac van de PATH"
x-i18n:
  source_path: install/node.md
  source_hash: 9f6d83be362e3e14
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:07:38Z
---

# Node.js + npm (kiem tra PATH)

Nen tang runtime cua OpenClaw la **Node 22+**.

Neu ban co the chay `npm install -g openclaw@latest` nhung sau do lai thay `openclaw: command not found`, thi gan nhu luon la van de **PATH**: thu muc ma npm dat cac binary toan cuc khong nam trong PATH cua shell.

## Chan doan nhanh

Chay:

```bash
node -v
npm -v
npm prefix -g
echo "$PATH"
```

Neu `$(npm prefix -g)/bin` (macOS/Linux) hoac `$(npm prefix -g)` (Windows) **khong** xuat hien ben trong `echo "$PATH"`, shell cua ban khong the tim thay cac binary npm toan cuc (bao gom ca `openclaw`).

## Khac phuc: dua thu muc bin toan cuc cua npm vao PATH

1. Tim prefix npm toan cuc cua ban:

```bash
npm prefix -g
```

2. Them thu muc bin toan cuc cua npm vao file khoi dong shell:

- zsh: `~/.zshrc`
- bash: `~/.bashrc`

Vi du (thay duong dan bang ket qua tu `npm prefix -g` cua ban):

```bash
# macOS / Linux
export PATH="/path/from/npm/prefix/bin:$PATH"
```

Sau do mo **mot terminal moi** (hoac chay `rehash` trong zsh / `hash -r` trong bash).

Tren Windows, them ket qua cua `npm prefix -g` vao PATH.

## Khac phuc: tranh loi `sudo npm install -g` / loi quyen (Linux)

Neu `npm install -g ...` that bai voi `EACCES`, hay chuyen prefix toan cuc cua npm sang mot thu muc ma nguoi dung co quyen ghi:

```bash
mkdir -p "$HOME/.npm-global"
npm config set prefix "$HOME/.npm-global"
export PATH="$HOME/.npm-global/bin:$PATH"
```

Luu dong `export PATH=...` vao file khoi dong shell cua ban.

## Lua chon cai dat Node duoc khuyen nghi

Ban se gap it bat ngo nhat neu Node/npm duoc cai dat theo cach:

- giu Node luon duoc cap nhat (22+)
- dam bao thu muc bin npm toan cuc on dinh va co trong PATH khi mo shell moi

Cac lua chon pho bien:

- macOS: Homebrew (`brew install node`) hoac trinh quan ly phien ban
- Linux: trinh quan ly phien ban ban ua thich, hoac cai dat duoc ho tro boi distro cung cap Node 22+
- Windows: trinh cai dat Node chinh thuc, `winget`, hoac trinh quan ly phien ban Node cho Windows

Neu ban dung trinh quan ly phien ban (nvm/fnm/asdf/etc), hay dam bao no duoc khoi tao trong shell ban dung hang ngay (zsh hay bash) de PATH ma no thiet lap co hieu luc khi ban chay cac trinh cai dat.
