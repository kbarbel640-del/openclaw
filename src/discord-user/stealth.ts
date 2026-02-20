export type StealthFingerprint = {
  properties: StealthProperties;
  superProperties: string;
  userAgent: string;
};

export type StealthProperties = {
  os: string;
  browser: string;
  device: string;
  system_locale: string;
  browser_user_agent: string;
  browser_version: string;
  os_version: string;
  referrer: string;
  referring_domain: string;
  referrer_current: string;
  referring_domain_current: string;
  release_channel: string;
  client_build_number: number;
  client_event_source: null;
  design_id: number;
};

export type StealthConfig = {
  buildNumber?: number;
  os?: string;
  browser?: string;
  releaseChannel?: string;
  typingDelay?: [number, number];
};

const DEFAULT_BUILD_NUMBER = 344749;
const DEFAULT_OS = "Windows";
const DEFAULT_BROWSER = "Discord Client";
const DEFAULT_RELEASE_CHANNEL = "stable";
const DEFAULT_BROWSER_VERSION = "131.0.0.0";
const DEFAULT_OS_VERSION = "10";
const DEFAULT_SYSTEM_LOCALE = "en-US";
const DEFAULT_TYPING_DELAY: [number, number] = [800, 2500];

const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) discord/1.0.9188 Chrome/128.0.6613.186 Electron/32.2.7 Safari/537.36";

export function buildStealthFingerprint(config?: StealthConfig): StealthFingerprint {
  const os = config?.os ?? DEFAULT_OS;
  const browser = config?.browser ?? DEFAULT_BROWSER;
  const releaseChannel = config?.releaseChannel ?? DEFAULT_RELEASE_CHANNEL;
  const buildNumber = config?.buildNumber ?? DEFAULT_BUILD_NUMBER;

  const properties: StealthProperties = {
    os,
    browser,
    device: "",
    system_locale: DEFAULT_SYSTEM_LOCALE,
    browser_user_agent: DEFAULT_USER_AGENT,
    browser_version: DEFAULT_BROWSER_VERSION,
    os_version: DEFAULT_OS_VERSION,
    referrer: "",
    referring_domain: "",
    referrer_current: "",
    referring_domain_current: "",
    release_channel: releaseChannel,
    client_build_number: buildNumber,
    client_event_source: null,
    design_id: 0,
  };

  const superProperties = Buffer.from(JSON.stringify(properties)).toString("base64");
  const userAgent = DEFAULT_USER_AGENT;

  return { properties, superProperties, userAgent };
}

/**
 * Returns a random delay (in ms) within the configured typing-delay range.
 */
export function resolveTypingDelay(config?: StealthConfig): number {
  const [min, max] = config?.typingDelay ?? DEFAULT_TYPING_DELAY;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Returns a small random jitter (0–200 ms) to add to actions.
 */
export function resolveActionJitter(): number {
  return Math.floor(Math.random() * 200);
}
