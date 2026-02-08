#!/usr/bin/env node
/**
 * 意識蒸餾腳本 v2 - 使用 LLM 進行智慧蒸餾
 *
 * Usage:
 *   node distill-v2.js daily bita     # LLM 智慧蒸餾
 *   node distill-v2.js knowledge bita # 提取知識點
 *   node distill-v2.js weekly         # L0 戰略週報
 *   node distill-v2.js inject bita    # 注入直覺到下級
 *   node distill-v2.js strategy       # L0 戰略分析（跨項目 + 異常 + 戰略）
 *   node distill-v2.js propagate      # 傳播戰略到下級
 */

import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  gatherL1States,
  crossProjectAnalysis,
  detectAnomalies,
  generateStrategy,
  saveStrategy,
  saveAnomalies,
  propagateStrategy,
} from "./lib/l0-strategy.js";
import { distillConversation, extractKnowledge, generateWeeklyReport } from "./lib/llm.js";

const WORKSPACE = "/app/workspace";
const DB_PATH = path.join(WORKSPACE, "data/timeline.db");
const CONSCIOUSNESS_DIR = path.join(WORKSPACE, "data/consciousness");

// 項目配置
const PROJECTS = {
  bita: {
    name: "幣塔",
    resolvedProject: "幣塔",
    agentWorkspace: "/app/workspace/agents/bita",
    groups: [
      "-5148508655",
      "-5159438640",
      "-5030731997",
      "-5070604096",
      "-5186655303",
      "-5295280162",
      "-5023713246",
      "-5297227033",
      "-1003849990504",
    ],
  },
  xo: {
    name: "XO",
    resolvedProject: "Jamie",
    agentWorkspace: "/app/workspace/agents/xo",
    groups: ["-5236199765"],
  },
};

function getDb() {
  return new DatabaseSync(DB_PATH);
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * 獲取項目的今日對話
 */
function getTodayMessages(projectId) {
  const db = getDb();
  const project = PROJECTS[projectId];
  if (!project) return [];

  const today = new Date().toISOString().split("T")[0];

  const sql = `
    SELECT
      timestamp,
      resolved_chat_name as chat,
      resolved_sender_name as sender,
      content,
      direction
    FROM messages
    WHERE date(timestamp) = ?
      AND resolved_project = ?
    ORDER BY timestamp ASC
  `;

  try {
    const stmt = db.prepare(sql);
    return stmt.all(today, project.resolvedProject);
  } catch (err) {
    console.error("Query error:", err.message);
    return [];
  }
}

/**
 * 獲取最近 N 天的對話
 */
function getRecentMessages(projectId, days = 7) {
  const db = getDb();
  const project = PROJECTS[projectId];
  if (!project) return [];

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const sql = `
    SELECT
      timestamp,
      resolved_chat_name as chat,
      resolved_sender_name as sender,
      content,
      direction
    FROM messages
    WHERE date(timestamp) >= ?
      AND resolved_project = ?
    ORDER BY timestamp ASC
  `;

  try {
    const stmt = db.prepare(sql);
    return stmt.all(startDate.toISOString().split("T")[0], project.resolvedProject);
  } catch (err) {
    console.error("Query error:", err.message);
    return [];
  }
}

/**
 * 格式化對話
 */
function formatMessages(messages) {
  if (messages.length === 0) return "今日無對話記錄。";

  let output = "";
  for (const msg of messages) {
    const time = msg.timestamp.split("T")[1]?.substring(0, 5) || "";
    const sender = msg.sender || "系統";
    const direction = msg.direction === "outbound" ? "🤖" : "👤";
    const content = (msg.content || "").substring(0, 300);
    output += `[${time}] ${direction} ${sender}: ${content}\n`;
  }
  return output;
}

/**
 * LLM 智慧蒸餾 - 每日摘要
 */
async function smartDailyDigest(projectId) {
  const project = PROJECTS[projectId];
  const messages = getTodayMessages(projectId);
  const today = new Date().toISOString().split("T")[0];

  console.log(`📊 ${project.name}: ${messages.length} 條消息`);

  if (messages.length === 0) {
    console.log(`   跳過（無對話）`);
    return null;
  }

  const formatted = formatMessages(messages);

  // 限制輸入長度（約 8000 字符）
  const truncated =
    formatted.length > 8000 ? formatted.substring(0, 8000) + "\n... (已截斷)" : formatted;

  console.log(`🧠 調用 LLM 蒸餾...`);
  const digest = await distillConversation(truncated, project.name);

  // 組合最終輸出
  const output = `# ${project.name} 智慧摘要 - ${today}

## 統計
- 對話數: ${messages.length}
- 參與者: ${[...new Set(messages.map((m) => m.sender))].filter(Boolean).join(", ")}

${digest}

---
_LLM 蒸餾於 ${new Date().toISOString()}_
`;

  // 寫入文件
  const dir = path.join(CONSCIOUSNESS_DIR, `L1_${projectId}`);
  ensureDir(dir);

  const filename = path.join(dir, `smart_${today}.md`);
  fs.writeFileSync(filename, output);
  console.log(`✅ 智慧摘要已保存: ${filename}`);

  return { messages: messages.length, file: filename, digest };
}

/**
 * 提取知識點並累積到知識庫
 */
async function extractAndAccumulateKnowledge(projectId) {
  const project = PROJECTS[projectId];
  const messages = getRecentMessages(projectId, 7);

  console.log(`📚 ${project.name}: 分析最近 7 天 ${messages.length} 條消息`);

  if (messages.length === 0) {
    console.log(`   跳過（無對話）`);
    return null;
  }

  const dir = path.join(CONSCIOUSNESS_DIR, `L1_${projectId}`);
  ensureDir(dir);

  // 讀取現有知識庫
  const knowledgeFile = path.join(dir, "knowledge.md");
  const existingKnowledge = fs.existsSync(knowledgeFile)
    ? fs.readFileSync(knowledgeFile, "utf-8")
    : "";

  const formatted = formatMessages(messages);
  const truncated =
    formatted.length > 8000 ? formatted.substring(0, 8000) + "\n... (已截斷)" : formatted;

  console.log(`🧠 調用 LLM 提取知識...`);
  const newKnowledge = await extractKnowledge(truncated, existingKnowledge);

  if (newKnowledge.includes("無新增")) {
    console.log(`   無新增知識`);
    return null;
  }

  // 累積知識
  const today = new Date().toISOString().split("T")[0];
  const updated = `${existingKnowledge}

---
## ${today} 更新

${newKnowledge}
`;

  fs.writeFileSync(knowledgeFile, updated);
  console.log(`✅ 知識庫已更新: ${knowledgeFile}`);

  return { file: knowledgeFile };
}

/**
 * 生成 L0 戰略週報
 */
async function smartWeeklyReport() {
  console.log(`📈 生成 L0 戰略週報...`);

  // 收集各項目的最近摘要
  let projectDigests = "";

  for (const [projectId, project] of Object.entries(PROJECTS)) {
    const dir = path.join(CONSCIOUSNESS_DIR, `L1_${projectId}`);

    // 找最近的智慧摘要
    const files = fs.existsSync(dir)
      ? fs
          .readdirSync(dir)
          .filter((f) => f.startsWith("smart_"))
          .sort()
          .reverse()
      : [];

    if (files.length > 0) {
      const latestFile = path.join(dir, files[0]);
      const content = fs.readFileSync(latestFile, "utf-8");
      projectDigests += `\n### ${project.name}\n${content}\n`;
    } else {
      projectDigests += `\n### ${project.name}\n無最近數據\n`;
    }
  }

  console.log(`🧠 調用 LLM 生成週報...`);
  const report = await generateWeeklyReport(projectDigests);

  const today = new Date().toISOString().split("T")[0];
  const output = `# 無極戰略週報 - ${today}

${report}

---
_L0 意識生成於 ${new Date().toISOString()}_
`;

  const dir = path.join(CONSCIOUSNESS_DIR, "L0_wuji");
  ensureDir(dir);

  const filename = path.join(dir, `strategy_${today}.md`);
  fs.writeFileSync(filename, output);
  console.log(`✅ 戰略週報已保存: ${filename}`);

  return { file: filename };
}

/**
 * L0 戰略分析 - 完整流程
 */
async function runL0Strategy() {
  console.log(`\n🎯 ===== L0 戰略層分析 =====\n`);

  // 1. 收集 L1 狀態
  console.log(`📊 收集各項目狀態...`);
  const states = gatherL1States(PROJECTS);

  const projectsWithData = Object.entries(states)
    .filter(([, s]) => s.digest)
    .map(([id]) => id);
  console.log(`   有數據的項目: ${projectsWithData.join(", ") || "無"}`);

  if (projectsWithData.length === 0) {
    console.log(`⚠️ 無項目數據，跳過戰略分析`);
    return;
  }

  // 2. 跨項目分析
  console.log(`\n🔍 跨項目分析...`);
  const crossAnalysis = await crossProjectAnalysis(states);
  console.log(`   完成`);

  // 3. 異常檢測
  console.log(`\n🚨 異常檢測...`);
  const anomalies = await detectAnomalies(states);
  console.log(`   發現 ${anomalies.anomalies?.length || 0} 個異常`);

  if (anomalies.anomalies?.length > 0) {
    saveAnomalies(anomalies);
    console.log(`   異常已記錄`);

    // 顯示高優先級異常
    const highPriority = anomalies.anomalies.filter(
      (a) => a.severity === "high" || a.severity === "critical",
    );
    if (highPriority.length > 0) {
      console.log(`\n   ⚠️ 高優先級異常:`);
      for (const a of highPriority) {
        console.log(`      - [${a.severity}] ${a.project}: ${a.description}`);
      }
    }
  }

  // 4. 讀取當前戰略
  const L0_DIR = path.join(CONSCIOUSNESS_DIR, "L0_wuji");
  const currentStrategyFile = path.join(L0_DIR, "STRATEGY.md");
  const currentStrategy = fs.existsSync(currentStrategyFile)
    ? fs.readFileSync(currentStrategyFile, "utf-8")
    : "";

  // 5. 生成戰略
  console.log(`\n📋 生成戰略方向...`);
  const strategy = await generateStrategy(crossAnalysis, anomalies, currentStrategy);

  // 6. 保存戰略
  const saved = saveStrategy(strategy);
  console.log(`✅ 戰略已保存: ${saved.current}`);

  // 7. 傳播到下級
  console.log(`\n📡 傳播戰略到下級...`);
  propagateStrategy(PROJECTS);

  console.log(`\n🎯 ===== L0 戰略分析完成 =====\n`);

  return { crossAnalysis, anomalies, strategy };
}

/**
 * 注入直覺到下級 Agent
 */
async function injectIntuition(projectId) {
  const project = PROJECTS[projectId];
  const dir = path.join(CONSCIOUSNESS_DIR, `L1_${projectId}`);

  console.log(`💉 注入直覺到 ${project.name} Agent...`);

  // 讀取知識庫
  const knowledgeFile = path.join(dir, "knowledge.md");
  const knowledge = fs.existsSync(knowledgeFile) ? fs.readFileSync(knowledgeFile, "utf-8") : "";

  if (!knowledge) {
    console.log(`   無知識庫可注入`);
    return null;
  }

  // 生成直覺文件（注入到 Agent workspace）
  const intuitionFile = path.join(project.agentWorkspace, "INTUITION.md");
  ensureDir(project.agentWorkspace);

  const intuition = `# INTUITION.md - 上級傳遞的直覺

> 這些是從歷史對話中蒸餾出的智慧，自動注入。
> 你不需要理解為什麼，只需要在處理相關問題時參考。

${knowledge}

---
_最後更新: ${new Date().toISOString()}_
`;

  fs.writeFileSync(intuitionFile, intuition);
  console.log(`✅ 直覺已注入: ${intuitionFile}`);

  return { file: intuitionFile };
}

// CLI
const [, , command, arg] = process.argv;

(async () => {
  try {
    switch (command) {
      case "daily":
        if (arg === "all") {
          for (const projectId of Object.keys(PROJECTS)) {
            await smartDailyDigest(projectId);
          }
        } else if (arg) {
          await smartDailyDigest(arg);
        } else {
          console.log("Usage: node distill-v2.js daily <project|all>");
        }
        break;

      case "knowledge":
        if (arg) {
          await extractAndAccumulateKnowledge(arg);
        } else {
          console.log("Usage: node distill-v2.js knowledge <project>");
        }
        break;

      case "weekly":
        await smartWeeklyReport();
        break;

      case "inject":
        if (arg) {
          await injectIntuition(arg);
        } else {
          for (const projectId of Object.keys(PROJECTS)) {
            await injectIntuition(projectId);
          }
        }
        break;

      case "strategy":
        await runL0Strategy();
        break;

      case "propagate":
        propagateStrategy(PROJECTS);
        break;

      default:
        console.log(`
意識蒸餾腳本 v2 - LLM 智慧蒸餾

Usage:
  node distill-v2.js daily <project|all>   # LLM 智慧摘要
  node distill-v2.js knowledge <project>   # 提取知識點
  node distill-v2.js weekly                # L0 戰略週報
  node distill-v2.js inject [project]      # 注入直覺
  node distill-v2.js strategy              # L0 戰略分析（完整流程）
  node distill-v2.js propagate             # 傳播戰略到下級

Projects: ${Object.keys(PROJECTS).join(", ")}
`);
    }
  } catch (err) {
    console.error("Error:", err.message);
    process.exit(1);
  }
})();
