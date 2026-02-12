import { html, nothing } from "lit";
import { ref } from "lit/directives/ref.js";
import { repeat } from "lit/directives/repeat.js";
import type { SessionsListResult } from "../types.ts";
import type { ChatItem, MessageGroup } from "../types/chat-types.ts";
import type { ChatAttachment, ChatQueueItem } from "../ui-types.ts";
import {
  renderMessageGroup,
  renderReadingIndicatorGroup,
  renderStreamingGroup,
} from "../chat/grouped-render.ts";
import { normalizeMessage, normalizeRoleForGrouping } from "../chat/message-normalizer.ts";
import { icons } from "../icons.ts";
import { detectTextDirection } from "../text-direction.ts";
import {
  getActiveChatTasks,
  getImmediateIssues,
  getNearTermProjects,
  laneLabel,
  loadTaskStore,
} from "../tasks-store.ts";
import { renderMarkdownSidebar } from "./markdown-sidebar.ts";
import "../components/resizable-divider.ts";

export type CompactionIndicatorStatus = {
  active: boolean;
  startedAt: number | null;
  completedAt: number | null;
};

type ChatModelOption = {
  value: string;
  provider: string;
  providerLabel: string;
  model: string;
  label: string;
};

type ChatProviderQuota = {
  provider: string;
  left: number;
  window: string;
  risk: "safe" | "tight" | "risk";
  resetMin: number | null;
};

export type ChatProps = {
  sessionKey: string;
  onSessionKeyChange: (next: string) => void;
  thinkingLevel: string | null;
  showThinking: boolean;
  loading: boolean;
  sending: boolean;
  canAbort?: boolean;
  compactionStatus?: CompactionIndicatorStatus | null;
  messages: unknown[];
  toolMessages: unknown[];
  stream: string | null;
  streamStartedAt: number | null;
  assistantAvatarUrl?: string | null;
  draft: string;
  queue: ChatQueueItem[];
  connected: boolean;
  canSend: boolean;
  disabledReason: string | null;
  error: string | null;
  sessions: SessionsListResult | null;
  // Focus mode
  focusMode: boolean;
  // Sidebar state
  sidebarOpen?: boolean;
  sidebarContent?: string | null;
  sidebarError?: string | null;
  splitRatio?: number;
  assistantName: string;
  assistantAvatar: string | null;
  // Image attachments
  attachments?: ChatAttachment[];
  onAttachmentsChange?: (attachments: ChatAttachment[]) => void;
  // Scroll control
  showNewMessages?: boolean;
  onScrollToBottom?: () => void;
  // Event handlers
  onRefresh: () => void;
  onToggleFocusMode: () => void;
  onDraftChange: (next: string) => void;
  modelOptions: ChatModelOption[];
  providerQuotas?: ChatProviderQuota[];
  modelLoading?: boolean;
  modelError?: string | null;
  selectedProvider?: string | null;
  selectedModel?: string | null;
  switchingModel?: boolean;
  onProviderChange?: (provider: string) => void;
  onModelChange?: (modelRef: string) => void;
  onSend: () => void;
  onAbort?: () => void;
  onQueueRemove: (id: string) => void;
  onNewSession: () => void;
  onOpenSidebar?: (content: string) => void;
  onCloseSidebar?: () => void;
  onSplitRatioChange?: (ratio: number) => void;
  onChatScroll?: (event: Event) => void;
};

const COMPACTION_TOAST_DURATION_MS = 5000;

function adjustTextareaHeight(el: HTMLTextAreaElement) {
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

function renderCompactionIndicator(status: CompactionIndicatorStatus | null | undefined) {
  if (!status) {
    return nothing;
  }

  // Show "compacting..." while active
  if (status.active) {
    return html`
      <div class="compaction-indicator compaction-indicator--active" role="status" aria-live="polite">
        ${icons.loader} Compacting context...
      </div>
    `;
  }

  // Show "compaction complete" briefly after completion
  if (status.completedAt) {
    const elapsed = Date.now() - status.completedAt;
    if (elapsed < COMPACTION_TOAST_DURATION_MS) {
      return html`
        <div class="compaction-indicator compaction-indicator--complete" role="status" aria-live="polite">
          ${icons.check} Context compacted
        </div>
      `;
    }
  }

  return nothing;
}

function generateAttachmentId(): string {
  return `att-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function handlePaste(e: ClipboardEvent, props: ChatProps) {
  const items = e.clipboardData?.items;
  if (!items || !props.onAttachmentsChange) {
    return;
  }

  const imageItems: DataTransferItem[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.type.startsWith("image/")) {
      imageItems.push(item);
    }
  }

  if (imageItems.length === 0) {
    return;
  }

  e.preventDefault();

  for (const item of imageItems) {
    const file = item.getAsFile();
    if (!file) {
      continue;
    }

    const reader = new FileReader();
    reader.addEventListener("load", () => {
      const dataUrl = reader.result as string;
      const newAttachment: ChatAttachment = {
        id: generateAttachmentId(),
        dataUrl,
        mimeType: file.type,
      };
      const current = props.attachments ?? [];
      props.onAttachmentsChange?.([...current, newAttachment]);
    });
    reader.readAsDataURL(file);
  }
}

function renderAttachmentPreview(props: ChatProps) {
  const attachments = props.attachments ?? [];
  if (attachments.length === 0) {
    return nothing;
  }

  return html`
    <div class="chat-attachments">
      ${attachments.map(
        (att) => html`
          <div class="chat-attachment">
            <img
              src=${att.dataUrl}
              alt="Attachment preview"
              class="chat-attachment__img"
            />
            <button
              class="chat-attachment__remove"
              type="button"
              aria-label="Remove attachment"
              @click=${() => {
                const next = (props.attachments ?? []).filter((a) => a.id !== att.id);
                props.onAttachmentsChange?.(next);
              }}
            >
              ${icons.x}
            </button>
          </div>
        `,
      )}
    </div>
  `;
}

export function renderChat(props: ChatProps) {
  const canCompose = props.connected;
  const isBusy = props.sending || props.stream !== null;
  const canAbort = Boolean(props.canAbort && props.onAbort);
  const activeSession = props.sessions?.sessions?.find((row) => row.key === props.sessionKey);
  const reasoningLevel = activeSession?.reasoningLevel ?? "off";
  const showReasoning = props.showThinking && reasoningLevel !== "off";
  const assistantIdentity = {
    name: props.assistantName,
    avatar: props.assistantAvatar ?? props.assistantAvatarUrl ?? null,
  };

  const hasAttachments = (props.attachments?.length ?? 0) > 0;
  const composePlaceholder = props.connected
    ? hasAttachments
      ? "Add a message or paste more images..."
      : "Message (↩ to send, Shift+↩ for line breaks, paste images)"
    : "Connect to the gateway to start chatting…";

  const splitRatio = props.splitRatio ?? 0.6;
  const sidebarOpen = Boolean(props.sidebarOpen && props.onCloseSidebar);
  const thread = html`
    <div
      class="chat-thread"
      role="log"
      aria-live="polite"
      @scroll=${props.onChatScroll}
    >
      ${
        props.loading
          ? html`
              <div class="muted">Loading chat…</div>
            `
          : nothing
      }
      ${repeat(
        buildChatItems(props),
        (item) => item.key,
        (item) => {
          if (item.kind === "divider") {
            return html`
              <div class="chat-divider" role="separator" data-ts=${String(item.timestamp)}>
                <span class="chat-divider__line"></span>
                <span class="chat-divider__label">${item.label}</span>
                <span class="chat-divider__line"></span>
              </div>
            `;
          }

          if (item.kind === "reading-indicator") {
            return renderReadingIndicatorGroup(assistantIdentity);
          }

          if (item.kind === "stream") {
            return renderStreamingGroup(
              item.text,
              item.startedAt,
              props.onOpenSidebar,
              assistantIdentity,
            );
          }

          if (item.kind === "group") {
            return renderMessageGroup(item, {
              onOpenSidebar: props.onOpenSidebar,
              showReasoning,
              assistantName: props.assistantName,
              assistantAvatar: assistantIdentity.avatar,
            });
          }

          return nothing;
        },
      )}
    </div>
  `;

  const taskStore = loadTaskStore();
  const activeTasks = getActiveChatTasks(taskStore.tasks, 5);
  const immediateIssues = getImmediateIssues(taskStore.tasks, 3);
  const nearTermProjects = getNearTermProjects(taskStore.tasks, 4);
  const currentEndeavorTask = activeTasks[0] ?? null;
  const majorEndeavors = [
    "Mentem",
    "ISOTRA Designer",
    "Pooltechnika 3D Pool",
    "Notino",
    "Vectra / Algovectra",
  ].map((name) => {
    const match = taskStore.tasks
      .filter((task) => (task.project || "").toLowerCase().includes(name.toLowerCase()))
      .sort((a, b) => a.priority.localeCompare(b.priority))[0];
    return { name, task: match ?? null };
  });

  return html`
    <section class="card chat">
      ${props.disabledReason ? html`<div class="callout">${props.disabledReason}</div>` : nothing}

      ${props.error ? html`<div class="callout danger">${props.error}</div>` : nothing}

      </div>

      ${
        props.focusMode
          ? html`
            <button
              class="chat-focus-exit"
              type="button"
              @click=${props.onToggleFocusMode}
              aria-label="Exit focus mode"
              title="Exit focus mode"
            >
              ${icons.x}
            </button>
          `
          : nothing
      }

      <div
        class="chat-split-container ${sidebarOpen ? "chat-split-container--open" : ""}"
      >
        <div
          class="chat-main"
          style="flex: ${sidebarOpen ? `0 0 ${splitRatio * 100}%` : "1 1 100%"}"
        >
          ${thread}
        </div>

        ${!sidebarOpen ? html`
          <aside class="chat-tasks-rail">
            <div class="chat-tasks-rail__title">Current Main Activity</div>
            ${taskStore.currentEndeavor
              ? html`
                  <div style="margin-bottom: 8px;"><strong>${taskStore.currentEndeavor}</strong></div>
                  <div class="muted" style="margin-bottom: 8px;">
                    status ${taskStore.currentEndeavorStatus || "n/a"} · ETA ${taskStore.currentEndeavorEta || "n/a"}
                  </div>
                  ${
                    currentEndeavorTask
                      ? html`<div style="margin-bottom: 12px;"><span class="mono">${currentEndeavorTask.priority}</span> ${currentEndeavorTask.title}</div>`
                      : html`<div class="muted" style="margin-bottom: 12px;">No linked task yet.</div>`
                  }
                `
              : html`<div class="muted" style="margin-bottom: 12px;">Set current endeavor in Task Management tab.</div>`}

            <div class="chat-tasks-rail__title">Major Endeavors</div>
            <ul class="chat-tasks-rail__list" style="margin-bottom: 12px;">
              ${majorEndeavors.map(
                (entry) => html`
                  <li>
                    <strong>${entry.name}</strong><br />
                    ${
                      entry.task
                        ? html`<span class="mono">${entry.task.priority}</span> ${entry.task.title}`
                        : html`<span class="muted">No task yet</span>`
                    }
                  </li>
                `,
              )}
            </ul>

            <div class="chat-tasks-rail__title">Immediate Issues</div>
            ${immediateIssues.length === 0
              ? html`<div class="muted" style="margin-bottom: 12px;">No P0 issues.</div>`
              : html`<ul class="chat-tasks-rail__list" style="margin-bottom: 12px;">
                  ${immediateIssues.map(
                    (task) =>
                      html`<li><span class="mono">${task.priority}</span> ${task.title} <span class="muted">(${task.project || laneLabel(task.lane)} / ${task.assignedAgent || "unassigned"})</span></li>`,
                  )}
                </ul>`}

            <div class="chat-tasks-rail__title">Near-Term Projects</div>
            ${nearTermProjects.length === 0
              ? html`<div class="muted">No projects yet.</div>`
              : html`<ul class="chat-tasks-rail__list">
                  ${nearTermProjects.map(
                    (entry) =>
                      html`<li><strong>${entry.project}</strong><br /><span class="mono">${entry.topTask.priority}</span> ${entry.topTask.title}</li>`,
                  )}
                </ul>`}

            <div class="chat-tasks-rail__title" style="margin-top: 12px;">Active Tasks</div>
            ${activeTasks.length === 0
              ? html`<div class="muted">No active tasks yet.</div>`
              : html`<ul class="chat-tasks-rail__list">
                  ${activeTasks.map(
                    (task) =>
                      html`<li><span class="mono">${task.priority}</span> ${task.title} <span class="muted">(${task.project || laneLabel(task.lane)} / ${task.assignedAgent || "unassigned"})</span></li>`,
                  )}
                </ul>`}
          </aside>
        ` : nothing}

        ${
          sidebarOpen
            ? html`
              <resizable-divider
                .splitRatio=${splitRatio}
                @resize=${(e: CustomEvent) => props.onSplitRatioChange?.(e.detail.splitRatio)}
              ></resizable-divider>
              <div class="chat-sidebar">
                ${renderMarkdownSidebar({
                  content: props.sidebarContent ?? null,
                  error: props.sidebarError ?? null,
                  onClose: props.onCloseSidebar!,
                  onViewRawText: () => {
                    if (!props.sidebarContent || !props.onOpenSidebar) {
                      return;
                    }
                    props.onOpenSidebar(`\`\`\`\n${props.sidebarContent}\n\`\`\``);
                  },
                })}
              </div>
            `
            : nothing
        }
      </div>

      ${
        props.queue.length
          ? html`
            <div class="chat-queue" role="status" aria-live="polite">
              <div class="chat-queue__title">Queued (${props.queue.length})</div>
              <div class="chat-queue__list">
                ${props.queue.map(
                  (item) => html`
                    <div class="chat-queue__item">
                      <div class="chat-queue__text">
                        ${
                          item.text ||
                          (item.attachments?.length ? `Image (${item.attachments.length})` : "")
                        }
                      </div>
                      <button
                        class="btn chat-queue__remove"
                        type="button"
                        aria-label="Remove queued message"
                        @click=${() => props.onQueueRemove(item.id)}
                      >
                        ${icons.x}
                      </button>
                    </div>
                  `,
                )}
              </div>
            </div>
          `
          : nothing
      }

      ${renderCompactionIndicator(props.compactionStatus)}

      ${
        props.showNewMessages
          ? html`
            <button
              class="btn chat-new-messages"
              type="button"
              @click=${props.onScrollToBottom}
            >
              New messages ${icons.arrowDown}
            </button>
          `
          : nothing
      }

      <div class="chat-compose">
        ${renderAttachmentPreview(props)}
        <div class="chat-compose__meta">
          ${(() => {
            const providers = Array.from(
              new Map((props.modelOptions ?? []).map((o) => [o.provider, o.providerLabel])).entries(),
            ).map(([provider, providerLabel]) => ({ provider, providerLabel }));
            const selectedProvider =
              props.selectedProvider ??
              (props.selectedModel?.includes("/") ? (props.selectedModel.split("/")[0] ?? null) : null) ??
              providers[0]?.provider ??
              null;
            const providerModels = (props.modelOptions ?? []).filter(
              (opt) => opt.provider === selectedProvider,
            );
            const selectedModel =
              props.selectedModel && providerModels.some((m) => m.value === props.selectedModel)
                ? props.selectedModel
                : providerModels[0]?.value ?? "";
            return html`
              <label class="chat-model-select">
                <span>Provider</span>
                <select
                  .value=${selectedProvider ?? ""}
                  ?disabled=${!props.connected || (props.modelLoading ?? false) || (props.switchingModel ?? false)}
                  @change=${(e: Event) => {
                    const value = (e.target as HTMLSelectElement).value;
                    props.onProviderChange?.(value);
                  }}
                >
                  <option value="">${props.modelLoading ? "Loading providers…" : "Select provider"}</option>
                  ${providers.map(
                    (p) => html`<option value=${p.provider}>${p.providerLabel}</option>`,
                  )}
                </select>
              </label>
              <label class="chat-model-select">
                <span>Model</span>
                <select
                  .value=${selectedModel}
                  ?disabled=${
                    !props.connected ||
                    (props.modelLoading ?? false) ||
                    (props.switchingModel ?? false) ||
                    !selectedProvider
                  }
                  @change=${(e: Event) => {
                    const value = (e.target as HTMLSelectElement).value;
                    if (value) {
                      props.onModelChange?.(value);
                    }
                  }}
                >
                  <option value="">${props.modelLoading ? "Loading models…" : "Select model"}</option>
                  ${providerModels.map((opt) => html`<option value=${opt.value}>${opt.label}</option>`)}
                </select>
              </label>
            `;
          })()}
          ${props.switchingModel ? html`<span class="muted">Switching…</span>` : nothing}
          ${props.modelError ? html`<span class="muted">${props.modelError}</span>` : nothing}
        </div>
        ${(props.providerQuotas?.length ?? 0) > 0
          ? html`
              <div class="chat-provider-quotas" aria-label="Provider quotas">
                ${props.providerQuotas!.map(
                  (q) => html`
                    <span class="chat-provider-quotas__chip" title=${`${q.provider}: ${q.left}% left (${q.window})`}>
                      <strong>${q.provider}</strong>
                      <span>${q.left}%</span>
                      <span class="chat-provider-quotas__risk chat-provider-quotas__risk--${q.risk}">${q.risk}</span>
                      ${q.resetMin != null ? html`<span>${q.resetMin <= 0 ? "now" : `${q.resetMin}m`}</span>` : nothing}
                    </span>
                  `,
                )}
              </div>
            `
          : nothing}
        <div class="chat-compose__row">
          <label class="field chat-compose__field">
            <span>Message</span>
            <textarea
              ${ref((el) => el && adjustTextareaHeight(el as HTMLTextAreaElement))}
              .value=${props.draft}
              dir=${detectTextDirection(props.draft)}
              ?disabled=${!props.connected}
              @keydown=${(e: KeyboardEvent) => {
                if (e.key !== "Enter") {
                  return;
                }
                if (e.isComposing || e.keyCode === 229) {
                  return;
                }
                if (e.shiftKey) {
                  return;
                } // Allow Shift+Enter for line breaks
                if (!props.connected) {
                  return;
                }
                e.preventDefault();
                if (canCompose) {
                  props.onSend();
                }
              }}
              @input=${(e: Event) => {
                const target = e.target as HTMLTextAreaElement;
                adjustTextareaHeight(target);
                props.onDraftChange(target.value);
              }}
              @paste=${(e: ClipboardEvent) => handlePaste(e, props)}
              placeholder=${composePlaceholder}
            ></textarea>
          </label>
          <div class="chat-compose__actions">
            <button
              class="btn"
              ?disabled=${!props.connected || (!canAbort && props.sending)}
              @click=${canAbort ? props.onAbort : props.onNewSession}
            >
              ${canAbort ? "Stop" : "New session"}
            </button>
            <button
              class="btn primary"
              ?disabled=${!props.connected}
              @click=${props.onSend}
            >
              ${isBusy ? "Queue" : "Send"}<kbd class="btn-kbd">↵</kbd>
            </button>
          </div>
        </div>
      </div>
    </section>
  `;
}

const CHAT_HISTORY_RENDER_LIMIT = 200;

function groupMessages(items: ChatItem[]): Array<ChatItem | MessageGroup> {
  const result: Array<ChatItem | MessageGroup> = [];
  let currentGroup: MessageGroup | null = null;

  for (const item of items) {
    if (item.kind !== "message") {
      if (currentGroup) {
        result.push(currentGroup);
        currentGroup = null;
      }
      result.push(item);
      continue;
    }

    const normalized = normalizeMessage(item.message);
    const role = normalizeRoleForGrouping(normalized.role);
    const timestamp = normalized.timestamp || Date.now();

    if (!currentGroup || currentGroup.role !== role) {
      if (currentGroup) {
        result.push(currentGroup);
      }
      currentGroup = {
        kind: "group",
        key: `group:${role}:${item.key}`,
        role,
        messages: [{ message: item.message, key: item.key }],
        timestamp,
        isStreaming: false,
      };
    } else {
      currentGroup.messages.push({ message: item.message, key: item.key });
    }
  }

  if (currentGroup) {
    result.push(currentGroup);
  }
  return result;
}

function buildChatItems(props: ChatProps): Array<ChatItem | MessageGroup> {
  const items: ChatItem[] = [];
  const history = Array.isArray(props.messages) ? props.messages : [];
  const tools = Array.isArray(props.toolMessages) ? props.toolMessages : [];
  const historyStart = Math.max(0, history.length - CHAT_HISTORY_RENDER_LIMIT);
  if (historyStart > 0) {
    items.push({
      kind: "message",
      key: "chat:history:notice",
      message: {
        role: "system",
        content: `Showing last ${CHAT_HISTORY_RENDER_LIMIT} messages (${historyStart} hidden).`,
        timestamp: Date.now(),
      },
    });
  }
  for (let i = historyStart; i < history.length; i++) {
    const msg = history[i];
    const normalized = normalizeMessage(msg);
    const raw = msg as Record<string, unknown>;
    const marker = raw.__openclaw as Record<string, unknown> | undefined;
    if (marker && marker.kind === "compaction") {
      items.push({
        kind: "divider",
        key:
          typeof marker.id === "string"
            ? `divider:compaction:${marker.id}`
            : `divider:compaction:${normalized.timestamp}:${i}`,
        label: "Compaction",
        timestamp: normalized.timestamp ?? Date.now(),
      });
      continue;
    }

    if (!props.showThinking && normalized.role.toLowerCase() === "toolresult") {
      continue;
    }

    items.push({
      kind: "message",
      key: messageKey(msg, i),
      message: msg,
    });
  }
  if (props.showThinking) {
    for (let i = 0; i < tools.length; i++) {
      items.push({
        kind: "message",
        key: messageKey(tools[i], i + history.length),
        message: tools[i],
      });
    }
  }

  if (props.stream !== null) {
    const key = `stream:${props.sessionKey}:${props.streamStartedAt ?? "live"}`;
    if (props.stream.trim().length > 0) {
      items.push({
        kind: "stream",
        key,
        text: props.stream,
        startedAt: props.streamStartedAt ?? Date.now(),
      });
    } else {
      items.push({ kind: "reading-indicator", key });
    }
  }

  return groupMessages(items);
}

function messageKey(message: unknown, index: number): string {
  const m = message as Record<string, unknown>;
  const toolCallId = typeof m.toolCallId === "string" ? m.toolCallId : "";
  if (toolCallId) {
    return `tool:${toolCallId}`;
  }
  const id = typeof m.id === "string" ? m.id : "";
  if (id) {
    return `msg:${id}`;
  }
  const messageId = typeof m.messageId === "string" ? m.messageId : "";
  if (messageId) {
    return `msg:${messageId}`;
  }
  const timestamp = typeof m.timestamp === "number" ? m.timestamp : null;
  const role = typeof m.role === "string" ? m.role : "unknown";
  if (timestamp != null) {
    return `msg:${role}:${timestamp}:${index}`;
  }
  return `msg:${role}:${index}`;
}
