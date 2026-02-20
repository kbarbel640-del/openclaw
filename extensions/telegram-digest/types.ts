/** Parsed arguments for /tg_digest command. */
export type TgDigestArgs = {
  period: string;
};

/** Parsed arguments for /tg_channel command. */
export type TgChannelArgs = {
  channel: string;
  period: string;
};

/** Parsed arguments for /tg_topics command. */
export type TgTopicsArgs = {
  period: string;
};

/** Parsed arguments for /tg_top command. */
export type TgTopArgs = {
  count: number;
  period: string;
};

/** A single Telegram message with engagement stats. */
export type TgMessage = {
  id: number;
  channel: string;
  date: Date;
  text: string;
  views: number;
  forwards: number;
  replies: number;
  reactions: number;
};

/** Resolved Telegram client configuration. */
export type TgConfig = {
  apiId: number;
  apiHash: string;
  session: string;
  channels: string[];
  maxMessages: number;
};

/** Messages grouped by channel name. */
export type ChannelMessages = {
  channel: string;
  messages: TgMessage[];
};
