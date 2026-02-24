import type {
  AnyAgentTool,
  ChannelPlugin,
  OpenClawPluginApi,
  OpenClawPluginToolFactory,
} from "openclaw/plugin-sdk";
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";
import { whatsappCallPlugin } from "./src/channel.js";
import { resolveWhatsAppCallAccount } from "./src/config.js";
import { setWhatsAppCallRuntime } from "./src/runtime.js";
import { createWhatsAppCallRemoteTool } from "./src/tool-remote.js";
import { createWhatsAppCallTool } from "./src/tool.js";
import { WhatsAppCallService } from "./src/voice/service.js";

const plugin = {
  id: "whatsapp-call",
  name: "WhatsApp Call",
  description: "Outbound AI voice calls via WhatsApp (WATI or Meta Graph API)",
  configSchema: emptyPluginConfigSchema(),
  register(api: OpenClawPluginApi) {
    setWhatsAppCallRuntime(api.runtime);
    api.registerChannel({ plugin: whatsappCallPlugin as ChannelPlugin });

    let service: WhatsAppCallService | null = null;

    api.registerService({
      id: "whatsapp-call-voice",
      start: async () => {
        const account = resolveWhatsAppCallAccount(api.config ?? {});
        // Remote mode: no local service needed
        if (account.config.serviceUrl) return;
        if (!account.enabled || !account.configured) return;

        service = new WhatsAppCallService(account.config, (msg) => api.logger.info(msg));
        await service.start();
      },
      stop: async () => {
        if (service) {
          await service.stop();
          service = null;
        }
      },
    });

    // Webhook HTTP route — only needed in local mode
    api.registerHttpRoute({
      path: "/whatsapp-call/webhook",
      handler: async (req, res) => {
        if (req.method === "GET") {
          const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
          const challenge = url.searchParams.get("hub.challenge");
          if (challenge) {
            res.writeHead(200, { "Content-Type": "text/plain" });
            res.end(challenge);
            return;
          }
          res.writeHead(200);
          res.end("ok");
          return;
        }

        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);
        const body = Buffer.concat(chunks).toString();

        api.logger.info(`[wa-call] webhook body(${body.length}b)`);

        if (service) {
          service.handleWebhook(body);
        }

        res.writeHead(200);
        res.end();
      },
    });

    // Agent tool — remote mode (HTTP) vs local mode (in-process)
    api.registerTool(
      ((ctx) => {
        const account = resolveWhatsAppCallAccount(ctx.config ?? {});

        // Remote mode: serviceUrl configured → lightweight HTTP tool
        if (account.config.serviceUrl) {
          return createWhatsAppCallRemoteTool(
            account.config.serviceUrl,
            process.env.WHATSAPP_CALL_API_KEY || "",
            {
              greeting: account.config.voiceGreeting || account.config.voiceInstructions,
              language: account.config.voiceLanguage,
              voice: account.config.voice,
              openaiApiKey: account.config.openaiApiKey,
            },
          ) as AnyAgentTool;
        }

        // Local mode: in-process service
        if (!account.enabled && !account.configured) return null;
        return createWhatsAppCallTool(() => service) as AnyAgentTool;
      }) as OpenClawPluginToolFactory,
      { optional: true },
    );
  },
};

export default plugin;
