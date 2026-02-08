---
summary: "apply_patch ツールで複数ファイルのパッチを適用します"
read_when:
  - 複数ファイルにまたがる構造化されたファイル編集が必要な場合
  - パッチベースの編集を文書化またはデバッグしたい場合
title: "apply_patch ツール"
x-i18n:
  source_path: tools/apply-patch.md
  source_hash: 8cec2b4ee3afa910
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:13:05Z
---

# apply_patch ツール

構造化されたパッチ形式を使用してファイル変更を適用します。これは、単一の `edit` 呼び出しでは脆くなりがちな、複数ファイルまたは複数ハンクの編集に最適です。

このツールは、1 つ以上のファイル操作をラップする単一の `input` 文字列を受け付けます。

```
*** Begin Patch
*** Add File: path/to/file.txt
+line 1
+line 2
*** Update File: src/app.ts
@@
-old line
+new line
*** Delete File: obsolete.txt
*** End Patch
```

## パラメータ

- `input`（必須）: `*** Begin Patch` と `*** End Patch` を含む完全なパッチ内容。

## 注記

- パスはワークスペースルートからの相対パスとして解決されます。
- ファイル名を変更するには、`*** Update File:` ハンク内で `*** Move to:` を使用します。
- `*** End of File` は、必要に応じて EOF のみの挿入を示します。
- これは実験的機能であり、デフォルトでは無効です。`tools.exec.applyPatch.enabled` で有効化します。
- OpenAI 専用（OpenAI Codex を含む）です。必要に応じて、`tools.exec.applyPatch.allowModels` によりモデル別にゲートできます。
- 設定は `tools.exec` 配下にのみあります。

## 例

```json
{
  "tool": "apply_patch",
  "input": "*** Begin Patch\n*** Update File: src/index.ts\n@@\n-const foo = 1\n+const foo = 2\n*** End Patch"
}
```
