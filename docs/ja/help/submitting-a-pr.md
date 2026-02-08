---
summary: "高いシグナルの PR を提出する方法"
title: "PR の提出"
x-i18n:
  source_path: help/submitting-a-pr.md
  source_hash: 277b0f51b948d1a9
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T08:14:46Z
---

良い PR はレビューしやすいものです。レビュアーは意図をすばやく把握し、挙動を検証し、安全に変更をマージできる必要があります。このガイドでは、人間および LLM レビュー向けに、簡潔で高シグナルな提出方法を説明します。

## 良い PR の条件

- [ ] 問題点、重要性、変更内容を説明する。
- [ ] 変更範囲を絞る。大規模なリファクタリングは避ける。
- [ ] ユーザー可視 / 設定 / デフォルトの変更を要約する。
- [ ] テストカバレッジ、スキップ項目、その理由を記載する。
- [ ] 証拠を追加する: ログ、スクリーンショット、または録画（UI/UX）。
- [ ] コードワード: このガイドを読んだ場合、PR の説明に「lobster-biscuit」を記載する。
- [ ] PR 作成前に、関連する `pnpm` コマンドを実行し、失敗を修正する。
- [ ] 関連する機能 / issue / 修正について、コードベースおよび GitHub を検索する。
- [ ] 主張は証拠または観察に基づかせる。
- [ ] 良いタイトル: 動詞 + スコープ + 成果（例: `Docs: add PR and issue templates`）。

簡潔さを重視してください。文法よりも簡潔なレビューが優先されます。該当しないセクションは省略してください。

### ベースライン検証コマンド（変更に対して実行し、失敗を修正）

- `pnpm lint`
- `pnpm check`
- `pnpm build`
- `pnpm test`
- プロトコル変更: `pnpm protocol:check`

## 段階的な情報開示

- 最初: 要約 / 意図
- 次: 変更点 / リスク
- 次: テスト / 検証
- 最後: 実装 / 証拠

## 一般的な PR タイプ: 具体事項

- [ ] 修正: 再現手順、根本原因、検証方法を追加する。
- [ ] 機能: ユースケース、挙動 / デモ / スクリーンショット（UI）を追加する。
- [ ] リファクタ: 「挙動変更なし」と明記し、移動 / 簡素化した内容を列挙する。
- [ ] 雑務: 理由を明記する（例: ビルド時間、CI、依存関係）。
- [ ] ドキュメント: 変更前 / 後の文脈、更新したページへのリンク、`pnpm format` を実行する。
- [ ] テスト: どのギャップをカバーするか、どのように回帰を防ぐか。
- [ ] パフォーマンス: 変更前 / 後の指標と測定方法を追加する。
- [ ] UX/UI: スクリーンショット / 動画を追加し、アクセシビリティへの影響を記載する。
- [ ] インフラ / ビルド: 環境 / 検証内容を記載する。
- [ ] セキュリティ: リスク、再現、検証を要約し、機密データは含めない。根拠のある主張のみとする。

## チェックリスト

- [ ] 明確な問題 / 意図
- [ ] 集中したスコープ
- [ ] 挙動変更の一覧
- [ ] テスト内容と結果
- [ ] 手動テスト手順（該当する場合）
- [ ] 秘密情報 / 個人データなし
- [ ] 証拠に基づいている

## 一般 PR テンプレート

```md
#### Summary

#### Behavior Changes

#### Codebase and GitHub Search

#### Tests

#### Manual Testing (omit if N/A)

### Prerequisites

-

### Steps

1.
2.

#### Evidence (omit if N/A)

**Sign-Off**

- Models used:
- Submitter effort (self-reported):
- Agent notes (optional, cite evidence):
```

## PR タイプ別テンプレート（該当タイプに置き換えてください）

### 修正

```md
#### Summary

#### Repro Steps

#### Root Cause

#### Behavior Changes

#### Tests

#### Manual Testing (omit if N/A)

### Prerequisites

-

### Steps

1.
2.

#### Evidence (omit if N/A)

**Sign-Off**

- Models used:
- Submitter effort:
- Agent notes:
```

### 機能

```md
#### Summary

#### Use Cases

#### Behavior Changes

#### Existing Functionality Check

- [ ] I searched the codebase for existing functionality.
      Searches performed (1-3 bullets):
  -
  -

#### Tests

#### Manual Testing (omit if N/A)

### Prerequisites

-

### Steps

1.
2.

#### Evidence (omit if N/A)

**Sign-Off**

- Models used:
- Submitter effort:
- Agent notes:
```

### リファクタ

```md
#### Summary

#### Scope

#### No Behavior Change Statement

#### Tests

#### Manual Testing (omit if N/A)

### Prerequisites

-

### Steps

1.
2.

#### Evidence (omit if N/A)

**Sign-Off**

- Models used:
- Submitter effort:
- Agent notes:
```

### 雑務 / メンテナンス

```md
#### Summary

#### Why This Matters

#### Tests

#### Manual Testing (omit if N/A)

### Prerequisites

-

### Steps

1.
2.

#### Evidence (omit if N/A)

**Sign-Off**

- Models used:
- Submitter effort:
- Agent notes:
```

### ドキュメント

```md
#### Summary

#### Pages Updated

#### Before/After

#### Formatting

pnpm format

#### Evidence (omit if N/A)

**Sign-Off**

- Models used:
- Submitter effort:
- Agent notes:
```

### テスト

```md
#### Summary

#### Gap Covered

#### Tests

#### Manual Testing (omit if N/A)

### Prerequisites

-

### Steps

1.
2.

#### Evidence (omit if N/A)

**Sign-Off**

- Models used:
- Submitter effort:
- Agent notes:
```

### パフォーマンス

```md
#### Summary

#### Baseline

#### After

#### Measurement Method

#### Tests

#### Manual Testing (omit if N/A)

### Prerequisites

-

### Steps

1.
2.

#### Evidence (omit if N/A)

**Sign-Off**

- Models used:
- Submitter effort:
- Agent notes:
```

### UX/UI

```md
#### Summary

#### Screenshots or Video

#### Accessibility Impact

#### Tests

#### Manual Testing

### Prerequisites

-

### Steps

1.
2. **Sign-Off**

- Models used:
- Submitter effort:
- Agent notes:
```

### インフラ / ビルド

```md
#### Summary

#### Environments Affected

#### Validation Steps

#### Manual Testing (omit if N/A)

### Prerequisites

-

### Steps

1.
2.

#### Evidence (omit if N/A)

**Sign-Off**

- Models used:
- Submitter effort:
- Agent notes:
```

### セキュリティ

```md
#### Summary

#### Risk Summary

#### Repro Steps

#### Mitigation or Fix

#### Verification

#### Tests

#### Manual Testing (omit if N/A)

### Prerequisites

-

### Steps

1.
2.

#### Evidence (omit if N/A)

**Sign-Off**

- Models used:
- Submitter effort:
- Agent notes:
```
