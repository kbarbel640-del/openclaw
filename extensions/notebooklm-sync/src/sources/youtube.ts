/**
 * YouTube transcript extraction.
 *
 * Extracts video transcripts/captions from YouTube videos.
 * Uses the publicly available timedtext API endpoint that YouTube
 * exposes for caption tracks. No API key required.
 */

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_CHARS = 500_000;

/** Extract YouTube video ID from various URL formats */
export function extractVideoId(url: string): string | null {
  try {
    const parsed = new URL(url);

    // https://www.youtube.com/watch?v=VIDEO_ID
    if (
      (parsed.hostname === "www.youtube.com" || parsed.hostname === "youtube.com") &&
      parsed.pathname === "/watch"
    ) {
      return parsed.searchParams.get("v") || null;
    }

    // https://youtu.be/VIDEO_ID
    if (parsed.hostname === "youtu.be") {
      const id = parsed.pathname.slice(1).split("/")[0];
      return id || null;
    }

    // https://www.youtube.com/embed/VIDEO_ID
    if (
      (parsed.hostname === "www.youtube.com" || parsed.hostname === "youtube.com") &&
      parsed.pathname.startsWith("/embed/")
    ) {
      return parsed.pathname.split("/")[2] || null;
    }

    // https://www.youtube.com/shorts/VIDEO_ID
    if (
      (parsed.hostname === "www.youtube.com" || parsed.hostname === "youtube.com") &&
      parsed.pathname.startsWith("/shorts/")
    ) {
      return parsed.pathname.split("/")[2] || null;
    }
  } catch {
    // not a valid URL
  }

  return null;
}

/** Fetch the YouTube video page and extract caption track URLs */
async function fetchCaptionTracks(
  videoId: string,
): Promise<Array<{ url: string; lang: string; name: string }>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const pageUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
    const response = await fetch(pageUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      },
      redirect: "follow",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`YouTube page fetch failed: HTTP ${response.status}`);
    }

    const html = await response.text();

    // Extract captionTracks from the ytInitialPlayerResponse JSON
    const playerResponseMatch = html.match(
      /ytInitialPlayerResponse\s*=\s*(\{.+?\});\s*(?:var\s|<\/script>)/s,
    );
    if (!playerResponseMatch) {
      throw new Error("Could not find player response in YouTube page");
    }

    let playerResponse: Record<string, unknown>;
    try {
      playerResponse = JSON.parse(playerResponseMatch[1]);
    } catch {
      throw new Error("Failed to parse YouTube player response JSON");
    }

    const captions = playerResponse?.captions as Record<string, unknown> | undefined;
    const renderer = captions?.playerCaptionsTracklistRenderer as
      | Record<string, unknown>
      | undefined;
    const tracks = renderer?.captionTracks as
      | Array<{ baseUrl?: string; languageCode?: string; name?: { simpleText?: string } }>
      | undefined;

    if (!tracks || tracks.length === 0) {
      throw new Error("No captions available for this video");
    }

    return tracks
      .filter((t) => t.baseUrl)
      .map((t) => ({
        url: t.baseUrl!,
        lang: t.languageCode ?? "unknown",
        name: t.name?.simpleText ?? t.languageCode ?? "unknown",
      }));
  } finally {
    clearTimeout(timeout);
  }
}

/** Parse YouTube's timedtext XML format into plain text */
function parseTimedTextXml(xml: string): string {
  // Extract text content from <text> elements, decode HTML entities
  const segments: string[] = [];
  const regex = /<text[^>]*>([\s\S]*?)<\/text>/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(xml)) !== null) {
    let text = match[1];
    // Decode XML/HTML entities
    text = text
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, " ")
      .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)))
      .replace(/&#(\d+);/gi, (_, dec) => String.fromCharCode(Number.parseInt(dec, 10)));
    if (text.trim()) {
      segments.push(text.trim());
    }
  }
  return segments.join(" ");
}

/** Fetch transcript text from a caption track URL */
async function fetchTranscriptFromTrack(trackUrl: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    // Request XML format (fmt=3 for srv3 format, or default XML)
    const url = new URL(trackUrl);
    if (!url.searchParams.has("fmt")) {
      url.searchParams.set("fmt", "srv3");
    }

    const response = await fetch(url.toString(), {
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Caption track fetch failed: HTTP ${response.status}`);
    }

    const xml = await response.text();
    return parseTimedTextXml(xml);
  } finally {
    clearTimeout(timeout);
  }
}

/** Extract video title from YouTube page */
async function fetchVideoTitle(videoId: string): Promise<string> {
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&format=json`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5_000);
    try {
      const response = await fetch(oembedUrl, { signal: controller.signal });
      if (response.ok) {
        const data = (await response.json()) as { title?: string };
        if (data.title) return data.title;
      }
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    // ignore
  }
  return `YouTube Video ${videoId}`;
}

export async function extractYouTubeTranscript(url: string): Promise<{
  title: string;
  content: string;
  source: string;
}> {
  const videoId = extractVideoId(url);
  if (!videoId) {
    throw new Error(`Invalid YouTube URL: ${url}`);
  }

  const [tracks, title] = await Promise.all([
    fetchCaptionTracks(videoId),
    fetchVideoTitle(videoId),
  ]);

  // Prefer English, then first available track
  const englishTrack = tracks.find((t) => t.lang.startsWith("en"));
  const selectedTrack = englishTrack || tracks[0];

  if (!selectedTrack) {
    throw new Error("No caption tracks found for this video");
  }

  const transcript = await fetchTranscriptFromTrack(selectedTrack.url);

  if (!transcript.trim()) {
    throw new Error("Transcript is empty");
  }

  const langNote =
    selectedTrack.lang !== "en" && !selectedTrack.lang.startsWith("en")
      ? ` (language: ${selectedTrack.name})`
      : "";

  return {
    title,
    content: transcript.slice(0, DEFAULT_MAX_CHARS),
    source: `${url}${langNote}`,
  };
}
