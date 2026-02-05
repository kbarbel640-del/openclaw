# Governance Prompt Templates

> 從 builder-governance 和 field-rhythm-kit 專案萃取的可重用 prompt 模板

---

## 📁 目錄

| 模板 | 用途 | 來源專案 |
|-----|------|---------|
| [persona-classification.md](./persona-classification.md) | 四人格分類系統 | field-rhythm-kit |
| [segment-classification.md](./segment-classification.md) | 五段落節奏分類 | field-rhythm-kit |
| [exp-evaluation.md](./exp-evaluation.md) | 經驗值自動計算 | builder-governance |
| [builder-level-report.md](./builder-level-report.md) | 等級狀態報告 | builder-governance |

---

## 🎯 使用場景

### 個人成長追蹤
```
persona-classification → 分類日常輸入
segment-classification → 分析工作節奏
exp-evaluation → 計算成長進度
builder-level-report → 生成進度報告
```

### 團隊治理
```
exp-evaluation → 週期性評估
builder-level-report → 1-on-1 會議材料
```

### AI 日誌系統
```
persona-classification → 輸入自動路由
segment-classification → 日誌結構化
```

---

## 🔧 整合建議

這些模板可以整合到現有的 AI agent 系統：

1. **日誌模組**：用 persona + segment 分類每日輸入
2. **成長模組**：用 exp-evaluation 追蹤貢獻
3. **報告模組**：用 builder-level-report 生成週報/月報

---

## 📝 相關設計文檔

- [builder-governance.md](../../docs/designs/builder-governance.md) — 完整薪資制度設計
- [field-rhythm-kit.md](../../docs/designs/field-rhythm-kit.md) — 完整語場節奏系統設計
