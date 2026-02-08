---
summary: "Tham chieu CLI cho `openclaw browser` (ho so, tab, hanh dong, Chrome extension relay)"
read_when:
  - Ban su dung `openclaw browser` va muon vi du cho cac tac vu pho bien
  - Ban muon dieu khien trinh duyet dang chay tren may khac thong qua node host
  - Ban muon su dung Chrome extension relay (gan/tach qua nut thanh cong cu)
title: "trinh duyet"
x-i18n:
  source_path: cli/browser.md
  source_hash: af35adfd68726fd5
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:06:24Z
---

# `openclaw browser`

Quan ly may chu dieu khien trinh duyet cua OpenClaw va chay cac hanh dong trinh duyet (tab, snapshot, screenshot, dieu huong, nhap, click).

Lien quan:

- Cong cu + API trinh duyet: [Browser tool](/tools/browser)
- Chrome extension relay: [Chrome extension](/tools/chrome-extension)

## Co thong so pho bien

- `--url <gatewayWsUrl>`: URL WebSocket cua Gateway (mac dinh tu cau hinh).
- `--token <token>`: token Gateway (neu can).
- `--timeout <ms>`: thoi gian cho yeu cau (ms).
- `--browser-profile <name>`: chon ho so trinh duyet (mac dinh tu cau hinh).
- `--json`: dau ra doc duoc bang may (neu ho tro).

## Khoi dong nhanh (local)

```bash
openclaw browser --browser-profile chrome tabs
openclaw browser --browser-profile openclaw start
openclaw browser --browser-profile openclaw open https://example.com
openclaw browser --browser-profile openclaw snapshot
```

## Ho so

Ho so la cac cau hinh dinh tuyen trinh duyet duoc dat ten. Tren thuc te:

- `openclaw`: khoi chay/gan vao mot phien ban Chrome do OpenClaw quan ly rieng (thu muc du lieu nguoi dung co lap).
- `chrome`: dieu khien cac tab Chrome hien co cua ban thong qua Chrome extension relay.

```bash
openclaw browser profiles
openclaw browser create-profile --name work --color "#FF5A36"
openclaw browser delete-profile --name work
```

Su dung mot ho so cu the:

```bash
openclaw browser --browser-profile work tabs
```

## Tab

```bash
openclaw browser tabs
openclaw browser open https://docs.openclaw.ai
openclaw browser focus <targetId>
openclaw browser close <targetId>
```

## Snapshot / screenshot / hanh dong

Snapshot:

```bash
openclaw browser snapshot
```

Screenshot:

```bash
openclaw browser screenshot
```

Dieu huong/click/nhap (tu dong hoa UI dua tren ref):

```bash
openclaw browser navigate https://example.com
openclaw browser click <ref>
openclaw browser type <ref> "hello"
```

## Chrome extension relay (gan qua nut thanh cong cu)

Che do nay cho phep tac tu dieu khien mot tab Chrome hien co ma ban gan thu cong (khong tu dong gan).

Cai dat extension dang unpacked toi mot duong dan on dinh:

```bash
openclaw browser extension install
openclaw browser extension path
```

Sau do Chrome → `chrome://extensions` → bat “Developer mode” → “Load unpacked” → chon thu muc da in ra.

Huong dan day du: [Chrome extension](/tools/chrome-extension)

## Dieu khien trinh duyet tu xa (node host proxy)

Neu Gateway chay tren mot may khac voi trinh duyet, hay chay mot **node host** tren may co Chrome/Brave/Edge/Chromium. Gateway se proxy cac hanh dong trinh duyet toi node do (khong can may chu dieu khien trinh duyet rieng).

Su dung `gateway.nodes.browser.mode` de dieu khien tuyen duong tu dong va `gateway.nodes.browser.node` de co dinh mot node cu the neu co nhieu node ket noi.

Bao mat + thiet lap tu xa: [Browser tool](/tools/browser), [Remote access](/gateway/remote), [Tailscale](/gateway/tailscale), [Security](/gateway/security)
