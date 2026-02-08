---
summary: "Cong cu phien tac tu de liet ke phien, lay lich su va gui tin nhan giua cac phien"
read_when:
  - Them hoac chinh sua cong cu phien
title: "Cong Cu Phien"
x-i18n:
  source_path: concepts/session-tool.md
  source_hash: cb6e0982ebf507bc
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:07:14Z
---

# Cong Cu Phien

Muc tieu: bo cong cu nho, kho su dung sai de tac tu co the liet ke phien, lay lich su va gui sang phien khac.

## Ten Cong Cu

- `sessions_list`
- `sessions_history`
- `sessions_send`
- `sessions_spawn`

## Mo Hinh Khoa

- Ngan chat truc tiep chinh luon la khoa literal `"main"` (duoc giai quyet thanh khoa chinh cua tac tu hien tai).
- Chat nhom su dung `agent:<agentId>:<channel>:group:<id>` hoac `agent:<agentId>:<channel>:channel:<id>` (truyen day du khoa).
- Cron job su dung `cron:<job.id>`.
- Hook su dung `hook:<uuid>` tru khi duoc dat ro rang.
- Phien node su dung `node-<nodeId>` tru khi duoc dat ro rang.

`global` va `unknown` la cac gia tri duoc danh rieng va khong bao gio duoc liet ke. Neu `session.scope = "global"`, chung toi alias no thanh `main` cho tat ca cac cong cu de nguoi goi khong bao gio thay `global`.

## sessions_list

Liet ke cac phien duoi dang mang cac dong.

Tham so:

- Bo loc `kinds?: string[]`: bat ky gia tri nao trong `"main" | "group" | "cron" | "hook" | "node" | "other"`
- `limit?: number` so dong toi da (mac dinh: mac dinh phia server, gioi han vi du 200)
- `activeMinutes?: number` chi cac phien duoc cap nhat trong N phut
- `messageLimit?: number` 0 = khong co tin nhan (mac dinh 0); >0 = bao gom N tin nhan gan nhat

Hanh vi:

- `messageLimit > 0` lay `chat.history` cho moi phien va bao gom N tin nhan gan nhat.
- Ket qua cong cu duoc loc ra khoi dau ra danh sach; dung `sessions_history` cho tin nhan cong cu.
- Khi chay trong phien tac tu **trong sandbox**, cong cu phien mac dinh o che do **chi hien thi cac phien duoc spawn** (xem ben duoi).

Hinh dang dong (JSON):

- `key`: khoa phien (string)
- `kind`: `main | group | cron | hook | node | other`
- `channel`: `whatsapp | telegram | discord | signal | imessage | webchat | internal | unknown`
- `displayName` (nhan hien thi nhom neu co)
- `updatedAt` (ms)
- `sessionId`
- `model`, `contextTokens`, `totalTokens`
- `thinkingLevel`, `verboseLevel`, `systemSent`, `abortedLastRun`
- `sendPolicy` (ghi de phien neu duoc dat)
- `lastChannel`, `lastTo`
- `deliveryContext` (`{ channel, to, accountId }` da chuan hoa khi co)
- `transcriptPath` (duong dan co gang tot nhat duoc suy ra tu thu muc luu tru + sessionId)
- `messages?` (chi khi `messageLimit > 0`)

## sessions_history

Lay transcript cho mot phien.

Tham so:

- `sessionKey` (bat buoc; chap nhan khoa phien hoac `sessionId` tu `sessions_list`)
- `limit?: number` so tin nhan toi da (server se gioi han)
- `includeTools?: boolean` (mac dinh false)

Hanh vi:

- `includeTools=false` loc cac tin nhan `role: "toolResult"`.
- Tra ve mang tin nhan theo dinh dang transcript thuan.
- Khi cung cap `sessionId`, OpenClaw giai quyet no thanh khoa phien tuong ung (bao loi neu thieu id).

## sessions_send

Gui mot tin nhan vao phien khac.

Tham so:

- `sessionKey` (bat buoc; chap nhan khoa phien hoac `sessionId` tu `sessions_list`)
- `message` (bat buoc)
- `timeoutSeconds?: number` (mac dinh >0; 0 = gui va khong cho)

Hanh vi:

- `timeoutSeconds = 0`: xep hang va tra ve `{ runId, status: "accepted" }`.
- `timeoutSeconds > 0`: cho toi da N giay de hoan tat, sau do tra ve `{ runId, status: "ok", reply }`.
- Neu cho bi het thoi gian: `{ runId, status: "timeout", error }`. Tien trinh van tiep tuc; goi `sessions_history` sau.
- Neu tien trinh that bai: `{ runId, status: "error", error }`.
- Thong bao giao hang chay sau khi tien trinh chinh hoan tat va theo best-effort; `status: "ok"` khong dam bao thong bao da duoc gui.
- Cho thong qua Gateway `agent.wait` (phia server) de viec ket noi lai khong lam mat cho.
- Ngu canh tin nhan giua tac tu duoc chen vao cho tien trinh chinh.
- Sau khi tien trinh chinh hoan tat, OpenClaw chay **vong lap tra loi lai**:
  - Vong 2+ luan phien giua tac tu yeu cau va tac tu dich.
  - Tra loi chinh xac `REPLY_SKIP` de dung ping‑pong.
  - So luot toi da la `session.agentToAgent.maxPingPongTurns` (0–5, mac dinh 5).
- Khi vong lap ket thuc, OpenClaw chay **buoc thong bao giua tac tu** (chi tac tu dich):
  - Tra loi chinh xac `ANNOUNCE_SKIP` de giu im lang.
  - Bat ky tra loi nao khac se duoc gui toi kenh dich.
  - Buoc thong bao bao gom yeu cau goc + tra loi vong 1 + tra loi ping‑pong moi nhat.

## Truong Kenh

- Doi voi nhom, `channel` la kenh duoc ghi tren muc phien.
- Doi voi chat truc tiep, `channel` anh xa tu `lastChannel`.
- Doi voi cron/hook/node, `channel` la `internal`.
- Neu thieu, `channel` la `unknown`.

## Bao Mat / Chinh Sach Gui

Chan dua tren chinh sach theo loai kenh/chat (khong theo session id).

```json
{
  "session": {
    "sendPolicy": {
      "rules": [
        {
          "match": { "channel": "discord", "chatType": "group" },
          "action": "deny"
        }
      ],
      "default": "allow"
    }
  }
}
```

Ghi de thoi gian chay (theo muc phien):

- `sendPolicy: "allow" | "deny"` (khong dat = ke thua cau hinh)
- Co the dat thong qua `sessions.patch` hoac `/send on|off|inherit` chi chu so huu (tin nhan doc lap).

Diem thuc thi:

- `chat.send` / `agent` (Gateway)
- logic giao hang tra loi tu dong

## sessions_spawn

Spawn mot lan chay tac tu phu trong mot phien co lap va thong bao ket qua ve kenh chat cua ben yeu cau.

Tham so:

- `task` (bat buoc)
- `label?` (tuy chon; dung cho log/UI)
- `agentId?` (tuy chon; spawn duoi mot agent id khac neu duoc phep)
- `model?` (tuy chon; ghi de mo hinh tac tu phu; gia tri khong hop le se bao loi)
- `runTimeoutSeconds?` (mac dinh 0; khi dat, huy lan chay tac tu phu sau N giay)
- `cleanup?` (`delete|keep`, mac dinh `keep`)

Danh sach cho phep:

- `agents.list[].subagents.allowAgents`: danh sach agent id duoc phep thong qua `agentId` (`["*"]` de cho phep bat ky). Mac dinh: chi tac tu yeu cau.

Kham pha:

- Dung `agents_list` de kham pha nhung agent id nao duoc phep cho `sessions_spawn`.

Hanh vi:

- Bat dau mot phien `agent:<agentId>:subagent:<uuid>` moi voi `deliver: false`.
- Tac tu phu mac dinh co day du bo cong cu **tru cong cu phien** (co the cau hinh thong qua `tools.subagents.tools`).
- Tac tu phu khong duoc phep goi `sessions_spawn` (khong co spawn tac tu phu → tac tu phu).
- Luon khong chan: tra ve `{ status: "accepted", runId, childSessionKey }` ngay lap tuc.
- Sau khi hoan tat, OpenClaw chay **buoc thong bao** cua tac tu phu va dang ket qua len kenh chat cua ben yeu cau.
- Tra loi chinh xac `ANNOUNCE_SKIP` trong buoc thong bao de giu im lang.
- Tra loi thong bao duoc chuan hoa thanh `Status`/`Result`/`Notes`; `Status` den tu ket qua thoi gian chay (khong phai van ban mo hinh).
- Phien tac tu phu tu dong duoc luu tru sau `agents.defaults.subagents.archiveAfterMinutes` (mac dinh: 60).
- Tra loi thong bao bao gom mot dong thong ke (thoi gian chay, token, sessionKey/sessionId, duong dan transcript, va chi phi tuy chon).

## Hien Thi Phien Sandbox

Cac phien trong sandbox co the su dung cong cu phien, nhung mac dinh chi thay cac phien ma chung spawn thong qua `sessions_spawn`.

Cau hinh:

```json5
{
  agents: {
    defaults: {
      sandbox: {
        // default: "spawned"
        sessionToolsVisibility: "spawned", // or "all"
      },
    },
  },
}
```
