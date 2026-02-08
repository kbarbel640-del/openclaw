---
summary: "高シグナルな Issue とバグ報告の提出方法"
title: "Issue の提出"
x-i18n:
  source_path: help/submitting-an-issue.md
  source_hash: bcb33f05647e9f0d
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T08:14:43Z
---

## Issue の提出

明確で簡潔な Issue は、診断と修正を迅速にします。バグ、リグレッション、または機能の不足については、以下を含めてください。

### 含める内容

- [ ] タイトル: 対象領域 & 症状
- [ ] 最小限の再現手順
- [ ] 期待される結果と実際の結果
- [ ] 影響範囲と重大度
- [ ] 環境: OS、ランタイム、バージョン、設定
- [ ] 証拠: マスキングしたログ、スクリーンショット（非 PII）
- [ ] 範囲: 新規、リグレッション、または長期的に存在
- [ ] 合言葉: Issue に lobster-biscuit を含める
- [ ] 既存の Issue がないか、コードベースと GitHub を検索済み
- [ ] 最近修正または対応されていないことを確認（特にセキュリティ）
- [ ] 主張は証拠または再現手順で裏付ける

簡潔に記載してください。完璧な文法よりも簡潔さを優先します。

検証（PR 前に実行・修正）:

- `pnpm lint`
- `pnpm check`
- `pnpm build`
- `pnpm test`
- プロトコルコードの場合: `pnpm protocol:check`

### テンプレート

#### バグ報告

```md
- [ ] Minimal repro
- [ ] Expected vs actual
- [ ] Environment
- [ ] Affected channels, where not seen
- [ ] Logs/screenshots (redacted)
- [ ] Impact/severity
- [ ] Workarounds

### Summary

### Repro Steps

### Expected

### Actual

### Environment

### Logs/Evidence

### Impact

### Workarounds
```

#### セキュリティ Issue

```md
### Summary

### Impact

### Versions

### Repro Steps (safe to share)

### Mitigation/workaround

### Evidence (redacted)
```

_公開の場では、シークレットやエクスプロイトの詳細を避けてください。機微な Issue については、詳細を最小限にし、非公開での開示を依頼してください。_

#### リグレッション報告

```md
### Summary

### Last Known Good

### First Known Bad

### Repro Steps

### Expected

### Actual

### Environment

### Logs/Evidence

### Impact
```

#### 機能リクエスト

```md
### Summary

### Problem

### Proposed Solution

### Alternatives

### Impact

### Evidence/examples
```

#### 改善提案

```md
### Summary

### Current vs Desired Behavior

### Rationale

### Alternatives

### Evidence/examples
```

#### 調査

```md
### Summary

### Symptoms

### What Was Tried

### Environment

### Logs/Evidence

### Impact
```

### 修正 PR の提出

PR 前の Issue 作成は任意です。省略する場合は、PR に詳細を含めてください。PR は焦点を絞り、Issue 番号を記載し、テストを追加するか未追加の理由を説明し、挙動の変更やリスクを文書化し、証拠としてマスキングしたログやスクリーンショットを含め、提出前に適切な検証を実行してください。
