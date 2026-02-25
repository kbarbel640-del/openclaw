import type { OpenClawConfig, ChannelOnboardingAdapter } from "openclaw/plugin-sdk";
import {
  listWhatsAppCallAccountIds,
  resolveWhatsAppCallAccount,
  type WhatsAppCallProvider,
} from "./config.js";

const channel = "whatsappcall" as const;
const CHANNEL_KEY = "whatsappcall";

export const whatsAppCallOnboardingAdapter: ChannelOnboardingAdapter = {
  channel,

  getStatus: async ({ cfg }) => {
    const accounts = listWhatsAppCallAccountIds(cfg);
    const configured = accounts.some((id) => resolveWhatsAppCallAccount(cfg, id).configured);
    return {
      channel,
      configured,
      statusLines: [
        `WhatsApp Call: ${configured ? "configured" : "needs setup (WATI or Meta tokens)"}`,
      ],
      selectionHint: configured ? "configured" : "voice calls via WhatsApp",
    };
  },

  configure: async ({ cfg, prompter }) => {
    let next = cfg;

    // Step 1: choose provider
    const providerChoice = await prompter.select<WhatsAppCallProvider>({
      message: "WhatsApp Call provider",
      options: [
        { value: "meta", label: "Default — use Meta Graph API tokens directly" },
        { value: "wati", label: "WATI — use WATI API tokens" },
      ],
    });

    const provider: WhatsAppCallProvider =
      typeof providerChoice === "string" ? providerChoice : "meta";

    if (provider === "meta") {
      next = await configureMeta(next, prompter);
    } else {
      next = await configureWati(next, prompter);
    }

    // Step 2: OpenAI API key
    next = await configureOpenAI(next, prompter);

    // Step 3: Twilio TURN (optional)
    next = await configureTwilio(next, prompter);

    // Step 4: Voice service URL
    next = await configureServiceUrl(next, prompter);

    return { cfg: next, accountId: "default" };
  },
};

async function configureWati(
  cfg: OpenClawConfig,
  prompter: { text: Function; note: Function },
): Promise<OpenClawConfig> {
  await prompter.note(
    [
      "You'll need these from your WATI dashboard:",
      "  1) Tenant ID (from WATI URL, e.g. the UUID part)",
      "  2) API Token (from WATI → Integrations → API)",
      "  3) Base URL (usually https://live-mt-server.wati.io)",
    ].join("\n"),
    "WATI credentials",
  );

  const existing = getExisting(cfg);

  const tenantId = String(
    await prompter.text({
      message: "WATI Tenant ID",
      initialValue: existing.watiTenantId,
      validate: (v: string) => (v?.trim() ? undefined : "Required"),
    }),
  ).trim();

  const apiToken = String(
    await prompter.text({
      message: "WATI API Token",
      initialValue: existing.watiApiToken,
      validate: (v: string) => (v?.trim() ? undefined : "Required"),
    }),
  ).trim();

  const baseUrl = String(
    await prompter.text({
      message: "WATI Base URL",
      initialValue: existing.watiBaseUrl || "https://live-mt-server.wati.io",
    }),
  ).trim();

  return mergeChannelConfig(cfg, {
    enabled: true,
    provider: "wati",
    watiBaseUrl: baseUrl,
    watiOutboundUrl: baseUrl,
    watiTenantId: tenantId,
    watiApiToken: apiToken,
  });
}

async function configureMeta(
  cfg: OpenClawConfig,
  prompter: { text: Function; note: Function },
): Promise<OpenClawConfig> {
  await prompter.note(
    [
      "You'll need these from Meta Business Manager:",
      "  1) Meta Phone Number ID (from WhatsApp → API Setup)",
      "  2) Meta Access Token (System User token with whatsapp_business_messaging permission)",
      "",
      "Note: Meta requires your number to have 2,000+ daily business conversations",
      "for the Calling API to be enabled.",
    ].join("\n"),
    "Meta Graph API credentials",
  );

  const existing = getExisting(cfg);

  const phoneNumberId = String(
    await prompter.text({
      message: "Meta Phone Number ID",
      initialValue: existing.metaPhoneNumberId,
      validate: (v: string) => (v?.trim() ? undefined : "Required"),
    }),
  ).trim();

  const accessToken = String(
    await prompter.text({
      message: "Meta Access Token",
      initialValue: existing.metaAccessToken,
      validate: (v: string) => (v?.trim() ? undefined : "Required"),
    }),
  ).trim();

  return mergeChannelConfig(cfg, {
    enabled: true,
    provider: "meta",
    metaPhoneNumberId: phoneNumberId,
    metaAccessToken: accessToken,
  });
}

async function configureOpenAI(
  cfg: OpenClawConfig,
  prompter: { text: Function; confirm: Function },
): Promise<OpenClawConfig> {
  const existing = getExisting(cfg);
  const envKey = process.env.OPENAI_API_KEY?.trim();

  if (envKey && !existing.openaiApiKey) {
    const useEnv = await prompter.confirm({
      message: "OPENAI_API_KEY found in env. Use it?",
      initialValue: true,
    });
    if (useEnv) return cfg;
  }

  if (existing.openaiApiKey) {
    const keep = await prompter.confirm({
      message: "OpenAI API key already configured. Keep it?",
      initialValue: true,
    });
    if (keep) return cfg;
  }

  const apiKey = String(
    await prompter.text({
      message: "OpenAI API Key (for Realtime voice)",
      validate: (v: string) => (v?.trim() ? undefined : "Required"),
    }),
  ).trim();

  return mergeChannelConfig(cfg, { openaiApiKey: apiKey });
}

async function configureTwilio(
  cfg: OpenClawConfig,
  prompter: { text: Function; confirm: Function },
): Promise<OpenClawConfig> {
  const existing = getExisting(cfg);

  if (existing.twilioAccountSid && existing.twilioAuthToken) {
    const keep = await prompter.confirm({
      message: "Twilio TURN credentials already configured. Keep them?",
      initialValue: true,
    });
    if (keep) return cfg;
  }

  const wantTurn = await prompter.confirm({
    message: "Add Twilio TURN server? (recommended for NAT traversal)",
    initialValue: true,
  });
  if (!wantTurn) return cfg;

  const sid = String(
    await prompter.text({
      message: "Twilio Account SID",
      initialValue: existing.twilioAccountSid,
      validate: (v: string) => (v?.trim() ? undefined : "Required"),
    }),
  ).trim();

  const token = String(
    await prompter.text({
      message: "Twilio Auth Token",
      initialValue: existing.twilioAuthToken,
      validate: (v: string) => (v?.trim() ? undefined : "Required"),
    }),
  ).trim();

  return mergeChannelConfig(cfg, { twilioAccountSid: sid, twilioAuthToken: token });
}

async function configureServiceUrl(
  cfg: OpenClawConfig,
  prompter: { text: Function },
): Promise<OpenClawConfig> {
  const existing = getExisting(cfg);

  const serviceUrl = String(
    await prompter.text({
      message: "WhatsApp Voice service URL (e.g. http://localhost:8080 or ngrok URL)",
      initialValue: existing.serviceUrl || "http://localhost:8080",
    }),
  ).trim();

  if (!serviceUrl) return cfg;
  return mergeChannelConfig(cfg, { serviceUrl });
}

function mergeChannelConfig(cfg: OpenClawConfig, patch: Record<string, unknown>): OpenClawConfig {
  const channels = (cfg.channels ?? {}) as Record<string, unknown>;
  const section = (channels[CHANNEL_KEY] ?? {}) as Record<string, unknown>;
  return {
    ...cfg,
    channels: { ...channels, [CHANNEL_KEY]: { ...section, ...patch } },
  } as OpenClawConfig;
}

function getExisting(cfg: OpenClawConfig): Record<string, string | undefined> {
  const section = (cfg.channels as Record<string, unknown>)?.[CHANNEL_KEY] as
    | Record<string, unknown>
    | undefined;
  if (!section) return {};
  const result: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(section)) {
    if (typeof v === "string") result[k] = v;
  }
  return result;
}
