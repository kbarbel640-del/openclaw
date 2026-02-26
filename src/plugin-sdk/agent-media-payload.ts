/**
 * @description Media attachment payload passed to an agent turn. Contains both
 * singular convenience fields (for the first attachment) and plural array
 * fields (for all attachments). Singular `MediaPath`/`MediaUrl` are the same
 * value — both are set for backwards compatibility with agents that read
 * either field.
 */
export type AgentMediaPayload = {
  /** Local filesystem path to the first media attachment. */
  MediaPath?: string;
  /** MIME content-type of the first media attachment, when known. */
  MediaType?: string;
  /**
   * URL (or local path) of the first media attachment. Set to the same value
   * as `MediaPath` for compatibility with URL-based agents.
   */
  MediaUrl?: string;
  /** Local filesystem paths for all attachments in the message. */
  MediaPaths?: string[];
  /** URLs (or local paths) for all attachments in the message. */
  MediaUrls?: string[];
  /** MIME content-types for all attachments; only entries with known types are included. */
  MediaTypes?: string[];
};

/**
 * @description Converts a list of downloaded media items into an
 * {@link AgentMediaPayload} suitable for inclusion in an agent turn payload.
 * The first item in `mediaList` populates the singular convenience fields;
 * all items populate the plural array fields.
 *
 * @param mediaList - Array of objects with a `path` (local file path) and
 *   optional `contentType` (MIME type).
 * @returns An {@link AgentMediaPayload} with singular and plural fields
 *   populated from `mediaList`. Array fields are `undefined` when the list is
 *   empty.
 *
 * @example
 * ```ts
 * const payload = buildAgentMediaPayload([
 *   { path: "/tmp/img.jpg", contentType: "image/jpeg" },
 * ]);
 * // { MediaPath: "/tmp/img.jpg", MediaType: "image/jpeg", ... }
 * ```
 */
export function buildAgentMediaPayload(
  mediaList: Array<{ path: string; contentType?: string | null }>,
): AgentMediaPayload {
  const first = mediaList[0];
  const mediaPaths = mediaList.map((media) => media.path);
  const mediaTypes = mediaList.map((media) => media.contentType).filter(Boolean) as string[];
  return {
    MediaPath: first?.path,
    MediaType: first?.contentType ?? undefined,
    MediaUrl: first?.path,
    MediaPaths: mediaPaths.length > 0 ? mediaPaths : undefined,
    MediaUrls: mediaPaths.length > 0 ? mediaPaths : undefined,
    MediaTypes: mediaTypes.length > 0 ? mediaTypes : undefined,
  };
}
