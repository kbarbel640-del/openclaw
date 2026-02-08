---
summary: "Bun 工作流程（實驗性）：安裝方式與相較於 pnpm 的注意事項"
read_when:
  - 你想要最快的本地開發循環（bun + watch）
  - 你遇到 Bun 安裝／修補／生命週期腳本問題
title: "Bun（實驗性）"
x-i18n:
  source_path: install/bun.md
  source_hash: eb3f4c222b6bae49
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:53:34Z
---

# Bun（實驗性）

目標：使用 **Bun** 執行此儲存庫（可選，**不建議** 用於 WhatsApp／Telegram），
且不偏離 pnpm 工作流程。

⚠️ **不建議用於 Gateway 閘道器 執行環境**（WhatsApp／Telegram 的 Bug）。生產環境請使用 Node。

## 狀態

- Bun 是可選的本地執行環境，可直接執行 TypeScript（`bun run …`、`bun --watch …`）。
- `pnpm` 是建置的預設方案，並持續獲得完整支援（且被部分文件工具使用）。
- Bun 無法使用 `pnpm-lock.yaml`，並會忽略它。

## 安裝

預設：

```sh
bun install
```

注意：`bun.lock`／`bun.lockb` 皆已加入 gitignore，因此不論哪種方式都不會造成儲存庫變動。若你想要「不寫入 lockfile」：

```sh
bun install --no-save
```

## 建置／測試（Bun）

```sh
bun run build
bun run vitest run
```

## Bun 生命週期腳本（預設為封鎖）

除非明確信任，否則 Bun 可能會封鎖相依套件的生命週期腳本（`bun pm untrusted`／`bun pm trust`）。
對於此儲存庫而言，常被封鎖的腳本並非必要：

- `@whiskeysockets/baileys` `preinstall`：檢查 Node 主版本是否 >= 20（我們使用 Node 22+）。
- `protobufjs` `postinstall`：輸出不相容版本配置的警告（不產生建置產物）。

如果你遇到確實需要這些腳本的實際執行期問題，請明確信任它們：

```sh
bun pm trust @whiskeysockets/baileys protobufjs
```

## 注意事項

- 部分腳本仍硬編碼使用 pnpm（例如 `docs:build`、`ui:*`、`protocol:check`）。目前請透過 pnpm 執行這些腳本。
