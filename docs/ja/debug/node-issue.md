---
summary: Node + tsx 「__name is not a function」クラッシュのメモと回避策
read_when:
  - Node のみの開発スクリプトやウォッチモードの失敗をデバッグする場合
  - OpenClaw における tsx/esbuild ローダーのクラッシュを調査する場合
title: "Node + tsx クラッシュ"
x-i18n:
  source_path: debug/node-issue.md
  source_hash: f9e9bd2281508337
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:14:04Z
---

# Node + tsx 「\_\_name is not a function」クラッシュ

## 概要

Node で `tsx` を使って OpenClaw を実行すると、起動時に次のエラーで失敗します。

```
[openclaw] Failed to start CLI: TypeError: __name is not a function
    at createSubsystemLogger (.../src/logging/subsystem.ts:203:25)
    at .../src/agents/auth-profiles/constants.ts:25:20
```

これは、開発スクリプトを Bun から `tsx`（コミット `2871657e`、2026-01-06）に切り替えた後に発生し始めました。同じランタイムパスは Bun では動作していました。

## 環境

- Node: v25.x（v25.3.0 で確認）
- tsx: 4.21.0
- OS: macOS（Node 25 が動作する他プラットフォームでも再現する可能性があります）

## 再現手順（Node のみ）

```bash
# in repo root
node --version
pnpm install
node --import tsx src/entry.ts status
```

## リポジトリ内での最小再現

```bash
node --import tsx scripts/repro/tsx-name-repro.ts
```

## Node バージョン確認

- Node 25.3.0: 失敗
- Node 22.22.0（Homebrew `node@22`）: 失敗
- Node 24: まだこの環境には未インストール。要検証

## メモ / 仮説

- `tsx` は esbuild を使って TS/ESM を変換します。esbuild の `keepNames` は `__name` ヘルパーを出力し、関数定義を `__name(...)` でラップします。
- このクラッシュは、実行時に `__name` は存在するものの関数ではないことを示しています。これは、Node 25 のローダーパスにおいて、このモジュールのヘルパーが欠落しているか、上書きされていることを示唆します。
- 同様の `__name` ヘルパー問題は、ヘルパーが欠落している、または書き換えられる場合に、他の esbuild 利用者でも報告されています。

## 回帰履歴

- `2871657e`（2026-01-06）: Bun を任意にするため、スクリプトを Bun から tsx に変更しました。
- それ以前（Bun パス）では、`openclaw status` と `gateway:watch` は動作していました。

## 回避策

- 開発スクリプトに Bun を使用します（現在の一時的な差し戻し）。
- Node + tsc watch を使用し、その後コンパイル済み出力を実行します:
  ```bash
  pnpm exec tsc --watch --preserveWatchOutput
  node --watch openclaw.mjs status
  ```
- ローカルで確認済み: `pnpm exec tsc -p tsconfig.json` + `node openclaw.mjs status` は Node 25 で動作します。
- 可能であれば TS ローダーで esbuild keepNames を無効化します（`__name` ヘルパーの挿入を防止します）。tsx は現在これを公開していません。
- `tsx` で Node LTS（22/24）をテストし、この問題が Node 25 固有かどうかを確認します。

## 参考

- https://opennext.js.org/cloudflare/howtos/keep_names
- https://esbuild.github.io/api/#keep-names
- https://github.com/evanw/esbuild/issues/1031

## 次のステップ

- Node 22/24 で再現し、Node 25 の回帰であることを確認します。
- `tsx` nightly をテストするか、既知の回帰がある場合は以前のバージョンに固定します。
- Node LTS でも再現する場合は、`__name` のスタックトレースを添えて、上流に最小再現を提出します。
