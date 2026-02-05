#!/usr/bin/env node
// Metrics Aggregator - 生成每日統計報告
//
// 用法：node metrics-aggregator.js [--date YYYY-MM-DD] [--telegram]
//
// 讀取 logs/failover.log 和 logs/cost.log，生成統計摘要

const fs = require('fs');
const path = require('path');
const https = require('https');

// 配置
const WORKSPACE_DIR = process.env.CLAWDBOT_WORKSPACE_DIR || '/Users/sulaxd/clawd';
const FAILOVER_LOG = path.join(WORKSPACE_DIR, 'logs', 'failover.log');
const COST_LOG = path.join(WORKSPACE_DIR, 'logs', 'cost.log');

// 從 hooks/config.json 讀取 Telegram 配置
function loadConfig() {
  const configPath = path.join(WORKSPACE_DIR, 'hooks', 'config.json');
  try {
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
  } catch (err) {
    console.warn('Failed to load config:', err.message);
  }
  return {};
}

const CONFIG = loadConfig();
const DASHBOARD_BOT_TOKEN = CONFIG.telegram?.dashboardBot?.token;
const DASHBOARD_GROUP_ID = CONFIG.telegram?.dashboardBot?.groupId;

// 解析命令行參數
function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { date: null, telegram: false };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--date' && args[i + 1]) {
      opts.date = args[++i];
    } else if (args[i] === '--telegram') {
      opts.telegram = true;
    }
  }

  // 默認為今天
  if (!opts.date) {
    opts.date = new Date().toISOString().split('T')[0];
  }

  return opts;
}

// 讀取並解析日誌文件
function readLogEntries(logPath, targetDate) {
  if (!fs.existsSync(logPath)) {
    return [];
  }

  const lines = fs.readFileSync(logPath, 'utf8').split('\n').filter(Boolean);
  const entries = [];

  for (const line of lines) {
    try {
      // 格式：2026-02-05T12:00:00.000Z | {...}
      const pipeIndex = line.indexOf(' | ');
      if (pipeIndex === -1) continue;

      const timestamp = line.substring(0, pipeIndex);
      const datePrefix = timestamp.split('T')[0];

      if (datePrefix === targetDate) {
        const json = line.substring(pipeIndex + 3);
        entries.push(JSON.parse(json));
      }
    } catch (err) {
      // 跳過無法解析的行
    }
  }

  return entries;
}

// 聚合 failover 統計
function aggregateFailovers(entries) {
  const stats = {
    total: entries.length,
    byReason: {},
    byModel: {},
    circuitBreakerTriggered: 0
  };

  for (const entry of entries) {
    // 按原因統計
    const reason = entry.reason || 'unknown';
    stats.byReason[reason] = (stats.byReason[reason] || 0) + 1;

    // 按模型統計
    const from = entry.from || `${entry.fromProvider}/${entry.fromModel}`;
    stats.byModel[from] = (stats.byModel[from] || 0) + 1;

    // Circuit breaker 計數
    if (entry.consecutiveCount >= 5) {
      stats.circuitBreakerTriggered++;
    }
  }

  return stats;
}

// 聚合成本統計
function aggregateCosts(entries) {
  const stats = {
    totalCalls: entries.length,
    successCalls: 0,
    failedCalls: 0,
    totalCost: 0,
    byModel: {},
    byAgent: {},
    totalDurationMs: 0
  };

  for (const entry of entries) {
    if (entry.success) {
      stats.successCalls++;
    } else {
      stats.failedCalls++;
    }

    stats.totalCost += entry.estimatedCost || 0;
    stats.totalDurationMs += entry.durationMs || 0;

    // 按模型統計
    const model = `${entry.provider}/${entry.model}`;
    if (!stats.byModel[model]) {
      stats.byModel[model] = { calls: 0, cost: 0, durationMs: 0 };
    }
    stats.byModel[model].calls++;
    stats.byModel[model].cost += entry.estimatedCost || 0;
    stats.byModel[model].durationMs += entry.durationMs || 0;

    // 按 agent 統計
    const agent = entry.agentId || 'unknown';
    if (!stats.byAgent[agent]) {
      stats.byAgent[agent] = { calls: 0, cost: 0 };
    }
    stats.byAgent[agent].calls++;
    stats.byAgent[agent].cost += entry.estimatedCost || 0;
  }

  return stats;
}

// 格式化報告
function formatReport(date, failoverStats, costStats) {
  const lines = [
    `📊 *Daily Metrics Report*`,
    `📅 ${date}`,
    ``,
    `*Model Usage*`,
    `├ Total calls: ${costStats.totalCalls}`,
    `├ Success: ${costStats.successCalls} (${((costStats.successCalls / costStats.totalCalls) * 100 || 0).toFixed(1)}%)`,
    `├ Failed: ${costStats.failedCalls}`,
    `└ Total duration: ${(costStats.totalDurationMs / 1000 / 60).toFixed(1)} min`,
    ``
  ];

  // 成本統計
  if (costStats.totalCost > 0) {
    lines.push(`*Estimated Cost*`);
    lines.push(`└ Total: $${costStats.totalCost.toFixed(4)}`);
    lines.push(``);
  }

  // 按模型統計
  if (Object.keys(costStats.byModel).length > 0) {
    lines.push(`*By Model*`);
    const models = Object.entries(costStats.byModel)
      .sort((a, b) => b[1].calls - a[1].calls);
    for (const [model, data] of models) {
      lines.push(`├ \`${model}\`: ${data.calls} calls, $${data.cost.toFixed(4)}`);
    }
    lines.push(``);
  }

  // Failover 統計
  if (failoverStats.total > 0) {
    lines.push(`*Failovers*`);
    lines.push(`├ Total: ${failoverStats.total}`);
    if (failoverStats.circuitBreakerTriggered > 0) {
      lines.push(`├ Circuit breaker: ${failoverStats.circuitBreakerTriggered}x`);
    }
    lines.push(`└ By reason:`);
    for (const [reason, count] of Object.entries(failoverStats.byReason)) {
      lines.push(`   • ${reason}: ${count}`);
    }
    lines.push(``);
  }

  // 按 agent 統計
  if (Object.keys(costStats.byAgent).length > 1) {
    lines.push(`*By Agent*`);
    const agents = Object.entries(costStats.byAgent)
      .sort((a, b) => b[1].calls - a[1].calls);
    for (const [agent, data] of agents) {
      lines.push(`├ ${agent}: ${data.calls} calls, $${data.cost.toFixed(4)}`);
    }
  }

  return lines.join('\n');
}

// 發送 Telegram 通知
function sendTelegram(text) {
  if (!DASHBOARD_BOT_TOKEN || !DASHBOARD_GROUP_ID) {
    console.log('Telegram not configured, skipping notification');
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      chat_id: DASHBOARD_GROUP_ID,
      text,
      parse_mode: 'Markdown'
    });

    const req = https.request({
      hostname: 'api.telegram.org',
      path: `/bot${DASHBOARD_BOT_TOKEN}/sendMessage`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, res => {
      res.statusCode === 200 ? resolve() : reject(new Error(`HTTP ${res.statusCode}`));
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// 主程序
async function main() {
  const opts = parseArgs();
  const targetDate = opts.date;

  console.log(`Generating metrics report for ${targetDate}...`);

  // 讀取日誌
  const failoverEntries = readLogEntries(FAILOVER_LOG, targetDate);
  const costEntries = readLogEntries(COST_LOG, targetDate);

  console.log(`Found ${failoverEntries.length} failover entries, ${costEntries.length} cost entries`);

  // 聚合統計
  const failoverStats = aggregateFailovers(failoverEntries);
  const costStats = aggregateCosts(costEntries);

  // 格式化報告
  const report = formatReport(targetDate, failoverStats, costStats);

  // 輸出到控制台
  console.log('\n' + report.replace(/\*/g, '').replace(/`/g, ''));

  // 發送到 Telegram
  if (opts.telegram) {
    try {
      await sendTelegram(report);
      console.log('\nReport sent to Telegram');
    } catch (err) {
      console.error('Failed to send Telegram notification:', err.message);
    }
  }
}

main().catch(console.error);
