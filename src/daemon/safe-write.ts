/**
 * Write to a stream, silently ignoring EPIPE/EIO errors that occur when the
 * receiving end of the pipe has already closed (e.g. during service lifecycle).
 */
export function safeWrite(stream: NodeJS.WritableStream, data: string): void {
  try {
    stream.write(data);
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException | undefined)?.code;
    if (code !== "EPIPE" && code !== "EIO") {
      throw err;
    }
  }
}
