#!/usr/bin/env node
/**
 * 意識蒸餾腳本 - Consciousness Distillation
 *
 * 從 Time Tunnel 提取面包屑，蒸餾成上級可用的智慧
 *
 * Usage:
 *   node distill.js daily bita    # 蒸餾 bita 項目的每日摘要
 *   node distill.js daily all     # 蒸餾所有項目
 *   node distill.js weekly        # 生成 L0 週報
 *   node distill.js topics bita   # 提取 bita 的熱門主題
 */

import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const WORKSPACE = "/app/workspace";
const DB_PATH = path.join(WORKSPACE, "data/timeline.db");
const CONSCIOUSNESS_DIR = path.join(WORKSPACE, "data/consciousness");

// 項目配置 (name 要對應 Time Tunnel 的 resolved_project)
const PROJECTS = {
  bita: {
    name: "幣塔",
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
    name: "Jamie", // Time Tunnel 中的 resolved_project
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
  if (!project) {
    console.error(`Unknown project: ${projectId}`);
    return [];
  }

  const today = new Date().toISOString().split("T")[0];
  const placeholders = project.groups.map(() => "?").join(",");

  const sql = `
    SELECT
      timestamp,
      resolved_chat_name as chat,
      resolved_sender_name as sender,
      content,
      direction
    FROM messages
    WHERE date(timestamp) = ?
      AND (chat_id IN (${placeholders}) OR chat_id IN (${project.groups.map((g) => `'telegram:${g}'`).join(",")}))
    ORDER BY timestamp ASC
  `;

  try {
    const stmt = db.prepare(sql);
    return stmt.all(today, ...project.groups);
  } catch (err) {
    console.error("Query error:", err.message);
    return [];
  }
}

/**
 * 格式化對話為可讀文本
 */
function formatMessages(messages) {
  if (messages.length === 0) return "今日無對話記錄。";

  let output = "";
  let currentChat = "";

  for (const msg of messages) {
    if (msg.chat !== currentChat) {
      output += `\n### ${msg.chat || "未知群組"}\n\n`;
      currentChat = msg.chat;
    }

    const time = msg.timestamp.split("T")[1].substring(0, 5);
    const sender = msg.sender || "系統";
    const direction = msg.direction === "outbound" ? "🤖" : "👤";
    const content = (msg.content || "").substring(0, 200);

    output += `${time} ${direction} **${sender}**: ${content}\n`;
  }

  return output;
}

/**
 * 生成每日摘要（本地版，不調用 LLM）
 */
function generateDailyDigest(projectId) {
  const project = PROJECTS[projectId];
  const messages = getTodayMessages(projectId);
  const today = new Date().toISOString().split("T")[0];

  const digest = `# ${project.name} 每日摘要 - ${today}

## 統計

- 總對話數: ${messages.length}
- 參與群組: ${[...new Set(messages.map((m) => m.chat))].filter(Boolean).join(", ") || "無"}
- 參與者: ${[...new Set(messages.map((m) => m.sender))].filter(Boolean).join(", ") || "無"}

## 對話記錄

${formatMessages(messages)}

---
_Generated at ${new Date().toISOString()}_
`;

  // 寫入文件
  const dir = path.join(CONSCIOUSNESS_DIR, `L1_${projectId}`);
  ensureDir(dir);

  const filename = path.join(dir, `daily_${today}.md`);
  fs.writeFileSync(filename, digest);
  console.log(`✅ Daily digest saved: ${filename}`);
  console.log(`   Messages: ${messages.length}`);

  return { messages: messages.length, file: filename };
}

/**
 * 提取熱門主題（簡單詞頻統計）
 */
function extractTopics(projectId, days = 7) {
  const db = getDb();
  const project = PROJECTS[projectId];
  if (!project) return;

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const startDateStr = startDate.toISOString().split("T")[0];

  const sql = `
    SELECT content FROM messages
    WHERE date(timestamp) >= ?
      AND resolved_project = ?
      AND content IS NOT NULL
  `;

  try {
    const stmt = db.prepare(sql);
    const rows = stmt.all(startDateStr, project.name);

    // 簡單詞頻統計
    const wordCount = {};
    const stopWords = new Set([
      "的",
      "是",
      "在",
      "了",
      "和",
      "有",
      "我",
      "你",
      "他",
      "她",
      "它",
      "這",
      "那",
      "就",
      "都",
      "也",
      "還",
      "不",
      "會",
      "可以",
      "什麼",
      "怎麼",
      "為什麼",
      "嗎",
      "呢",
      "吧",
      "啊",
      "哦",
      "嗯",
    ]);

    for (const row of rows) {
      const words = row.content.match(/[\u4e00-\u9fa5]+/g) || [];
      for (const word of words) {
        if (word.length >= 2 && !stopWords.has(word)) {
          wordCount[word] = (wordCount[word] || 0) + 1;
        }
      }
    }

    // 排序取 Top 20
    const topics = Object.entries(wordCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([word, count]) => ({ word, count }));

    // 寫入文件
    const dir = path.join(CONSCIOUSNESS_DIR, `L1_${projectId}`);
    ensureDir(dir);

    const filename = path.join(dir, "topics.json");
    const data = {
      updated: new Date().toISOString(),
      period: `${days} days`,
      topics,
    };
    fs.writeFileSync(filename, JSON.stringify(data, null, 2));
    console.log(`✅ Topics saved: ${filename}`);
    console.log(
      `   Top topics: ${topics
        .slice(0, 5)
        .map((t) => t.word)
        .join(", ")}`,
    );
  } catch (err) {
    console.error("Extract topics error:", err.message);
  }
}

/**
 * 生成 L0 週報
 */
function generateWeeklyReport() {
  const today = new Date();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - 7);

  let report = `# 無極週報 - ${weekStart.toISOString().split("T")[0]} ~ ${today.toISOString().split("T")[0]}

## 項目概覽

`;

  for (const [projectId, project] of Object.entries(PROJECTS)) {
    const dir = path.join(CONSCIOUSNESS_DIR, `L1_${projectId}`);
    const topicsFile = path.join(dir, "topics.json");

    report += `### ${project.name}\n\n`;

    if (fs.existsSync(topicsFile)) {
      const topics = JSON.parse(fs.readFileSync(topicsFile, "utf-8"));
      report += `**熱門主題**: ${topics.topics
        .slice(0, 5)
        .map((t) => t.word)
        .join(", ")}\n\n`;
    } else {
      report += `_尚無數據_\n\n`;
    }
  }

  report += `---
_Generated at ${new Date().toISOString()}_
`;

  // 寫入文件
  const dir = path.join(CONSCIOUSNESS_DIR, "L0_wuji");
  ensureDir(dir);

  const filename = path.join(dir, `weekly_${today.toISOString().split("T")[0]}.md`);
  fs.writeFileSync(filename, report);
  console.log(`✅ Weekly report saved: ${filename}`);
}

// CLI
const [, , command, arg] = process.argv;

switch (command) {
  case "daily":
    if (arg === "all") {
      for (const projectId of Object.keys(PROJECTS)) {
        generateDailyDigest(projectId);
      }
    } else if (arg) {
      generateDailyDigest(arg);
    } else {
      console.log("Usage: node distill.js daily <project|all>");
    }
    break;

  case "topics":
    if (arg) {
      extractTopics(arg);
    } else {
      console.log("Usage: node distill.js topics <project>");
    }
    break;

  case "weekly":
    generateWeeklyReport();
    break;

  default:
    console.log(`
意識蒸餾腳本 - Consciousness Distillation

Usage:
  node distill.js daily <project|all>  # 生成每日摘要
  node distill.js topics <project>     # 提取熱門主題
  node distill.js weekly               # 生成 L0 週報

Projects: ${Object.keys(PROJECTS).join(", ")}
`);
}
