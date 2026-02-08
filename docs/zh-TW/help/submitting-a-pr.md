---
summary: "如何提交高訊號的 PR"
title: "提交 PR"
x-i18n:
  source_path: help/submitting-a-pr.md
  source_hash: 277b0f51b948d1a9
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T08:15:06Z
---

好的 PR 容易審查：審查者應能快速了解意圖、驗證行為，並安全地合併變更。本指南涵蓋適合人類與 LLM 審查的精簡、高訊號提交方式。

## 什麼造就一個好的 PR

- [ ] 說明問題、其重要性，以及所做的變更。
- [ ] 保持變更聚焦。避免大範圍重構。
- [ ] 彙總使用者可見／設定／預設值的變更。
- [ ] 列出測試涵蓋、略過項目與原因。
- [ ] 加入佐證：日誌、螢幕截圖或錄影（UI/UX）。
- [ ] 暗號：如果你讀過本指南，請在 PR 描述中放入「lobster-biscuit」。
- [ ] 建立 PR 前，請執行／修正相關的 `pnpm` 指令。
- [ ] 在程式碼庫與 GitHub 搜尋相關功能／議題／修正。
- [ ] 主張需基於證據或觀察。
- [ ] 好的標題：動詞 + 範圍 + 結果（例如：`Docs: add PR and issue templates`）。

力求精簡；精簡的審查勝過文法。省略任何不適用的章節。

### 基線驗證指令（針對你的變更執行／修正失敗）

- `pnpm lint`
- `pnpm check`
- `pnpm build`
- `pnpm test`
- 協定變更：`pnpm protocol:check`

## 漸進式揭露

- 最上：摘要／意圖
- 接著：變更／風險
- 接著：測試／驗證
- 最後：實作／佐證

## 常見 PR 類型：重點說明

- [ ] 修正（Fix）：加入重現步驟、根因、驗證方式。
- [ ] 功能（Feature）：加入使用情境、行為／示範／螢幕截圖（UI）。
- [ ] 重構（Refactor）：註明「無行為變更」，列出移動／簡化的內容。
- [ ] 雜項（Chore）：說明原因（例如：建置時間、CI、相依套件）。
- [ ] 文件（Docs）：前後對照、連結更新頁面，執行 `pnpm format`。
- [ ] 測試（Test）：涵蓋了哪個缺口；如何防止回歸。
- [ ] 效能（Perf）：加入前／後指標，以及量測方式。
- [ ] UX/UI：螢幕截圖／影片，註明無障礙影響。
- [ ] 基礎設施／建置（Infra/Build）：環境／驗證。
- [ ] 安全性（Security）：彙總風險、重現、驗證，不含敏感資料。僅限有根據的主張。

## 檢查清單

- [ ] 清楚的問題／意圖
- [ ] 聚焦的範圍
- [ ] 列出行為變更
- [ ] 列出測試與結果
- [ ] 手動測試步驟（如適用）
- [ ] 無機密／私人資料
- [ ] 以證據為本

## 一般 PR 範本

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

## PR 類型範本（以你的類型取代）

### 修正（Fix）

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

### 功能（Feature）

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

### 重構（Refactor）

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

### 雜項／維護（Chore/Maintenance）

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

### 文件（Docs）

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

### 測試（Test）

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

### 效能（Perf）

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

### 基礎設施／建置（Infra/Build）

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

### 安全性（Security）

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
