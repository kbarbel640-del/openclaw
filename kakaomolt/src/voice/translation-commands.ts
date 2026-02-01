/**
 * Translation & Interpretation Commands for KakaoTalk
 *
 * Handles user commands for:
 * - Text translation (/번역, /translate)
 * - Real-time interpretation (/통역, /interpret)
 * - Language settings
 */

import {
  translateText,
  parseLanguageCode,
  formatLanguageList,
  formatPopularPairs,
  SUPPORTED_LANGUAGES,
  type LanguageCode,
  type TranslationResult,
  type InterpreterConfig,
} from "./realtime-interpreter.js";

// ============================================
// Command Types
// ============================================

export type TranslationCommandType =
  | "translate"      // Text translation
  | "interpret"      // Start real-time interpretation
  | "interpret_stop" // Stop interpretation
  | "languages"      // List supported languages
  | "set_language"   // Set default language
  | "help";          // Help

export interface TranslationCommand {
  isCommand: boolean;
  type?: TranslationCommandType;
  sourceLanguage?: LanguageCode;
  targetLanguage?: LanguageCode;
  text?: string;
  bidirectional?: boolean;
}

export interface TranslationCommandResult {
  success: boolean;
  message: string;
  audioBase64?: string;
  audioFormat?: string;
  quickReplies?: string[];
  sessionId?: string; // For interpretation sessions
}

// ============================================
// Command Parsing
// ============================================

/**
 * Check if message is a translation command
 */
export function isTranslationCommand(message: string): boolean {
  const trimmed = message.trim().toLowerCase();
  return (
    /^[/\/](번역|translate|통역|interpret|언어|languages?)(\s|$)/i.test(trimmed) ||
    /^(번역해|통역해|번역\s*해\s*줘|통역\s*해\s*줘)/i.test(trimmed) ||
    /^(translate|interpret)\s/i.test(trimmed)
  );
}

/**
 * Parse translation command from message
 */
export function parseTranslationCommand(message: string): TranslationCommand {
  const trimmed = message.trim();

  // Help command
  if (/^[/\/](번역|통역)\s*(도움말|help)$/i.test(trimmed)) {
    return { isCommand: true, type: "help" };
  }

  // Language list command
  if (/^[/\/](언어|languages?|언어목록|지원언어)$/i.test(trimmed)) {
    return { isCommand: true, type: "languages" };
  }

  // Stop interpretation
  if (/^[/\/](통역\s*종료|통역\s*중지|interpret\s*stop|stop\s*interpret)/i.test(trimmed)) {
    return { isCommand: true, type: "interpret_stop" };
  }

  // Real-time interpretation: /통역 한국어 영어 or /통역 ko en
  const interpretMatch = trimmed.match(
    /^[/\/]?(통역|interpret|실시간\s*통역)\s+(\S+)\s+(\S+)(?:\s+(양방향|bidirectional|bi))?$/i,
  );
  if (interpretMatch) {
    const srcLang = parseLanguageCode(interpretMatch[2]);
    const tgtLang = parseLanguageCode(interpretMatch[3]);
    const bidirectional = !!interpretMatch[4];

    if (!srcLang || !tgtLang) {
      return {
        isCommand: true,
        type: "interpret",
        sourceLanguage: srcLang ?? undefined,
        targetLanguage: tgtLang ?? undefined,
      };
    }

    return {
      isCommand: true,
      type: "interpret",
      sourceLanguage: srcLang,
      targetLanguage: tgtLang,
      bidirectional,
    };
  }

  // Simple interpretation start: /통역 or 통역해줘
  if (/^[/\/]?(통역|interpret|실시간\s*통역|통역\s*해\s*줘?)$/i.test(trimmed)) {
    return {
      isCommand: true,
      type: "interpret",
      // Default to Korean ↔ English
      sourceLanguage: "ko",
      targetLanguage: "en",
      bidirectional: true,
    };
  }

  // Text translation with specified languages: /번역 영어 [text] or /번역 ko->en [text]
  const translateWithLangMatch = trimmed.match(
    /^[/\/]?(번역|translate)\s+(?:(\S+)\s*(?:->|→|에서|to)\s*)?(\S+)\s+(.+)$/i,
  );
  if (translateWithLangMatch) {
    const srcInput = translateWithLangMatch[2];
    const tgtInput = translateWithLangMatch[3];
    const text = translateWithLangMatch[4];

    const srcLang = srcInput ? parseLanguageCode(srcInput) : undefined;
    const tgtLang = parseLanguageCode(tgtInput);

    if (tgtLang) {
      return {
        isCommand: true,
        type: "translate",
        sourceLanguage: srcLang ?? undefined,
        targetLanguage: tgtLang,
        text,
      };
    }
  }

  // Simple translation: /번역 [text] (auto-detect source, default target Korean or English)
  const simpleTranslateMatch = trimmed.match(/^[/\/]?(번역|translate)\s+(.+)$/i);
  if (simpleTranslateMatch) {
    const text = simpleTranslateMatch[2];

    // If text looks Korean, translate to English; otherwise to Korean
    const hasKorean = /[\uAC00-\uD7AF]/.test(text);

    return {
      isCommand: true,
      type: "translate",
      targetLanguage: hasKorean ? "en" : "ko",
      text,
    };
  }

  // Natural language request: "영어로 번역해줘: [text]"
  const naturalMatch = trimmed.match(
    /^(\S+)(?:로|으로)\s*번역\s*해\s*줘?[:\s]*(.+)$/i,
  );
  if (naturalMatch) {
    const tgtLang = parseLanguageCode(naturalMatch[1]);
    const text = naturalMatch[2];

    if (tgtLang && text) {
      return {
        isCommand: true,
        type: "translate",
        targetLanguage: tgtLang,
        text,
      };
    }
  }

  // "[text]를 영어로 번역" pattern
  const reverseMatch = trimmed.match(
    /^(.+)[를을]\s*(\S+)(?:로|으로)\s*번역\s*해?\s*줘?$/i,
  );
  if (reverseMatch) {
    const text = reverseMatch[1];
    const tgtLang = parseLanguageCode(reverseMatch[2]);

    if (tgtLang && text) {
      return {
        isCommand: true,
        type: "translate",
        targetLanguage: tgtLang,
        text,
      };
    }
  }

  return { isCommand: false };
}

// ============================================
// Command Handlers
// ============================================

/**
 * Handle translation command
 */
export async function handleTranslationCommand(
  cmd: TranslationCommand,
  userId: string,
  apiKey?: string,
): Promise<TranslationCommandResult> {
  switch (cmd.type) {
    case "translate":
      return handleTextTranslation(cmd, apiKey);

    case "interpret":
      return handleStartInterpretation(cmd, userId);

    case "interpret_stop":
      return handleStopInterpretation(userId);

    case "languages":
      return {
        success: true,
        message: formatLanguageList() + "\n" + formatPopularPairs(),
        quickReplies: ["번역 영어", "번역 일본어", "통역 한영"],
      };

    case "help":
      return {
        success: true,
        message: formatTranslationHelp(),
        quickReplies: ["번역 도움말", "언어목록", "통역 한영"],
      };

    default:
      return {
        success: false,
        message: "알 수 없는 명령입니다. '/번역 도움말'을 입력해주세요.",
      };
  }
}

/**
 * Handle text translation
 */
async function handleTextTranslation(
  cmd: TranslationCommand,
  apiKey?: string,
): Promise<TranslationCommandResult> {
  if (!cmd.text) {
    return {
      success: false,
      message: "번역할 텍스트를 입력해주세요.\n\n예시: /번역 영어 안녕하세요",
      quickReplies: ["번역 영어 안녕하세요", "번역 일본어 감사합니다"],
    };
  }

  if (!cmd.targetLanguage) {
    return {
      success: false,
      message: "대상 언어를 지정해주세요.\n\n예시: /번역 영어 [텍스트]",
      quickReplies: ["언어목록"],
    };
  }

  const result = await translateText(
    {
      text: cmd.text,
      sourceLanguage: cmd.sourceLanguage,
      targetLanguage: cmd.targetLanguage,
      formality: "neutral",
    },
    apiKey,
  );

  if (!result.success) {
    return {
      success: false,
      message: `번역 실패: ${result.error}`,
    };
  }

  const targetLang = SUPPORTED_LANGUAGES[cmd.targetLanguage];
  const sourceLang = cmd.sourceLanguage
    ? SUPPORTED_LANGUAGES[cmd.sourceLanguage]
    : null;

  let message = `${targetLang.flag} **${targetLang.nativeName} 번역**\n\n`;
  message += `${result.translatedText}`;

  if (sourceLang) {
    message += `\n\n---\n${sourceLang.flag} 원문: ${cmd.text}`;
  }

  return {
    success: true,
    message,
    quickReplies: [`번역 ${targetLang.code}`, "언어목록"],
  };
}

/**
 * Handle start interpretation
 */
function handleStartInterpretation(
  cmd: TranslationCommand,
  userId: string,
): TranslationCommandResult {
  if (!cmd.sourceLanguage || !cmd.targetLanguage) {
    return {
      success: false,
      message: `언어를 지정해주세요.

**사용법:**
\`/통역 한국어 영어\` - 한↔영 통역 시작
\`/통역 ko en bi\` - 양방향 통역

**지원 언어:**
한국어(ko), 영어(en), 일본어(ja), 중국어(zh), 스페인어(es), 프랑스어(fr) 등

'/언어목록'으로 전체 언어를 확인하세요.`,
      quickReplies: ["언어목록", "통역 한영", "통역 한일"],
    };
  }

  const srcLang = SUPPORTED_LANGUAGES[cmd.sourceLanguage];
  const tgtLang = SUPPORTED_LANGUAGES[cmd.targetLanguage];

  const modeText = cmd.bidirectional
    ? `${srcLang.flag} ${srcLang.nativeName} ↔ ${tgtLang.flag} ${tgtLang.nativeName} (양방향)`
    : `${srcLang.flag} ${srcLang.nativeName} → ${tgtLang.flag} ${tgtLang.nativeName}`;

  // Note: Actual session creation would be done by the voice handler
  // This returns instructions for starting the session
  return {
    success: true,
    message: `🎙️ **실시간 통역 준비**

${modeText}

**시작 방법:**
1. 음성 메시지를 보내주세요
2. AI가 실시간으로 통역합니다
3. '/통역 종료'로 종료

**특징:**
• 실시간 음성-음성 통역
• ~500ms 이하 지연
• 자연스러운 음성 출력

음성 메시지로 말씀해주세요! 🎤`,
    quickReplies: ["통역 종료", "언어목록"],
    sessionId: `pending-${userId}-${cmd.sourceLanguage}-${cmd.targetLanguage}`,
  };
}

/**
 * Handle stop interpretation
 */
function handleStopInterpretation(userId: string): TranslationCommandResult {
  // Note: Actual session termination would be done by the voice handler
  return {
    success: true,
    message: `✅ **통역 세션 종료**

통역 서비스를 종료했습니다.
다시 시작하려면 '/통역'을 입력하세요.`,
    quickReplies: ["통역 한영", "통역 한일", "번역 도움말"],
  };
}

/**
 * Format translation help
 */
function formatTranslationHelp(): string {
  return `📖 **번역/통역 도움말**

**텍스트 번역**
• \`/번역 영어 안녕하세요\` - 영어로 번역
• \`/번역 ko->en Hello\` - 한국어→영어
• \`영어로 번역해줘: 감사합니다\`
• \`이것을 일본어로 번역\`

**실시간 통역**
• \`/통역 한국어 영어\` - 한↔영 통역
• \`/통역 ko en bi\` - 양방향 통역
• \`/통역 종료\` - 통역 세션 종료

**언어 코드**
\`ko\` 한국어, \`en\` 영어, \`ja\` 일본어
\`zh\` 중국어, \`es\` 스페인어, \`fr\` 프랑스어

**실시간 통역 특징**
• Gemini 2.5 Flash Native Audio 사용
• 음성→음성 직접 통역 (STT/TTS 분리 없음)
• 초저지연 (~500ms)
• 24개 언어 지원

'/언어목록'으로 전체 언어를 확인하세요.`;
}

// ============================================
// Billing for Translation
// ============================================

export interface TranslationBillingResult {
  creditsUsed: number;
  breakdown: {
    textCredits: number;
    voiceCredits: number;
    multiplier: number;
  };
}

/** Credits per 1000 characters of text translation */
const TEXT_CREDITS_PER_1K_CHARS = 1;

/** Credits per minute of real-time interpretation */
const INTERPRET_CREDITS_PER_MINUTE = 30;

/** Multiplier for real-time interpretation (2x) */
const INTERPRET_MULTIPLIER = 2.0;

/**
 * Calculate credits for text translation
 */
export function calculateTranslationCredits(textLength: number): TranslationBillingResult {
  const textCredits = Math.ceil(textLength / 1000) * TEXT_CREDITS_PER_1K_CHARS;

  return {
    creditsUsed: textCredits,
    breakdown: {
      textCredits,
      voiceCredits: 0,
      multiplier: 1.0,
    },
  };
}

/**
 * Calculate credits for real-time interpretation
 */
export function calculateInterpretationCredits(durationMs: number): TranslationBillingResult {
  const minutes = Math.ceil(durationMs / 60000);
  const baseCredits = minutes * INTERPRET_CREDITS_PER_MINUTE;
  const totalCredits = Math.ceil(baseCredits * INTERPRET_MULTIPLIER);

  return {
    creditsUsed: totalCredits,
    breakdown: {
      textCredits: 0,
      voiceCredits: baseCredits,
      multiplier: INTERPRET_MULTIPLIER,
    },
  };
}

/**
 * Format billing info for display
 */
export function formatTranslationBillingInfo(result: TranslationBillingResult): string {
  if (result.breakdown.voiceCredits > 0) {
    return `💳 실시간 통역: ${result.creditsUsed} 크레딧 (${result.breakdown.multiplier}x 배율)`;
  }
  return `💳 텍스트 번역: ${result.creditsUsed} 크레딧`;
}
