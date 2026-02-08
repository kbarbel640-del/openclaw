---
summary: "Cau hinh Moonshot K2 so voi Kimi Coding (nha cung cap + khoa rieng)"
read_when:
  - Ban muon thiet lap Moonshot K2 (Moonshot Open Platform) so voi Kimi Coding
  - Ban can hieu cac endpoint, khoa va tham chieu mo hinh rieng biet
  - Ban muon cau hinh copy/paste cho tung nha cung cap
title: "Moonshot AI"
x-i18n:
  source_path: providers/moonshot.md
  source_hash: 73b8b691b923ce3d
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:08:06Z
---

# Moonshot AI (Kimi)

Moonshot cung cap Kimi API voi cac endpoint tuong thich OpenAI. Cau hinh
nha cung cap va dat mo hinh mac dinh la `moonshot/kimi-k2.5`, hoac su dung
Kimi Coding voi `kimi-coding/k2p5`.

Cac ID mo hinh Kimi K2 hien tai:

{/_ moonshot-kimi-k2-ids:start _/ && null}

- `kimi-k2.5`
- `kimi-k2-0905-preview`
- `kimi-k2-turbo-preview`
- `kimi-k2-thinking`
- `kimi-k2-thinking-turbo`
  {/_ moonshot-kimi-k2-ids:end _/ && null}

```bash
openclaw onboard --auth-choice moonshot-api-key
```

Kimi Coding:

```bash
openclaw onboard --auth-choice kimi-code-api-key
```

Luu y: Moonshot va Kimi Coding la cac nha cung cap rieng biet. Khoa khong the dung chung, endpoint khac nhau, va tham chieu mo hinh khac nhau (Moonshot su dung `moonshot/...`, Kimi Coding su dung `kimi-coding/...`).

## Doan cau hinh (Moonshot API)

```json5
{
  env: { MOONSHOT_API_KEY: "sk-..." },
  agents: {
    defaults: {
      model: { primary: "moonshot/kimi-k2.5" },
      models: {
        // moonshot-kimi-k2-aliases:start
        "moonshot/kimi-k2.5": { alias: "Kimi K2.5" },
        "moonshot/kimi-k2-0905-preview": { alias: "Kimi K2" },
        "moonshot/kimi-k2-turbo-preview": { alias: "Kimi K2 Turbo" },
        "moonshot/kimi-k2-thinking": { alias: "Kimi K2 Thinking" },
        "moonshot/kimi-k2-thinking-turbo": { alias: "Kimi K2 Thinking Turbo" },
        // moonshot-kimi-k2-aliases:end
      },
    },
  },
  models: {
    mode: "merge",
    providers: {
      moonshot: {
        baseUrl: "https://api.moonshot.ai/v1",
        apiKey: "${MOONSHOT_API_KEY}",
        api: "openai-completions",
        models: [
          // moonshot-kimi-k2-models:start
          {
            id: "kimi-k2.5",
            name: "Kimi K2.5",
            reasoning: false,
            input: ["text"],
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
            contextWindow: 256000,
            maxTokens: 8192,
          },
          {
            id: "kimi-k2-0905-preview",
            name: "Kimi K2 0905 Preview",
            reasoning: false,
            input: ["text"],
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
            contextWindow: 256000,
            maxTokens: 8192,
          },
          {
            id: "kimi-k2-turbo-preview",
            name: "Kimi K2 Turbo",
            reasoning: false,
            input: ["text"],
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
            contextWindow: 256000,
            maxTokens: 8192,
          },
          {
            id: "kimi-k2-thinking",
            name: "Kimi K2 Thinking",
            reasoning: true,
            input: ["text"],
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
            contextWindow: 256000,
            maxTokens: 8192,
          },
          {
            id: "kimi-k2-thinking-turbo",
            name: "Kimi K2 Thinking Turbo",
            reasoning: true,
            input: ["text"],
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
            contextWindow: 256000,
            maxTokens: 8192,
          },
          // moonshot-kimi-k2-models:end
        ],
      },
    },
  },
}
```

## Kimi Coding

```json5
{
  env: { KIMI_API_KEY: "sk-..." },
  agents: {
    defaults: {
      model: { primary: "kimi-coding/k2p5" },
      models: {
        "kimi-coding/k2p5": { alias: "Kimi K2.5" },
      },
    },
  },
}
```

## Ghi chu

- Tham chieu mo hinh Moonshot su dung `moonshot/<modelId>`. Tham chieu mo hinh Kimi Coding su dung `kimi-coding/<modelId>`.
- Ghi de thong tin gia va metadata ngu canh trong `models.providers` neu can.
- Neu Moonshot cong bo gioi han ngu canh khac cho mot mo hinh, hay dieu chinh
  `contextWindow` tuong ung.
- Su dung `https://api.moonshot.ai/v1` cho endpoint quoc te, va `https://api.moonshot.cn/v1` cho endpoint Trung Quoc.
