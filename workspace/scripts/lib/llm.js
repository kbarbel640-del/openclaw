/**
 * LLM 調用模組 - 用於意識蒸餾
 *
 * 使用 DeepSeek（便宜）做蒸餾工作
 */

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || "sk-08f5d6785f59405bbae05b3b874021a1";
const DEEPSEEK_BASE_URL = "https://api.deepseek.com/v1";

/**
 * 調用 LLM 生成回應
 */
export async function chat(messages, options = {}) {
  const { model = "deepseek-chat", temperature = 0.3, maxTokens = 2000 } = options;

  const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`LLM API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

/**
 * 蒸餾對話 - 生成智慧摘要
 */
export async function distillConversation(messages, projectName) {
  const prompt = `你是一個意識蒸餾系統。分析以下 ${projectName} 項目的對話記錄，提取關鍵洞察。

對話記錄：
${messages}

請用以下格式輸出：

## 今日摘要
（2-3 句話概括今天發生了什麼）

## 關鍵事件
（列出 3-5 個重要事件，每個一行）

## 識別的模式
（如果發現重複出現的問題或行為模式，列出來）

## 待解決問題
（如果有未解決的問題，列出來）

## 給上級的建議
（如果有需要戰略層關注的事項，列出來）

請用繁體中文回覆，保持簡潔。`;

  return chat([
    { role: "system", content: "你是意識蒸餾系統，負責從對話中提取智慧和模式。" },
    { role: "user", content: prompt },
  ]);
}

/**
 * 提取知識點
 */
export async function extractKnowledge(messages, existingKnowledge = "") {
  const prompt = `分析以下對話，提取可複用的知識點。

現有知識庫：
${existingKnowledge || "（空）"}

新對話：
${messages}

請提取：
1. 新發現的事實（人名、規則、流程等）
2. 可以寫入 SOP 的標準做法
3. 常見問題的標準答案

格式：
### 新知識點
- [類別] 知識內容

### SOP 建議
- 流程名稱: 步驟描述

### FAQ 更新
- Q: 問題
- A: 答案

只輸出新的、之前沒有的知識。如果沒有新知識，輸出「無新增」。`;

  return chat([
    { role: "system", content: "你是知識提取系統，負責從對話中提取可複用的知識。" },
    { role: "user", content: prompt },
  ]);
}

/**
 * 生成週報
 */
export async function generateWeeklyReport(projectDigests) {
  const prompt = `你是無極的戰略意識層。根據以下各項目的週摘要，生成一份全局週報。

各項目摘要：
${projectDigests}

請生成：

## 本週全局概覽
（2-3 句話概括整體狀況）

## 各項目狀態
（每個項目一段，說明進展和問題）

## 跨項目趨勢
（如果發現多個項目有共同趨勢，指出來）

## 戰略建議
（需要調整資源或策略的地方）

## 下週關注點
（需要特別關注的事項）`;

  return chat([
    { role: "system", content: "你是無極的戰略意識層，負責全局思考和戰略規劃。" },
    { role: "user", content: prompt },
  ]);
}
