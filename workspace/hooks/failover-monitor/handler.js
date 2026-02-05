// Failover Monitor Hook - 監控模型切換並記錄/通知
//
// 監聽事件：model:failover
// 動作：記錄日誌 + 發送 Telegram 通知 + Circuit Breaker

import https from 'https';
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
    console.warn('[failover-monitor] Failed to load config:', err.message);
  }
  return {};
}

const CONFIG = loadConfig();
const LOG_BOT_TOKEN = process.env.OPENCLAW_LOG_BOT_TOKEN || CONFIG.telegram?.logBot?.token;
const LOG_GROUP_ID = process.env.OPENCLAW_LOG_GROUP_ID || CONFIG.telegram?.logBot?.groupId;

// 追蹤連續 failover 次數（用於 circuit breaker）
const failoverCounts = new Map();
const MAX_CONSECUTIVE_FAILOVERS = 5;
const FAILOVER_WINDOW_MS = 60000; // 1 分鐘內的 failover 計算為連續

function sendTelegram(text) {
  // 優雅降級：無配置時跳過通知
  if (!LOG_BOT_TOKEN || !LOG_GROUP_ID) {
    console.log('[failover-monitor] Telegram not configured, skipping notification');
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ chat_id: LOG_GROUP_ID, text, parse_mode: 'Markdown' });
    const req = https.request({
      hostname: 'api.telegram.org',
      path: `/bot${LOG_BOT_TOKEN}/sendMessage`,
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

function logToFile(entry) {
  const logPath = path.join(CONTAINER_WORKSPACE, 'logs', 'failover.log');

  try {
    // 確保目錄存在
    const dir = path.dirname(logPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const line = `${new Date().toISOString()} | ${JSON.stringify(entry)}\n`;
    fs.appendFileSync(logPath, line);
  } catch (err) {
    console.error('[failover-monitor] Failed to write log:', err.message);
  }
}

function getFailoverKey(sessionKey) {
  return sessionKey || 'default';
}

function trackFailover(sessionKey) {
  const key = getFailoverKey(sessionKey);
  const now = Date.now();

  let record = failoverCounts.get(key);
  if (!record || (now - record.lastTime) > FAILOVER_WINDOW_MS) {
    // 重置計數
    record = { count: 0, lastTime: now };
  }

  record.count++;
  record.lastTime = now;
  failoverCounts.set(key, record);

  return record.count;
}

/**
 * Internal Hook Handler for model:failover events
 *
 * @param {Object} event - Internal hook event
 * @param {string} event.type - "model"
 * @param {string} event.action - "failover"
 * @param {string} event.sessionKey - Session key
 * @param {Object} event.context - Failover context
 * @returns {Object|undefined} - Optional result with allow/vetoReason/overrideTarget
 */
async function handler(event) {
  // 只處理 model:failover 事件
  if (event.type !== 'model' || event.action !== 'failover') {
    return;
  }

  const {
    fromProvider,
    fromModel,
    toProvider,
    toModel,
    reason,
    errorMessage,
    statusCode,
    attemptNumber,
    totalCandidates,
    agentId
  } = event.context;

  const sessionKey = event.sessionKey;

  // 追蹤連續 failover
  const consecutiveCount = trackFailover(sessionKey);

  // 記錄到文件
  logToFile({
    timestamp: new Date().toISOString(),
    from: `${fromProvider}/${fromModel}`,
    to: `${toProvider}/${toModel}`,
    reason,
    errorMessage,
    statusCode,
    attemptNumber,
    totalCandidates,
    consecutiveCount,
    sessionKey,
    agentId
  });

  // 構建通知訊息
  const reasonEmoji = {
    'timeout': '⏱️',
    'rate_limit': '🚦',
    'auth': '🔐',
    'billing': '💳',
    'format': '📝',
    'unknown': '❓'
  }[reason] || '❓';

  const message = [
    `${reasonEmoji} *Model Failover*`,
    ``,
    `\`${fromProvider}/${fromModel}\``,
    `  ↓ ${reason}${statusCode ? ` (${statusCode})` : ''}`,
    `\`${toProvider}/${toModel}\``,
    ``,
    `Attempt: ${attemptNumber}/${totalCandidates}`,
    consecutiveCount > 1 ? `⚠️ Consecutive: ${consecutiveCount}` : '',
    agentId ? `Agent: ${agentId}` : ''
  ].filter(Boolean).join('\n');

  // 發送 Telegram 通知
  try {
    await sendTelegram(message);
  } catch (err) {
    console.error('[failover-monitor] Telegram notification failed:', err.message);
  }

  // Circuit breaker 邏輯
  if (consecutiveCount >= MAX_CONSECUTIVE_FAILOVERS) {
    console.warn(`[failover-monitor] Too many consecutive failovers (${consecutiveCount}), vetoing`);

    // 發送警告
    try {
      await sendTelegram(
        `🚨 *Circuit Breaker Triggered*\n\n` +
        `連續 ${consecutiveCount} 次 failover\n` +
        `Session: ${sessionKey || 'unknown'}\n\n` +
        `已阻止進一步切換，請檢查 API 狀態`
      );
    } catch (err) {
      // ignore
    }

    return {
      allow: false,
      vetoReason: `Circuit breaker: ${consecutiveCount} consecutive failovers in ${FAILOVER_WINDOW_MS / 1000}s`
    };
  }

  // 允許 failover
  return { allow: true };
}

export default handler;
