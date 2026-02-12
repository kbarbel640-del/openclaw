export type SttConfig = {
  /** STT provider name (e.g. "wav2vec2-stt"). Accepts any installed STT skill. */
  provider?: string;
  /** Language code for recognition (e.g. "en-US"). */
  language?: string;
  /** Enable continuous recognition mode. */
  continuous?: boolean;
  /** Return interim (partial) results during recognition. */
  interimResults?: boolean;
  /** Recognition request timeout (ms). */
  timeoutMs?: number;
};
