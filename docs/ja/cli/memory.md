---
summary: "CLI リファレンス（`openclaw memory` の status/index/search）"
read_when:
  - セマンティックメモリをインデックス化または検索したい場合
  - メモリの利用可否やインデックス作成のデバッグをしている場合
title: "memory"
x-i18n:
  source_path: cli/memory.md
  source_hash: 95a9e94306f95be2
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T04:55:45Z
---

# `openclaw memory`

セマンティックメモリのインデックス作成と検索を管理します。
アクティブなメモリプラグインによって提供されます（デフォルト: `memory-core`; 無効にするには `plugins.slots.memory = "none"` を設定します）。

関連:

- メモリの概念: [Memory](/concepts/memory)
- プラグイン: [Plugins](/plugins)

## 例

```bash
openclaw memory status
openclaw memory status --deep
openclaw memory status --deep --index
openclaw memory status --deep --index --verbose
openclaw memory index
openclaw memory index --verbose
openclaw memory search "release checklist"
openclaw memory status --agent main
openclaw memory index --agent main --verbose
```

## オプション

共通:

- `--agent <id>`: 単一のエージェントにスコープします（デフォルト: 設定済みのすべてのエージェント）。
- `--verbose`: プローブおよびインデックス作成中に詳細ログを出力します。

注記:

- `memory status --deep` は、ベクター + 埋め込みの利用可否をプローブします。
- `memory status --deep --index` は、ストアがダーティな場合に再インデックスを実行します。
- `memory index --verbose` は、フェーズごとの詳細（プロバイダー、モデル、ソース、バッチアクティビティ）を出力します。
- `memory status` には、`memorySearch.extraPaths` を通じて設定された追加パスも含まれます。
