/**
 * ACP Session Adapter
 *
 * Bridges ACP session lifecycle to Clawdis's getReplyFromConfig().
 * Follows the same pattern as Discord/Telegram monitors.
 */

import type {
  AgentSideConnection,
  ContentBlock,
  PromptRequest,
  PromptResponse,
  TextContent,
} from "@agentclientprotocol/sdk";

import { formatAgentEnvelope } from "../auto-reply/envelope.js";
import { getReplyFromConfig } from "../auto-reply/reply.js";
import type { ReplyPayload } from "../auto-reply/types.js";
import { type ClawdisConfig, loadConfig } from "../config/config.js";
import type { AcpSessionState } from "./types.js";

export type AcpSessionAdapterDeps = {
  connection: AgentSideConnection;
  config?: ClawdisConfig;
};

/**
 * Manages a single ACP session, translating between ACP protocol
 * and Clawdis's unified reply system.
 */
export class AcpSessionAdapter {
  private state: AcpSessionState;
  private connection: AgentSideConnection;
  private config: ClawdisConfig;

  constructor(sessionId: string, cwd: string, deps: AcpSessionAdapterDeps) {
    this.state = {
      sessionId,
      cwd,
      createdAt: Date.now(),
      abortController: null,
      clawdisSessionKey: `acp:${sessionId}`,
    };
    this.connection = deps.connection;
    this.config = deps.config ?? loadConfig();
  }

  get sessionId(): string {
    return this.state.sessionId;
  }

  get cwd(): string {
    return this.state.cwd;
  }

  /**
   * Handle an ACP prompt request.
   * Builds MsgContext and calls getReplyFromConfig(), streaming updates back.
   */
  async handlePrompt(params: PromptRequest): Promise<PromptResponse> {
    // Abort any pending prompt
    this.state.abortController?.abort();
    this.state.abortController = new AbortController();

    const userText = this.extractTextFromPrompt(params.prompt);

    // Build MsgContext matching Discord/Telegram pattern
    const msgContext = {
      Body: formatAgentEnvelope({
        surface: "ACP",
        body: userText,
      }),
      From: `acp:${this.state.sessionId}`,
      To: `session:${this.state.sessionId}`,
      ChatType: "direct" as const,
      Surface: "acp" as const,
      Timestamp: Date.now(),
      // ACP-specific: pass working directory
      WorkingDirectory: this.state.cwd,
    };

    try {
      const replyResult = await getReplyFromConfig(
        msgContext,
        {
          onPartialReply: (payload) => this.sendPartialReply(payload),
          onToolResult: (payload) => this.sendToolResult(payload),
        },
        this.config,
      );

      // Send final reply if any
      const replies = replyResult
        ? Array.isArray(replyResult)
          ? replyResult
          : [replyResult]
        : [];

      for (const reply of replies) {
        if (reply.text) {
          await this.connection.sessionUpdate({
            sessionId: this.state.sessionId,
            update: {
              sessionUpdate: "agent_message_chunk",
              content: { type: "text", text: reply.text },
            },
          });
        }
      }

      return { stopReason: "end_turn" };
    } catch (err) {
      if (this.state.abortController?.signal.aborted) {
        return { stopReason: "cancelled" };
      }
      throw err;
    } finally {
      this.state.abortController = null;
    }
  }

  /**
   * Cancel the current prompt.
   */
  cancel(): void {
    this.state.abortController?.abort();
  }

  /**
   * Send a partial reply as an agent_message_chunk.
   */
  private async sendPartialReply(payload: ReplyPayload): Promise<void> {
    if (!payload.text) return;

    await this.connection.sessionUpdate({
      sessionId: this.state.sessionId,
      update: {
        sessionUpdate: "agent_message_chunk",
        content: { type: "text", text: payload.text },
      },
    });
  }

  /**
   * Send a tool result notification.
   * TODO: Map to proper tool_call / tool_call_update once we have tool event details.
   */
  private async sendToolResult(payload: ReplyPayload): Promise<void> {
    if (!payload.text) return;

    // For now, send as agent message chunk
    // Phase 2 will properly map tool invocations
    await this.connection.sessionUpdate({
      sessionId: this.state.sessionId,
      update: {
        sessionUpdate: "agent_message_chunk",
        content: { type: "text", text: payload.text },
      },
    });
  }

  /**
   * Extract text content from ACP prompt content blocks.
   */
  private extractTextFromPrompt(prompt: ContentBlock[]): string {
    return prompt
      .filter(
        (block): block is TextContent & { type: "text" } =>
          "type" in block && block.type === "text" && "text" in block,
      )
      .map((block) => block.text)
      .join("\n");
  }
}
