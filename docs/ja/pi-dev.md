---
title: "Pi 開発ワークフロー"
x-i18n:
  source_path: pi-dev.md
  source_hash: 65bd0580dd03df05
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:34:11Z
---

# Pi 開発ワークフロー

このガイドは、OpenClaw における Pi 統合の作業に向けた、健全なワークフローを要約しています。

## 型チェックとリンティング

- 型チェックとビルド: `pnpm build`
- リント: `pnpm lint`
- フォーマットチェック: `pnpm format`
- プッシュ前のフルゲート: `pnpm lint && pnpm build && pnpm test`

## Pi テストの実行

Pi 統合のテストセット専用のスクリプトを使用します。

```bash
scripts/pi/run-tests.sh
```

実際のプロバイダーの挙動を検証するライブテストを含めるには、次を使用します。

```bash
scripts/pi/run-tests.sh --live
```

このスクリプトは、以下の glob を通じて Pi 関連のユニットテストをすべて実行します。

- `src/agents/pi-*.test.ts`
- `src/agents/pi-embedded-*.test.ts`
- `src/agents/pi-tools*.test.ts`
- `src/agents/pi-settings.test.ts`
- `src/agents/pi-tool-definition-adapter.test.ts`
- `src/agents/pi-extensions/*.test.ts`

## 手動テスト

推奨フロー:

- 開発モードで Gateway（ゲートウェイ）を実行します:
  - `pnpm gateway:dev`
- エージェントを直接トリガーします:
  - `pnpm openclaw agent --message "Hello" --thinking low`
- 対話的なデバッグには TUI を使用します:
  - `pnpm tui`

ツール呼び出しの挙動を確認するには、`read` または `exec` のアクションをプロンプトしてください。これにより、ツールのストリーミングとペイロードの処理を確認できます。

## クリーンスレートのリセット

状態は OpenClaw の状態ディレクトリ配下に保存されます。デフォルトは `~/.openclaw` です。`OPENCLAW_STATE_DIR` が設定されている場合は、代わりにそのディレクトリを使用します。

すべてをリセットするには:

- 設定用: `openclaw.json`
- 認証プロファイルとトークン用: `credentials/`
- エージェントのセッション履歴用: `agents/<agentId>/sessions/`
- セッションインデックス用: `agents/<agentId>/sessions.json`
- レガシーパスが存在する場合: `sessions/`
- 空のワークスペースにしたい場合: `workspace/`

セッションのみをリセットしたい場合は、そのエージェントに対して `agents/<agentId>/sessions/` と `agents/<agentId>/sessions.json` を削除します。再認証したくない場合は、`credentials/` を保持してください。

## 参考資料

- https://docs.openclaw.ai/testing
- https://docs.openclaw.ai/start/getting-started
