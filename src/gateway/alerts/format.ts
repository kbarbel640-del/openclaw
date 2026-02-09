export type AlertLevel = "info" | "warning" | "error" | "critical";

export interface SystemAlert {
  level: AlertLevel;
  title: string;
  source: string; // e.g., "cron:job-id"
  details: string;
  meta?: Record<string, any>;
  timestamp?: number;
}

export function formatAlertMessage(alert: SystemAlert): string {
  const icon = getLevelIcon(alert.level);
  const time = new Date(alert.timestamp || Date.now()).toLocaleTimeString("zh-TW", {
    hour12: false,
  });

  // Markdown format for Telegram/Messaging
  let msg = `${icon} **System Alert: ${alert.title}**\n\n`;

  if (alert.meta?.jobName) {
    msg += `📦 **Job**: \`${alert.meta.jobName}\`\n`;
  }

  msg += `🛑 **Error**: \`${cleanError(alert.details)}\`\n`;
  msg += `🕒 **Time**: ${time}\n`;
  msg += `🤖 **Source**: \`${alert.source}\`\n\n`;

  if (alert.meta?.suggestion) {
    msg += `💡 **Suggestion**:\n${alert.meta.suggestion}`;
  } else {
    msg += `💡 **Diagnostics**:\nThe system encountered a critical failure. Agent runtime may be unavailable.`;
  }

  return msg;
}

function getLevelIcon(level: AlertLevel): string {
  switch (level) {
    case "critical":
      return "🚨";
    case "error":
      return "❌";
    case "warning":
      return "⚠️";
    case "info":
      return "ℹ️";
    default:
      return "🔔";
  }
}

function cleanError(err: string): string {
  // Truncate overly long stack traces or raw JSON
  if (err.length > 200) {
    return err.substring(0, 197) + "...";
  }
  return err;
}
