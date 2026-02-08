---
summary: "Truy cap tu xa bang duong ham SSH (Gateway WS) va tailnet"
read_when:
  - Van hanh hoac xu ly su co cac thiet lap Gateway tu xa
title: "Truy cap tu xa"
x-i18n:
  source_path: gateway/remote.md
  source_hash: 449d406f88c53dcc
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:07:32Z
---

# Truy cap tu xa (SSH, duong ham, va tailnet)

Repo nay ho tro “truy cap tu xa qua SSH” bang cach duy tri mot Gateway (master) duy nhat chay tren mot may chu/may ban rieng, va ket noi cac client toi no.

- Doi voi **nguoi van hanh (ban / ung dung macOS)**: duong ham SSH la phuong an du phong pho bien.
- Doi voi **node (iOS/Android va cac thiet bi tuong lai)**: ket noi toi **Gateway WebSocket** (LAN/tailnet hoac duong ham SSH khi can).

## Y tuong cot loi

- Gateway WebSocket bind vao **loopback** tren cong da cau hinh (mac dinh 18789).
- De su dung tu xa, ban forward cong loopback do qua SSH (hoac dung tailnet/VPN de giam can thiet phai tunnel).

## Cac thiet lap VPN/tailnet pho bien (noi agent chay)

Hay xem **may chu Gateway** la “noi agent ton tai.” No so huu session, cau hinh xac thuc, kenh va trang thai.
Laptop/desktop cua ban (va cac node) ket noi toi may chu do.

### 1) Gateway luon hoat dong trong tailnet (VPS hoac may chu tai nha)

Chay Gateway tren mot may chu on dinh va truy cap qua **Tailscale** hoac SSH.

- **UX tot nhat:** giu `gateway.bind: "loopback"` va dung **Tailscale Serve** cho Control UI.
- **Du phong:** giu loopback + duong ham SSH tu bat ky may nao can truy cap.
- **Vi du:** [exe.dev](/install/exe-dev) (VM de dung) hoac [Hetzner](/install/hetzner) (VPS san xuat).

Phu hop khi laptop cua ban hay ngu nhung ban muon agent luon hoat dong.

### 2) May tinh de ban tai nha chay Gateway, laptop la bo dieu khien tu xa

Laptop **khong** chay agent. No ket noi tu xa:

- Dung che do **Remote over SSH** cua ung dung macOS (Settings → General → “OpenClaw runs”).
- Ung dung tu dong mo va quan ly duong ham, nen WebChat + kiem tra suc khoe hoat dong “ngay lap tuc.”

Runbook: [macOS remote access](/platforms/mac/remote).

### 3) Laptop chay Gateway, truy cap tu xa tu cac may khac

Giu Gateway cuc bo nhung mo truy cap an toan:

- Tao duong ham SSH toi laptop tu cac may khac, hoac
- Dung Tailscale Serve cho Control UI va giu Gateway chi bind loopback.

Huong dan: [Tailscale](/gateway/tailscale) va [Web overview](/web).

## Luong lenh (cai gi chay o dau)

Mot dich vu gateway duy nhat so huu trang thai + kenh. Node chi la thiet bi ngoai vi.

Vi du luong (Telegram → node):

- Tin nhan Telegram toi **Gateway**.
- Gateway chay **agent** va quyet dinh co goi cong cu node hay khong.
- Gateway goi **node** qua Gateway WebSocket (RPC `node.*`).
- Node tra ket qua; Gateway gui phan hoi nguoc lai Telegram.

Ghi chu:

- **Node khong chay dich vu gateway.** Chi nen co mot gateway tren moi host, tru khi ban co chu y chay cac cau hinh co lap (xem [Multiple gateways](/gateway/multiple-gateways)).
- Che do “node mode” cua ung dung macOS chi la mot client node qua Gateway WebSocket.

## Duong ham SSH (CLI + cong cu)

Tao duong ham cuc bo toi Gateway WS tu xa:

```bash
ssh -N -L 18789:127.0.0.1:18789 user@host
```

Khi duong ham da mo:

- `openclaw health` va `openclaw status --deep` se truy cap gateway tu xa qua `ws://127.0.0.1:18789`.
- `openclaw gateway {status,health,send,agent,call}` cung co the nham toi URL da forward qua `--url` khi can.

Luu y: thay `18789` bang `gateway.port` da cau hinh (hoac `--port`/`OPENCLAW_GATEWAY_PORT`).
Luu y: khi ban truyen `--url`, CLI se khong tu dong dung cau hinh hay thong tin xac thuc tu bien moi truong.
Hay chi ro `--token` hoac `--password`. Thieu thong tin xac thuc ro rang se gay loi.

## Gia tri mac dinh tu xa cho CLI

Ban co the luu dich tieu tu xa de cac lenh CLI dung mac dinh:

```json5
{
  gateway: {
    mode: "remote",
    remote: {
      url: "ws://127.0.0.1:18789",
      token: "your-token",
    },
  },
}
```

Khi gateway chi bind loopback, hay giu URL o `ws://127.0.0.1:18789` va mo duong ham SSH truoc.

## Chat UI qua SSH

WebChat khong con dung cong HTTP rieng. UI chat SwiftUI ket noi truc tiep toi Gateway WebSocket.

- Forward `18789` qua SSH (xem o tren), sau do ket noi client toi `ws://127.0.0.1:18789`.
- Tren macOS, nen dung che do “Remote over SSH” cua ung dung, vi no tu dong quan ly duong ham.

## Ung dung macOS “Remote over SSH”

Ung dung thanh menu macOS co the thiet lap toan bo quy trinh tu dau den cuoi (kiem tra trang thai tu xa, WebChat, va forward Voice Wake).

Runbook: [macOS remote access](/platforms/mac/remote).

## Quy tac bao mat (tu xa/VPN)

Tom tat: **giu Gateway chi bind loopback** tru khi ban chac chan can mo bind.

- **Loopback + SSH/Tailscale Serve** la mac dinh an toan nhat (khong lo cong khai).
- **Bind khong phai loopback** (`lan`/`tailnet`/`custom`, hoac `auto` khi loopback khong kha dung) bat buoc phai dung token/mat khau.
- `gateway.remote.token` **chi** dung cho cac cuoc goi CLI tu xa — **khong** kich hoat xac thuc cuc bo.
- `gateway.remote.tlsFingerprint` co dinh chung chi TLS tu xa khi dung `wss://`.
- **Tailscale Serve** co the xac thuc bang header dinh danh khi `gateway.auth.allowTailscale: true`.
  Dat no thanh `false` neu ban muon dung token/mat khau thay the.
- Doi xu quyen dieu khien qua trinh duyet giong quyen cua nguoi van hanh: chi tailnet + ghep node co chu y.

Dao sau: [Security](/gateway/security).
