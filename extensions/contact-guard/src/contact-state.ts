/**
 * Contact State Management
 *
 * Handles loading, caching, and updating contact state files
 */

import fs from "node:fs";
import path from "node:path";

export interface ContactState {
  phone: string;
  name?: string;
  relation?: string;
  authorizedProjects: string[];
  activeProject?: string;
  lastTopic?: string;
  recentWork: Array<{ date: string; description: string }>;
  notes?: string;
}

const contactCache = new Map<string, ContactState>();

/**
 * Parse a contact state markdown file into structured data
 */
export function parseContactFile(content: string, phone: string): ContactState {
  const state: ContactState = {
    phone,
    authorizedProjects: [],
    recentWork: [],
  };

  // Extract name from header
  const nameMatch = content.match(/^# Contact: ([^\n]+)/m);
  if (nameMatch) {
    state.name = nameMatch[1].replace(/\([^)]*\)/, "").trim();
  }

  // Extract key fields
  const fieldPatterns: Record<string, RegExp> = {
    name: /\*\*Name:\*\*\s*(.+)/,
    relation: /\*\*Relation:\*\*\s*(.+)/,
    activeProject: /\*\*Active project:\*\*\s*(.+)/,
    lastTopic: /\*\*Last topic:\*\*\s*(.+)/,
  };

  for (const [field, pattern] of Object.entries(fieldPatterns)) {
    const match = content.match(pattern);
    if (match) {
      (state as Record<string, unknown>)[field] = match[1].trim();
    }
  }

  // Extract authorized projects (bullet list under ## Authorized Projects)
  const projectSection = content.match(/## Authorized Projects\n([\s\S]*?)(?=\n##|$)/);
  if (projectSection) {
    const projects = projectSection[1].match(/^-\s*(.+)$/gm);
    if (projects) {
      state.authorizedProjects = projects
        .map((p) => p.replace(/^-\s*/, "").trim())
        .filter((p) => p && p !== "None" && !p.includes("not tech projects"));
    }
  }

  // Extract recent work
  const recentSection = content.match(/## Recent Work\n([\s\S]*?)(?=\n##|$)/);
  if (recentSection) {
    const items = recentSection[1].match(/^-\s*(\d{4}-\d{2}-\d{2}):\s*(.+)$/gm);
    if (items) {
      state.recentWork = items
        .map((item) => {
          const match = item.match(/^-\s*(\d{4}-\d{2}-\d{2}):\s*(.+)$/);
          return match ? { date: match[1], description: match[2] } : null;
        })
        .filter((x): x is { date: string; description: string } => x !== null);
    }
  }

  return state;
}

/**
 * Load contact state from file
 */
export function loadContactState(
  workspaceDir: string,
  contactStateDir: string,
  phone: string,
): ContactState | null {
  // Normalize phone number for filename
  const normalizedPhone = phone.replace(/[^\d+]/g, "");
  const filePath = path.join(workspaceDir, contactStateDir, `${normalizedPhone}.md`);

  // Check cache first
  const cached = contactCache.get(normalizedPhone);
  if (cached) {
    return cached;
  }

  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    const content = fs.readFileSync(filePath, "utf-8");
    const state = parseContactFile(content, normalizedPhone);
    contactCache.set(normalizedPhone, state);
    return state;
  } catch {
    return null;
  }
}

/**
 * Extract phone number from session key
 * Handles formats like: whatsapp:+2348151259975:user or agent:main:whatsapp:+2348151259975
 */
export function extractPhoneFromSessionKey(sessionKey: string): string | null {
  // Match E.164 format phone numbers
  const phoneMatch = sessionKey.match(/(\+\d{10,15})/);
  return phoneMatch ? phoneMatch[1] : null;
}

/**
 * Clear contact cache (useful for testing or refresh)
 */
export function clearContactCache(): void {
  contactCache.clear();
}
