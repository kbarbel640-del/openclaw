import type { ParsedArgs } from "./types.js";

/**
 * Build a Gmail search query string from parsed arguments.
 *
 * Default query: `newer_than:1d in:inbox`
 */
export function buildGmailQuery(args: ParsedArgs): string {
  const parts: string[] = [];

  if (args.filters.from) {
    parts.push(`from:${args.filters.from}`);
  }

  if (args.filters.to) {
    parts.push(`to:${args.filters.to}`);
  }

  parts.push(`newer_than:${args.period}`);
  parts.push("in:inbox");

  if (args.filters.urgent) {
    parts.push("is:important OR label:urgent OR subject:(срочно OR urgent OR ASAP)");
  }

  if (args.filters.unread) {
    parts.push("is:unread");
  }

  if (args.filters.freeText) {
    parts.push(args.filters.freeText);
  }

  return parts.join(" ");
}
