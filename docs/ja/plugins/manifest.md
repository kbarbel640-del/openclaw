---
summary: "プラグインマニフェスト + JSON Schema 要件（厳格な設定検証）"
read_when:
  - OpenClaw プラグインを構築している場合
  - プラグイン設定スキーマを配布する、またはプラグイン検証エラーをデバッグする必要がある場合
title: "プラグインマニフェスト"
x-i18n:
  source_path: plugins/manifest.md
  source_hash: 47b3e33c915f47bd
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:34:32Z
---

# プラグインマニフェスト（openclaw.plugin.json）

すべてのプラグインは、**プラグインルート**に `openclaw.plugin.json` ファイルを **必ず** 同梱する必要があります。
OpenClaw はこのマニフェストを使用して、**プラグインコードを実行せずに** 設定を検証します。
マニフェストが欠落している、または無効な場合はプラグインエラーとして扱われ、設定検証がブロックされます。

プラグインシステムの完全なガイドについては、[Plugins](/plugin) を参照してください。

## 必須フィールド

```json
{
  "id": "voice-call",
  "configSchema": {
    "type": "object",
    "additionalProperties": false,
    "properties": {}
  }
}
```

必須キー:

- `id`（string）: 正規のプラグイン ID。
- `configSchema`（object）: プラグイン設定用の JSON Schema（インライン）。

任意キー:

- `kind`（string）: プラグイン種別（例: `"memory"`）。
- `channels`（array）: このプラグインが登録するチャンネル ID（例: `["matrix"]`）。
- `providers`（array）: このプラグインが登録するプロバイダー ID。
- `skills`（array）: 読み込む Skills ディレクトリ（プラグインルートからの相対パス）。
- `name`（string）: プラグインの表示名。
- `description`（string）: プラグインの短い要約。
- `uiHints`（object）: UI 描画用の設定フィールドのラベル／プレースホルダー／機密フラグ。
- `version`（string）: プラグインのバージョン（情報用）。

## JSON Schema 要件

- **すべてのプラグインは JSON Schema を同梱する必要があります**。設定を受け付けない場合でも同様です。
- 空のスキーマも許可されます（例: `{ "type": "object", "additionalProperties": false }`）。
- スキーマは実行時ではなく、設定の読み書き時に検証されます。

## 検証の挙動

- 不明な `channels.*` キーは、該当するチャンネル ID がプラグインマニフェストで宣言されていない限り **エラー** になります。
- `plugins.entries.<id>`、`plugins.allow`、`plugins.deny`、および `plugins.slots.*` は、**検出可能** なプラグイン ID を参照している必要があります。不明な ID は **エラー** です。
- プラグインがインストールされているものの、マニフェストまたはスキーマが破損している、もしくは欠落している場合、検証は失敗し、Doctor がプラグインエラーを報告します。
- プラグイン設定が存在するが、プラグインが **無効** の場合、設定は保持され、Doctor とログに **警告** が表示されます。

## 注意事項

- マニフェストは、ローカルファイルシステムからの読み込みを含め、**すべてのプラグインで必須** です。
- 実行時はプラグインモジュールを別途読み込みます。マニフェストは検出 + 検証のためだけに使用されます。
- プラグインがネイティブモジュールに依存する場合は、ビルド手順およびパッケージマネージャーの許可リスト要件（例: pnpm `allow-build-scripts` - `pnpm rebuild <package>`）を文書化してください。
