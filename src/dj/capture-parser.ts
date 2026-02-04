/**
 * Parser for DJ capture command input.
 * Extracts type prefix and content from capture messages.
 */

export type CaptureType = "task" | "note" | "meeting" | "idea";

export type ParsedCapture = {
  type: CaptureType;
  content: string;
  rawInput: string;
};

const TYPE_PREFIXES: Record<string, CaptureType> = {
  task: "task",
  todo: "task",
  note: "note",
  meeting: "meeting",
  mtg: "meeting",
  idea: "idea",
};

/**
 * Parse capture input to extract type and content.
 *
 * @example
 * parseCaptureInput("Buy headphones") // { type: "task", content: "Buy headphones" }
 * parseCaptureInput("meeting: Label call notes") // { type: "meeting", content: "Label call notes" }
 * parseCaptureInput("idea: mashup concept") // { type: "idea", content: "mashup concept" }
 */
export function parseCaptureInput(input: string): ParsedCapture {
  const trimmed = input.trim();
  if (!trimmed) {
    return { type: "task", content: "", rawInput: input };
  }

  // Check for type prefix (e.g., "meeting:", "idea:")
  const prefixMatch = trimmed.match(/^([a-z]+):\s*/i);
  if (prefixMatch) {
    const prefix = prefixMatch[1]?.toLowerCase() ?? "";
    const captureType = TYPE_PREFIXES[prefix];
    if (captureType) {
      const content = trimmed.slice(prefixMatch[0].length).trim();
      return { type: captureType, content, rawInput: input };
    }
  }

  // Default to task
  return { type: "task", content: trimmed, rawInput: input };
}

/**
 * Extract a potential due date reference from capture content.
 * Returns the date reference string if found, null otherwise.
 */
export function extractDateReference(content: string): string | null {
  const patterns = [
    /\bby\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
    /\bby\s+(tomorrow|today)\b/i,
    /\bby\s+(next\s+week)\b/i,
    /\bby\s+(\d{1,2}\/\d{1,2})\b/i,
    /\bby\s+([a-z]+\s+\d{1,2})\b/i,
    /\bdue\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
    /\bdue\s+(tomorrow|today)\b/i,
    /\b(tomorrow|today)\b/i,
  ];

  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }

  return null;
}
