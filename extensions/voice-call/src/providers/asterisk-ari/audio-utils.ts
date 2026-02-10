import type { VoiceCallConfig } from "../../config.js";

export function mulawToLinear(mulaw: number): number {
  let m = ~mulaw & 0xff;
  const sign = m & 0x80;
  const exponent = (m >> 4) & 0x07;
  const mantissa = m & 0x0f;
  let sample = ((mantissa << 3) + 132) << exponent;
  sample -= 132;
  return sign ? -sample : sample;
}

export function alawToLinear(aLaw: number): number {
  const a = aLaw ^ 0x55;
  let t = (a & 0x0f) << 4;
  const seg = (a & 0x70) >> 4;
  switch (seg) {
    case 0:
      t += 8;
      break;
    case 1:
      t += 0x108;
      break;
    default:
      t += 0x108;
      t <<= seg - 1;
      break;
  }
  return a & 0x80 ? t : -t;
}

export function linearToAlaw(pcm: number): number {
  const ALAW_MAX = 0x7fff;
  let mask = 0xd5;
  let p = pcm;
  if (p < 0) {
    mask = 0x55;
    p = -p - 1;
  }
  if (p > ALAW_MAX) {
    p = ALAW_MAX;
  }
  let seg = 0;
  if (p >= 256) {
    let tmp = p >> 8;
    while (tmp) {
      seg++;
      tmp >>= 1;
    }
    seg = Math.min(seg, 7);
    const aval = (seg << 4) | ((p >> (seg + 3)) & 0x0f);
    return (aval ^ mask) & 0xff;
  }
  const aval = p >> 4;
  return (aval ^ mask) & 0xff;
}

export function g711ToPcm16Buffer(payload: Buffer, codec: NonNullable<VoiceCallConfig["asteriskAri"]>["codec"]): Buffer {
  const pcm = Buffer.allocUnsafe(payload.length * 2);
  if (codec === "alaw") {
    for (let i = 0; i < payload.length; i++) {
      pcm.writeInt16LE(alawToLinear(payload[i] ?? 0), i * 2);
    }
    return pcm;
  }
  for (let i = 0; i < payload.length; i++) {
    pcm.writeInt16LE(mulawToLinear(payload[i] ?? 0), i * 2);
  }
  return pcm;
}

export function mulawToAlawBuffer(mulaw: Buffer): Buffer {
  const out = Buffer.allocUnsafe(mulaw.length);
  for (let i = 0; i < mulaw.length; i++) {
    out[i] = linearToAlaw(mulawToLinear(mulaw[i] ?? 0));
  }
  return out;
}

export function computeRms(pcm: Buffer): number {
  if (pcm.length < 2) return 0;
  let sum = 0;
  for (let i = 0; i < pcm.length; i += 2) {
    const sample = pcm.readInt16LE(i);
    sum += sample * sample;
  }
  const count = pcm.length / 2;
  return Math.sqrt(sum / Math.max(1, count));
}

export function pcmDurationMsFromBytes(bytes: number): number {
  return Math.round((bytes / 2 / 8000) * 1000);
}

export function buildWavFromPcm(pcm: Buffer, sampleRate = 8000): Buffer {
  const dataSize = pcm.length;
  const header = Buffer.alloc(44);
  header.write("RIFF", 0, 4, "ascii");
  header.writeUInt32LE(36 + dataSize, 4);
  header.write("WAVE", 8, 4, "ascii");
  header.write("fmt ", 12, 4, "ascii");
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36, 4, "ascii");
  header.writeUInt32LE(dataSize, 40);
  return Buffer.concat([header, pcm]);
}
