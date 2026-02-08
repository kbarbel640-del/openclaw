import type { WebClient } from "@slack/web-api";
import { logVerbose } from "../globals.js";

export type SlackStreamHandle = {
  /** Append markdown text to the live-updating message. */
  append: (text: string) => Promise<void>;
  /** Finalize the stream. The message becomes a normal Slack message. */
  stop: () => Promise<void>;
};

/** Minimum ms between stream appends to create a visible reveal effect. */
const STREAM_CHUNK_DELAY_MS = 100;
/** Approximate characters per streaming chunk. */
const STREAM_CHUNK_SIZE = 40;

/**
 * Split `text` into chunks that break on word boundaries.
 */
function chunkText(text: string, chunkSize: number): string[] {
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= chunkSize) {
      chunks.push(remaining);
      break;
    }
    let end = remaining.lastIndexOf(" ", chunkSize);
    if (end <= 0) {
      end = remaining.indexOf(" ", chunkSize);
      if (end <= 0) end = remaining.length;
    }
    chunks.push(remaining.slice(0, end + 1));
    remaining = remaining.slice(end + 1);
  }
  return chunks;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Start a Slack streaming message using `chat.startStream` /
 * `chat.appendStream` / `chat.stopStream`.
 *
 * The API returns a message `ts` (not a `stream_id`) which is used
 * with the channel to identify the stream for append/stop calls.
 */
export async function startSlackStream(params: {
  client: WebClient;
  channel: string;
  threadTs?: string;
}): Promise<SlackStreamHandle> {
  const { client, channel, threadTs } = params;

  const startPayload: Record<string, unknown> = { channel };
  if (threadTs) {
    startPayload.thread_ts = threadTs;
  }

  console.error(`[stream-debug] calling chat.startStream with:`, JSON.stringify(startPayload));
  const startResult = (await client.apiCall("chat.startStream", startPayload)) as {
    ok?: boolean;
    ts?: string;
    stream_id?: string;
    channel?: string;
    error?: string;
  };
  console.error(`[stream-debug] chat.startStream result:`, JSON.stringify(startResult));

  if (!startResult.ok) {
    throw new Error(`chat.startStream failed: ${startResult.error ?? "unknown error"}`);
  }

  // The API may return stream_id (older docs) or ts (current behavior).
  const streamId = startResult.stream_id ?? startResult.ts;
  if (!streamId) {
    throw new Error("chat.startStream returned neither stream_id nor ts");
  }

  const streamChannel = startResult.channel ?? channel;
  let appendCount = 0;
  // Track cumulative text for appendStream (each append sends full content so far).
  let cumulativeText = "";

  const rawAppend = async (text: string) => {
    appendCount++;
    cumulativeText += text;
    console.error(`[stream-debug] append #${appendCount} (+${text.length} chars, total=${cumulativeText.length})`);
    // Try both field names — the API may expect stream_id or use channel+ts.
    const result = (await client.apiCall("chat.appendStream", {
      channel: streamChannel,
      stream_id: streamId,
      ts: streamId,
      text: cumulativeText,
    })) as { ok?: boolean; error?: string };
    if (!result.ok) {
      console.error(`[stream-debug] append #${appendCount} FAILED:`, JSON.stringify(result));
      throw new Error(`chat.appendStream failed: ${result.error}`);
    }
  };

  const rawStop = async () => {
    console.error(`[stream-debug] stopping stream ${streamId} after ${appendCount} appends`);
    const result = (await client.apiCall("chat.stopStream", {
      channel: streamChannel,
      stream_id: streamId,
      ts: streamId,
    })) as { ok?: boolean; error?: string };
    console.error(`[stream-debug] chat.stopStream result:`, JSON.stringify(result));
  };

  // Wrap append with chunking for visible progressive reveal.
  const chunkedAppend = async (text: string) => {
    const chunks = chunkText(text, STREAM_CHUNK_SIZE);
    console.error(`[stream-debug] chunking ${text.length} chars into ${chunks.length} chunks`);
    for (let i = 0; i < chunks.length; i++) {
      await rawAppend(chunks[i]);
      if (i < chunks.length - 1) {
        await sleep(STREAM_CHUNK_DELAY_MS);
      }
    }
  };

  return {
    append: chunkedAppend,
    stop: rawStop,
  };
}

/**
 * Deliver a complete message via streaming.  Falls back to returning
 * `false` if the stream API is unavailable.
 */
export async function deliverViaStream(params: {
  client: WebClient;
  channel: string;
  text: string;
  threadTs?: string;
}): Promise<boolean> {
  try {
    const stream = await startSlackStream({
      client: params.client,
      channel: params.channel,
      threadTs: params.threadTs,
    });
    await stream.append(params.text);
    await stream.stop();
    return true;
  } catch (err) {
    logVerbose(`slack stream delivery failed, will fall back: ${String(err)}`);
    return false;
  }
}
