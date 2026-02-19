export function generateSummary(
  transcriptLines: string[],
  mode: "summary" | "key_points" = "summary",
): string | string[] {
  if (transcriptLines.length === 0) {
    return mode === "key_points" ? [] : "";
  }

  const userMessages: string[] = [];
  const assistantResponses: string[] = [];

  for (const line of transcriptLines) {
    try {
      const entry = JSON.parse(line);
      if (entry.role === "user" && entry.content) {
        userMessages.push(entry.content);
      } else if (entry.role === "assistant" && entry.content) {
        assistantResponses.push(entry.content);
      }
    } catch {
      // Skip non-JSON lines
    }
  }

  if (mode === "key_points") {
    return extractKeyPoints(userMessages, assistantResponses);
  }

  return createSummary(userMessages, assistantResponses);
}

function extractKeyPoints(userMessages: string[], _assistantResponses: string[]): string[] {
  const points: string[] = [];

  if (userMessages.length > 0) {
    points.push(`User requested ${userMessages.length} things`);
  }

  const taskPatterns = [
    { pattern: /code|implement|create|build/i, label: "coding tasks" },
    { pattern: /search|find|look/i, label: "search tasks" },
    { pattern: /explain|what is|how does/i, label: "explanations" },
    { pattern: /fix|bug|error/i, label: "bug fixes" },
  ];

  for (const { pattern, label } of taskPatterns) {
    const matches = userMessages.filter((m) => pattern.test(m));
    if (matches.length > 0) {
      points.push(`Completed ${matches.length} ${label}`);
    }
  }

  const lastUser = userMessages[userMessages.length - 1];
  if (lastUser && lastUser.length > 10) {
    points.push(`Latest: ${lastUser.slice(0, 100)}...`);
  }

  return points.slice(0, 5);
}

function createSummary(userMessages: string[], assistantResponses: string[]): string {
  const parts: string[] = [];

  if (userMessages.length > 0) {
    parts.push(`${userMessages.length} user interactions`);
  }

  if (assistantResponses.length > 0) {
    parts.push(`${assistantResponses.length} assistant responses`);
  }

  const lastUser = userMessages[userMessages.length - 1];
  if (lastUser) {
    parts.push(`Last topic: ${lastUser.slice(0, 80)}`);
  }

  return parts.join(" | ");
}
