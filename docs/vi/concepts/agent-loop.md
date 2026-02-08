---
summary: "Vong lap tac tu, vong doi, luong va ngu nghia cho"
read_when:
  - Ban can mot huong dan chi tiet chinh xac ve vong lap tac tu hoac cac su kien vong doi
title: "Agent Loop"
x-i18n:
  source_path: concepts/agent-loop.md
  source_hash: 0775b96eb3451e13
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:07:02Z
---

# Agent Loop (OpenClaw)

Mot vong lap tac tu la toan bo lan chay “thuc” cua mot tac tu: tiep nhan → lap rap boi canh → suy luan mo hinh →
thuc thi cong cu → stream phan hoi → luu tru. Day la duong di chinh thuc bien mot thong diep
thanh hanh dong va phan hoi cuoi cung, dong thoi giu trang thai phien nhat quan.

Trong OpenClaw, mot vong lap la mot lan chay don, duoc serialize theo tung phien, phat ra cac su kien vong doi va stream
khi mo hinh suy nghi, goi cong cu va stream dau ra. Tai lieu nay giai thich cach vong lap xac thuc do
duoc ket noi tu dau den cuoi.

## Diem vao

- Gateway RPC: `agent` va `agent.wait`.
- CLI: lenh `agent`.

## Cach hoat dong (tong quan)

1. RPC `agent` kiem tra tham so, giai quyet phien (sessionKey/sessionId), luu metadata phien, tra ve `{ runId, acceptedAt }` ngay lap tuc.
2. `agentCommand` chay tac tu:
   - giai quyet mo hinh + mac dinh thinking/verbose
   - tai snapshot Skills
   - goi `runEmbeddedPiAgent` (pi-agent-core runtime)
   - phat **lifecycle end/error** neu vong lap nhung ben trong khong phat ra
3. `runEmbeddedPiAgent`:
   - serialize cac lan chay thong qua hang doi theo phien + hang doi toan cuc
   - giai quyet mo hinh + ho so xac thuc va xay dung pi session
   - dang ky cac su kien pi va stream cac delta cua assistant/cong cu
   - thuc thi timeout -> huy lan chay neu vuot qua
   - tra ve payload + metadata su dung
4. `subscribeEmbeddedPiSession` ket noi cac su kien pi-agent-core sang stream `agent` cua OpenClaw:
   - su kien cong cu => `stream: "tool"`
   - delta assistant => `stream: "assistant"`
   - su kien vong doi => `stream: "lifecycle"` (`phase: "start" | "end" | "error"`)
5. `agent.wait` su dung `waitForAgentJob`:
   - cho **lifecycle end/error** doi voi `runId`
   - tra ve `{ status: ok|error|timeout, startedAt, endedAt, error? }`

## Xep hang + dong thoi

- Cac lan chay duoc serialize theo tung session key (session lane) va tuy chon thong qua mot lane toan cuc.
- Dieu nay ngan chan tranh chap cong cu/phien va giu lich su phien nhat quan.
- Cac kenh nhan tin co the chon che do hang doi (collect/steer/followup) de dua vao he thong lane nay.
  Xem [Command Queue](/concepts/queue).

## Chuan bi phien + workspace

- Workspace duoc giai quyet va tao; cac lan chay trong sandbox co the chuyen huong den thu muc goc workspace cua sandbox.
- Skills duoc tai (hoac tai su dung tu snapshot) va tiem vao env va prompt.
- Cac tep bootstrap/context duoc giai quyet va tiem vao bao cao system prompt.
- Mot khoa ghi phien duoc cap; `SessionManager` duoc mo va chuan bi truoc khi stream.

## Lap rap prompt + system prompt

- System prompt duoc xay dung tu prompt co so cua OpenClaw, prompt Skills, boi canh bootstrap va cac ghi de theo tung lan chay.
- Gioi han rieng theo mo hinh va token du tru cho compaction duoc thuc thi.
- Xem [System prompt](/concepts/system-prompt) de biet mo hinh nhin thay gi.

## Diem hook (noi ban co the chan)

OpenClaw co hai he thong hook:

- **Internal hooks** (Gateway hooks): script huong su kien cho lenh va su kien vong doi.
- **Plugin hooks**: cac diem mo rong ben trong vong doi tac tu/cong cu va pipeline Gateway.

### Internal hooks (Gateway hooks)

- **`agent:bootstrap`**: chay trong luc xay dung cac tep bootstrap truoc khi system prompt duoc hoan tat.
  Dung cai nay de them/loai bo cac tep boi canh bootstrap.
- **Command hooks**: `/new`, `/reset`, `/stop`, va cac su kien lenh khac (xem tai lieu Hooks).

Xem [Hooks](/hooks) de biet thiet lap va vi du.

### Plugin hooks (vong doi agent + gateway)

Chung chay ben trong vong lap tac tu hoac pipeline Gateway:

- **`before_agent_start`**: tiem boi canh hoac ghi de system prompt truoc khi lan chay bat dau.
- **`agent_end`**: kiem tra danh sach thong diep cuoi cung va metadata lan chay sau khi hoan tat.
- **`before_compaction` / `after_compaction`**: quan sat hoac gan nhan cac chu ky compaction.
- **`before_tool_call` / `after_tool_call`**: chan tham so/ket qua cong cu.
- **`tool_result_persist`**: bien doi dong bo ket qua cong cu truoc khi chung duoc ghi vao transcript phien.
- **`message_received` / `message_sending` / `message_sent`**: hook thong diep vao + ra.
- **`session_start` / `session_end`**: ranh gioi vong doi phien.
- **`gateway_start` / `gateway_stop`**: su kien vong doi Gateway.

Xem [Plugins](/plugin#plugin-hooks) de biet API hook va chi tiet dang ky.

## Streaming + phan hoi tung phan

- Delta cua assistant duoc stream tu pi-agent-core va phat ra duoi dang su kien `assistant`.
- Block streaming co the phat phan hoi tung phan tren `text_end` hoac `message_end`.
- Streaming ly giai co the duoc phat nhu mot stream rieng hoac duoi dang block replies.
- Xem [Streaming](/concepts/streaming) de biet hanh vi chunking va block reply.

## Thuc thi cong cu + cong cu nhan tin

- Su kien bat dau/cap nhat/ket thuc cong cu duoc phat tren stream `tool`.
- Ket qua cong cu duoc lam sach ve kich thuoc va payload hinh anh truoc khi ghi log/phat.
- Cac lan gui cong cu nhan tin duoc theo doi de ngan chan xac nhan trung lap tu assistant.

## Dinh hinh phan hoi + ngan chan

- Payload cuoi cung duoc lap rap tu:
  - van ban assistant (va ly giai tuy chon)
  - tom tat cong cu inline (khi verbose + duoc phep)
  - van ban loi cua assistant khi mo hinh gap loi
- `NO_REPLY` duoc coi la mot token im lang va bi loc khoi payload dau ra.
- Cac ban sao trung lap cua cong cu nhan tin bi loai bo khoi danh sach payload cuoi.
- Neu khong con payload co the render va mot cong cu bi loi, se phat mot phan hoi loi cong cu du phong
  (tru khi cong cu nhan tin da gui mot phan hoi hien thi cho nguoi dung).

## Compaction + thu lai

- Auto-compaction phat cac su kien stream `compaction` va co the kich hoat thu lai.
- Khi thu lai, cac bo dem trong bo nho va tom tat cong cu duoc dat lai de tranh dau ra trung lap.
- Xem [Compaction](/concepts/compaction) de biet pipeline compaction.

## Event streams (hien tai)

- `lifecycle`: phat boi `subscribeEmbeddedPiSession` (va du phong boi `agentCommand`)
- `assistant`: delta duoc stream tu pi-agent-core
- `tool`: su kien cong cu duoc stream tu pi-agent-core

## Xu ly kenh chat

- Delta assistant duoc dem vao cac thong diep chat `delta`.
- Mot chat `final` duoc phat khi **lifecycle end/error**.

## Timeout

- Mac dinh `agent.wait`: 30s (chi rieng phan cho). Tham so `timeoutMs` ghi de.
- Runtime agent: mac dinh `agents.defaults.timeoutSeconds` 600s; duoc thuc thi trong bo hen gio huy `runEmbeddedPiAgent`.

## Noi moi thu co the ket thuc som

- Agent timeout (huy)
- AbortSignal (huy)
- Gateway ngat ket noi hoac RPC timeout
- `agent.wait` timeout (chi cho, khong dung agent)
