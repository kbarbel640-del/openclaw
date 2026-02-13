import { Buffer } from "node:buffer";

export const FRAME_STDOUT = 1;
export const FRAME_STDERR = 2;
export const FRAME_EXIT = 3;
export const FRAME_ERROR = 4;
export const MAX_FRAME_SIZE = 16 * 1024 * 1024; // 16MB

export type CliportFrame = {
  kind: number;
  payload: Buffer;
};

export function encodeFrame(kind: number, payload: Buffer | string): Buffer {
  const body = Buffer.isBuffer(payload) ? payload : Buffer.from(payload, "utf-8");
  const out = Buffer.allocUnsafe(5 + body.length);
  out.writeUInt8(kind, 0);
  out.writeUInt32BE(body.length, 1);
  body.copy(out, 5);
  return out;
}

export function tryDecodeFrames(buffer: Buffer): {
  frames: CliportFrame[];
  rest: Buffer;
  error?: string;
} {
  const frames: CliportFrame[] = [];
  let offset = 0;
  while (offset + 5 <= buffer.length) {
    const kind = buffer.readUInt8(offset);
    const size = buffer.readUInt32BE(offset + 1);
    if (size > MAX_FRAME_SIZE) {
      return {
        frames,
        rest: Buffer.from(buffer.subarray(offset)),
        error: `frame size ${size} exceeds maximum ${MAX_FRAME_SIZE}`,
      };
    }
    const next = offset + 5 + size;
    if (next > buffer.length) {
      break;
    }
    const payload = Buffer.from(buffer.subarray(offset + 5, next));
    frames.push({ kind, payload });
    offset = next;
  }
  return { frames, rest: Buffer.from(buffer.subarray(offset)) };
}

export function encodeExitFrame(params: {
  code: number | null;
  signal: NodeJS.Signals | number | null;
  timedOut: boolean;
  durationMs: number;
}): Buffer {
  return encodeFrame(
    FRAME_EXIT,
    JSON.stringify({
      code: params.code,
      signal: params.signal,
      timedOut: params.timedOut,
      durationMs: params.durationMs,
    }),
  );
}

export function encodeErrorFrame(message: string): Buffer {
  return encodeFrame(FRAME_ERROR, message);
}
