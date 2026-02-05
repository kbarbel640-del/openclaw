// Error Recovery Hook - 檢測 exec 錯誤並觸發自癒
//
// 監聽事件：tool.error, exec.error
// 動作：檢測 EBADF → 觸發 kickstart → 通知 Telegram

import https from 'https';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';

const CONTAINER_WORKSPACE = '/app/workspace';

function loadConfig() {
  const configPath = path.join(CONTAINER_WORKSPACE, 'hooks', 'config.json');
  try {
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
  } catch (err) {
    console.warn('[error-recovery] Failed to load config:', err.message);
  }
  return {};
}

const CONFIG = loadConfig();
const LOG_BOT_TOKEN = process.env.OPENCLAW_LOG_BOT_TOKEN || CONFIG.telegram?.logBot?.token;
const LOG_GROUP_ID = process.env.OPENCLAW_LOG_GROUP_ID || CONFIG.telegram?.logBot?.groupId;

// 防抖：避免短時間內重複觸發
let lastRecoveryTime = 0;
const RECOVERY_COOLDOWN_MS = 60000; // 1 分鐘內不重複觸發

function sendTelegram(text) {
  if (!LOG_BOT_TOKEN || !LOG_GROUP_ID) {
    console.log('[error-recovery] Telegram not configured, skipping notification');
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

function runKickstart() {
  return new Promise((resolve, reject) => {
    exec('launchctl kickstart -k gui/501/com.clawdbot.gateway', (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else {
        resolve(stdout);
      }
    });
  });
}

async function handler(event, context) {
  // 檢查是否是錯誤事件
  const eventType = event.type || event.name || '';
  const payload = event.payload || event.data || event;

  // 檢測 EBADF 錯誤
  const errorText = JSON.stringify(payload).toLowerCase();
  const isEBADF = errorText.includes('ebadf') ||
                  errorText.includes('spawn') && errorText.includes('errno');

  if (!isEBADF) {
    return; // 不是 EBADF，不處理
  }

  // 防抖檢查
  const now = Date.now();
  if (now - lastRecoveryTime < RECOVERY_COOLDOWN_MS) {
    console.log('[error-recovery] Cooldown active, skipping recovery');
    return;
  }
  lastRecoveryTime = now;

  console.log('[error-recovery] EBADF detected, triggering recovery...');

  try {
    // 通知開始修復
    await sendTelegram('🔧 *Error Recovery Hook*\n檢測到 EBADF 錯誤，正在執行 kickstart...');

    // 執行 kickstart
    await runKickstart();

    // 通知成功
    await sendTelegram('✅ *Error Recovery Hook*\nKickstart 完成\n\n⚠️ 注意：現有 session 可能需要 /restart 重連');

    console.log('[error-recovery] Recovery completed');
  } catch (err) {
    console.error('[error-recovery] Recovery failed:', err.message);
    await sendTelegram(`❌ *Error Recovery Hook*\n自動修復失敗: ${err.message}\n\n需要人工介入`);
  }
}

export default handler;
