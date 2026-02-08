---
summary: "Kien truc IPC macOS cho ung dung OpenClaw, van chuyen nut Gateway va PeekabooBridge"
read_when:
  - Chinh sua hop dong IPC hoac IPC cua ung dung thanh menu
title: "IPC macOS"
x-i18n:
  source_path: platforms/mac/xpc.md
  source_hash: d0211c334a4a59b7
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:08:04Z
---

# Kien truc IPC macOS cua OpenClaw

**Mo hinh hien tai:** mot socket Unix cuc bo ket noi **node host service** voi **ung dung macOS** de phe duyet exec + `system.run`. Mot CLI debug `openclaw-mac` ton tai cho viec kham pha/kiem tra ket noi; cac hanh dong cua tac tu van di qua Gateway WebSocket va `node.invoke`. Tu dong hoa UI su dung PeekabooBridge.

## Muc tieu

- Mot the hien GUI duy nhat so huu tat ca cong viec lien quan den TCC (thong bao, ghi man hinh, mic, giong noi, AppleScript).
- Be mat tu dong hoa nho gon: Gateway + cac lenh node, cong them PeekabooBridge cho tu dong hoa UI.
- Quyen han co the doan truoc: luon cung bundle ID da ky, duoc launchd khoi chay, de quyen TCC duoc giu on dinh.

## Cach hoat dong

### Gateway + van chuyen node

- Ung dung chay Gateway (che do local) va ket noi den no nhu mot node.
- Cac hanh dong cua tac tu duoc thuc hien qua `node.invoke` (vi du: `system.run`, `system.notify`, `canvas.*`).

### Dich vu node + IPC ung dung

- Mot node host service khong giao dien ket noi den Gateway WebSocket.
- Cac yeu cau `system.run` duoc chuyen tiep den ung dung macOS qua mot socket Unix cuc bo.
- Ung dung thuc hien exec trong ngu canh UI, hien hop thoai neu can, va tra ve ket qua.

So do (SCI):

```
Agent -> Gateway -> Node Service (WS)
                      |  IPC (UDS + token + HMAC + TTL)
                      v
                  Mac App (UI + TCC + system.run)
```

### PeekabooBridge (tu dong hoa UI)

- Tu dong hoa UI su dung mot socket UNIX rieng ten `bridge.sock` va giao thuc JSON cua PeekabooBridge.
- Thu tu uu tien host (phia client): Peekaboo.app → Claude.app → OpenClaw.app → thuc thi local.
- Bao mat: cac bridge host yeu cau TeamID duoc cho phep; loi thoat cung UID chi trong DEBUG duoc bao ve boi `PEEKABOO_ALLOW_UNSIGNED_SOCKET_CLIENTS=1` (quy uoc Peekaboo).
- Xem: [Su dung PeekabooBridge](/platforms/mac/peekaboo) de biet them chi tiet.

## Cac luong van hanh

- Khoi dong lai/xay dung lai: `SIGN_IDENTITY="Apple Development: <Developer Name> (<TEAMID>)" scripts/restart-mac.sh`
  - Dung cac the hien hien co
  - Xay dung Swift + dong goi
  - Ghi/bootstraps/kickstarts LaunchAgent
- Don the hien: ung dung thoat som neu phat hien mot the hien khac voi cung bundle ID dang chay.

## Ghi chu cung co bao mat

- Uu tien yeu cau khop TeamID cho tat ca cac be mat co dac quyen.
- PeekabooBridge: `PEEKABOO_ALLOW_UNSIGNED_SOCKET_CLIENTS=1` (chi DEBUG) co the cho phep ben goi cung UID cho phat trien local.
- Tat ca giao tiep deu chi local; khong mo cong mang.
- Cac hop thoai TCC chi xuat phat tu bundle GUI; giu on dinh bundle ID da ky qua cac lan xay dung lai.
- Cung co IPC: quyen socket `0600`, token, kiem tra UID doi tac, thach thuc/phan hoi HMAC, TTL ngan.
