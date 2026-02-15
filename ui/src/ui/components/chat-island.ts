/**
 * Chat Island - Interactive chat component for Astro.
 * Wraps the existing renderChat view with gateway service calls.
 */

import { StoreController } from "@nanostores/lit";
import { LitElement, html, type TemplateResult } from "lit";
import { customElement, state } from "lit/decorators.js";
import { gateway, $gatewayEvent } from "../../services/gateway.ts";
import { $connected, $activeSession, $sessions } from "../../stores/app.ts";
import {
  $chatLoading,
  $chatSending,
  $chatMessage,
  $chatMessages,
  $chatToolMessages,
  $chatStream,
  $chatStreamStartedAt,
  $chatQueue,
  $chatAttachments,
  $sidebarOpen,
  $sidebarContent,
  $sidebarError,
  $splitRatio,
} from "../../stores/chat.ts";
import { renderChat, type ChatProps } from "../views/chat.ts";

@customElement("chat-island")
export class ChatIsland extends LitElement {
  private chatLoading = new StoreController(this, $chatLoading);
  private chatSending = new StoreController(this, $chatSending);
  private chatMessage = new StoreController(this, $chatMessage);
  private chatMessages = new StoreController(this, $chatMessages);
  private chatToolMessages = new StoreController(this, $chatToolMessages);
  private chatStream = new StoreController(this, $chatStream);
  private chatStreamStartedAt = new StoreController(this, $chatStreamStartedAt);
  private chatQueue = new StoreController(this, $chatQueue);
  private chatAttachments = new StoreController(this, $chatAttachments);
  private sidebarOpen = new StoreController(this, $sidebarOpen);
  private sidebarContent = new StoreController(this, $sidebarContent);
  private sidebarError = new StoreController(this, $sidebarError);
  private splitRatio = new StoreController(this, $splitRatio);
  private connectedCtrl = new StoreController(this, $connected);
  private activeSession = new StoreController(this, $activeSession);
  private sessions = new StoreController(this, $sessions);

  @state() private focusMode = false;
  @state() private showThinking = false;

  protected createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    // Listen for chat events from gateway
    $gatewayEvent.subscribe((evt) => {
      if (!evt) {
        return;
      }
      if (evt.event === "chat.stream") {
        const payload = evt.payload as { text?: string; startedAt?: number } | undefined;
        if (payload?.text !== undefined) {
          $chatStream.set(payload.text);
        }
        if (payload?.startedAt) {
          $chatStreamStartedAt.set(payload.startedAt);
        }
      }
      if (evt.event === "chat.done") {
        $chatStream.set(null);
        $chatStreamStartedAt.set(null);
        $chatSending.set(false);
        void this.refreshChat();
      }
    });
    void this.refreshChat();
  }

  render(): TemplateResult {
    const props: ChatProps = {
      sessionKey: this.activeSession.value || "main",
      onSessionKeyChange: (next: string) => {
        $activeSession.set(next);
        void this.refreshChat();
      },
      thinkingLevel: null,
      showThinking: this.showThinking,
      loading: this.chatLoading.value,
      sending: this.chatSending.value,
      canAbort: false,
      compactionStatus: null,
      messages: [...this.chatMessages.value],
      toolMessages: [...this.chatToolMessages.value],
      stream: this.chatStream.value,
      streamStartedAt: this.chatStreamStartedAt.value,
      assistantAvatarUrl: null,
      draft: this.chatMessage.value,
      queue: [...this.chatQueue.value],
      connected: this.connectedCtrl.value,
      canSend: this.connectedCtrl.value && !this.chatSending.value,
      disabledReason: this.connectedCtrl.value ? null : "Connect to gateway to chat",
      error: null,
      sessions: this.sessions.value as ChatProps["sessions"],
      focusMode: this.focusMode,
      sidebarOpen: this.sidebarOpen.value,
      sidebarContent: this.sidebarContent.value,
      sidebarError: this.sidebarError.value,
      splitRatio: this.splitRatio.value,
      assistantName: "OpenClaw",
      assistantAvatar: null,
      attachments: [...this.chatAttachments.value],
      onAttachmentsChange: (attachments) => {
        $chatAttachments.set(attachments);
      },
      onRefresh: () => void this.refreshChat(),
      onToggleFocusMode: () => {
        this.focusMode = !this.focusMode;
      },
      onDraftChange: (next: string) => {
        $chatMessage.set(next);
      },
      onSend: () => void this.sendMessage(),
      onQueueRemove: (id: string) => {
        $chatQueue.set(this.chatQueue.value.filter((item) => item.id !== id));
      },
      onNewSession: () => void this.createNewSession(),
      onOpenSidebar: (content: string) => {
        $sidebarContent.set(content);
        $sidebarOpen.set(true);
      },
      onCloseSidebar: () => {
        $sidebarOpen.set(false);
      },
      onSplitRatioChange: (ratio: number) => {
        $splitRatio.set(ratio);
      },
    };

    return html`${renderChat(props)}`;
  }

  private async refreshChat() {
    $chatLoading.set(true);
    try {
      const sessionKey = this.activeSession.value || "main";
      const result = await gateway.call<{
        messages?: unknown[];
        toolMessages?: unknown[];
      }>("chat.history", { sessionKey });
      $chatMessages.set(result.messages ?? []);
      $chatToolMessages.set(result.toolMessages ?? []);
    } catch (err) {
      // Silently handle — gateway may not be ready yet
      if (this.connectedCtrl.value) {
        console.warn("Failed to load chat:", err);
      }
    } finally {
      $chatLoading.set(false);
    }
  }

  private async sendMessage() {
    const message = this.chatMessage.value.trim();
    if (!message && this.chatAttachments.value.length === 0) {
      return;
    }

    $chatSending.set(true);
    try {
      const sessionKey = this.activeSession.value || "main";
      await gateway.call("chat.send", {
        sessionKey,
        message,
        attachments: [...this.chatAttachments.value],
      });
      $chatMessage.set("");
      $chatAttachments.set([]);
    } catch (err) {
      console.error("Failed to send message:", err);
      $chatSending.set(false);
    }
  }

  private async createNewSession() {
    try {
      const result = await gateway.call<{ sessionKey?: string }>("sessions.create");
      if (result.sessionKey) {
        $activeSession.set(result.sessionKey);
        $chatMessages.set([]);
        $chatToolMessages.set([]);
      }
    } catch (err) {
      console.error("Failed to create session:", err);
    }
  }
}
