/**
 * L0 戰略層模組 - 全局意識
 *
 * 職責：
 * - 跨項目分析
 * - 異常檢測與升級
 * - 戰略方向生成
 * - 資源分配建議
 */

import fs from "node:fs";
import path from "node:path";
import { chat } from "./llm.js";

const WORKSPACE = "/app/workspace";
const CONSCIOUSNESS_DIR = path.join(WORKSPACE, "data/consciousness");
const L0_DIR = path.join(CONSCIOUSNESS_DIR, "L0_wuji");

/**
 * 收集所有 L1 項目的最新狀態
 */
export function gatherL1States(projects) {
  const states = {};

  for (const [projectId, project] of Object.entries(projects)) {
    const dir = path.join(CONSCIOUSNESS_DIR, `L1_${projectId}`);
    states[projectId] = {
      name: project.name,
      digest: null,
      knowledge: null,
      topics: null,
    };

    // 讀取最新智慧摘要
    if (fs.existsSync(dir)) {
      const digestFiles = fs
        .readdirSync(dir)
        .filter((f) => f.startsWith("smart_"))
        .sort()
        .reverse();

      if (digestFiles.length > 0) {
        states[projectId].digest = fs.readFileSync(path.join(dir, digestFiles[0]), "utf-8");
      }

      // 讀取知識庫
      const knowledgeFile = path.join(dir, "knowledge.md");
      if (fs.existsSync(knowledgeFile)) {
        states[projectId].knowledge = fs.readFileSync(knowledgeFile, "utf-8");
      }

      // 讀取主題
      const topicsFile = path.join(dir, "topics.json");
      if (fs.existsSync(topicsFile)) {
        states[projectId].topics = JSON.parse(fs.readFileSync(topicsFile, "utf-8"));
      }
    }
  }

  return states;
}

/**
 * 跨項目分析
 */
export async function crossProjectAnalysis(states) {
  const statesSummary = Object.entries(states)
    .map(([id, state]) => {
      return `### ${state.name} (${id})
${state.digest ? state.digest.substring(0, 2000) : "無數據"}
`;
    })
    .join("\n---\n");

  const prompt = `你是無極的 L0 戰略意識層。分析以下各項目的狀態，找出跨項目的共同趨勢和問題。

${statesSummary}

請分析：

## 跨項目趨勢
（多個項目共同出現的現象或問題）

## 資源分配建議
（哪些項目需要更多關注？哪些可以減少投入？）

## 潛在風險
（如果不處理可能惡化的問題）

## 協同機會
（項目之間可以互相幫助的地方）

用繁體中文，保持戰略高度，不要陷入細節。`;

  return chat([
    { role: "system", content: "你是無極的戰略意識層，負責全局思考和資源調配。" },
    { role: "user", content: prompt },
  ]);
}

/**
 * 異常檢測
 */
export async function detectAnomalies(states) {
  const prompt = `分析以下項目狀態，識別異常情況：

${JSON.stringify(states, null, 2)}

異常類型：
1. 沉默異常 — 某個項目突然沒有對話
2. 情緒異常 — 對話中出現負面情緒升級
3. 模式異常 — 某個問題重複出現但未解決
4. 資源異常 — 某個項目消耗異常高

請輸出 JSON 格式：
{
  "anomalies": [
    {
      "project": "項目ID",
      "type": "異常類型",
      "severity": "low|medium|high|critical",
      "description": "描述",
      "recommendation": "建議處理方式"
    }
  ],
  "summary": "整體異常狀況摘要"
}

如果沒有異常，返回空的 anomalies 陣列。`;

  const response = await chat(
    [
      { role: "system", content: "你是異常檢測系統，用 JSON 格式輸出。" },
      { role: "user", content: prompt },
    ],
    { temperature: 0.1 },
  );

  try {
    // 嘗試解析 JSON
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.error("Failed to parse anomaly response:", e.message);
  }

  return { anomalies: [], summary: "無法解析異常檢測結果" };
}

/**
 * 生成戰略方向
 */
export async function generateStrategy(crossAnalysis, anomalies, currentStrategy = "") {
  const prompt = `根據以下分析結果，更新或確認戰略方向：

## 當前戰略
${currentStrategy || "（尚未定義）"}

## 跨項目分析
${crossAnalysis}

## 異常情況
${JSON.stringify(anomalies, null, 2)}

請生成更新後的戰略方向：

## 核心優先級（最多 3 項）
（當前最需要關注的事項）

## 資源配置
（各項目的關注程度：高/中/低）

## 本週行動項目
（具體要做的事）

## 紅線警戒
（絕對不能發生的事）

用繁體中文，保持簡潔有力。`;

  return chat([
    { role: "system", content: "你是戰略規劃師，負責設定方向和優先級。" },
    { role: "user", content: prompt },
  ]);
}

/**
 * 保存戰略文件
 */
export function saveStrategy(strategy) {
  if (!fs.existsSync(L0_DIR)) {
    fs.mkdirSync(L0_DIR, { recursive: true });
  }

  const today = new Date().toISOString().split("T")[0];

  // 保存當前戰略
  const strategyFile = path.join(L0_DIR, "STRATEGY.md");
  const content = `# 無極戰略方向

> 最後更新: ${today}

${strategy}

---
_此文件由 L0 戰略層自動生成，所有下級 Agent 應遵循_
`;

  fs.writeFileSync(strategyFile, content);

  // 保存歷史版本
  const historyFile = path.join(L0_DIR, `strategy_${today}.md`);
  fs.writeFileSync(historyFile, content);

  return { current: strategyFile, history: historyFile };
}

/**
 * 保存異常記錄
 */
export function saveAnomalies(anomalies) {
  if (!fs.existsSync(L0_DIR)) {
    fs.mkdirSync(L0_DIR, { recursive: true });
  }

  const anomalyFile = path.join(L0_DIR, "anomalies.jsonl");
  const timestamp = new Date().toISOString();

  for (const anomaly of anomalies.anomalies || []) {
    const record = JSON.stringify({ ...anomaly, timestamp }) + "\n";
    fs.appendFileSync(anomalyFile, record);
  }

  return anomalyFile;
}

/**
 * 傳播戰略到下級
 */
export function propagateStrategy(projects) {
  const strategyFile = path.join(L0_DIR, "STRATEGY.md");

  if (!fs.existsSync(strategyFile)) {
    console.log("無戰略文件可傳播");
    return;
  }

  const strategy = fs.readFileSync(strategyFile, "utf-8");

  for (const [projectId, project] of Object.entries(projects)) {
    if (project.agentWorkspace) {
      const targetDir = project.agentWorkspace;
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      const targetFile = path.join(targetDir, "STRATEGY.md");
      fs.writeFileSync(
        targetFile,
        `# 上級戰略方向

> 從 L0 戰略層傳遞

${strategy}
`,
      );
      console.log(`✅ 戰略已傳播到 ${projectId}: ${targetFile}`);
    }
  }
}
