// Cost Tracker Hook - 追蹤模型使用成本
//
// 監聽事件：model:complete
// 動作：記錄使用量並估算成本

import fs from 'fs';
import path from 'path';

// 容器內 workspace 路徑
const CONTAINER_WORKSPACE = '/app/workspace';

// 從配置文件讀取
function loadConfig() {
  const configPath = path.join(CONTAINER_WORKSPACE, 'hooks', 'config.json');
  try {
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
  } catch (err) {
    console.warn('[cost-tracker] Failed to load config:', err.message);
  }
  return {};
}

const CONFIG = loadConfig();

// 預設定價 ($/1M tokens)
const DEFAULT_COSTS = {
  'anthropic/claude-opus-4-5': { input: 15, output: 75 },
  'anthropic/claude-sonnet-4': { input: 3, output: 15 },
  'deepseek/deepseek-chat': { input: 0.14, output: 0.28 },
  'deepseek/deepseek-reasoner': { input: 0.55, output: 2.19 },
  'zai/glm-4.7': { input: 0.1, output: 0.1 }
};

function getModelCost(provider, model) {
  const key = `${provider}/${model}`;
  return CONFIG.costs?.[key] || DEFAULT_COSTS[key] || { input: 0, output: 0 };
}

function logToFile(entry) {
  const logPath = path.join(CONTAINER_WORKSPACE, 'logs', 'cost.log');

  try {
    const dir = path.dirname(logPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const line = `${new Date().toISOString()} | ${JSON.stringify(entry)}\n`;
    fs.appendFileSync(logPath, line);
  } catch (err) {
    console.error('[cost-tracker] Failed to write log:', err.message);
  }
}

/**
 * 估算成本（基於 token 或持續時間）
 */
function estimateCost(context) {
  const { provider, model, inputTokens, outputTokens, durationMs } = context;
  const costs = getModelCost(provider, model);

  // 如果有 token 數據，精確計算
  if (inputTokens || outputTokens) {
    const inputCost = ((inputTokens || 0) / 1000000) * costs.input;
    const outputCost = ((outputTokens || 0) / 1000000) * costs.output;
    return inputCost + outputCost;
  }

  // 否則基於持續時間粗略估算（假設 ~50 tokens/s）
  if (durationMs) {
    const estimatedTokens = (durationMs / 1000) * 50;
    return (estimatedTokens / 1000000) * ((costs.input + costs.output) / 2);
  }

  return 0;
}

/**
 * Internal Hook Handler for model:complete events
 */
async function handler(event) {
  // 只處理 model:complete 事件
  if (event.type !== 'model' || event.action !== 'complete') {
    return;
  }

  const {
    provider,
    model,
    inputTokens,
    outputTokens,
    cacheReadTokens,
    cacheWriteTokens,
    durationMs,
    success,
    errorMessage,
    sessionKey,
    agentId
  } = event.context;

  const estimatedCost = estimateCost(event.context);

  // 記錄到文件
  logToFile({
    timestamp: new Date().toISOString(),
    provider,
    model,
    inputTokens: inputTokens || null,
    outputTokens: outputTokens || null,
    cacheReadTokens: cacheReadTokens || null,
    cacheWriteTokens: cacheWriteTokens || null,
    durationMs: durationMs || null,
    success,
    errorMessage: errorMessage || null,
    estimatedCost: Math.round(estimatedCost * 1000000) / 1000000, // 6 decimal places
    sessionKey,
    agentId
  });
}

export default handler;
