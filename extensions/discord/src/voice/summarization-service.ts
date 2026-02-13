/**
 * Voice session summarization via Groq's OpenAI-compatible chat completion API.
 */
import type { SpeakerTranscription } from "./types.js";

const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_SUMMARIZATION_MODEL = "llama-3.3-70b-versatile";

export interface SummarizeVoiceSessionParams {
  transcriptions: SpeakerTranscription[];
  apiKey: string;
  model?: string;
}

export interface SummarizeVoiceSessionResult {
  summary: string;
  actionItems: string;
  formatted: string;
}

function buildTranscriptText(transcriptions: SpeakerTranscription[]): string {
  return transcriptions
    .map((t) => {
      const time = new Date(t.timestamp).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      });
      return `[${time}] ${t.userName}: ${t.text}`;
    })
    .join("\n");
}

const SYSTEM_PROMPT = `You are a meeting assistant. Given a voice conversation transcript, produce:

1. A concise **Summary** of the discussion (3-5 bullet points)
2. **Action Items** organized by person, listing what each person committed to or was assigned

Format your response in Discord-compatible markdown exactly like this:

## Summary
- Point 1
- Point 2
- Point 3

## Action Items
**PersonName**
- Action item 1
- Action item 2

**AnotherPerson**
- Action item 1

If there are no clear action items for a person, omit them.
If the transcript is too short or unclear, provide a brief summary and note that no clear action items were identified.`;

/**
 * Summarize a voice session's transcriptions via Groq LLM.
 * Returns `null` on failure (never throws).
 */
export async function summarizeVoiceSession(
  params: SummarizeVoiceSessionParams,
): Promise<SummarizeVoiceSessionResult | null> {
  try {
    if (params.transcriptions.length === 0) {
      return null;
    }

    const model = params.model ?? DEFAULT_SUMMARIZATION_MODEL;
    const transcript = buildTranscriptText(params.transcriptions);

    const res = await fetch(GROQ_CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${params.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `Here is the voice conversation transcript:\n\n${transcript}`,
          },
        ],
        temperature: 0.3,
        max_tokens: 2048,
      }),
    });

    if (!res.ok) {
      return null;
    }

    const payload = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const content = payload.choices?.[0]?.message?.content?.trim();
    if (!content) {
      return null;
    }

    // Parse the summary and action items sections
    const summaryMatch = content.match(/## Summary\s*\n([\s\S]*?)(?=\n## Action Items|$)/);
    const actionItemsMatch = content.match(/## Action Items\s*\n([\s\S]*?)$/);

    return {
      summary: summaryMatch?.[1]?.trim() ?? content,
      actionItems: actionItemsMatch?.[1]?.trim() ?? "",
      formatted: content,
    };
  } catch {
    return null;
  }
}
