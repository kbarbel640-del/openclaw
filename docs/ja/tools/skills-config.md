---
summary: "Skills 設定スキーマと例"
read_when:
  - Skills 設定の追加または変更
  - バンドルされた許可リストまたはインストール動作の調整
title: "Skills 設定"
x-i18n:
  source_path: tools/skills-config.md
  source_hash: e265c93da7856887
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:12:53Z
---

# Skills 設定

Skills 関連の設定はすべて、`~/.openclaw/openclaw.json` の `skills` 配下にあります。

```json5
{
  skills: {
    allowBundled: ["gemini", "peekaboo"],
    load: {
      extraDirs: ["~/Projects/agent-scripts/skills", "~/Projects/oss/some-skill-pack/skills"],
      watch: true,
      watchDebounceMs: 250,
    },
    install: {
      preferBrew: true,
      nodeManager: "npm", // npm | pnpm | yarn | bun (Gateway runtime still Node; bun not recommended)
    },
    entries: {
      "nano-banana-pro": {
        enabled: true,
        apiKey: "GEMINI_KEY_HERE",
        env: {
          GEMINI_API_KEY: "GEMINI_KEY_HERE",
        },
      },
      peekaboo: { enabled: true },
      sag: { enabled: false },
    },
  },
}
```

## フィールド

- `allowBundled`: **バンドルされた** Skills のみに対する任意の許可リストです。設定すると、リスト内の
  バンドルされた Skills のみが対象になります（managed/workspace Skills は影響を受けません）。
- `load.extraDirs`: 追加でスキャンする Skill ディレクトリ（最も低い優先度）。
- `load.watch`: Skill フォルダーを監視し、Skills スナップショットを更新します（デフォルト: true）。
- `load.watchDebounceMs`: Skill ウォッチャーイベントのデバウンス（ミリ秒）（デフォルト: 250）。
- `install.preferBrew`: 利用可能な場合は brew インストーラーを優先します（デフォルト: true）。
- `install.nodeManager`: node インストーラーの優先設定（`npm` | `pnpm` | `yarn` | `bun`、デフォルト: npm）。
  これは **Skill のインストール** にのみ影響します。Gateway（ゲートウェイ）のランタイムは引き続き Node にする必要があります
  （WhatsApp/Telegram では Bun は推奨されません）。
- `entries.<skillKey>`: Skill ごとのオーバーライド。

Skill ごとのフィールド:

- `enabled`: バンドル/インストールされていても Skill を無効化するには、`false` を設定します。
- `env`: エージェント実行時に注入される環境変数（未設定の場合のみ）。
- `apiKey`: 主要な環境変数を宣言する Skills 向けの任意の利便機能。

## 注記

- `entries` 配下のキーは、デフォルトでは Skill 名に対応します。Skill が
  `metadata.openclaw.skillKey` を定義している場合は、代わりにそのキーを使用してください。
- ウォッチャーが有効な場合、Skills への変更は次回のエージェントターンで取り込まれます。

### サンドボックス化された Skills + 環境変数

セッションが **サンドボックス化** されている場合、Skill プロセスは Docker 内で実行されます。サンドボックスは
ホストの `process.env` を **継承しません**。

次のいずれかを使用してください:

- `agents.defaults.sandbox.docker.env`（またはエージェントごとの `agents.list[].sandbox.docker.env`）
- 環境変数をカスタムサンドボックスイメージに焼き込む

グローバルの `env` と `skills.entries.<skill>.env/apiKey` は、**ホスト** 実行にのみ適用されます。
