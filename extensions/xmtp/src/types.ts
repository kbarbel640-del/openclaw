/**
 * Types for XMTP agent runtime and message handling.
 * Agent from @xmtp/agent-sdk has no sendText; use agent.client.conversations.getConversationById then conversation.sendText.
 */

export interface XmtpConversation {
  sendText(text: string, isOptimistic?: boolean): Promise<string>;
}

export interface XmtpClientConversations {
  getConversationById(id: string): Promise<XmtpConversation | undefined>;
}

export interface XmtpAgentRuntime {
  readonly client: { conversations: XmtpClientConversations };
  on(
    event: "text",
    handler: (ctx: {
      message: { content: string; id?: string };
      conversation?: { id?: string };
      getSenderAddress(): Promise<string>;
    }) => void | Promise<void>,
  ): void;
  start(): Promise<void>;
  stop(): Promise<void>;
}
