---
summary: "Noi dung ma system prompt cua OpenClaw chua va cach no duoc lap rap"
read_when:
  - Chinh sua van ban system prompt, danh sach cong cu, hoac cac phan thoi gian/nhip tim
  - Thay doi hanh vi khoi tao workspace hoac tiem vao Skills
title: "System Prompt"
x-i18n:
  source_path: concepts/system-prompt.md
  source_hash: bef4b2674ba0414c
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:07:09Z
---

# System Prompt

OpenClaw xay dung mot system prompt tuy chinh cho moi lan chay agent. Prompt nay **thuoc quyen OpenClaw** va khong su dung prompt mac dinh cua p-coding-agent.

Prompt duoc OpenClaw lap rap va tiem vao moi lan chay agent.

## Cau truc

Prompt duoc thiet ke gon nhe va su dung cac phan co dinh:

- **Tooling**: danh sach cong cu hien tai + mo ta ngan.
- **Safety**: loi nhac hang rao an toan ngan gon de tranh hanh vi tim kiem quyen luc hoac vuot qua giam sat.
- **Skills** (khi co): cho mo hinh biet cach tai huong dan skill theo yeu cau.
- **OpenClaw Self-Update**: cach chay `config.apply` va `update.run`.
- **Workspace**: thu muc lam viec (`agents.defaults.workspace`).
- **Documentation**: duong dan cuc bo toi tai lieu OpenClaw (repo hoac goi npm) va khi nao nen doc.
- **Workspace Files (injected)**: cho biet cac file bootstrap duoc dua vao ben duoi.
- **Sandbox** (khi bat): cho biet moi truong runtime trong sandbox, cac duong dan sandbox, va viec co the thuc thi dac quyen hay khong.
- **Current Date & Time**: thoi gian theo dia phuong nguoi dung, mui gio, va dinh dang thoi gian.
- **Reply Tags**: cu phap the tra loi tuy chon cho cac nha cung cap ho tro.
- **Heartbeats**: prompt nhip tim va hanh vi ack.
- **Runtime**: host, OS, node, model, thu muc goc repo (khi phat hien), muc do suy nghi (mot dong).
- **Reasoning**: muc do hien thi hien tai + goi y bat/tat /reasoning.

Cac hang rao an toan trong system prompt mang tinh huong dan. Chung dinh huong hanh vi cua mo hinh nhung khong thuc thi chinh sach. Hay su dung chinh sach cong cu, phe duyet exec, sandboxing, va danh sach cho phep kenh de thuc thi bat buoc; nguoi van hanh co the tat chung theo thiet ke.

## Cac che do prompt

OpenClaw co the render system prompt nho hon cho cac sub-agent. Runtime thiet lap
`promptMode` cho moi lan chay (khong phai cau hinh cho nguoi dung):

- `full` (mac dinh): bao gom tat ca cac phan ben tren.
- `minimal`: dung cho sub-agent; loai bo **Skills**, **Memory Recall**, **OpenClaw
  Self-Update**, **Model Aliases**, **User Identity**, **Reply Tags**,
  **Messaging**, **Silent Replies**, va **Heartbeats**. Tooling, **Safety**,
  Workspace, Sandbox, Current Date & Time (khi biet), Runtime, va ngu canh duoc tiem
  van san sang.
- `none`: chi tra ve dong nhan dang co ban.

Khi `promptMode=minimal`, cac prompt duoc tiem bo sung se duoc gan nhan **Subagent
Context** thay vi **Group Chat Context**.

## Tiem bootstrap workspace

Cac file bootstrap duoc cat gon va noi them duoi **Project Context** de mo hinh
thay duoc nhan dang va ngu canh ho so ma khong can doc tuong minh:

- `AGENTS.md`
- `SOUL.md`
- `TOOLS.md`
- `IDENTITY.md`
- `USER.md`
- `HEARTBEAT.md`
- `BOOTSTRAP.md` (chi tren workspace moi toanh)

Cac file lon se bi cat bot kem theo dau danh dau. Kich thuoc toi da moi file duoc
dieu khien boi `agents.defaults.bootstrapMaxChars` (mac dinh: 20000). Cac file thieu se tiem vao
mot dau danh dau file thieu ngan.

Cac hook noi bo co the chan buoc nay thong qua `agent:bootstrap` de bien doi hoac thay the
cac file bootstrap duoc tiem (vi du hoan doi `SOUL.md` bang mot persona khac).

De kiem tra dong gop cua moi file duoc tiem (thuan vs da tiem, cat bot, cong voi phan du schema cong cu), su dung `/context list` hoac `/context detail`. Xem [Context](/concepts/context).

## Xu ly thoi gian

System prompt bao gom mot phan **Current Date & Time** rieng khi biet mui gio cua
nguoi dung. De giu prompt on dinh cho cache, hien nay no chi bao gom
**mui gio** (khong co dong ho dong hoac dinh dang thoi gian).

Su dung `session_status` khi agent can thoi gian hien tai; the trang thai
bao gom mot dong timestamp.

Cau hinh voi:

- `agents.defaults.userTimezone`
- `agents.defaults.timeFormat` (`auto` | `12` | `24`)

Xem [Date & Time](/date-time) de biet day du chi tiet hanh vi.

## Skills

Khi ton tai cac skill du dieu kien, OpenClaw tiem vao mot **danh sach skill kha dung**
gon nhe (`formatSkillsForPrompt`) bao gom **duong dan file** cho moi skill. Prompt
huong dan mo hinh su dung `read` de tai SKILL.md tai vi tri da liet ke
(workspace, quan ly, hoac dong goi). Neu khong co skill nao du dieu kien, phan
Skills se bi loai bo.

```
<available_skills>
  <skill>
    <name>...</name>
    <description>...</description>
    <location>...</location>
  </skill>
</available_skills>
```

Dieu nay giu prompt co ban nho gon trong khi van cho phep su dung skill co muc tieu.

## Documentation

Khi co san, system prompt bao gom mot phan **Documentation** chi den
thu muc tai lieu OpenClaw cuc bo (hoac `docs/` trong workspace repo hoac tai lieu
dong goi npm) va cung ghi chu ve ban sao cong khai, repo nguon, Discord cong dong, va
ClawHub (https://clawhub.com) de kham pha skills. Prompt huong dan mo hinh uu tien tham khao
tai lieu cuc bo truoc cho hanh vi OpenClaw, lenh, cau hinh, hoac kien truc, va tu chay
`openclaw status` khi co the (chi hoi nguoi dung khi thieu quyen truy cap).
