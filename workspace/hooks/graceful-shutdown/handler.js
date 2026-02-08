/**
 * Level 50: Graceful Shutdown Hook
 *
 * 追蹤 in-flight 消息處理，確保重啟時等待完成。
 *
 * 工作原理：
 * - message:received 時開始追蹤
 * - message:sent 時結束追蹤
 * - shutdown 時等待所有追蹤完成
 */

// In-flight 請求存儲
const inFlightRequests = new Map();

// 生成唯一 ID
function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * 處理 message:received 事件
 */
function handleMessageReceived(event) {
  const ctx = event.context || {};
  const chatId = ctx.chatId || ctx.originatingTo || "unknown";
  const channel = ctx.channel || "unknown";
  const content = ctx.content || "";

  // 生成追蹤 ID（基於 chatId，一個 chat 同時只能有一個 in-flight）
  const trackingKey = `${channel}:${chatId}`;

  // 如果已經有一個 in-flight，先結束它（避免積累）
  if (inFlightRequests.has(trackingKey)) {
    const existing = inFlightRequests.get(trackingKey);
    console.log(
      `[graceful-shutdown] ⚠️ replacing existing in-flight: ${trackingKey} (${Date.now() - existing.startedAt}ms)`,
    );
  }

  const request = {
    id: generateId(),
    trackingKey,
    chatId,
    channel,
    content: content.slice(0, 100),
    startedAt: Date.now(),
  };

  inFlightRequests.set(trackingKey, request);
  console.log(`[graceful-shutdown] [+] in-flight: ${inFlightRequests.size} (${channel}:${chatId})`);

  return request.id;
}

/**
 * 處理 message:sent 事件
 */
function handleMessageSent(event) {
  const ctx = event.context || {};
  const chatId = ctx.chatId || "unknown";
  const channel = ctx.channel || "unknown";

  const trackingKey = `${channel}:${chatId}`;

  if (inFlightRequests.has(trackingKey)) {
    const request = inFlightRequests.get(trackingKey);
    const duration = Date.now() - request.startedAt;
    inFlightRequests.delete(trackingKey);
    console.log(
      `[graceful-shutdown] [-] in-flight: ${inFlightRequests.size} (completed in ${duration}ms)`,
    );
  }
}

/**
 * 主處理函數
 */
export default async function handler(event) {
  const eventKey = `${event.type}:${event.action}`;

  switch (eventKey) {
    case "message:received":
      handleMessageReceived(event);
      break;
    case "message:sent":
      handleMessageSent(event);
      break;
    default:
      // 忽略其他事件
      break;
  }
}

/**
 * 導出 in-flight 狀態供 shutdown 使用
 */
export function getInFlightCount() {
  return inFlightRequests.size;
}

export function getInFlightRequests() {
  return Array.from(inFlightRequests.values());
}

export async function waitForCompletion(timeoutMs = 30000) {
  const count = inFlightRequests.size;
  if (count === 0) {
    console.log("[graceful-shutdown] no in-flight requests");
    return { completed: true, remaining: 0 };
  }

  console.log(`[graceful-shutdown] waiting for ${count} in-flight request(s)...`);
  for (const req of inFlightRequests.values()) {
    console.log(
      `  - ${req.channel}:${req.chatId} (${Date.now() - req.startedAt}ms) "${req.content}"`,
    );
  }

  return new Promise((resolve) => {
    const startTime = Date.now();
    const checkInterval = setInterval(() => {
      const remaining = inFlightRequests.size;
      const elapsed = Date.now() - startTime;

      if (remaining === 0) {
        clearInterval(checkInterval);
        console.log("[graceful-shutdown] all requests completed");
        resolve({ completed: true, remaining: 0 });
      } else if (elapsed >= timeoutMs) {
        clearInterval(checkInterval);
        console.log(`[graceful-shutdown] timeout with ${remaining} pending`);
        resolve({ completed: false, remaining, timedOut: true });
      }
    }, 500);
  });
}
