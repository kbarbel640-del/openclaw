// Message Mirror Hook - 將訊息鏡像到 Telegram Log 群組

import https from 'https';
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
    console.warn('[message-mirror] Failed to load config:', err.message);
  }
  return {};
}

const CONFIG = loadConfig();
const LOG_BOT_TOKEN = process.env.OPENCLAW_LOG_BOT_TOKEN || CONFIG.telegram?.logBot?.token;
const LOG_GROUP_ID = process.env.OPENCLAW_LOG_GROUP_ID || CONFIG.telegram?.logBot?.groupId;

function sendTelegram(token, chatId, text) {
  if (!token || !chatId) {
    console.log('[message-mirror] Telegram not configured, skipping');
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ chat_id: chatId, text });
    const req = https.request({
      hostname: 'api.telegram.org',
      path: `/bot${token}/sendMessage`,
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

async function handler(event, context) {
  const { channel, from, text, timestamp } = event.payload || {};

  const logMessage = [
    `📨 [${channel || 'unknown'}] ${from || 'unknown'}`,
    `時間: ${new Date(timestamp).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}`,
    '---',
    text?.substring(0, 500) || '(無文字)'
  ].join('\n');

  try {
    await sendTelegram(LOG_BOT_TOKEN, LOG_GROUP_ID, logMessage);
  } catch (err) {
    console.error('[message-mirror] Failed to send:', err.message);
  }
}

export default handler;
