---
summary: "Cac buoc kiem tra suc khoe cho ket noi kenh"
read_when:
  - Chan doan suc khoe kenh WhatsApp
title: "Kiem Tra Suc Khoe"
x-i18n:
  source_path: gateway/health.md
  source_hash: 74f242e98244c135
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:07:15Z
---

# Kiem Tra Suc Khoe (CLI)

Huong dan ngan gon de xac minh ket noi kenh ma khong can doan.

## Kiem tra nhanh

- `openclaw status` — tom tat cuc bo: kha nang truy cap Gateway/che do, goi y cap nhat, tuoi xac thuc kenh da lien ket, phien + hoat dong gan day.
- `openclaw status --all` — chan doan cuc bo day du (chi doc, co mau, an toan de dan de debug).
- `openclaw status --deep` — dong thoi kiem tra Gateway dang chay (do tham do theo kenh khi duoc ho tro).
- `openclaw health --json` — yeu cau Gateway dang chay cung cap anh chup suc khoe day du (chi WS; khong co socket Baileys truc tiep).
- Gui `/status` nhu mot tin nhan doc lap trong WhatsApp/WebChat de nhan phan hoi trang thai ma khong kich hoat tac tu.
- Logs: tail `/tmp/openclaw/openclaw-*.log` va loc theo `web-heartbeat`, `web-reconnect`, `web-auto-reply`, `web-inbound`.

## Chan doan chuyen sau

- Thong tin dang nhap tren dia: `ls -l ~/.openclaw/credentials/whatsapp/<accountId>/creds.json` (mtime nen la gan day).
- Kho phien: `ls -l ~/.openclaw/agents/<agentId>/sessions/sessions.json` (duong dan co the ghi de trong cau hinh). So luong va nguoi nhan gan day duoc hien thi qua `status`.
- Quy trinh lien ket lai: `openclaw channels logout && openclaw channels login --verbose` khi ma trang thai 409–515 hoac `loggedOut` xuat hien trong logs. (Luu y: quy trinh dang nhap QR tu dong khoi dong lai mot lan doi voi trang thai 515 sau khi ghep cap.)

## Khi co su co

- `logged out` hoac trang thai 409–515 → lien ket lai bang `openclaw channels logout` sau do `openclaw channels login`.
- Khong the truy cap Gateway → khoi dong no: `openclaw gateway --port 18789` (dung `--force` neu cong dang ban).
- Khong co tin nhan vao → xac nhan dien thoai da lien ket dang online va nguoi gui duoc phep (`channels.whatsapp.allowFrom`); voi chat nhom, dam bao quy tac allowlist + mention phu hop (`channels.whatsapp.groups`, `agents.list[].groupChat.mentionPatterns`).

## Lenh "health" chuyen dung

`openclaw health --json` yeu cau Gateway dang chay cung cap anh chup suc khoe (CLI khong mo socket kenh truc tiep). No bao cao thong tin dang nhap/xac thuc da lien ket khi co, tom tat tham do theo kenh, tom tat kho phien, va thoi gian tham do. Lenh se thoat voi ma khac 0 neu Gateway khong the truy cap hoac tham do that bai/het thoi gian. Dung `--timeout <ms>` de ghi de thoi gian mac dinh 10s.
