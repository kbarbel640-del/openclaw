---
summary: "Goi truc tiep mot cong cu don le thong qua diem cuoi HTTP cua Gateway"
read_when:
  - Goi cong cu ma khong can chay toan bo mot luot agent
  - Xay dung tu dong hoa can thuc thi chinh sach cong cu
title: "API Goi Cong Cu"
x-i18n:
  source_path: gateway/tools-invoke-http-api.md
  source_hash: 17ccfbe0b0d9bb61
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:07:26Z
---

# Tools Invoke (HTTP)

Gateway cua OpenClaw phoi bay mot diem cuoi HTTP don gian de goi truc tiep mot cong cu don le. Luon duoc bat, nhung bi kiem soat boi xac thuc Gateway va chinh sach cong cu.

- `POST /tools/invoke`
- Cung cong voi Gateway (da kenh WS + HTTP): `http://<gateway-host>:<port>/tools/invoke`

Kich thuoc payload toi da mac dinh la 2 MB.

## Xac thuc

Su dung cau hinh xac thuc Gateway. Gui bearer token:

- `Authorization: Bearer <token>`

Ghi chu:

- Khi `gateway.auth.mode="token"`, su dung `gateway.auth.token` (hoac `OPENCLAW_GATEWAY_TOKEN`).
- Khi `gateway.auth.mode="password"`, su dung `gateway.auth.password` (hoac `OPENCLAW_GATEWAY_PASSWORD`).

## Than yeu cau

```json
{
  "tool": "sessions_list",
  "action": "json",
  "args": {},
  "sessionKey": "main",
  "dryRun": false
}
```

Cac truong:

- `tool` (string, bat buoc): ten cong cu can goi.
- `action` (string, tuy chon): anh xa vao args neu schema cong cu ho tro `action` va payload args bo qua truong nay.
- `args` (object, tuy chon): doi so rieng cua cong cu.
- `sessionKey` (string, tuy chon): khoa phien muc tieu. Neu bo qua hoac `"main"`, Gateway se su dung khoa phien chinh da cau hinh (ton trong `session.mainKey` va agent mac dinh, hoac `global` trong pham vi toan cuc).
- `dryRun` (boolean, tuy chon): du tru cho tuong lai; hien tai bo qua.

## Hanh vi chinh sach + dinh tuyen

Tinh kha dung cua cong cu duoc loc qua cung chuoi chinh sach duoc su dung boi cac agent cua Gateway:

- `tools.profile` / `tools.byProvider.profile`
- `tools.allow` / `tools.byProvider.allow`
- `agents.<id>.tools.allow` / `agents.<id>.tools.byProvider.allow`
- chinh sach nhom (neu khoa phien anh xa toi mot nhom hoac kenh)
- chinh sach subagent (khi goi voi khoa phien subagent)

Neu mot cong cu khong duoc cho phep boi chinh sach, diem cuoi se tra ve **404**.

De giup chinh sach nhom giai quyet boi canh, ban co the tuy chon dat:

- `x-openclaw-message-channel: <channel>` (vi du: `slack`, `telegram`)
- `x-openclaw-account-id: <accountId>` (khi ton tai nhieu tai khoan)

## Phan hoi

- `200` → `{ ok: true, result }`
- `400` → `{ ok: false, error: { type, message } }` (yeu cau khong hop le hoac loi cong cu)
- `401` → chua duoc uy quyen
- `404` → cong cu khong kha dung (khong tim thay hoac khong nam trong danh sach cho phep)
- `405` → phuong thuc khong duoc phep

## Vi du

```bash
curl -sS http://127.0.0.1:18789/tools/invoke \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "tool": "sessions_list",
    "action": "json",
    "args": {}
  }'
```
