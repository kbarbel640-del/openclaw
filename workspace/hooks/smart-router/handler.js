// Smart Router Hook - 智能模型路由 v4
//
// 設計原則：
//   1. 歷史模式預測（數據驅動）
//   2. 意圖分類優先（關鍵詞檢測）
//   3. Sonnet 為預設第一層
//   4. 複雜任務才升級 Opus
//   5. 多模態/長 context → Gemini
//   6. 成本優化 → DeepSeek
//
// 路由層級：
//   L0:   渠道規則（LINE 強制 Sonnet）
//   L0.5: 用戶明確指定，不干預
//   L1:   多模態檢測（圖片 → Gemini）
//   L1.5: 回饋迴路 — 歷史模式預測（confidence ≥ 0.85, occurrences ≥ 5）
//   L2:   意圖分類（關鍵詞 → 任務類型）
//   L3:   任務路由（任務類型 → 模型）
//   L4:   Context 長度調整
//   L5:   預設 Sonnet
//
// 回饋迴路：
//   recordThought → extractThoughtPatterns（每小時） → predictDecision（每次請求）

// 接入內省系統 + 回饋迴路
import { recordThought, extractThoughtPatterns, predictDecision } from "../time-tunnel/query.js";

// ============================================================
// 回饋迴路 — 模式學習節流器
// ============================================================
let _lastPatternExtract = 0;
const PATTERN_EXTRACT_INTERVAL = 60 * 60 * 1000; // 每小時最多跑一次
const PREDICT_MIN_CONFIDENCE = 0.85;
const PREDICT_MIN_OCCURRENCES = 5;

// ============================================================
// 模型定義
// ============================================================
const MODELS = {
  // Anthropic - 主力
  SONNET: "anthropic/claude-sonnet-4-5", // 預設：快速、通用、高品質文字
  OPUS: "anthropic/claude-opus-4-5", // 升級：深度推理、複雜架構

  // Google - 特化
  GEMINI: "google-antigravity/gemini-3-flash", // 多模態、超長 context、搜尋整合

  // DeepSeek - 成本優化
  DEEPSEEK: "deepseek/deepseek-chat", // 便宜、翻譯
  DEEPSEEK_R1: "deepseek/deepseek-reasoner", // 數學、step-by-step 推理

  // ZAI - 中文
  GLM: "zai/glm-4.7", // 中文優化
};

// ============================================================
// 意圖分類關鍵詞（L2 層）
// ============================================================
const INTENT_KEYWORDS = {
  // === Opus 任務（深度思考）===
  code_generation: [
    "寫程式",
    "寫代碼",
    "write code",
    "implement",
    "create function",
    "開發",
    "develop",
    "build",
    "程式碼",
    "coding",
  ],
  code_debug: [
    "debug",
    "bug",
    "錯誤",
    "error",
    "fix",
    "修復",
    "壞了",
    "不work",
    "為什麼不行",
    "why not working",
    "問題出在",
  ],
  code_review: ["review", "審查", "看看這段", "check this", "優化", "optimize", "refactor", "重構"],
  architecture: [
    "架構",
    "architecture",
    "設計",
    "design pattern",
    "系統設計",
    "how to structure",
    "怎麼設計",
  ],
  complex_reasoning: [
    "分析",
    "analyze",
    "為什麼",
    "why",
    "explain",
    "解釋",
    "比較",
    "compare",
    "評估",
    "evaluate",
    "深入",
  ],

  // === Gemini 任務（多模態/搜尋）===
  multimodal: [
    "這張圖",
    "這個圖片",
    "看圖",
    "圖中",
    "image",
    "photo",
    "picture",
    "截圖",
    "screenshot",
    "看這個",
  ],
  search: ["搜尋", "search", "查一下", "google", "找找", "最新", "news", "新聞", "現在", "目前"],
  long_document: [
    "整份文件",
    "整個codebase",
    "全部程式碼",
    "entire",
    "whole",
    "所有檔案",
    "all files",
  ],

  // === DeepSeek 任務（成本優化）===
  math: [
    "計算",
    "calculate",
    "數學",
    "math",
    "公式",
    "formula",
    "多少",
    "how much",
    "統計",
    "statistics",
  ],
  translation: ["翻譯", "translate", "轉成", "convert to", "英文", "中文", "日文", "韓文"],

  // === Sonnet 任務（預設）===
  writing: [
    "寫",
    "write",
    "draft",
    "草稿",
    "文案",
    "copy",
    "email",
    "郵件",
    "信",
    "letter",
    "報告",
    "report",
  ],
  chat: ["聊", "chat", "說說", "談談", "你覺得", "what do you think", "hi", "hello", "嗨", "哈囉"],
  sensitive: [
    "隱私",
    "privacy",
    "機密",
    "confidential",
    "密碼",
    "password",
    "個資",
    "personal",
    "敏感",
  ],

  // === GLM 任務（中文優化）===
  chinese_heavy: ["繁體", "简体", "成語", "詩詞", "古文", "文言文"],
};

// 意圖 → 模型映射
const INTENT_MODEL_MAP = {
  // Opus
  code_generation: MODELS.OPUS,
  code_debug: MODELS.OPUS,
  code_review: MODELS.OPUS,
  architecture: MODELS.OPUS,
  complex_reasoning: MODELS.OPUS,

  // Gemini
  multimodal: MODELS.GEMINI,
  search: MODELS.GEMINI,
  long_document: MODELS.GEMINI,

  // DeepSeek
  math: MODELS.DEEPSEEK_R1,
  translation: MODELS.DEEPSEEK,

  // Sonnet
  writing: MODELS.SONNET,
  chat: MODELS.SONNET,
  sensitive: MODELS.SONNET, // Claude 有更好的 guardrails

  // GLM
  chinese_heavy: MODELS.GLM,
};

// 直接任務提示映射（向後兼容）
const TASK_ROUTING = {
  code: MODELS.OPUS,
  reasoning: MODELS.OPUS,
  complex: MODELS.OPUS,
  analysis: MODELS.OPUS,
  architecture: MODELS.OPUS,
  debug: MODELS.OPUS,
  math: MODELS.DEEPSEEK_R1,
  translation: MODELS.DEEPSEEK,
  chinese: MODELS.GLM,
  chat: MODELS.SONNET,
  simple: MODELS.SONNET,
  general: MODELS.SONNET,
  writing: MODELS.SONNET,
  multimodal: MODELS.GEMINI,
  image: MODELS.GEMINI,
  search: MODELS.GEMINI,
};

// ============================================================
// Context 長度閾值
// ============================================================
const CONTEXT_THRESHOLDS = {
  VERY_LONG: 100000, // >100k → Gemini（1M+ window）
  LONG: 64000, // >64k → 保持但記錄
};

// ============================================================
// 意圖分類函數（L2）
// ============================================================
function classifyIntent(message) {
  if (!message || typeof message !== "string") {
    return null;
  }

  const lowerMsg = message.toLowerCase();

  // 遍歷所有意圖類別
  for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowerMsg.includes(keyword.toLowerCase())) {
        return intent;
      }
    }
  }

  return null;
}

// ============================================================
// 多模態檢測（L1）
// ============================================================
function hasMultimodalContent(event) {
  const { hasImage, hasFile, attachments, mediaTypes } = event.context || {};

  // 檢查是否有圖片
  if (hasImage) return true;
  if (attachments?.some((a) => a.type?.startsWith("image"))) return true;
  if (mediaTypes?.includes("image")) return true;

  return false;
}

// ============================================================
// Context 長度調整（L4）
// ============================================================
function adjustForContextLength(baseModel, contextLength) {
  if (!contextLength || contextLength <= 0) {
    return baseModel;
  }

  // 超長 context → Gemini（1M+ window）
  if (contextLength > CONTEXT_THRESHOLDS.VERY_LONG) {
    console.log(`[smart-router] L4: Very long context (${contextLength}) -> Gemini`);
    return MODELS.GEMINI;
  }

  return baseModel;
}

// ============================================================
// 主處理函數
// ============================================================
async function handler(event) {
  // 只處理 model:select 事件
  if (event.type !== "model" || event.action !== "select") {
    return;
  }

  const {
    requestedModel,
    candidates,
    sessionKey,
    agentId,
    contextLength,
    taskHint,
    channel,
    message, // 用戶消息（用於意圖分類）
    lastMessage, // 備用
  } = event.context;

  const userMessage = message || lastMessage || "";
  let selectedModel = null;
  let routeReason = "";

  // ============================================================
  // L0: 渠道規則
  // ============================================================
  if (channel === "line" || sessionKey?.includes(":line:")) {
    console.log(`[smart-router] L0: LINE -> Sonnet (Reply Token 30s limit)`);
    return { overrideModel: MODELS.SONNET };
  }

  // ============================================================
  // L0.5: 用戶明確指定模型，不干預
  // ============================================================
  if (requestedModel && !requestedModel.includes("claude-opus-4-5")) {
    return;
  }

  // ============================================================
  // L1: 多模態檢測
  // ============================================================
  if (hasMultimodalContent(event)) {
    selectedModel = MODELS.GEMINI;
    routeReason = "L1: multimodal content -> Gemini";
    console.log(`[smart-router] ${routeReason}`);
    return { overrideModel: selectedModel };
  }

  // ============================================================
  // L1.5: 回饋迴路 — 歷史模式預測
  // ============================================================
  let prediction = null;
  try {
    prediction = predictDecision({
      triggerType: "model_select",
      triggerContent: userMessage?.substring(0, 200),
      context: JSON.stringify({ contextLength, taskHint, channel }),
    });
  } catch (e) {
    // 靜默失敗，不影響路由
  }

  // ============================================================
  // L2: 意圖分類（關鍵詞）
  // ============================================================
  const detectedIntent = classifyIntent(userMessage);
  if (detectedIntent && INTENT_MODEL_MAP[detectedIntent]) {
    selectedModel = INTENT_MODEL_MAP[detectedIntent];
    routeReason = `L2: intent "${detectedIntent}" -> ${selectedModel}`;
  }

  // L1.5 結果：只有在 L2 沒命中時，且預測信心度夠高才採用
  if (
    !selectedModel &&
    prediction?.confidence >= PREDICT_MIN_CONFIDENCE &&
    prediction?.occurrences >= PREDICT_MIN_OCCURRENCES
  ) {
    selectedModel = prediction.predictedDecision;
    routeReason = `L1.5: pattern "${prediction.patternName}" (${prediction.occurrences}x, conf=${prediction.confidence.toFixed(2)}) -> ${selectedModel}`;
    console.log(`[smart-router] ${routeReason}`);
  }

  // ============================================================
  // L3: 任務提示路由（向後兼容）
  // ============================================================
  if (!selectedModel && taskHint) {
    const hint = taskHint.toLowerCase();
    if (TASK_ROUTING[hint]) {
      selectedModel = TASK_ROUTING[hint];
      routeReason = `L3: taskHint "${taskHint}" -> ${selectedModel}`;
    }
  }

  // ============================================================
  // L4: Context 長度調整
  // ============================================================
  if (selectedModel) {
    const adjusted = adjustForContextLength(selectedModel, contextLength);
    if (adjusted !== selectedModel) {
      selectedModel = adjusted;
      routeReason = `L4: long context (${contextLength}) override -> Gemini`;
    }
  } else if (contextLength > CONTEXT_THRESHOLDS.VERY_LONG) {
    selectedModel = MODELS.GEMINI;
    routeReason = `L4: very long context (${contextLength}) -> Gemini`;
  }

  // ============================================================
  // L5: 預設 Sonnet
  // ============================================================
  if (!selectedModel) {
    selectedModel = MODELS.SONNET;
    routeReason = "L5: default -> Sonnet";
  }

  // ============================================================
  // 執行路由
  // ============================================================
  const currentFirst = candidates?.[0];
  const currentKey = currentFirst ? `${currentFirst.provider}/${currentFirst.model}` : "unknown";

  // 記錄決策到內省系統
  try {
    const alternatives = Object.entries(MODELS)
      .filter(([_, m]) => m !== selectedModel)
      .map(([k, v]) => `${k}: ${v}`)
      .slice(0, 3)
      .join(", ");

    recordThought({
      triggerType: "model_select",
      triggerContent: userMessage?.substring(0, 200) || "(no message)",
      triggerSource: channel || "unknown",
      triggerContext: JSON.stringify({
        contextLength,
        taskHint,
        detectedIntent,
        currentModel: currentKey,
      }),
      decision: selectedModel,
      decisionReason: routeReason,
      confidence: detectedIntent ? 0.8 : taskHint ? 0.7 : 0.5,
      method: detectedIntent ? "intent_classification" : taskHint ? "task_hint" : "default",
      alternatives,
      actionTaken: selectedModel !== currentKey ? "override" : "keep",
      actionResult:
        selectedModel !== currentKey ? `${currentKey} -> ${selectedModel}` : "no change",
      chatId: sessionKey,
      channel,
    });
    // 節流模式提取：每小時最多一次，非同步不阻塞
    const now = Date.now();
    if (now - _lastPatternExtract > PATTERN_EXTRACT_INTERVAL) {
      _lastPatternExtract = now;
      try {
        const result = extractThoughtPatterns({ days: 14, minOccurrences: 3 });
        if (result.newPatterns > 0) {
          console.log(
            `[smart-router] 🔄 Extracted ${result.newPatterns} new patterns from ${result.analyzed} decisions`,
          );
        }
      } catch (e2) {
        // 靜默失敗
      }
    }
  } catch (e) {
    console.error("[smart-router] Failed to record thought:", e.message);
  }

  if (selectedModel !== currentKey) {
    console.log(`[smart-router] ${currentKey} -> ${selectedModel} (${routeReason})`);
    return { overrideModel: selectedModel };
  }

  return;
}

export default handler;
