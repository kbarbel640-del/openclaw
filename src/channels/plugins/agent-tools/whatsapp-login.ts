import type { AgentTool } from "@mariozechner/pi-agent-core";
import { z } from "zod";
import { zodToToolJsonSchema } from "../../../agents/schema/zod-tool-schema.js";

// oxlint-disable-next-line typescript/no-explicit-any
export function createWhatsAppLoginTool(): AgentTool<any, unknown> {
  return {
    label: "WhatsApp Login",
    name: "whatsapp_login",
    description: "Generate a WhatsApp QR code for linking, or wait for the scan to complete.",
    parameters: zodToToolJsonSchema(
      z.object({
        action: z.enum(["start", "wait"]),
        timeoutMs: z.number().optional(),
        force: z.boolean().optional(),
      }),
    ),
    execute: async (_toolCallId, args) => {
      const { startWebLoginWithQr, waitForWebLogin } = await import("../../../web/login-qr.js");
      const action = (args as { action?: string })?.action ?? "start";
      if (action === "wait") {
        const result = await waitForWebLogin({
          timeoutMs:
            typeof (args as { timeoutMs?: unknown }).timeoutMs === "number"
              ? (args as { timeoutMs?: number }).timeoutMs
              : undefined,
        });
        return {
          content: [{ type: "text", text: result.message }],
          details: { connected: result.connected },
        };
      }

      const result = await startWebLoginWithQr({
        timeoutMs:
          typeof (args as { timeoutMs?: unknown }).timeoutMs === "number"
            ? (args as { timeoutMs?: number }).timeoutMs
            : undefined,
        force:
          typeof (args as { force?: unknown }).force === "boolean"
            ? (args as { force?: boolean }).force
            : false,
      });

      if (!result.qrDataUrl) {
        return {
          content: [
            {
              type: "text",
              text: result.message,
            },
          ],
          details: { qr: false },
        };
      }

      const text = [
        result.message,
        "",
        "Open WhatsApp → Linked Devices and scan:",
        "",
        `![whatsapp-qr](${result.qrDataUrl})`,
      ].join("\n");
      return {
        content: [{ type: "text", text }],
        details: { qr: true },
      };
    },
  };
}
