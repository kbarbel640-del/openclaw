/**
 * Memory type classification for session memory files.
 *
 * Used by LLM-based automatic classification when saving sessions.
 */
export type MemoryType =
  | "profile" // User preferences, personal info, identity
  | "event" // Time-bound happenings, appointments, meetings
  | "knowledge" // Facts, concepts, technical information
  | "behavior" // Habits, patterns, workflows
  | "skill" // Abilities, techniques, how-to knowledge
  | "unclassified"; // Fallback when classification fails

/**
 * Result from LLM-based slug and type generation.
 */
export type SlugAndTypeResult = {
  slug: string | null;
  type: MemoryType;
};
