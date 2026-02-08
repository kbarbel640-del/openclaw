---
title: "Tao Skills"
x-i18n:
  source_path: tools/creating-skills.md
  source_hash: ad801da34fe361ff
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:08:41Z
---

# Tao Skills tuy chinh 🛠

OpenClaw duoc thiet ke de de dang mo rong. "Skills" la cach chinh de them cac kha nang moi cho tro ly cua ban.

## Skill la gi?

Mot skill la mot thu muc chua tep `SKILL.md` (cung cap huong dan va dinh nghia cong cu cho LLM) va tuy chon mot so script hoac tai nguyen.

## Tung buoc: Skill dau tien cua ban

### 1. Tao Thu Muc

Skills nam trong workspace cua ban, thuong la `~/.openclaw/workspace/skills/`. Tao mot thu muc moi cho skill cua ban:

```bash
mkdir -p ~/.openclaw/workspace/skills/hello-world
```

### 2. Dinh Nghia `SKILL.md`

Tao tep `SKILL.md` trong thu muc do. Tep nay su dung frontmatter YAML cho metadata va Markdown cho huong dan.

```markdown
---
name: hello_world
description: A simple skill that says hello.
---

# Hello World Skill

When the user asks for a greeting, use the `echo` tool to say "Hello from your custom skill!".
```

### 3. Them Cong Cu (Tuy Chon)

Ban co the dinh nghia cac cong cu tuy chinh trong frontmatter hoac huong dan tac tu su dung cac cong cu he thong san co (nhu `bash` hoac `browser`).

### 4. Lam Moi OpenClaw

Yeu cau tac tu cua ban "refresh skills" hoac khoi dong lai Gateway. OpenClaw se phat hien thu muc moi va lap chi muc `SKILL.md`.

## Thuc Hanh Tot Nhat

- **Ngan Gon**: Huong dan mo hinh _lam gi_, khong phai cach tro thanh mot AI.
- **An Toan Truoc Het**: Neu skill cua ban su dung `bash`, hay dam bao prompt khong cho phep tiem lenh tuy y tu dau vao nguoi dung khong dang tin cay.
- **Kiem Thu Cuc Bo**: Su dung `openclaw agent --message "use my new skill"` de kiem thu.

## Skills Chia Se

Ban cung co the duyet va dong gop skills tai [ClawHub](https://clawhub.com).
