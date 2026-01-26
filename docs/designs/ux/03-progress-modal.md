# Real-Time Progress Modal - UI Prototype

**Generated:** 2025-01-26
**Component:** Progress Tracking Modal for Automation Execution
**Magic MCP Response:** Full modal bundle with timeline, progress bar, and real-time updates

---

## ⚠️ Stack Translation Required

**Magic MCP Output:** React + shadcn/ui + Framer Motion
**Clawdbot Stack:** Lit Web Components + Tailwind v4 + Custom Design System

The code below provides **design patterns, styling, and UX concepts** but must be translated from React to Lit Web Components for Clawdbot.

### Key Translation Points:
- React `useState` → Lit reactive properties
- React Dialog → `<dialog>` element or custom modal overlay
- Framer Motion animations → CSS `@keyframes` or Web Animations API
- shadcn/ui Progress → Custom progress element
- Real-time updates → SSE (Server-Sent Events) or polling in Lit

---

## Installation

```bash
npm install framer-motion lucide-react clsx tailwind-merge @radix-ui/react-progress @radix-ui/react-dialog
```

---

## Main Progress Modal Component

```typescript
"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  MessageSquare,
  X,
  Loader2
} from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import * as ProgressPrimitive from "@radix-ui/react-progress";
import * as DialogPrimitive from "@radix-ui/react-dialog";

// Utility
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Progress Component
interface ProgressProps
  extends React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> {}

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  ProgressProps
>(({ className, value, ...props }, ref) => (
  <ProgressPrimitive.Root
    ref={ref}
    className={cn(
      "bg-primary/20 relative h-2 w-full overflow-hidden rounded-full",
      className
    )}
    {...props}
  >
    <ProgressPrimitive.Indicator
      className="bg-primary h-full w-full flex-1 transition-all"
      style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
    />
  </ProgressPrimitive.Root>
));
Progress.displayName = ProgressPrimitive.Root.displayName;

// Dialog Components
const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-[50%] top-[50%] z-50 grid w-full max-w-2xl translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 sm:rounded-lg",
        className
      )}
      {...props}
    >
      {children}
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

// Button Component
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost" | "destructive";
  size?: "default" | "sm" | "lg";
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    const baseStyles = "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";

    const variants = {
      default: "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90",
      outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
      ghost: "hover:bg-accent hover:text-accent-foreground",
      destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
    };

    const sizes = {
      default: "h-9 px-4 py-2",
      sm: "h-8 rounded-lg px-3 text-xs",
      lg: "h-10 rounded-lg px-8",
    };

    return (
      <button
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

// Types
type MilestoneStatus = "completed" | "current" | "pending";

interface Milestone {
  id: string;
  title: string;
  status: MilestoneStatus;
  timestamp?: string;
}

interface AutomationProgressModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  automationName?: string;
  currentMilestone?: string;
  progress?: number;
  milestones?: Milestone[];
  elapsedTime?: string;
  conflicts?: number;
  onJumpToChat?: () => void;
  onCancel?: () => void;
}

// Main Modal Component
const AutomationProgressModal: React.FC<AutomationProgressModalProps> = ({
  isOpen = true,
  onClose = () => {},
  automationName = "Data Migration Automation",
  currentMilestone = "Processing records batch 3/5",
  progress = 65,
  milestones = [
    { id: "1", title: "Initialization", status: "completed", timestamp: "10:30 AM" },
    { id: "2", title: "Data Validation", status: "completed", timestamp: "10:32 AM" },
    { id: "3", title: "Processing Records", status: "current", timestamp: "10:35 AM" },
    { id: "4", title: "Conflict Resolution", status: "pending" },
    { id: "5", title: "Finalization", status: "pending" },
  ],
  elapsedTime = "5m 23s",
  conflicts = 2,
  onJumpToChat = () => {},
  onCancel = () => {},
}) => {
  const getStatusIcon = (status: MilestoneStatus) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case "current":
        return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />;
      case "pending":
        return <div className="h-5 w-5 rounded-full border-2 border-muted" />;
    }
  };

  const getStatusColor = (status: MilestoneStatus) => {
    switch (status) {
      case "completed":
        return "text-green-500";
      case "current":
        return "text-blue-500";
      case "pending":
        return "text-muted-foreground";
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-foreground">
                  {automationName}
                </h2>
                <p className="text-sm text-muted-foreground">Execution in progress</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </button>
          </div>

          {/* Status Indicator with Progress Bar */}
          <div className="mb-6 p-4 rounded-lg bg-blue-500/5 border border-blue-500/20">
            <div className="flex items-center gap-2 mb-2">
              <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
              <span className="text-sm font-medium text-foreground">
                {currentMilestone}
              </span>
            </div>
            <Progress value={progress} className="h-2" />
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-muted-foreground">
                {progress}% complete
              </span>
              <span className="text-xs text-blue-500 font-medium">
                {progress}% of 100%
              </span>
            </div>
          </div>

          {/* Execution Timeline */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-foreground mb-4">
              Execution Timeline
            </h3>
            <div className="space-y-3">
              {milestones.map((milestone, index) => (
                <motion.div
                  key={milestone.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-start gap-3"
                >
                  <div className="relative">
                    {getStatusIcon(milestone.status)}
                    {index < milestones.length - 1 && (
                      <div
                        className={cn(
                          "absolute left-1/2 top-6 w-0.5 h-6 -translate-x-1/2",
                          milestone.status === "completed"
                            ? "bg-green-500"
                            : "bg-muted"
                        )}
                      />
                    )}
                  </div>
                  <div className="flex-1 pt-0.5">
                    <div className="flex items-center justify-between">
                      <span
                        className={cn(
                          "text-sm font-medium",
                          getStatusColor(milestone.status)
                        )}
                      >
                        {milestone.title}
                      </span>
                      {milestone.timestamp && (
                        <span className="text-xs text-muted-foreground">
                          {milestone.timestamp}
                        </span>
                      )}
                    </div>
                    {milestone.status === "current" && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Processing...
                      </p>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Statistics Cards */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="p-4 rounded-lg bg-muted/50 border">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Elapsed Time</span>
              </div>
              <p className="text-lg font-semibold text-foreground">{elapsedTime}</p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50 border">
              <div className="flex items-center gap-2 mb-1">
                <AlertCircle className="h-4 w-4 text-orange-500" />
                <span className="text-xs text-muted-foreground">Conflicts</span>
              </div>
              <p className="text-lg font-semibold text-foreground">{conflicts}</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <Button
              onClick={onJumpToChat}
              variant="default"
              className="flex-1 gap-2"
            >
              <MessageSquare className="h-4 w-4" />
              Jump to Chat
            </Button>
            <Button
              onClick={onCancel}
              variant="outline"
              className="flex-1"
            >
              Cancel
            </Button>
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
};

export default function AutomationProgressDemo() {
  const [isOpen, setIsOpen] = React.useState(true);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <Button onClick={() => setIsOpen(true)}>Open Progress Modal</Button>
      <AutomationProgressModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onJumpToChat={() => alert("Jumping to chat...")}
        onCancel={() => {
          alert("Automation cancelled");
          setIsOpen(false);
        }}
      />
    </div>
  );
}
```

---

## Key Features Captured

### Modal Structure
1. **Overlay** - Semi-transparent backdrop (`bg-black/80`)
2. **Centered Content** - Fixed positioning with translate transforms
3. **Close Button** - X icon in top-right corner
4. **Animation** - Fade-in/scale-in animation on open

### Header Section
- Status icon (spinning loader for running)
- Automation name
- Status subtitle
- Close button

### Progress Display
- Blue highlighted status banner
- Spinning loader icon
- Current milestone text
- Horizontal progress bar with percentage
- Dual percentage display (text + visual)

### Execution Timeline
- Vertical list of milestones
- Three states per milestone:
  - **Completed**: Green checkmark icon + timestamp
  - **Current**: Blue spinning loader + "Processing..." text
  - **Pending**: Gray circle placeholder
- Connecting lines between milestones (green when completed, gray otherwise)

### Statistics Section
- Two-column grid layout
- Cards with icon + label + value
- Elapsed Time card
- Conflicts count card

### Action Buttons
- "Jump to Chat" - Primary style, message icon
- "Cancel" - Outline style

---

## Smart-Sync Fork Milestones

For Git fork sync automation, the timeline should be:

```typescript
const gitSyncMilestones = [
  { id: "1", title: "Initialize Workspace", status: "completed" },
  { id: "2", title: "Clone Fork Repository", status: "completed" },
  { id: "3", title: "Add Upstream Remote", status: "completed" },
  { id: "4", title: "Fetch Upstream Changes", status: "completed" },
  { id: "5", title: "Detect Merge Conflicts", status: "current" },
  { id: "6", title: "Resolve Conflicts", status: "pending" },
  { id: "7", title: "Push Feature Branch", status: "pending" },
  { id: "8", title: "Create Pull Request", status: "pending" },
  { id: "9", title: "Complete", status: "pending" },
];
```

---

## Real-Time Update Mechanism

For Clawdbot Lit implementation:

```typescript
// In Lit component
@customElement('progress-modal')
export class ProgressModal extends LitElement {
  @property() automationId = '';
  @state() progress = 0;
  @state() currentMilestone = '';
  @state() milestones: Milestone[] = [];

  // Server-Sent Events for real-time updates
  private eventSource?: EventSource;

  connected() {
    // Connect to SSE endpoint
    this.eventSource = new EventSource(
      `/api/automations/${this.automationId}/progress/stream`
    );

    this.eventSource.onmessage = (event) => {
      const update = JSON.parse(event.data);
      this.progress = update.percentage;
      this.currentMilestone = update.milestone;
      this.milestones = update.timeline;
    };
  }

  disconnected() {
    this.eventSource?.close();
  }

  // Jump to Chat handler
  private jumpToChat() {
    window.location.hash = `#sessions?sessionId=${this.sessionId}`;
  }

  // Cancel handler
  async cancel() {
    await fetch(`/api/automations/${this.automationId}/cancel`, {
      method: 'POST',
    });
  }
}
```

---

## Styling Details

### Progress Bar
```css
.bg-primary\/20 {
  background-color: rgb(59 130 246 / 0.2);
}

.bg-primary {
  background-color: rgb(59 130 246);
}

.transition-all {
  transition-property: all;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  transition-duration: 150ms;
}
```

### Spinning Animation
```css
@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.animate-spin {
  animation: spin 1s linear infinite;
}
```

### Modal Animations
```css
@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes zoomIn {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.animate-in {
  animation: fadeIn 0.2s ease-out, zoomIn 0.2s ease-out;
}
```

---

## Failed/Attention State

When conflicts require attention, show:

```typescript
// Add warning banner
<div className="mb-6 p-4 rounded-lg bg-orange-500/5 border border-orange-500/20">
  <div className="flex items-center gap-2 mb-3">
    <AlertTriangle className="h-5 w-5 text-orange-500" />
    <span className="font-semibold text-orange-500">
      2 conflicts require attention
    </span>
  </div>

  {/* List uncertain resolutions */}
  <div className="space-y-3">
    {uncertainResolutions.map((issue) => (
      <div key={issue.id} className="p-3 rounded bg-background border">
        <div className="flex items-center gap-2 mb-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <code className="text-sm">{issue.file}</code>
          <span className="text-xs text-muted-foreground">
            Confidence: {issue.confidence}%
          </span>
        </div>
        <p className="text-sm text-foreground mb-3">
          {issue.explanation}
        </p>
        <div className="space-y-2">
          <span className="text-xs font-medium text-muted-foreground">
            Resolution options:
          </span>
          {issue.options.map((option, i) => (
            <button
              key={i}
              className="block w-full text-left px-3 py-2 text-sm rounded border hover:bg-accent"
              onClick={() => applyResolution(issue.id, option)}
            >
              {i + 1}. {option.description}
            </button>
          ))}
        </div>
      </div>
    ))}
  </div>
</div>
```

---

## Lit Web Component Template

```typescript
import { LitElement, html, css } from 'lit';
import { customElement, state, property } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { cache } from 'lit/directives/cache.js';

// Icon templates (using inline SVG)
const spinnerIcon = html`
  <svg class="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
    <circle cx="12" cy="12" r="10" stroke-width="4" stroke-opacity="0.25"></circle>
    <path d="M4 12a8 8 0 018 0 8 8 0 01-8 0" stroke-width="4" stroke-opacity="0.25"></path>
  </svg>
`;

const checkIcon = html`
  <svg class="h-5 w-5 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M20 6L9 17l-5-5" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>
`;

@customElement('automation-progress-modal')
export class AutomationProgressModal extends LitElement {
  @property() isOpen = false;
  @property() automationName = '';
  @property() sessionId = '';
  @state() progress = 0;
  @state() currentMilestone = '';
  @state() milestones: Milestone[] = [];
  @state() elapsedTime = '0m 0s';
  @state() status: 'running' | 'complete' | 'failed' = 'running';

  // SSE connection
  private eventSource?: EventSource;

  static styles = css`
    :host {
      display: contents;
    }

    .modal-overlay {
      position: fixed;
      inset: 0;
      z-index: 50;
      background: rgba(0, 0, 0, 0.8);
    }

    .modal-content {
      position: fixed;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      width: 90vw;
      max-width: 600px;
      max-height: 90vh;
      overflow-y: auto;
      background: var(--color-card);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      padding: 1.5rem;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
    }

    .progress-bar {
      height: 0.5rem;
      background: var(--color-muted);
      border-radius: 999px;
      overflow: hidden;
    }

    .progress-fill {
      height: 100%;
      background: var(--color-primary);
      transition: width 0.3s ease;
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    .animate-spin {
      animation: spin 1s linear infinite;
    }

    .timeline-item {
      display: flex;
      gap: 0.75rem;
    }

    .timeline-line {
      width: 2px;
      background: var(--color-border);
    }

    .timeline-line.completed {
      background: var(--color-success);
    }
  `;

  connected() {
    if (this.isOpen && this.sessionId) {
      this.setupEventSource();
    }
  }

  disconnected() {
    this.eventSource?.close();
  }

  private setupEventSource() {
    this.eventSource = new EventSource(
      `/api/automations/${this.automationId}/progress/stream`
    );

    this.eventSource.onmessage = (event) => {
      const update = JSON.parse(event.data);
      this.progress = update.percentage;
      this.currentMilestone = update.milestone;
      this.milestones = update.timeline;
      this.status = update.status;
    };
  }

  render() {
    if (!this.isOpen) return html``;

    return html`
      <div class="modal-overlay" @click=${this.handleClose}>
        <div class="modal-content" @click=${(e: Event) => e.stopPropagation()}>
          <!-- Header -->
          <div class="flex items-start justify-between mb-6">
            <div class="flex items-center gap-3">
              <div class="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                ${spinnerIcon}
              </div>
              <div>
                <h2 class="text-xl font-semibold">${this.automationName}</h2>
                <p class="text-sm text-muted-foreground">Execution in progress</p>
              </div>
            </div>
            <button
              @click="${this.handleClose}"
              class="rounded-sm opacity-70 hover:opacity-100"
            >
              ✕
            </button>
          </div>

          <!-- Progress -->
          <div class="mb-6 p-4 rounded-lg bg-blue-500/5 border border-blue-500/20">
            <div class="flex items-center gap-2 mb-2">
              ${spinnerIcon}
              <span class="text-sm font-medium">${this.currentMilestone}</span>
            </div>
            <div class="progress-bar">
              <div class="progress-fill" style="width: ${this.progress}%"></div>
            </div>
            <div class="flex items-center justify-between mt-2">
              <span class="text-xs text-muted-foreground">${this.progress}% complete</span>
              <span class="text-xs text-blue-500 font-medium">${this.progress}% of 100%</span>
            </div>
          </div>

          <!-- Timeline -->
          <div class="mb-6">
            <h3 class="text-sm font-semibold mb-4">Execution Timeline</h3>
            <div class="space-y-3">
              ${repeat(this.milestones, (milestone) => milestone.id, (milestone) => {
                const isCompleted = milestone.status === 'completed';
                const isCurrent = milestone.status === 'current';

                return html`
                  <div class="timeline-item">
                    <div class="relative">
                      ${isCompleted ? checkIcon : isCurrent ? spinnerIcon : html`
                        <div class="h-5 w-5 rounded-full border-2 border-muted"></div>
                      `}
                      ${milestone.timestamp ? html`
                        <span class="text-xs text-muted-foreground">${milestone.timestamp}</span>
                      ` : ''}
                    </div>
                    <div class="flex-1 pt-0.5">
                      <span class="text-sm font-medium ${
                        isCompleted ? 'text-green-500' :
                        isCurrent ? 'text-blue-500' :
                        'text-muted-foreground'
                      }">
                        ${milestone.title}
                      </span>
                    </div>
                  </div>
                `;
              })}
            </div>
          </div>

          <!-- Actions -->
          <div class="flex items-center gap-3">
            <button
              @click="${this.jumpToChat}"
              class="flex-1 bg-primary text-primary-foreground px-4 py-2 rounded-lg font-medium"
            >
              Jump to Chat
            </button>
            ${this.status === 'running' ? html`
              <button
                @click="${this.cancel}"
                class="flex-1 border border-input px-4 py-2 rounded-lg font-medium"
              >
                Cancel
              </button>
            ` : html`
              <button
                @click="${this.handleClose}"
                class="flex-1 border border-input px-4 py-2 rounded-lg font-medium"
              >
                Close
              </button>
            `}
          </div>
        </div>
      </div>
    `;
  }

  private handleClose() {
    this.isOpen = false;
    this.dispatchEvent(new CustomEvent('close'));
  }

  private jumpToChat() {
    window.location.hash = `#sessions?sessionId=${this.sessionId}`;
  }

  private async cancel() {
    const response = await fetch(`/api/automations/${this.automationId}/cancel`, {
      method: 'POST',
    });

    if (response.ok) {
      this.status = 'cancelled';
    }
  }
}

interface Milestone {
  id: string;
  title: string;
  status: 'completed' | 'current' | 'pending';
  timestamp?: string;
}
```
