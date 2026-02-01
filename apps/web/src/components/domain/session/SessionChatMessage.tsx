"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { AgentAvatar } from "@/components/composed";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { User, ChevronDown, ChevronUp, Check, Loader2, AlertCircle, Copy } from "lucide-react";
import type { ChatMessage, ToolCall } from "@/lib/api/sessions";

export interface SessionChatMessageProps {
  message: ChatMessage & {
    id?: string;
    agentName?: string;
    agentStatus?: "active" | "ready";
    isStreaming?: boolean;
  };
  className?: string;
}

export function SessionChatMessage({ message, className }: SessionChatMessageProps) {
  const [expandedTools, setExpandedTools] = React.useState<Set<string>>(new Set());

  const toggleToolExpand = (toolId: string) => {
    setExpandedTools((prev) => {
      const next = new Set(prev);
      if (next.has(toolId)) {
        next.delete(toolId);
      } else {
        next.add(toolId);
      }
      return next;
    });
  };

  const isUser = message.role === "user";
  const formattedTime = message.timestamp
    ? new Date(message.timestamp).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  return (
    <div
      className={cn(
        "flex gap-3",
        isUser ? "justify-end" : "justify-start",
        className
      )}
    >
      {/* Agent avatar for assistant messages */}
      {!isUser && message.agentName && (
        <AgentAvatar
          name={message.agentName}
          size="sm"
          status={message.agentStatus}
          className="mt-1 shrink-0"
        />
      )}

      <div
        className={cn(
          "max-w-[85%] md:max-w-[75%] space-y-2",
          isUser && "order-first"
        )}
      >
        {/* Message bubble */}
        <div
          className={cn(
            "rounded-2xl px-4 py-3",
            isUser
              ? "bg-primary text-primary-foreground"
              : "bg-card border border-border shadow-sm"
          )}
        >
          {/* Header */}
          <div className="mb-1 flex items-center justify-between gap-2 text-xs">
            <span
              className={cn(
                "font-medium",
                isUser ? "text-primary-foreground/90" : "text-foreground"
              )}
            >
              {isUser ? "You" : message.agentName || "Assistant"}
            </span>
            {formattedTime && (
              <span
                className={cn(
                  isUser ? "text-primary-foreground/70" : "text-muted-foreground"
                )}
              >
                {formattedTime}
              </span>
            )}
          </div>

          {/* Content */}
          <div
            className={cn(
              "text-sm leading-relaxed whitespace-pre-wrap",
              isUser ? "text-primary-foreground" : "text-foreground"
            )}
          >
            {message.content}
            {message.isStreaming && (
              <span className="ml-1 inline-block h-4 w-0.5 animate-pulse bg-current" />
            )}
          </div>
        </div>

        {/* Tool Calls */}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="space-y-2">
            {message.toolCalls.map((tool) => (
              <ToolCallCard
                key={tool.id}
                tool={tool}
                isExpanded={expandedTools.has(tool.id)}
                onToggle={() => toggleToolExpand(tool.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* User avatar */}
      {isUser && (
        <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-muted">
          <User className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
    </div>
  );
}

interface ToolCallCardProps {
  tool: ToolCall;
  isExpanded: boolean;
  onToggle: () => void;
}

function ToolCallCard({ tool, isExpanded, onToggle }: ToolCallCardProps) {
  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-muted/50 overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-2 p-3 text-left hover:bg-muted/80 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm">
            {tool.status === "running" ? (
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            ) : tool.status === "done" ? (
              <Check className="h-4 w-4 text-green-500" />
            ) : (
              <AlertCircle className="h-4 w-4 text-destructive" />
            )}
          </span>
          <span className="text-sm font-medium text-foreground">{tool.name}</span>
        </div>
        <div className="flex items-center gap-2">
          {tool.duration && (
            <span className="text-xs text-muted-foreground">{tool.duration}</span>
          )}
          <Badge
            variant="secondary"
            className={cn(
              "text-[10px] px-1.5 py-0",
              tool.status === "running" && "bg-primary/10 text-primary",
              tool.status === "done" && "bg-green-500/10 text-green-600",
              tool.status === "error" && "bg-destructive/10 text-destructive"
            )}
          >
            {tool.status === "running" ? "Running" : tool.status === "done" ? "Done" : "Error"}
          </Badge>
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Progress bar for running tools */}
      {tool.status === "running" && tool.progress !== undefined && (
        <div className="px-3 pb-2">
          <Progress value={Math.max(0, Math.min(100, tool.progress))} className="h-1.5" />
        </div>
      )}

      {/* Expanded details */}
      {isExpanded && (
        <div className="border-t border-border p-3 space-y-3">
          {tool.input && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Input
                </p>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => handleCopy(tool.input!)}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
              <pre className="rounded-lg bg-background p-2 text-xs overflow-x-auto scrollbar-thin">
                {tool.input}
              </pre>
            </div>
          )}
          {tool.output && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Output
                </p>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => handleCopy(tool.output!)}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
              <pre className="rounded-lg bg-background p-2 text-xs overflow-x-auto max-h-32 scrollbar-thin">
                {tool.output}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default SessionChatMessage;
