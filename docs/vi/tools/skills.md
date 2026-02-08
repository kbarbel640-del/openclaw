---
summary: "Skills: quan ly vs workspace, quy tac gating, va lien ket cau hinh/env"
read_when:
  - Them hoac sua doi skills
  - Thay doi gating skills hoac quy tac tai
title: "Skills"
x-i18n:
  source_path: tools/skills.md
  source_hash: 54685da5885600b3
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:09:35Z
---

# Skills (OpenClaw)

OpenClaw su dung cac thu muc skill **tuong thich [AgentSkills](https://agentskills.io)** de day tac tu cach su dung cong cu. Moi skill la mot thu muc chua `SKILL.md` voi YAML frontmatter va huong dan. OpenClaw tai **bundled skills** cung voi cac ghi de cuc bo tuy chon, va loc chung khi tai dua tren moi truong, cau hinh, va su ton tai cua nhi phan.

## Vi tri va thu tu uu tien

Skills duoc tai tu **ba** noi:

1. **Bundled skills**: di kem voi ban cai dat (goi npm hoac OpenClaw.app)
2. **Managed/local skills**: `~/.openclaw/skills`
3. **Workspace skills**: `<workspace>/skills`

Neu trung ten skill, thu tu uu tien la:

`<workspace>/skills` (cao nhat) → `~/.openclaw/skills` → bundled skills (thap nhat)

Ngoai ra, ban co the cau hinh them cac thu muc skill bo sung (uu tien thap nhat) thong qua
`skills.load.extraDirs` trong `~/.openclaw/openclaw.json`.

## Skills theo tung tac tu vs dung chung

Trong thiet lap **nhieu tac tu**, moi tac tu co workspace rieng. Dieu nay co nghia la:

- **Per-agent skills** nam trong `<workspace>/skills` chi cho tac tu do.
- **Shared skills** nam trong `~/.openclaw/skills` (managed/local) va hien thi
  cho **tat ca tac tu** tren cung mot may.
- **Shared folders** cung co the duoc them qua `skills.load.extraDirs` (uu tien thap nhat)
  neu ban muon mot goi skills chung duoc su dung boi nhieu tac tu.

Neu cung mot ten skill ton tai o nhieu noi, thu tu uu tien thong thuong ap dung:
workspace thang, sau do managed/local, roi bundled.

## Plugins + skills

Plugins co the di kem skills rieng bang cach liet ke cac thu muc `skills` trong
`openclaw.plugin.json` (duong dan tuong doi so voi goc plugin). Skills cua plugin duoc tai
khi plugin duoc bat va tham gia vao cac quy tac uu tien skills thong thuong.
Ban co the gating chung thong qua `metadata.openclaw.requires.config` tren muc cau hinh cua plugin.
Xem [Plugins](/plugin) de biet ve kham pha/cau hinh va [Tools](/tools) ve be mat cong cu
ma cac skills do huong dan.

## ClawHub (cai dat + dong bo)

ClawHub la registry skills cong khai cho OpenClaw. Duyet tai
https://clawhub.com. Su dung no de kham pha, cai dat, cap nhat, va sao luu skills.
Huong dan day du: [ClawHub](/tools/clawhub).

Cac quy trinh pho bien:

- Cai dat mot skill vao workspace cua ban:
  - `clawhub install <skill-slug>`
- Cap nhat tat ca skills da cai:
  - `clawhub update --all`
- Dong bo (quet + cong bo cap nhat):
  - `clawhub sync --all`

Theo mac dinh, `clawhub` cai dat vao `./skills` duoi thu muc lam viec hien tai
(hoac quay ve workspace OpenClaw da cau hinh). OpenClaw nhan dien no la
`<workspace>/skills` o phien tiep theo.

## Ghi chu bao mat

- Xem skills ben thu ba nhu **ma khong dang tin cay**. Doc ky truoc khi bat.
- Uu tien chay trong sandbox cho dau vao khong dang tin cay va cong cu rui ro. Xem [Sandboxing](/gateway/sandboxing).
- `skills.entries.*.env` va `skills.entries.*.apiKey` tiem bi mat vao tien trinh **host**
  cho luot tac tu do (khong phai sandbox). Giu bi mat ra khoi prompt va log.
- De co mo hinh de doa va checklist rong hon, xem [Security](/gateway/security).

## Dinh dang (AgentSkills + tuong thich Pi)

`SKILL.md` phai bao gom it nhat:

```markdown
---
name: nano-banana-pro
description: Generate or edit images via Gemini 3 Pro Image
---
```

Ghi chu:

- Chung toi tuan theo dac ta AgentSkills ve bo cuc/y dinh.
- Trinh phan tich duoc nhung boi tac tu tich hop ho tro chi cac khoa frontmatter **mot dong**.
- `metadata` nen la **doi tuong JSON mot dong**.
- Su dung `{baseDir}` trong huong dan de tham chieu duong dan thu muc skill.
- Cac khoa frontmatter tuy chon:
  - `homepage` — URL hien thi la “Website” trong macOS Skills UI (cung ho tro qua `metadata.openclaw.homepage`).
  - `user-invocable` — `true|false` (mac dinh: `true`). Khi `true`, skill duoc mo ra nhu mot slash command cho nguoi dung.
  - `disable-model-invocation` — `true|false` (mac dinh: `false`). Khi `true`, skill bi loai khoi prompt cua mo hinh (van co san qua goi tu nguoi dung).
  - `command-dispatch` — `tool` (tuy chon). Khi dat `tool`, slash command bo qua mo hinh va dieu phoi truc tiep den cong cu.
  - `command-tool` — ten cong cu de goi khi `command-dispatch: tool` duoc dat.
  - `command-arg-mode` — `raw` (mac dinh). Doi voi dieu phoi cong cu, chuyen tiep chuoi tham so thuan den cong cu (khong phan tich loi).

    Cong cu duoc goi voi tham so:
    `{ command: "<raw args>", commandName: "<slash command>", skillName: "<skill name>" }`.

## Gating (bo loc khi tai)

OpenClaw **loc skills khi tai** su dung `metadata` (JSON mot dong):

```markdown
---
name: nano-banana-pro
description: Generate or edit images via Gemini 3 Pro Image
metadata:
  {
    "openclaw":
      {
        "requires": { "bins": ["uv"], "env": ["GEMINI_API_KEY"], "config": ["browser.enabled"] },
        "primaryEnv": "GEMINI_API_KEY",
      },
  }
---
```

Cac truong duoi `metadata.openclaw`:

- `always: true` — luon bao gom skill (bo qua cac gate khac).
- `emoji` — emoji tuy chon duoc su dung boi macOS Skills UI.
- `homepage` — URL tuy chon hien thi la “Website” trong macOS Skills UI.
- `os` — danh sach nen tang tuy chon (`darwin`, `linux`, `win32`). Neu dat, skill chi hop le tren cac OS do.
- `requires.bins` — danh sach; moi muc phai ton tai tren `PATH`.
- `requires.anyBins` — danh sach; it nhat mot muc phai ton tai tren `PATH`.
- `requires.env` — danh sach; bien moi truong phai ton tai **hoac** duoc cung cap trong cau hinh.
- `requires.config` — danh sach cac duong dan `openclaw.json` phai co gia tri dung.
- `primaryEnv` — ten bien moi truong lien ket voi `skills.entries.<name>.apiKey`.
- `install` — mang tuy chon cac dac ta installer duoc su dung boi macOS Skills UI (brew/node/go/uv/download).

Luu y ve sandboxing:

- `requires.bins` duoc kiem tra tren **host** tai thoi diem tai skill.
- Neu mot tac tu duoc chay trong sandbox, nhi phan cung phai ton tai **ben trong container**.
  Cai dat no thong qua `agents.defaults.sandbox.docker.setupCommand` (hoac anh tuy chinh).
  `setupCommand` chay mot lan sau khi container duoc tao.
  Cai dat goi cung yeu cau egress mang, root FS co the ghi, va nguoi dung root trong sandbox.
  Vi du: skill `summarize` (`skills/summarize/SKILL.md`) can CLI `summarize`
  ben trong container sandbox de chay o do.

Vi du installer:

```markdown
---
name: gemini
description: Use Gemini CLI for coding assistance and Google search lookups.
metadata:
  {
    "openclaw":
      {
        "emoji": "♊️",
        "requires": { "bins": ["gemini"] },
        "install":
          [
            {
              "id": "brew",
              "kind": "brew",
              "formula": "gemini-cli",
              "bins": ["gemini"],
              "label": "Install Gemini CLI (brew)",
            },
          ],
      },
  }
---
```

Ghi chu:

- Neu liet ke nhieu installer, gateway chon **mot** tuy chon uu tien (brew khi co, neu khong thi node).
- Neu tat ca installer la `download`, OpenClaw liet ke tung muc de ban thay cac artifact san co.
- Dac ta installer co the bao gom `os: ["darwin"|"linux"|"win32"]` de loc tuy chon theo nen tang.
- Cai dat Node tuan theo `skills.install.nodeManager` trong `openclaw.json` (mac dinh: npm; tuy chon: npm/pnpm/yarn/bun).
  Dieu nay chi anh huong den **cai dat skill**; runtime Gateway van nen la Node
  (khong khuyen nghi Bun cho WhatsApp/Telegram).
- Cai dat Go: neu `go` thieu va `brew` co san, gateway se cai Go qua Homebrew truoc va dat `GOBIN` thanh `bin` cua Homebrew khi co the.
- Cai dat Download: `url` (bat buoc), `archive` (`tar.gz` | `tar.bz2` | `zip`), `extract` (mac dinh: tu dong khi phat hien archive), `stripComponents`, `targetDir` (mac dinh: `~/.openclaw/tools/<skillKey>`).

Neu khong co `metadata.openclaw`, skill luon hop le (tru khi
bi tat trong cau hinh hoac bi chan boi `skills.allowBundled` doi voi bundled skills).

## Ghi de cau hinh (`~/.openclaw/openclaw.json`)

Bundled/managed skills co the bat/tat va duoc cung cap gia tri env:

```json5
{
  skills: {
    entries: {
      "nano-banana-pro": {
        enabled: true,
        apiKey: "GEMINI_KEY_HERE",
        env: {
          GEMINI_API_KEY: "GEMINI_KEY_HERE",
        },
        config: {
          endpoint: "https://example.invalid",
          model: "nano-pro",
        },
      },
      peekaboo: { enabled: true },
      sag: { enabled: false },
    },
  },
}
```

Luu y: neu ten skill chua dau gach ngang, hay dat khoa trong dau ngoac kep (JSON5 cho phep khoa co dau ngoac).

Cac khoa cau hinh mac dinh khop voi **ten skill**. Neu mot skill dinh nghia
`metadata.openclaw.skillKey`, hay su dung khoa do duoi `skills.entries`.

Quy tac:

- `enabled: false` vo hieu hoa skill ngay ca khi no duoc bundled/da cai.
- `env`: tiem **chi khi** bien chua duoc dat san trong tien trinh.
- `apiKey`: tien ich cho skills khai bao `metadata.openclaw.primaryEnv`.
- `config`: tui tuy chon cho cac truong tuy bien theo tung skill; cac khoa tuy bien phai nam o day.
- `allowBundled`: allowlist tuy chon chi cho **bundled** skills. Neu dat, chi
  cac bundled skills trong danh sach moi hop le (managed/workspace khong bi anh huong).

## Tiem moi truong (moi lan chay tac tu)

Khi mot lan chay tac tu bat dau, OpenClaw:

1. Doc metadata cua skill.
2. Ap dung `skills.entries.<key>.env` hoac `skills.entries.<key>.apiKey` vao
   `process.env`.
3. Xay dung system prompt voi cac skills **hop le**.
4. Khoi phuc moi truong ban dau sau khi lan chay ket thuc.

Dieu nay **chi ap dung cho lan chay tac tu**, khong phai moi truong shell toan cuc.

## Anh chup phien (hieu nang)

OpenClaw chup nhanh danh sach skills hop le **khi phien bat dau** va tai su dung danh sach do cho cac luot tiep theo trong cung phien. Thay doi ve skills hoac cau hinh se co hieu luc o phien moi tiep theo.

Skills cung co the lam moi giua phien khi skills watcher duoc bat hoac khi mot nut tu xa hop le moi xuat hien (xem ben duoi). Hay hieu day la **hot reload**: danh sach duoc lam moi se duoc ap dung o luot tac tu tiep theo.

## Nut macOS tu xa (Gateway Linux)

Neu Gateway dang chay tren Linux nhung mot **nut macOS** duoc ket noi **voi `system.run` duoc cho phep** (bao mat phe duyet Exec khong dat `deny`), OpenClaw co the coi cac skills chi danh cho macOS la hop le khi cac nhi phan can thiet ton tai tren nut do. Tac tu nen thuc thi cac skills do thong qua cong cu `nodes` (thuong la `nodes.run`).

Dieu nay dua vao viec nut bao cao kha nang ho tro lenh va viec do tim bin thong qua `system.run`. Neu nut macOS mat ket noi sau do, cac skills van hien thi; viec goi co the that bai cho den khi nut ket noi lai.

## Skills watcher (tu dong lam moi)

Theo mac dinh, OpenClaw theo doi cac thu muc skill va cap nhat anh chup skills khi cac tep `SKILL.md` thay doi. Cau hinh muc nay duoi `skills.load`:

```json5
{
  skills: {
    load: {
      watch: true,
      watchDebounceMs: 250,
    },
  },
}
```

## Tac dong token (danh sach skills)

Khi skills hop le, OpenClaw tiem mot danh sach XML gon nhe cac skills co san vao system prompt (qua `formatSkillsForPrompt` trong `pi-coding-agent`). Chi phi la xac dinh:

- **Chi phi co ban (chi khi ≥1 skill):** 195 ky tu.
- **Moi skill:** 97 ky tu + do dai cua cac gia tri `<name>`, `<description>`, va `<location>` sau khi XML-escape.

Cong thuc (ky tu):

```
total = 195 + Σ (97 + len(name_escaped) + len(description_escaped) + len(location_escaped))
```

Ghi chu:

- XML escaping mo rong `& < > " '` thanh cac thuc the (`&amp;`, `&lt;`, v.v.), lam tang do dai.
- So token thay doi theo tokenizer cua mo hinh. Uoc tinh kieu OpenAI la ~4 ky tu/token, vi vay **97 ky tu ≈ 24 token** cho moi skill cong voi do dai truong thuc te cua ban.

## Vong doi managed skills

OpenClaw cung cap mot bo ky nang co ban nhu **bundled skills** nhu mot phan cua ban cai dat
(goi npm hoac OpenClaw.app). `~/.openclaw/skills` ton tai cho cac ghi de cuc bo
(vi du, co dinh/va va mot skill ma khong can thay doi ban bundled).
Workspace skills thuoc so huu nguoi dung va ghi de ca hai khi trung ten.

## Tham chieu cau hinh

Xem [Skills config](/tools/skills-config) de biet day du so do cau hinh.

## Dang tim them skills?

Duyet https://clawhub.com.

---
