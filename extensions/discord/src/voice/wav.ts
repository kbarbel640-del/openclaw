/**
 * PCM-to-WAV buffer conversion.
 * Wraps raw PCM audio data in a 44-byte RIFF/WAVE header.
 */

export interface WavOptions {
  sampleRate?: number;
  channels?: number;
  bitsPerSample?: number;
}

/**
 * Wrap raw PCM data in a WAV container.
 * Defaults to 48kHz stereo 16-bit, matching Discord voice output.
 */
export function wrapPcmInWav(pcmData: Buffer, opts?: WavOptions): Buffer {
  const sampleRate = opts?.sampleRate ?? 48000;
  const channels = opts?.channels ?? 2;
  const bitsPerSample = opts?.bitsPerSample ?? 16;
  const byteRate = sampleRate * channels * (bitsPerSample / 8);
  const blockAlign = channels * (bitsPerSample / 8);
  const dataSize = pcmData.length;
  const headerSize = 44;

  const buffer = Buffer.alloc(headerSize + dataSize);

  // RIFF header
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);

  // fmt sub-chunk
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16); // sub-chunk size
  buffer.writeUInt16LE(1, 20); // audio format (PCM)
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);

  // data sub-chunk
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);
  pcmData.copy(buffer, headerSize);

  return buffer;
}
