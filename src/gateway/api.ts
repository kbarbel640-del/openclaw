import { IncomingMessage, ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { readJsonBody } from "./hooks.js";
import { agentCommand } from "../commands/agent.js";
import { defaultRuntime } from "../runtime.js";
import { createDefaultDeps } from "../cli/deps.js";

export async function handleApiRequest(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<boolean> {
  const url = new URL(
    req.url ?? "/",
    `http://${req.headers.host || "localhost"}`,
  );

  if (url.pathname === "/v1/chat/completions" && req.method === "POST") {
    const body = await readJsonBody(req, 1024 * 1024); // 1MB limit
    if (!body.ok) {
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          error: { message: body.error, type: "invalid_request_error" },
        }),
      );
      return true;
    }

    const payload = body.value as any;
    const messages = payload.messages || [];

    // Simple prompt conversion: extract the last user message or join them
    // For a "one-turn" agent query, usually the last user message is what we want,
    // but context matters.
    // However, Clawdbot agent command expects a "message".
    // Let's grab the last user message as the command, or join them.
    // If Osaurus sends history, we might want to be careful.
    // For now, let's just take the last message content if it's user, or all of it.

    // Better strategy: "User: ... \n Assistant: ... " style?
    // Clawdbot agent usually takes a natural language command.
    // If Osaurus says "Hey Osaurus, check my server", Osaurus sends "Check my server".
    // So messages[0] is likely the command.

    const lastMessage = messages[messages.length - 1];
    const prompt = lastMessage?.content || "";

    const runId = randomUUID();
    const deps = createDefaultDeps();

    try {
      const result = await agentCommand(
        {
          message: prompt,
          runId,
          deliver: false,
          provider: "whatsapp", // Default context
          bestEffortDeliver: false,
        },
        defaultRuntime,
        deps,
      );

      // Extract text response
      let content = "";
      if (result?.payloads && result.payloads.length > 0) {
        content = result.payloads
          .map((p) => p.text)
          .filter(Boolean)
          .join("\n\n");
      } else {
        content = "No response from Clawdbot.";
      }

      const response = {
        id: runId,
        object: "chat.completion",
        created: Math.floor(Date.now() / 1000),
        model: payload.model || "clawdbot-agent",
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: content,
            },
            finish_reason: "stop",
          },
        ],
        usage: {
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0,
        },
      };

      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(response));
    } catch (err) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({ error: { message: String(err), type: "api_error" } }),
      );
    }
    return true;
  }

  return false;
}
