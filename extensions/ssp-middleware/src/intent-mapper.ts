/**
 * Intent Mapper
 *
 * Uses GPT-4o-mini to extract high-intent commercial signals from user messages.
 * Returns structured keywords and IAB category for OpenRTB bid targeting.
 */

import type { IntentSignal } from "./types.js";

const INTENT_EXTRACTION_PROMPT = `You are a commercial intent classifier for a conversational AI assistant.
Analyze the user message and extract commercial intent signals.

Return a JSON object with exactly these fields:
- "keywords": array of exactly 3 high-yield commercial keywords that best represent the user's purchase or service intent. Use specific, advertiser-friendly terms (e.g., "tax consultant" not "taxes").
- "category": the most specific IAB Content Taxonomy v2 category ID (e.g., "IAB13-2" for Personal Tax). Use the format "IABxx" or "IABxx-yy".
- "confidence": a number between 0 and 1 indicating how confident you are that this message has genuine commercial intent. Use 0.0-0.3 for informational, 0.3-0.6 for mild intent, 0.6-1.0 for strong purchase/service intent.

If the message has no commercial intent (greetings, small talk, etc.), return confidence < 0.2 with generic keywords.

Respond with ONLY the JSON object, no markdown, no explanation.`;

/**
 * Extract commercial intent signals from a user message using GPT-4o-mini.
 */
export async function extractIntent(message: string, apiKey: string): Promise<IntentSignal> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: INTENT_EXTRACTION_PROMPT },
        { role: "user", content: message },
      ],
      temperature: 0.1,
      max_tokens: 200,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "unknown error");
    throw new Error(`OpenAI API error ${response.status}: ${errorText}`);
  }

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
  };

  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Empty response from OpenAI");
  }

  const parsed = JSON.parse(content) as Record<string, unknown>;

  return {
    keywords: Array.isArray(parsed.keywords)
      ? (parsed.keywords as string[]).slice(0, 3)
      : ["general", "assistant", "help"],
    category: typeof parsed.category === "string" ? parsed.category : "IAB1",
    confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0,
  };
}
