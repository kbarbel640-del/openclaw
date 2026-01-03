/**
 * Test fixtures for web search testing
 * Provides mock data for unit tests, integration tests, and E2E tests
 */

import type { WebSearchResult } from './messages.js';

// Mock successful search result (general)
export const MOCK_SEARCH_RESULT: WebSearchResult = {
  response: `Температура в Москве сегодня +15°C. Переменная облачность, без осадков. Ветер северо-западный, 3 м/с.`,
  session_id: 'test-session-abc-123',
  stats: {
    models: {
      'gemini-1.5-flash': {
        api: { totalRequests: 1, totalErrors: 0 },
        tokens: { input: 15, candidates: 45, total: 60 }
      }
    }
  }
};

// Mock weather search result
export const MOCK_WEATHER_RESULT: WebSearchResult = {
  response: `Сейчас в Лондоне +18°C, ясная погода. Влажность 65%, ветер юго-западный 4 м/с. Завтра ожидается +20°C.`,
  session_id: 'weather-session-xyz-789',
  stats: {
    models: {
      'gemini-1.5-flash': {
        api: { totalRequests: 1, totalErrors: 0 },
        tokens: { input: 12, candidates: 38, total: 50 }
      }
    }
  }
};

// Mock news search result
export const MOCK_NEWS_RESULT: WebSearchResult = {
  response: `Последние новости по ИИ:

• OpenAI запустила новую модель GPT-5
• Google представил инструменты для разработчиков
• NVIDIA анонсировала новые GPU для ИИ

Основные события произошли на конференциях в этом месяце.`,
  session_id: 'news-session-def-456',
  stats: {
    models: {
      'gemini-1.5-pro': {
        api: { totalRequests: 1, totalErrors: 0 },
        tokens: { input: 20, candidates: 150, total: 170 }
      }
    }
  }
};

// Mock CLI stdout outputs (raw JSON strings)
export const MOCK_CLI_OUTPUTS = {
  success: JSON.stringify(MOCK_SEARCH_RESULT),
  weather: JSON.stringify(MOCK_WEATHER_RESULT),
  news: JSON.stringify(MOCK_NEWS_RESULT),
  
  // Error outputs
  timeout: JSON.stringify({ error: 'timeout', message: 'Request timed out after 30000ms' }),
  apiError: JSON.stringify({ error: 'api_error', message: 'API key invalid' }),
  
  // Non-JSON output (fallback case)
  plainText: 'This is just plain text response from Gemini CLI'
};

// Mock Telegram messages for testing
export const MOCK_TELEGRAM_MESSAGES = {
  weather: { text: 'погода в Москве', chatId: 12345, userId: 67890 },
  news: { text: 'последние новости по ИИ', chatId: 12345, userId: 67890 },
  explicit: { text: 'погугли python tutorial', chatId: 12345, userId: 67890 },
  deepResearch: { text: 'сделай депресерч по ИИ', chatId: 12345, userId: 67890 },
  normalChat: { text: 'привет, как дела?', chatId: 12345, userId: 67890 },
  
  // Edge cases
  withPolite: { text: 'пожалуйста найди погоду', chatId: 12345, userId: 67890 },
  withDisfluency: { text: 'ну можешь погугли что такое python', chatId: 12345, userId: 67890 }
};

// Test queries organized by category
export const TEST_QUERIES = {
  valid: [
    'погода в Москве',
    'последние новости',
    'какая температура в Лондоне',
    'что такое квантовая физика'
  ],
  
  explicit: [
    'погугли python',
    'найди рецепт пирога',
    'web search something',
    'загугли информацию'
  ],
  
  invalid: [
    'привет как дела',
    'расскажи шутку',
    'спасибо за помощь',
    'давай поговорим'
  ],
  
  deepResearch: [
    'сделай депресерч по ИИ',
    'do deep research on python',
    'depression research on AI',
    'глубокое исследование по теме'
  ]
};

// Mock context objects for testing
export const MOCK_CONTEXT = {
  telegram: {
    messageId: 123,
    chatId: 456,
    userId: 789,
    username: 'testuser'
  }
};

// Expected extracted queries for testing
export const EXPECTED_QUERIES = {
  weather: 'погоду в Москве',
  explicitWeather: 'погоду в Москве', // With "погугли" stripped
  news: 'последние новости по ИИ',
  explicitNews: 'по ИИ', // With explicit keyword stripped
  withPolite: 'погоду',
  withDisfluency: 'что такое python'
};

// Error scenarios for testing error handling
export const ERROR_SCENARIOS = {
  timeout: {
    code: 'ETIMEOUT',
    message: 'Command timed out after 30000ms'
  },
  cliNotFound: {
    code: 'ENOENT',
    message: 'spawn /path/to/cli ENOENT'
  },
  permission: {
    code: 'EACCES',
    message: 'Permission denied'
  },
  apiError: {
    stderr: 'Error: API key not valid. Please check the API key and network connection.',
    exitCode: 1
  }
};

// Mock configuration objects
export const MOCK_CONFIG = {
  enabled: {
    webSearch: { enabled: true, cliPath: '/test/cli.sh', timeoutMs: 30000 }
  },
  disabled: {
    webSearch: { enabled: false, cliPath: '/test/cli.sh', timeoutMs: 30000 }
  }
};
