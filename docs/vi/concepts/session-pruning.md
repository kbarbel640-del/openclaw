---
summary: "Tia phien: cat gon ket qua cong cu de giam phong to ngu canh"
read_when:
  - Ban muon giam tang truong ngu canh LLM tu dau ra cong cu
  - Ban dang tinh chinh agents.defaults.contextPruning
x-i18n:
  source_path: concepts/session-pruning.md
  source_hash: 9b0aa2d1abea7050
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:07:03Z
---

# Tia phien

Tia phien cat bot **ket qua cong cu cu** khoi ngu canh trong bo nho ngay truoc moi lan goi LLM. No **khong** ghi lai lich su phien tren dia (`*.jsonl`).

## Khi nao chay

- Khi `mode: "cache-ttl"` duoc bat va lan goi Anthropic gan nhat cho phien cu hon `ttl`.
- Chi anh huong den cac thong diep gui toi mo hinh cho yeu cau do.
- Chi hoat dong cho cac goi API Anthropic (va cac mo hinh Anthropic tren OpenRouter).
- De dat ket qua tot nhat, hay khop `ttl` voi `cacheControlTtl` cua mo hinh.
- Sau khi tia, cua so TTL duoc dat lai de cac yeu cau tiep theo giu cache cho den khi `ttl` het han lai.

## Gia tri mac dinh thong minh (Anthropic)

- Ho so **OAuth hoac setup-token**: bat tia `cache-ttl` va dat heartbeat thanh `1h`.
- Ho so **API key**: bat tia `cache-ttl`, dat heartbeat thanh `30m`, va dat mac dinh `cacheControlTtl` la `1h` tren cac mo hinh Anthropic.
- Neu ban tu dat bat ky gia tri nao trong so nay, OpenClaw **khong** ghi de chung.

## Cai thien gi (chi phi + hanh vi cache)

- **Tai sao can tia:** cache prompt cua Anthropic chi ap dung trong TTL. Neu phien bi bo trong qua TTL, yeu cau tiep theo se cache lai toan bo prompt neu ban khong cat gon truoc.
- **Cai gi re hon:** tia giam kich thuoc **cacheWrite** cho yeu cau dau tien sau khi TTL het han.
- **Tai sao dat lai TTL quan trong:** khi tia chay, cua so cache duoc dat lai, vi vay cac yeu cau theo sau co the tai su dung prompt vua duoc cache thay vi cache lai toan bo lich su lan nua.
- **No khong lam gi:** tia khong them token hay “nhan doi” chi phi; no chi thay doi nhung gi duoc cache o yeu cau dau tien sau TTL.

## Co the tia nhung gi

- Chi cac thong diep `toolResult`.
- Thong diep nguoi dung + tro ly **khong bao gio** bi chinh sua.
- `keepLastAssistants` thong diep tro ly gan nhat duoc bao ve; ket qua cong cu sau moc cat nay se khong bi tia.
- Neu khong du thong diep tro ly de thiet lap moc cat, viec tia se bi bo qua.
- Cac ket qua cong cu chua **khoi hinh anh** se bi bo qua (khong bao gio bi cat/lam trong).

## Uoc tinh cua so ngu canh

Tia su dung uoc tinh cua so ngu canh (ky tu ≈ token × 4). Cua so co so duoc giai quyet theo thu tu sau:

1. Ghi de `models.providers.*.models[].contextWindow`.
2. Dinh nghia mo hinh `contextWindow` (tu dang ky mo hinh).
3. Gia tri mac dinh `200000` token.

Neu `agents.defaults.contextTokens` duoc dat, no duoc xem nhu gioi han (min) cho cua so da giai quyet.

## Che do

### cache-ttl

- Tia chi chay neu lan goi Anthropic cuoi cung cu hon `ttl` (mac dinh `5m`).
- Khi chay: cung hanh vi cat mem + xoa cung nhu truoc.

## Cat mem vs xoa cung

- **Cat mem**: chi ap dung cho ket qua cong cu qua lon.
  - Giu phan dau + phan cuoi, chen `...`, va them ghi chu voi kich thuoc ban dau.
  - Bo qua cac ket qua co khoi hinh anh.
- **Xoa cung**: thay the toan bo ket qua cong cu bang `hardClear.placeholder`.

## Chon cong cu

- `tools.allow` / `tools.deny` ho tro ky tu dai dien `*`.
- Danh sach tu choi luon thang.
- So khop khong phan biet chu hoa chu thuong.
- Danh sach cho phep rong => tat ca cong cu duoc cho phep.

## Tuong tac voi cac gioi han khac

- Cac cong cu tich hop san da tu cat ngan dau ra cua chinh chung; tia phien la mot lop bo sung ngan cac cuoc tro chuyen keo dai tich luy qua nhieu dau ra cong cu trong ngu canh mo hinh.
- Nen (compaction) la rieng: nen tom tat va luu tru, con tia la tam thoi theo tung yeu cau. Xem [/concepts/compaction](/concepts/compaction).

## Gia tri mac dinh (khi bat)

- `ttl`: `"5m"`
- `keepLastAssistants`: `3`
- `softTrimRatio`: `0.3`
- `hardClearRatio`: `0.5`
- `minPrunableToolChars`: `50000`
- `softTrim`: `{ maxChars: 4000, headChars: 1500, tailChars: 1500 }`
- `hardClear`: `{ enabled: true, placeholder: "[Old tool result content cleared]" }`

## Vi du

Mac dinh (tat):

```json5
{
  agent: {
    contextPruning: { mode: "off" },
  },
}
```

Bat tia nhan biet TTL:

```json5
{
  agent: {
    contextPruning: { mode: "cache-ttl", ttl: "5m" },
  },
}
```

Gioi han tia cho cac cong cu cu the:

```json5
{
  agent: {
    contextPruning: {
      mode: "cache-ttl",
      tools: { allow: ["exec", "read"], deny: ["*image*"] },
    },
  },
}
```

Xem tham chieu cau hinh: [Gateway Configuration](/gateway/configuration)
