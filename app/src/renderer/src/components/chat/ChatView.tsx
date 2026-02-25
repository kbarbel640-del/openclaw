import { useState, useEffect, useRef, useCallback, type CSSProperties } from "react";
import type { SophieStatus, SessionProgress } from "../../App";
import { FlagCard } from "./FlagCard";
import { InputBar } from "./InputBar";
import { ProgressCard } from "./ProgressCard";
import { QuestionCard } from "./QuestionCard";
import { SophieMessage } from "./SophieMessage";
import type { ChatMessage, ContentBlock } from "./types";
import { makeId } from "./types";
import { UserMessage } from "./UserMessage";

interface ChatViewProps {
  onStatusChange: (s: SophieStatus) => void;
  onProgressChange: (p: SessionProgress | null) => void;
}

function buildWelcomeMessages(): ChatMessage[] {
  const blocks: ContentBlock[] = [
    { kind: "text", value: "Session initialized. Catalog connected." },
    { kind: "text", value: "SCENARIOS DETECTED:" },
    {
      kind: "scenario-bar",
      name: "GOLDEN_HOUR::OUTDOOR::PORTRAIT",
      filled: 47,
      total: 50,
      count: 47,
    },
    { kind: "scenario-bar", name: "INDOOR::FLASH::RECEPTION", filled: 31, total: 50, count: 31 },
    { kind: "scenario-bar", name: "CEREMONY::INDOOR::NATURAL", filled: 12, total: 50, count: 12 },
    { kind: "scenario-bar", name: "OVERCAST::OUTDOOR::GROUP", filled: 22, total: 50, count: 22 },
    { kind: "stat", value: "12,847", label: "PHOTOS ANALYZED" },
    {
      kind: "spec",
      rows: [
        { label: "SCENARIOS", value: "24" },
        { label: "CONFIDENCE", value: "GOOD", accent: true },
      ],
    },
    { kind: "text", value: "What would you like to work on?" },
  ];

  return [
    {
      id: "welcome-0",
      type: "sophie",
      content: "",
      timestamp: new Date().toISOString(),
      blocks,
      data: {
        actions: [
          { label: "START EDITING", value: "start editing the queue" },
          { label: "CULL FIRST", value: "cull the catalog first" },
          { label: "SHOW DNA", value: "show my editing DNA" },
        ],
      },
    },
  ];
}

interface MockResponse {
  content: string;
  blocks?: ContentBlock[];
  data?: Record<string, unknown>;
}

const MOCK_RESPONSES: MockResponse[] = [
  {
    content: "Processing. Stand by.",
  },
  {
    content: "",
    blocks: [
      { kind: "stat", value: "1,412", label: "IMAGES QUEUED" },
      {
        kind: "text",
        value:
          "Starting with golden hour portraits — that's where your profile is strongest. Flagging anything below 0.7 confidence.",
      },
    ],
    data: {
      actions: [
        { label: "APPROVE", value: "approve and continue" },
        { label: "ADJUST THRESHOLD", value: "adjust confidence threshold" },
      ],
    },
  },
  {
    content: "",
    blocks: [
      { kind: "text", value: "Running scenario evaluation now." },
      {
        kind: "spec",
        rows: [
          { label: "FILE", value: "DSC_0473.NEF" },
          { label: "SCENARIO", value: "GOLDEN_HOUR::OUTDOOR::PORTRAIT" },
          { label: "CONFIDENCE", value: "0.92 / HIGH", accent: true },
          { label: "APPLIED", value: "EXP +0.35 / TEMP +300K / SHD +38" },
        ],
      },
      { kind: "text", value: "Results will stream in as they complete." },
    ],
  },
  {
    content: "Noted. I've queued that for the next pass.",
  },
  {
    content: "",
    blocks: [
      { kind: "text", value: "Catalog scan complete." },
      {
        kind: "spec",
        rows: [
          { label: "NEW EDITS", value: "23 (RECEPTION, TODAY)" },
          { label: "PROFILE Δ", value: "TEMP BIAS +40K" },
          { label: "CONFIDENCE", value: "MODERATE → GOOD", accent: true },
        ],
      },
      { kind: "scenario-bar", name: "INDOOR::FLASH::RECEPTION", filled: 31, total: 50, count: 31 },
      { kind: "text", value: "Want me to re-ingest or keep the current profile?" },
    ],
    data: {
      actions: [
        { label: "RE-INGEST", value: "re-ingest the catalog" },
        { label: "KEEP CURRENT", value: "keep current profile" },
      ],
    },
  },
];

function pickMockResponse(): MockResponse {
  return MOCK_RESPONSES[Math.floor(Math.random() * MOCK_RESPONSES.length)];
}

export function ChatView({ onStatusChange, onProgressChange }: ChatViewProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(buildWelcomeMessages);
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, thinking]);

  const addMessage = useCallback((msg: ChatMessage) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  const handleSend = useCallback(
    (text: string) => {
      const userMsg: ChatMessage = {
        id: makeId(),
        type: "user",
        content: text,
        timestamp: new Date().toISOString(),
      };
      addMessage(userMsg);
      setThinking(true);
      onStatusChange("editing");

      const sophieApi = (window as Record<string, unknown>).sophie as
        | { invoke?: (channel: string, data?: unknown) => Promise<unknown> }
        | undefined;

      if (sophieApi?.invoke) {
        sophieApi
          .invoke("sophie:query", { query: text })
          .then((response: unknown) => {
            const msg = response as ChatMessage;
            addMessage({
              id: msg.id ?? makeId(),
              type: msg.type ?? "sophie",
              content: msg.content ?? "Acknowledged.",
              timestamp: msg.timestamp ?? new Date().toISOString(),
              data: msg.data,
            });
          })
          .catch(() => {
            addMessage({
              id: makeId(),
              type: "sophie",
              content: "Connection error. Operating in local mode.",
              timestamp: new Date().toISOString(),
            });
          })
          .finally(() => {
            setThinking(false);
            onStatusChange("idle");
          });
      } else {
        setTimeout(
          () => {
            const mock = pickMockResponse();
            addMessage({
              id: makeId(),
              type: "sophie",
              content: mock.content,
              timestamp: new Date().toISOString(),
              data: mock.data,
              blocks: mock.blocks,
            });
            setThinking(false);
            onStatusChange("idle");
          },
          800 + Math.random() * 600,
        );
      }
    },
    [addMessage, onStatusChange],
  );

  const handleAction = useCallback(
    (value: string) => {
      handleSend(value);
    },
    [handleSend],
  );

  const handleFlagAction = useCallback(
    (msgId: string, action: "approve" | "manual" | "skip") => {
      addMessage({
        id: makeId(),
        type: "sophie",
        content: `${action.toUpperCase()} applied to ${msgId}.`,
        timestamp: new Date().toISOString(),
      });
    },
    [addMessage],
  );

  const handleQuestionSelect = useCallback(
    (option: string) => {
      handleSend(option);
    },
    [handleSend],
  );

  void onProgressChange;

  return (
    <div style={styles.container}>
      <div ref={scrollRef} style={styles.scroll}>
        <div style={styles.messages}>
          {messages.map((msg) => (
            <MessageRenderer
              key={msg.id}
              message={msg}
              onAction={handleAction}
              onFlagAction={handleFlagAction}
              onQuestionSelect={handleQuestionSelect}
            />
          ))}
          {thinking && <ThinkingIndicator />}
        </div>
      </div>
      <InputBar onSend={handleSend} />
    </div>
  );
}

function ThinkingIndicator() {
  const [dots, setDots] = useState(1);

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((d) => (d % 3) + 1);
    }, 400);
    return () => clearInterval(interval);
  }, []);

  const dotStr = "●".repeat(dots) + "○".repeat(3 - dots);

  return (
    <div style={styles.thinkingCard}>
      <div style={styles.thinkingHeader}>
        <span style={styles.thinkingLabel}>SOPHIE</span>
        <span style={styles.thinkingStatus}>PROCESSING</span>
      </div>
      <div style={styles.thinkingRule} />
      <div style={styles.thinkingBody}>
        <span style={styles.thinkingDots}>{dotStr}</span>
      </div>
    </div>
  );
}

function MessageRenderer({
  message,
  onAction,
  onFlagAction,
  onQuestionSelect,
}: {
  message: ChatMessage;
  onAction: (value: string) => void;
  onFlagAction: (msgId: string, action: "approve" | "manual" | "skip") => void;
  onQuestionSelect: (option: string) => void;
}) {
  const actions = message.data?.actions as Array<{ label: string; value: string }> | undefined;

  const sophieActions = actions?.map((a) => ({
    label: a.label,
    onClick: () => onAction(a.value),
  }));

  switch (message.type) {
    case "sophie":
      return <SophieMessage message={message} actions={sophieActions} />;
    case "user":
      return <UserMessage message={message} />;
    case "flag":
      return <FlagCard message={message} onAction={(action) => onFlagAction(message.id, action)} />;
    case "progress":
      return <ProgressCard message={message} />;
    case "question":
      return <QuestionCard message={message} onSelect={onQuestionSelect} />;
    default:
      return null;
  }
}

const styles: Record<string, CSSProperties> = {
  container: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    overflow: "hidden",
  },
  scroll: {
    flex: 1,
    overflowY: "auto",
    overflowX: "hidden",
  },
  messages: {
    display: "flex",
    flexDirection: "column",
    gap: "var(--space-3)",
    padding: "var(--space-4) 0",
  },
  thinkingCard: {
    border: "1px solid var(--border)",
    background: "var(--bg-primary)",
    margin: "0 var(--space-3)",
    opacity: 0.7,
  },
  thinkingHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "var(--space-2) var(--space-3)",
  },
  thinkingLabel: {
    fontFamily: "var(--font-mono)",
    fontSize: "10px",
    fontWeight: 400,
    letterSpacing: "3px",
    textTransform: "uppercase" as const,
    color: "var(--text-secondary)",
  },
  thinkingStatus: {
    fontFamily: "var(--font-mono)",
    fontSize: "9px",
    fontWeight: 400,
    letterSpacing: "3px",
    textTransform: "uppercase" as const,
    color: "var(--accent)",
  },
  thinkingRule: {
    height: 1,
    background: "var(--border)",
  },
  thinkingBody: {
    padding: "var(--space-3)",
  },
  thinkingDots: {
    fontFamily: "var(--font-mono)",
    fontSize: "14px",
    letterSpacing: "4px",
    color: "var(--accent)",
  },
};
