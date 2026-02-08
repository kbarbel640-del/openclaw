---
summary: "OpenClaw が環境変数を読み込む場所とその優先順位"
read_when:
  - どの環境変数が、どの順序で読み込まれるかを把握する必要がある場合
  - Gateway（ゲートウェイ）で API キーが見つからない問題をデバッグしている場合
  - プロバイダーの認証やデプロイ環境をドキュメント化している場合
title: "環境変数"
x-i18n:
  source_path: help/environment.md
  source_hash: b49ae50e5d306612
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T08:14:43Z
---

# 環境変数

OpenClaw は複数のソースから環境変数を取得します。ルールは **既存の値を決して上書きしない** ことです。

## 優先順位（高い → 低い）

1. **プロセス環境**（Gateway（ゲートウェイ）プロセスが親のシェル／デーモンから既に受け取っているもの）。
2. **カレントワーキングディレクトリの `.env`**（dotenv のデフォルト；上書きしません）。
3. **`~/.openclaw/.env` にあるグローバルな `.env`**（別名 `$OPENCLAW_STATE_DIR/.env`；上書きしません）。
4. **`~/.openclaw/openclaw.json` 内の Config `env` ブロック**（不足している場合のみ適用）。
5. **任意のログインシェルからのインポート**（`env.shellEnv.enabled` または `OPENCLAW_LOAD_SHELL_ENV=1`）。期待されるキーが不足している場合にのみ適用されます。

設定ファイル自体が存在しない場合は、手順 4 はスキップされます。シェルのインポートは、有効であれば引き続き実行されます。

## Config `env` ブロック

インラインで環境変数を設定する同等の 2 つの方法があります（いずれも上書きしません）：

```json5
{
  env: {
    OPENROUTER_API_KEY: "sk-or-...",
    vars: {
      GROQ_API_KEY: "gsk-...",
    },
  },
}
```

## シェルの環境変数インポート

`env.shellEnv` はログインシェルを実行し、**不足している** 期待されるキーのみをインポートします：

```json5
{
  env: {
    shellEnv: {
      enabled: true,
      timeoutMs: 15000,
    },
  },
}
```

環境変数での指定：

- `OPENCLAW_LOAD_SHELL_ENV=1`
- `OPENCLAW_SHELL_ENV_TIMEOUT_MS=15000`

## 設定内での環境変数の置換

設定の文字列値では、`${VAR_NAME}` 構文を使用して環境変数を直接参照できます：

```json5
{
  models: {
    providers: {
      "vercel-gateway": {
        apiKey: "${VERCEL_GATEWAY_API_KEY}",
      },
    },
  },
}
```

詳細については、[Configuration: Env var substitution](/gateway/configuration#env-var-substitution-in-config) を参照してください。

## 関連

- [Gateway configuration](/gateway/configuration)
- [FAQ: env vars and .env loading](/help/faq#env-vars-and-env-loading)
- [Models overview](/concepts/models)
