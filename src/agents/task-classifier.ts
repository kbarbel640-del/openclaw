/**
 * Task Classifier - 根據消息內容推斷任務類型
 *
 * 用於 smart-router hook 選擇最適合的模型
 */

export type TaskHint =
  | "code"
  | "math"
  | "reasoning"
  | "translation"
  | "chinese"
  | "chat"
  | "complex";

interface ClassificationRule {
  hint: TaskHint;
  patterns: RegExp[];
  weight: number;
}

const CLASSIFICATION_RULES: ClassificationRule[] = [
  // 代碼相關
  {
    hint: "code",
    patterns: [
      /```[\w]*\n/, // Code blocks
      /\b(function|class|const|let|var|def|import|export|return)\b/i,
      /\b(javascript|typescript|python|java|c\+\+|rust|go|swift)\b/i,
      /\.(js|ts|py|java|cpp|rs|go|swift|rb|php)\b/,
      /\b(bug|fix|refactor|implement|debug|compile|runtime)\b/i,
      /\b(API|SDK|CLI|npm|pip|yarn|git)\b/,
    ],
    weight: 10,
  },

  // 數學相關
  {
    hint: "math",
    patterns: [
      /\d+\s*[+\-*/^]\s*\d+/, // Basic arithmetic
      /\b(calculate|compute|solve|equation|formula)\b/i,
      /\b(integral|derivative|matrix|vector|probability)\b/i,
      /\b(數學|計算|方程|積分|微分)\b/,
      /[∫∑∏√πθ]/, // Math symbols
    ],
    weight: 8,
  },

  // 推理/複雜任務
  {
    hint: "reasoning",
    patterns: [
      /\b(analyze|explain|compare|evaluate|consider)\b/i,
      /\b(why|how come|what if|suppose|assume)\b/i,
      /\b(pros? and cons?|trade-?offs?|advantages?|disadvantages?)\b/i,
      /\b(分析|解釋|比較|評估|為什麼)\b/,
    ],
    weight: 6,
  },

  // 翻譯相關
  {
    hint: "translation",
    patterns: [
      /\b(translate|translation|翻譯|翻译)\b/i,
      /\b(in english|in chinese|用中文|用英文)\b/i,
      /\b(to japanese|to korean|to spanish|to french)\b/i,
    ],
    weight: 9,
  },

  // 中文對話
  {
    hint: "chinese",
    patterns: [
      /[\u4e00-\u9fff]{10,}/, // 10+ Chinese characters
      /\b(中文|華語|普通話|繁體|簡體)\b/,
    ],
    weight: 4,
  },

  // 複雜任務（長文本）
  {
    hint: "complex",
    patterns: [
      /\b(research|investigate|comprehensive|detailed|thorough)\b/i,
      /\b(document|report|essay|article|paper)\b/i,
    ],
    weight: 5,
  },
];

/**
 * 根據消息內容推斷任務類型
 */
export function classifyTask(text: string): TaskHint {
  if (!text || typeof text !== "string") {
    return "chat";
  }

  const scores: Record<TaskHint, number> = {
    code: 0,
    math: 0,
    reasoning: 0,
    translation: 0,
    chinese: 0,
    chat: 0,
    complex: 0,
  };

  // 計算每個類型的分數
  for (const rule of CLASSIFICATION_RULES) {
    for (const pattern of rule.patterns) {
      if (pattern.test(text)) {
        scores[rule.hint] += rule.weight;
      }
    }
  }

  // 文本長度加分（長文本可能是複雜任務）
  if (text.length > 2000) {
    scores.complex += 3;
    scores.reasoning += 2;
  }

  // 找出最高分
  let maxHint: TaskHint = "chat";
  let maxScore = 0;

  for (const [hint, score] of Object.entries(scores) as [TaskHint, number][]) {
    if (score > maxScore) {
      maxScore = score;
      maxHint = hint;
    }
  }

  // 如果沒有明顯特徵，返回 chat
  if (maxScore < 5) {
    return "chat";
  }

  return maxHint;
}

/**
 * 估算 token 數量（粗略估算）
 */
export function estimateTokenCount(text: string): number {
  if (!text) {
    return 0;
  }

  // 粗略估算：英文 ~4 chars/token，中文 ~1.5 chars/token
  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const otherChars = text.length - chineseChars;

  return Math.ceil(chineseChars / 1.5 + otherChars / 4);
}
