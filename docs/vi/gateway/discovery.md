---
summary: "Kham pha nut va cac phuong thuc truyen tai (Bonjour, Tailscale, SSH) de tim Gateway"
read_when:
  - Trien khai hoac thay doi co che kham pha/quang cao Bonjour
  - Dieu chinh cac che do ket noi tu xa (truc tiep vs SSH)
  - Thiet ke kham pha nut + ghep cap cho cac nut tu xa
title: "Kham pha va Truyen tai"
x-i18n:
  source_path: gateway/discovery.md
  source_hash: e12172c181515bfa
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:07:24Z
---

# Discovery & transports

OpenClaw co hai van de rieng biet, be ngoai trong giong nhau:

1. **Dieu khien tu xa cua nguoi van hanh**: ung dung menu bar macOS dieu khien mot gateway chay o noi khac.
2. **Ghep cap nut**: iOS/Android (va cac nut tuong lai) tim mot gateway va ghep cap an toan.

Muc tieu thiet ke la giu toan bo kham pha/quang cao mang trong **Node Gateway** (`openclaw gateway`) va giu cac client (ung dung mac, iOS) o vai tro nguoi tieu thu.

## Thuat ngu

- **Gateway**: mot tien trinh gateway chay dai han, so huu trang thai (phien, ghep cap, so dang ky nut) va chay cac kenh. Phan lon thiet lap dung mot gateway moi host; cac thiet lap nhieu gateway tach biet la co the.
- **Gateway WS (control plane)**: diem cuoi WebSocket mac dinh tai `127.0.0.1:18789`; co the bind vao LAN/tailnet thong qua `gateway.bind`.
- **Direct WS transport**: diem cuoi Gateway WS huong LAN/tailnet (khong SSH).
- **SSH transport (fallback)**: dieu khien tu xa bang cach chuyen tiep `127.0.0.1:18789` qua SSH.
- **Legacy TCP bridge (deprecated/removed)**: truyen tai nut cu (xem [Bridge protocol](/gateway/bridge-protocol)); khong con duoc quang cao cho kham pha.

Chi tiet giao thuc:

- [Gateway protocol](/gateway/protocol)
- [Bridge protocol (legacy)](/gateway/bridge-protocol)

## Vi sao chung toi giu ca “direct” va SSH

- **Direct WS** mang lai UX tot nhat tren cung mang va trong mot tailnet:
  - tu dong kham pha tren LAN qua Bonjour
  - token ghep cap + ACL do gateway so huu
  - khong can truy cap shell; be mat giao thuc co the gon nhe va de kiem toan
- **SSH** van la phuong an du phong pho quat:
  - hoat dong o bat ky dau ban co quyen SSH (ke ca qua cac mang khong lien quan)
  - vuot qua cac van de multicast/mDNS
  - khong can mo cong inbound moi ngoai SSH

## Dau vao kham pha (cach client biet gateway o dau)

### 1) Bonjour / mDNS (chi LAN)

Bonjour la best-effort va khong vuot qua cac mang. No chi duoc dung de thuan tien tren “cung LAN”.

Huong muc tieu:

- **gateway** quang cao diem cuoi WS cua no qua Bonjour.
- Client duyet va hien thi danh sach “chon mot gateway”, sau do luu diem cuoi da chon.

Chi tiet xu ly su co va beacon: [Bonjour](/gateway/bonjour).

#### Chi tiet service beacon

- Kieu dich vu:
  - `_openclaw-gw._tcp` (beacon truyen tai gateway)
- Khoa TXT (khong bi mat):
  - `role=gateway`
  - `lanHost=<hostname>.local`
  - `sshPort=22` (hoac bat ky gia tri nao duoc quang cao)
  - `gatewayPort=18789` (Gateway WS + HTTP)
  - `gatewayTls=1` (chi khi TLS duoc bat)
  - `gatewayTlsSha256=<sha256>` (chi khi TLS duoc bat va co fingerprint)
  - `canvasPort=18793` (cong host canvas mac dinh; phuc vu `/__openclaw__/canvas/`)
  - `cliPath=<path>` (tuy chon; duong dan tuyet doi toi entrypoint `openclaw` co the chay hoac binary)
  - `tailnetDns=<magicdns>` (goi y tuy chon; tu dong phat hien khi Tailscale kha dung)

Tat/ghi de:

- `OPENCLAW_DISABLE_BONJOUR=1` tat quang cao.
- `gateway.bind` trong `~/.openclaw/openclaw.json` dieu khien che do bind cua Gateway.
- `OPENCLAW_SSH_PORT` ghi de cong SSH duoc quang cao trong TXT (mac dinh la 22).
- `OPENCLAW_TAILNET_DNS` cong bo mot goi y `tailnetDns` (MagicDNS).
- `OPENCLAW_CLI_PATH` ghi de duong dan CLI duoc quang cao.

### 2) Tailnet (xuyen mang)

Voi cac thiet lap kieu London/Vienna, Bonjour se khong giup duoc. Dich den “direct” duoc khuyen nghi la:

- Ten MagicDNS cua Tailscale (uu tien) hoac mot IP tailnet on dinh.

Neu gateway co the phat hien no dang chay duoi Tailscale, no se cong bo `tailnetDns` nhu mot goi y tuy chon cho client (bao gom ca beacon pham vi rong).

### 3) Muc tieu thu cong / SSH

Khi khong co duong truc tiep (hoac direct bi tat), client luon co the ket noi qua SSH bang cach chuyen tiep cong gateway local loopback.

Xem [Remote access](/gateway/remote).

## Lua chon truyen tai (chinh sach client)

Hanh vi client duoc khuyen nghi:

1. Neu diem cuoi direct da ghep cap duoc cau hinh va co the truy cap, hay dung no.
2. Neu khong, neu Bonjour tim thay mot gateway tren LAN, de xuat lua chon “Dung gateway nay” chi mot cham va luu no lam diem cuoi direct.
3. Neu khong, neu mot DNS/IP tailnet da duoc cau hinh, thu direct.
4. Neu khong, quay ve SSH.

## Ghep cap + xac thuc (direct transport)

Gateway la nguon su that cho viec chap nhan nut/client.

- Yeu cau ghep cap duoc tao/phe duyet/tu choi trong gateway (xem [Gateway pairing](/gateway/pairing)).
- Gateway thuc thi:
  - xac thuc (token / cap khoa)
  - pham vi/ACL (gateway khong phai la proxy tho toi moi phuong thuc)
  - gioi han toc do

## Trach nhiem theo thanh phan

- **Gateway**: quang cao beacon kham pha, so huu quyet dinh ghep cap, va luu tru diem cuoi WS.
- **ung dung macOS**: giup ban chon mot gateway, hien thi loi nhac ghep cap, va chi dung SSH lam du phong.
- **nut iOS/Android**: duyet Bonjour nhu mot thuan tien va ket noi toi Gateway WS da ghep cap.
