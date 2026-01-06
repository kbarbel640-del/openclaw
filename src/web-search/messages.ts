/**
 * Web Search message templates
 * Uses telegram formatter for MarkdownV2 and emoji restrictions
 */

import { formatTelegramMessage } from "../telegram/formatter.js";

export interface WebSearchResult {
  response: string;
  session_id: string;
  stats: {
    models: Record<string, {
      api: { totalRequests: number; totalErrors: number };
      tokens: { input: number; candidates: number; total: number };
    }>;
  };
}

export interface WebSearchMessages {
  acknowledgment: () => string;
  resultDelivery: (result: WebSearchResult) => string;
  error: (error: string, sessionId?: string) => string;
  timeout: () => string;
  cliNotFound: (path: string) => string;
}

/**
 * Allowed emoji set (black/white only, never 2 close together):
 * Numbers: ① ② ③ ④ ⑤, ❶ ❷ ❸ ❹ ❺
 * Circles: ○ ● ◐ ◑ ◒ ◓
 * Arrows: ⬆︎ ↗︎ ➡︎ ↘︎ ⬇︎ ↙︎ ⬅︎ ↖︎
 * Symbols: ✂︎ ♠︎ ☣︎
 */

export const messages: WebSearchMessages = {
  /**
   * System acknowledgment when search is triggered
   * Uses plain text to avoid markdown parsing errors in temporary messages
   */
  acknowledgment: () => {
    return "Выполняю веб-поиск...";
  },

  /**
   * Deliver search results with visual distinction
   */
  resultDelivery: (result: WebSearchResult) => {
    const message = `🌐 Результат поиска:\n\n${result.response}`;
    return formatTelegramMessage(message);
  },

  /**
   * Error message with user-friendly text and search ID for debugging
   */
  error: (error: string, sessionId?: string) => {
    const errorText = error.length > 200 ? `${error.slice(0, 200)}...` : error;
    const sessionInfo = sessionId ? `\nSearch ID: ${sessionId}` : "";
    const message = `❌ Ошибка поиска:\n\n${errorText}${sessionInfo}`;
    return formatTelegramMessage(message);
  },

  /**
   * Timeout message after timeout
   */
  timeout: () => {
    return formatTelegramMessage("◐ Поиск занял слишком много времени");
  },

  /**
   * CLI not found error with configuration hint
   */
  cliNotFound: (path: string) => {
    const message = `❌ Ошибка поиска:\n\nCLI not found at ${path}\nПроверьте настройки webSearch.cliPath в конфигурации`;
    return formatTelegramMessage(message);
  }
};
