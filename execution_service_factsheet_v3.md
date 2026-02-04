# Execution Service Factsheet (v3)

**Status**: Product Architecture
**Last Updated**: 2025-02-04
**Changes from v2**: Added frontend, project board UI, sleep-time compute, trace-based self-improvement, async/sync hybrid collaboration model.

---

## 1. Service Overview

### 1.1 Purpose

The Execution Service is a **web-based autonomous agent platform**. Users interact through a project-board UI (inspired by Linear/Jira) to create tasks, monitor agent progress in real-time, review deliverables, and collaborate with agents through both asynchronous comments and synchronous discussions.

Agents run autonomously in Docker containers using an LLM-in-a-loop architecture. A background **Sleep-Time Compute** system reviews daily traces to generate reminders, consolidate memory, detect failure patterns, and propose self-improvements.

### 1.2 Core Capabilities

| Capability | Description |
|------------|-------------|
| **Project Board** | Kanban-style task management where agent plan steps auto-populate as work items |
| **Agent Execution** | LLM-in-a-loop with tools, planning, compaction, sub-agents (unchanged from v2) |
| **First-Draft Review** | Agent produces deliverables; user reviews/approves/requests changes on the board |
| **Async Collaboration** | Agent and user communicate via comments on work items |
| **Sync Collaboration** | Scheduled live discussions between agent and user on specific topics |
| **Sleep-Time Compute** | Nightly background jobs: daily digest, memory consolidation, failure analysis, skill generation |
| **Trace-Based Self-Improvement** | Review agent traces, detect patterns, propose prompt/skill updates |
| **File System Browser** | Each agent workspace is browsable in the UI |

### 1.3 System Architecture

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                                FRONTEND (Web App)                                │
│                                                                                  │
│  ┌───────────────┐  ┌───────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │ Project Board  │  │  Task Detail  │  │  Sync Chat   │  │  File Browser    │   │
│  │ (Kanban/List)  │  │  + Comments   │  │  (Live Mode) │  │  (Workspace)     │   │
│  └───────┬───────┘  └───────┬───────┘  └──────┬───────┘  └──────┬───────────┘   │
│          │                  │                  │                  │               │
│          └──────────────────┴──────────────────┴──────────────────┘               │
│                                        │                                         │
│                              WebSocket + REST API                                │
└────────────────────────────────────────┬─────────────────────────────────────────┘
                                         │
┌────────────────────────────────────────┼─────────────────────────────────────────┐
│                              API SERVER (Backend)                                │
│                                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────────────┐   │
│  │ Session           │  │ Board Sync       │  │ Discussion Scheduler          │   │
│  │ Coordinator       │  │ Engine           │  │                               │   │
│  │ (routing, HITL,   │  │ (plan → board    │  │ (schedule sync sessions,      │   │
│  │  control)         │  │  projection)     │  │  availability, notifications) │   │
│  └──────────────────┘  └──────────────────┘  └──────────────────────────────┘   │
│                                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────────────┐   │
│  │ Agent Runner      │  │ Trace Store      │  │ Sleep-Time Compute            │   │
│  │ (agent loop,      │  │ (JSONL per task, │  │ (nightly: digest, memory,     │   │
│  │  tools, container)│  │  query API)      │  │  failures, skills)            │   │
│  └──────────────────┘  └──────────────────┘  └──────────────────────────────┘   │
│                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────┘
         │                    │                    │                    │
         ▼                    ▼                    ▼                    ▼
   ┌──────────┐       ┌────────────┐       ┌────────────┐       ┌──────────┐
   │  Docker  │       │   Redis    │       │  Context   │       │ Database │
   │  Engine  │       │  Streams   │       │  Service   │       │ (Postgres)│
   └──────────┘       └────────────┘       └────────────┘       └──────────┘
```

---

## 2. Project Board

### 2.1 Concept

The project board is the **primary UI for managing agents**. It replaces the chat-first paradigm with a task-management paradigm:

- User creates a **Task** (becomes an Epic or Story on the board)
- Agent starts working, calls `update_plan` → plan steps automatically appear as **Work Items** on the board
- Agent updates plan status → Work Item status updates in real-time
- Agent leaves **Comments** on Work Items with findings, questions, blockers
- User comments asynchronously on Work Items to steer the agent
- User can enter **Sync Mode** to have a live discussion with the agent on any Work Item

### 2.2 Data Model

```typescript
/** A Task is the top-level unit — an Epic or Story depending on complexity */
interface Task {
  task_id: string;
  session_id: string;
  user_id: string;

  /** User-provided goal */
  goal: string;
  constraints?: string[];

  /** Auto-classified based on estimated complexity */
  size: 'story' | 'epic';

  status: TaskStatus;

  /** Agent's current plan — source of truth for Work Items */
  plan_snapshot?: PlanSnapshot;

  /** Deliverables produced by the agent */
  deliverables: Deliverable[];

  /** Usage metrics */
  usage: UsageMetrics;

  created_at: string;
  updated_at: string;
  completed_at?: string;
}

enum TaskStatus {
  RUNNING = 'RUNNING',
  BLOCKED = 'BLOCKED',           // Agent is waiting for user input
  DISCUSSING = 'DISCUSSING',     // In sync discussion mode
  PAUSED = 'PAUSED',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}
```

### 2.3 Work Items (Plan Steps → Board Items)

Work Items are **projections of the agent's plan** — not a separate data model the agent writes to. When the agent calls `update_plan`, the system extracts plan steps and projects them onto the board.

```typescript
/** A Work Item is a projection of a plan step onto the board */
interface WorkItem {
  item_id: string;              // Same as plan step id
  task_id: string;
  description: string;
  status: WorkItemStatus;
  notes?: string;               // Agent's notes from the plan step

  /** Comments from agent and user */
  comments: Comment[];

  /** Sub-agent label if this step is being handled by a sub-agent */
  sub_agent_label?: string;

  /** Evidence/screenshots attached during execution */
  evidence: EvidenceRef[];

  /** Timestamps */
  started_at?: string;
  completed_at?: string;

  /** Position on the board (ordering) */
  sort_order: number;
}

enum WorkItemStatus {
  TODO = 'TODO',                 // plan step status: pending
  IN_PROGRESS = 'IN_PROGRESS',  // plan step status: in_progress
  DONE = 'DONE',                // plan step status: done
  BLOCKED = 'BLOCKED',          // plan step status: blocked
  SKIPPED = 'SKIPPED',          // plan step status: skipped
}
```

### 2.4 Plan-to-Board Projection

When the agent calls `update_plan`, the Board Sync Engine runs:

```typescript
async function syncPlanToBoard(taskId: string, plan: PlanSnapshot): Promise<void> {
  const existingItems = await db.getWorkItems(taskId);
  const existingIds = new Set(existingItems.map(i => i.item_id));

  for (const step of plan.steps) {
    if (existingIds.has(step.id)) {
      // Update existing item
      await db.updateWorkItem(step.id, {
        description: step.description,
        status: mapPlanStatusToWorkItemStatus(step.status),
        notes: step.notes,
        updated_at: new Date().toISOString(),
      });
      existingIds.delete(step.id);
    } else {
      // Create new item
      await db.createWorkItem({
        item_id: step.id,
        task_id: taskId,
        description: step.description,
        status: mapPlanStatusToWorkItemStatus(step.status),
        notes: step.notes,
        sort_order: plan.steps.indexOf(step),
      });
    }
  }

  // Items no longer in plan → mark as SKIPPED
  for (const removedId of existingIds) {
    await db.updateWorkItem(removedId, { status: 'SKIPPED' });
  }

  // Push real-time update to frontend via WebSocket
  await ws.broadcast(taskId, { type: 'board_updated', items: plan.steps });
}

function mapPlanStatusToWorkItemStatus(planStatus: string): WorkItemStatus {
  const map: Record<string, WorkItemStatus> = {
    'pending': 'TODO',
    'in_progress': 'IN_PROGRESS',
    'done': 'DONE',
    'blocked': 'BLOCKED',
    'skipped': 'SKIPPED',
  };
  return map[planStatus] || 'TODO';
}
```

### 2.5 Comments

Comments are the async communication channel between agent and user.

```typescript
interface Comment {
  comment_id: string;
  item_id: string;              // Work Item this comment is on
  task_id: string;
  author_type: 'agent' | 'user' | 'system';
  author_id: string;
  content: string;
  comment_type: CommentType;
  created_at: string;

  /** For discussion_request type */
  discussion_request?: DiscussionRequest;
}

type CommentType =
  | 'note'                // Agent shares a finding or progress update
  | 'question'            // Agent asks user a question (async HITL)
  | 'answer'              // User answers agent's question
  | 'feedback'            // User gives feedback or correction
  | 'decision'            // Agent records a decision made
  | 'blocker'             // Agent reports a blocker
  | 'discussion_request'  // Agent requests a live discussion
  | 'discussion_summary'  // Agent posts discussion summary + next steps
  | 'deliverable'         // Agent announces a deliverable for review
  | 'system';             // System-generated (e.g., status change)
```

### 2.6 Agent Comment Tool

The agent posts comments via a tool. This replaces `ask_user` for async questions.

```typescript
const postCommentTool: Tool = {
  name: 'post_comment',
  description: `Post a comment on a work item in the project board. Use this to:
- Share findings or progress with the user
- Ask questions (the user will answer when available)
- Report blockers
- Record important decisions
- Announce deliverables for review

For urgent questions that block your progress, set block=true.
For questions that can wait, set block=false and continue working.`,
  parameters: {
    type: 'object',
    properties: {
      item_id: {
        type: 'string',
        description: 'The work item ID to comment on. Use "task" to comment at the task level.',
      },
      content: { type: 'string' },
      comment_type: {
        type: 'string',
        enum: ['note', 'question', 'decision', 'blocker', 'deliverable'],
      },
      block: {
        type: 'boolean',
        description: 'If true, pause execution until user responds. If false, continue working.',
        default: false,
      },
    },
    required: ['item_id', 'content', 'comment_type'],
  },
};
```

**Behavior**:
- `block: false` → Comment posted, agent continues working. User responds whenever.
- `block: true` → Comment posted, agent loop returns `BLOCKED`. User sees notification. When user responds, agent resumes.

### 2.7 User Comment Injection

When a user posts a comment on a Work Item, the system injects it into the agent's context:

```typescript
// User posts comment via API
async function handleUserComment(taskId: string, itemId: string, content: string): Promise<void> {
  // Save to database
  const comment = await db.createComment({
    item_id: itemId,
    task_id: taskId,
    author_type: 'user',
    content,
    comment_type: 'feedback',
  });

  // Inject into agent's context
  await injectionQueue.push(taskId, {
    injection_type: 'user_comment',
    content: `User commented on work item "${itemId}": ${content}`,
    metadata: { item_id: itemId, comment_id: comment.comment_id },
  });
}
```

The agent sees the comment on its next iteration and can react to it.

---

## 3. First-Draft Review Flow

### 3.1 Concept

Long-running tasks produce **deliverables** (reports, code, data, screenshots). Instead of the agent "completing" and sending a chat message, it publishes deliverables for structured review.

### 3.2 Flow

```
Agent completes a major piece of work
        │
        ▼
Agent calls publish_deliverable:
  filepath: "output/pricing-report.md"
  description: "Competitive pricing analysis report"
  type: "report"
        │
        ▼
Agent calls post_comment on the relevant work item:
  comment_type: "deliverable"
  content: "Pricing analysis complete. Report ready for review."
        │
        ▼
Board UI: Work Item shows "Deliverable Ready for Review" badge
User clicks → sees the deliverable rendered inline (markdown, images, etc.)
        │
        ├── User approves → posts comment "Looks good, continue"
        │   → injected into agent context → agent moves to next step
        │
        ├── User requests changes → posts comment "Add competitor D"
        │   → injected into agent context → agent revises deliverable
        │
        └── User does nothing → agent continues to next step after timeout
            (configurable: wait_for_review_timeout)
```

### 3.3 Deliverable Review States

```typescript
interface Deliverable {
  deliverable_id: string;
  task_id: string;
  item_id?: string;              // Associated work item
  filepath: string;
  description: string;
  type: 'report' | 'code' | 'data' | 'screenshot' | 'other';
  review_status: ReviewStatus;
  content?: string;              // Inline for small files
  size_bytes?: number;
  created_at: string;
  reviewed_at?: string;
  reviewer_comment?: string;
}

enum ReviewStatus {
  PENDING = 'PENDING',           // Awaiting user review
  APPROVED = 'APPROVED',
  CHANGES_REQUESTED = 'CHANGES_REQUESTED',
  AUTO_APPROVED = 'AUTO_APPROVED', // Timeout, agent continued
}
```

### 3.4 Review Configuration

```typescript
interface ReviewConfig {
  /** Block agent until user reviews deliverable? */
  require_review: boolean;             // default: false

  /** If require_review=false, how long to wait before auto-approving */
  auto_approve_timeout_seconds: number; // default: 300 (5 min)

  /** Deliverable types that always require review */
  always_require_review: string[];     // default: [] (e.g., ['code', 'report'])
}
```

---

## 4. Async/Sync Hybrid Collaboration

### 4.1 Two Modes

| Mode | How It Works | When to Use |
|------|-------------|-------------|
| **Async** | Agent posts comments on Work Items. User responds when available. Agent may or may not block. | Default. Most interactions. Low-urgency questions, progress updates, deliverable reviews. |
| **Sync** | Live chat between agent and user on a specific topic. Agent schedules a discussion window. | Complex decisions, trade-off discussions, ambiguous requirements, strategy alignment. |

### 4.2 Async Mode (Default)

Agent works autonomously. Communication happens through comments:

```
Agent working on task...
  │
  ├── Posts note: "Found 3 pricing tiers for Competitor A" (non-blocking)
  │
  ├── Posts question: "Should I include free tier in comparison?" (non-blocking, continues)
  │
  ├── Posts blocker: "Login to Competitor B requires 2FA. Need credentials." (blocking)
  │   └── Agent pauses. User sees notification. Responds when available.
  │
  └── Posts deliverable: "Draft report ready for review" (non-blocking or blocking per config)
```

User sees all of this on the board. Can respond to any comment at any time. Responses are injected into the agent's context.

### 4.3 Sync Mode (Scheduled Discussions)

When the agent determines a topic needs interactive discussion:

```typescript
const requestDiscussionTool: Tool = {
  name: 'request_discussion',
  description: `Request a live discussion with the user about a specific topic.
Use when:
- A decision has significant trade-offs that need user input
- The topic is too complex for async back-and-forth
- You need to walk the user through options interactively
- The user needs to see something demonstrated live

The user will be notified and can set their availability.
You will be notified when the discussion is scheduled.`,
  parameters: {
    type: 'object',
    properties: {
      item_id: {
        type: 'string',
        description: 'Work item this discussion relates to',
      },
      topic: {
        type: 'string',
        description: 'What you want to discuss',
      },
      context: {
        type: 'string',
        description: 'Background context and what you have prepared',
      },
      estimated_duration_minutes: {
        type: 'number',
        description: 'Estimated discussion length',
        default: 10,
      },
      urgency: {
        type: 'string',
        enum: ['low', 'medium', 'high'],
        description: 'How urgently this discussion is needed',
        default: 'medium',
      },
      block: {
        type: 'boolean',
        description: 'If true, pause work until discussion happens. If false, continue other work.',
        default: false,
      },
      preparation_notes: {
        type: 'string',
        description: 'Notes for the user to review before the discussion (agenda items, options to consider)',
      },
    },
    required: ['item_id', 'topic', 'context'],
  },
};
```

### 4.4 Discussion Lifecycle

```
Agent calls request_discussion
        │
        ▼
System creates DiscussionRequest:
  status: REQUESTED
  Board UI: Work Item shows "Discussion Requested" badge
  User gets notification (push/email) with topic + preparation notes
        │
        ▼
User sets availability:
  "I'm free now" → discussion starts immediately
  "Schedule for 3pm" → system schedules
  "Not now, answer async instead" → converts to async question
        │
        ▼ (if scheduled)
At scheduled time:
  System sends notification: "Agent is ready to discuss. Join now?"
  User confirms → Task status → DISCUSSING
        │
        ▼
SYNC CHAT MODE:
  User and agent exchange messages in real-time
  Agent sees user messages immediately (not via injection queue — direct)
  Chat happens in a dedicated panel associated with the Work Item
        │
        ▼
Discussion ends (user clicks "End Discussion" or timeout):
  1. Agent generates discussion summary
  2. Agent posts summary as a comment (type: discussion_summary)
  3. Agent generates next steps and updates plan
  4. Agent asks user to confirm next steps
        │
        ▼
User confirms → Agent resumes async execution
User modifies → Agent updates plan accordingly
```

### 4.5 Discussion Data Model

```typescript
interface DiscussionRequest {
  request_id: string;
  task_id: string;
  item_id: string;
  topic: string;
  context: string;
  preparation_notes?: string;
  urgency: 'low' | 'medium' | 'high';
  estimated_duration_minutes: number;
  status: DiscussionStatus;
  requested_at: string;
  scheduled_at?: string;
  started_at?: string;
  ended_at?: string;
}

enum DiscussionStatus {
  REQUESTED = 'REQUESTED',
  SCHEDULED = 'SCHEDULED',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  DECLINED = 'DECLINED',         // User chose async instead
  EXPIRED = 'EXPIRED',           // User never responded
}

interface DiscussionSession {
  session_id: string;
  request_id: string;
  task_id: string;
  item_id: string;
  messages: DiscussionMessage[];
  summary?: string;
  next_steps?: string[];
  confirmed_by_user: boolean;
}

interface DiscussionMessage {
  message_id: string;
  role: 'user' | 'agent';
  content: string;
  timestamp: string;
}
```

### 4.6 Sync Chat Implementation

During a sync discussion, the agent loop switches from injection-queue-based input to **direct WebSocket streaming**:

```typescript
async function runSyncDiscussion(
  agentLoop: AgentLoop,
  discussion: DiscussionRequest,
  ws: WebSocketConnection,
): Promise<DiscussionSession> {
  const messages: DiscussionMessage[] = [];

  // Agent opens with prepared context
  const opener = await agentLoop.generateDiscussionOpener(discussion);
  messages.push({ role: 'agent', content: opener, timestamp: now() });
  ws.send({ type: 'discussion_message', message: opener, role: 'agent' });

  // Real-time exchange
  while (true) {
    const userMessage = await ws.waitForMessage({ timeout: 120_000 }); // 2 min inactivity timeout

    if (userMessage.type === 'end_discussion') break;
    if (userMessage.type === 'message') {
      messages.push({ role: 'user', content: userMessage.content, timestamp: now() });

      // Agent responds immediately (sync mode — no queuing)
      const agentResponse = await agentLoop.respondToDiscussionMessage(
        userMessage.content,
        messages,
        discussion,
      );
      messages.push({ role: 'agent', content: agentResponse, timestamp: now() });
      ws.send({ type: 'discussion_message', message: agentResponse, role: 'agent' });
    }
  }

  // Generate summary + next steps
  const summary = await agentLoop.generateDiscussionSummary(messages, discussion);
  const nextSteps = await agentLoop.generateNextSteps(messages, discussion);

  // Post as comment
  await postComment(discussion.item_id, {
    comment_type: 'discussion_summary',
    content: `## Discussion Summary\n\n${summary}\n\n## Next Steps\n\n${nextSteps.map((s, i) => `${i + 1}. ${s}`).join('\n')}`,
  });

  return { messages, summary, next_steps: nextSteps, confirmed_by_user: false };
}
```

---

## 5. File System Browser

### 5.1 Purpose

Every agent has a Docker workspace. The File Browser lets users see what the agent is doing in its file system — plans, memos, scratch files, deliverables, tool outputs.

### 5.2 API

```typescript
interface FileBrowserAPI {
  /** List files in a directory */
  listFiles(taskId: string, path: string): Promise<FileEntry[]>;

  /** Read file content */
  readFile(taskId: string, path: string): Promise<FileContent>;

  /** Get file tree */
  getFileTree(taskId: string): Promise<FileTreeNode>;
}

interface FileEntry {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size_bytes: number;
  modified_at: string;
}

interface FileContent {
  path: string;
  content: string;
  mime_type: string;
  size_bytes: number;
}

interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileTreeNode[];
}
```

### 5.3 UI Layout

```
┌─────────────────────────────────────────────────────────────┐
│  File Browser — Task "Competitive Pricing Analysis"          │
├──────────────────┬──────────────────────────────────────────┤
│  /workspace/     │  .plan.md                                 │
│  ├── .plan.md    │                                           │
│  ├── .memo/      │  # Execution Plan                        │
│  │   ├── find... │                                           │
│  │   └── deci... │  **Approach**: Research 5 competitors...  │
│  ├── .scratch/   │                                           │
│  │   └── tool... │  ## Steps                                 │
│  └── output/     │  - [x] **research**: Collect pricing...   │
│      ├── repo... │  - [>] **compare**: Build comparison...   │
│      └── scre... │  - [ ] **report**: Generate final...      │
│                  │                                           │
└──────────────────┴──────────────────────────────────────────┘
```

Special rendering:
- `.plan.md` → rendered as a progress tracker
- `output/*` → rendered with "Review" button for deliverables
- `.memo/*` → collapsed by default (agent's working memory)
- `.scratch/*` → hidden by default (temporary files)

---

## 6. Sleep-Time Compute

### 6.1 Purpose

Sleep-time compute runs background jobs when agents are idle (typically nightly). It processes the day's traces and produces actionable outputs for the next day.

### 6.2 Jobs

| Job | Schedule | Input | Output | Description |
|-----|----------|-------|--------|-------------|
| **Daily Digest** | 00:00 daily | All task traces from past 24h | DailyDigest | Summarize what happened, generate reminders for tomorrow |
| **Memory Consolidation** | 01:00 daily | All `.memo/` files across tasks | Consolidated knowledge entries | Merge scattered notes into structured, searchable knowledge |
| **Failure Pattern Detection** | 02:00 daily | Failed task traces from past 7 days | ImprovementProposal[] | Identify recurring failures, propose prompt/skill updates |
| **Stale Task Detection** | 03:00 daily | All RUNNING/PAUSED tasks | StaleTaskAlert[] | Flag tasks with no progress for >24h |
| **Skill Extraction** | Weekly (Sunday) | All traces from past week | Candidate SKILL.md files | Detect repeated workflows, generate reusable skills |
| **Workspace Cleanup** | 04:00 daily | Completed task workspaces | Cleanup report | Archive old workspaces, free disk space |

### 6.3 Daily Digest

```typescript
interface DailyDigest {
  digest_id: string;
  user_id: string;
  date: string;                     // YYYY-MM-DD
  generated_at: string;

  /** What happened today */
  summary: string;

  /** Tasks completed */
  completed_tasks: TaskDigestEntry[];

  /** Tasks still in progress */
  active_tasks: TaskDigestEntry[];

  /** Tasks that need attention */
  attention_needed: AttentionItem[];

  /** Reminders for tomorrow */
  reminders: Reminder[];

  /** Metrics */
  metrics: DailyMetrics;
}

interface TaskDigestEntry {
  task_id: string;
  goal: string;
  status: TaskStatus;
  key_events: string[];           // "Completed pricing research", "Blocked on login credentials"
  deliverables_produced: number;
  tokens_used: number;
}

interface AttentionItem {
  task_id: string;
  item_id?: string;
  attention_type: 'blocked' | 'stale' | 'review_pending' | 'discussion_requested' | 'failed';
  description: string;
  action_needed: string;
}

interface Reminder {
  reminder_id: string;
  source_task_id?: string;
  content: string;
  priority: 'low' | 'medium' | 'high';
  /** How the reminder was generated */
  reason: 'agent_requested' | 'stale_detection' | 'pattern_detected' | 'deadline_approaching';
}

interface DailyMetrics {
  tasks_completed: number;
  tasks_created: number;
  total_tokens: number;
  total_duration_minutes: number;
  deliverables_produced: number;
  discussions_held: number;
  comments_exchanged: number;
}
```

### 6.4 Daily Digest Generation

```typescript
async function generateDailyDigest(userId: string, date: string): Promise<DailyDigest> {
  // Gather today's traces
  const traces = await traceStore.getTracesForUser(userId, date);
  const tasks = await db.getTasksUpdatedSince(userId, startOfDay(date));
  const pendingReviews = await db.getPendingDeliverables(userId);
  const pendingDiscussions = await db.getPendingDiscussions(userId);
  const blockedTasks = await db.getBlockedTasks(userId);

  // Generate digest via LLM
  const digest = await llm.call({
    model: 'fast-model',
    messages: [
      { role: 'system', content: DAILY_DIGEST_PROMPT },
      { role: 'user', content: JSON.stringify({
        traces_summary: summarizeTraces(traces),
        tasks,
        pending_reviews: pendingReviews,
        pending_discussions: pendingDiscussions,
        blocked_tasks: blockedTasks,
      })},
    ],
  });

  return parseDailyDigest(digest.content);
}

const DAILY_DIGEST_PROMPT = `You are a daily digest generator. Given today's agent activity,
produce a concise summary that helps the user plan tomorrow.

Focus on:
- What was accomplished
- What needs the user's attention (blocked tasks, pending reviews, discussion requests)
- Reminders based on observed patterns (e.g., "You asked about X yesterday but didn't follow up")
- Approaching deadlines

Be concise. Use bullet points. Prioritize action items.`;
```

### 6.5 Memory Consolidation

Agents write scattered notes to `.memo/` files during execution. Memory consolidation merges these into structured knowledge:

```typescript
async function consolidateMemory(userId: string): Promise<void> {
  // Gather all memo files across active task workspaces
  const memos = await gatherAllMemoFiles(userId);

  // Group by topic via LLM
  const consolidation = await llm.call({
    model: 'fast-model',
    messages: [
      { role: 'system', content: MEMORY_CONSOLIDATION_PROMPT },
      { role: 'user', content: formatMemosForConsolidation(memos) },
    ],
  });

  // Write consolidated entries to Context Service
  const entries = parseConsolidationResult(consolidation.content);
  for (const entry of entries) {
    await contextService.upsertKnowledge(userId, entry);
  }
}

const MEMORY_CONSOLIDATION_PROMPT = `You are a knowledge manager. Given scattered agent memos
from multiple tasks, consolidate them into structured knowledge entries.

Each entry should have:
- topic: What this knowledge is about
- content: The consolidated information
- source_tasks: Which tasks this came from
- confidence: How reliable this information is (verified/observed/inferred)

Merge duplicate information. Resolve contradictions (note which is newer).
Remove ephemeral notes that are no longer relevant (e.g., "trying approach X" when X already succeeded or failed).`;
```

### 6.6 Failure Pattern Detection

```typescript
interface ImprovementProposal {
  proposal_id: string;
  detection_type: 'recurring_failure' | 'user_correction' | 'inefficiency' | 'skill_gap';
  description: string;
  evidence: TraceEvidence[];
  proposed_change: ProposedChange;
  confidence: number;              // 0.0 - 1.0
  status: 'pending_review' | 'approved' | 'rejected' | 'applied';
}

type ProposedChange =
  | { type: 'prompt_update'; section: string; current: string; proposed: string }
  | { type: 'new_skill'; skill_name: string; skill_content: string }
  | { type: 'skill_update'; skill_name: string; changes: string }
  | { type: 'risk_rule'; pattern: string; proposed_level: string }
  | { type: 'tool_hint'; tool_name: string; hint: string };

interface TraceEvidence {
  task_id: string;
  trace_file: string;
  iteration: number;
  description: string;
}
```

**Flow**:

```
Sleep-time agent analyzes traces from past 7 days
        │
        ▼
Detects patterns:
  "Agent failed to login 8 times across 3 tasks before trying alternative approach"
  "User corrected report format in 4 out of 5 tasks"
  "Agent spends 15+ iterations on PDF extraction every time"
        │
        ▼
Generates ImprovementProposals:
  1. prompt_update: "Add to system prompt: If login fails twice, try alternative methods"
  2. prompt_update: "Add to system prompt: Use markdown tables for comparison reports"
  3. new_skill: Generate "pdf-extraction" SKILL.md
        │
        ▼
Proposals appear on Board UI as "System Improvement" items
User reviews each proposal: Approve / Reject / Modify
        │
        ▼
Approved → Applied automatically:
  - Prompt updates: appended to agent's system prompt
  - New skills: written to /skills/ directory
  - Risk rules: added to risk policy config
```

### 6.7 Skill Extraction

```typescript
async function extractSkills(userId: string): Promise<void> {
  const weekTraces = await traceStore.getTracesForUser(userId, pastWeek());

  const extraction = await llm.call({
    model: 'thinking-model',
    messages: [
      { role: 'system', content: SKILL_EXTRACTION_PROMPT },
      { role: 'user', content: summarizeTracesForSkillExtraction(weekTraces) },
    ],
  });

  const candidates = parseSkillCandidates(extraction.content);
  for (const skill of candidates) {
    await db.createImprovementProposal({
      detection_type: 'skill_gap',
      description: `Repeated workflow detected: ${skill.name}`,
      proposed_change: {
        type: 'new_skill',
        skill_name: skill.name,
        skill_content: skill.content,
      },
    });
  }
}

const SKILL_EXTRACTION_PROMPT = `Analyze these agent traces from the past week.
Identify repeated workflows that the agent performs across multiple tasks.

For each repeated workflow, generate a SKILL.md file that would help
the agent perform this workflow faster in the future.

A good skill candidate:
- Appears in 2+ different tasks
- Takes 5+ agent iterations to figure out each time
- Has a consistent pattern that can be documented
- Would save significant time if pre-documented`;
```

---

## 7. Trace System

### 7.1 Trace Storage

Every agent loop iteration produces trace entries stored as JSONL:

```typescript
interface TraceEntry {
  trace_id: string;
  task_id: string;
  timestamp: string;
  iteration: number;
  event_type: TraceEventType;
  duration_ms?: number;
  tokens?: { input: number; output: number };
  data: Record<string, unknown>;
}

type TraceEventType =
  | 'agent_start'
  | 'llm_request'          // Full prompt sent to LLM
  | 'llm_response'         // Full LLM response
  | 'tool_call'            // Tool name + params
  | 'tool_result'          // Tool output (possibly truncated)
  | 'plan_updated'         // New plan snapshot
  | 'comment_posted'       // Agent posted a comment
  | 'injection_received'   // External input received
  | 'compaction_start'
  | 'compaction_end'
  | 'memory_flush'
  | 'sub_agent_spawn'
  | 'sub_agent_complete'
  | 'risk_check'
  | 'doom_loop_detected'
  | 'discussion_started'
  | 'discussion_ended'
  | 'deliverable_published'
  | 'agent_end';
```

### 7.2 Trace Query API

```typescript
interface TraceStore {
  /** Get all traces for a task */
  getTraces(taskId: string): Promise<TraceEntry[]>;

  /** Get traces for a user across all tasks in a date range */
  getTracesForUser(userId: string, date: string): Promise<TraceEntry[]>;

  /** Get traces matching a filter */
  queryTraces(filter: TraceFilter): Promise<TraceEntry[]>;

  /** Get a summary of a task's trace (for sleep-time compute) */
  getTraceSummary(taskId: string): Promise<TraceSummary>;
}

interface TraceFilter {
  task_id?: string;
  user_id?: string;
  event_types?: TraceEventType[];
  date_from?: string;
  date_to?: string;
  limit?: number;
}

interface TraceSummary {
  task_id: string;
  total_iterations: number;
  total_tokens: number;
  total_duration_ms: number;
  tool_call_counts: Record<string, number>;
  compaction_count: number;
  errors: TraceSummaryError[];
  user_corrections: string[];
  key_decisions: string[];
}
```

### 7.3 Trace Viewer in UI

The trace viewer lets users inspect agent behavior step by step (like LangSmith):

```
┌─────────────────────────────────────────────────────────────────┐
│  Trace Viewer — Task "Competitive Pricing Analysis"              │
├──────────┬──────────────────────────────────────────────────────┤
│ Timeline │  Iteration 14: tool_call                              │
│          │                                                       │
│  #1  ●   │  Tool: browser                                        │
│  #2  ●   │  Action: navigate                                     │
│  #3  ●   │  URL: https://competitor-a.com/pricing                │
│  #4  ●   │                                                       │
│  #5  ●   │  Duration: 3.2s                                       │
│  #6  ●   │  Risk: MEDIUM                                         │
│  #7  ●   │                                                       │
│  #8  ●   │  Result:                                               │
│  #9  ●   │  Page loaded successfully. Title: "Pricing - ..."     │
│  #10 ●   │  Screenshot saved to .scratch/screenshot-14.png       │
│  #11 ●   │                                                       │
│  #12 ●   │  ┌─────────────────────────────────────┐              │
│  #13 ●   │  │ Context at this step:                │              │
│  #14 ● ← │  │ Tokens: 42,318 / 128,000            │              │
│  #15 ○   │  │ Plan: 2/5 steps done                 │              │
│  #16 ○   │  │ Compactions: 1                        │              │
│  #17 ○   │  └─────────────────────────────────────┘              │
│          │                                                       │
└──────────┴──────────────────────────────────────────────────────┘
```

---

## 8. Recursive Self-Improvement Loop

### 8.1 The Full Loop

```
                    ┌──────────────────────────────┐
                    │        AGENT EXECUTES         │
                    │    (produces traces, results)  │
                    └──────────────┬───────────────┘
                                   │
                                   ▼
                    ┌──────────────────────────────┐
                    │     TRACES STORED (JSONL)     │
                    └──────────────┬───────────────┘
                                   │
                                   ▼
                    ┌──────────────────────────────┐
                    │    SLEEP-TIME COMPUTE         │
                    │  (nightly analysis)           │
                    │                               │
                    │  • Failure pattern detection   │
                    │  • User correction analysis    │
                    │  • Inefficiency detection      │
                    │  • Skill gap identification    │
                    └──────────────┬───────────────┘
                                   │
                                   ▼
                    ┌──────────────────────────────┐
                    │  IMPROVEMENT PROPOSALS        │
                    │  (appear on Board for review)  │
                    └──────────────┬───────────────┘
                                   │
                            User reviews
                                   │
                    ┌──────┬───────┴───────┬──────┐
                    │      │               │      │
                 Approve  Modify        Reject   Ignore
                    │      │
                    ▼      ▼
                    ┌──────────────────────────────┐
                    │     CHANGES APPLIED           │
                    │                               │
                    │  • System prompt updated       │
                    │  • New SKILL.md created         │
                    │  • Risk rules adjusted          │
                    │  • Memory entries added          │
                    └──────────────┬───────────────┘
                                   │
                                   ▼
                          (next agent execution
                           uses improved config)
                                   │
                    ┌──────────────┘
                    │
                    ▼
              AGENT EXECUTES (improved) ─── loop continues ───▶
```

### 8.2 Safety: Human in the Loop

Improvement proposals are NEVER auto-applied. They always require user review:

```typescript
interface ImprovementReview {
  proposal_id: string;
  action: 'approve' | 'approve_modified' | 'reject';
  modified_change?: ProposedChange;   // If approve_modified
  reviewer_comment?: string;
}
```

This prevents:
- Prompt drift (agent gradually changing its own behavior)
- Cascading errors (one bad trace leading to harmful prompt changes)
- Loss of control (agent optimizing for metrics the user doesn't care about)

### 8.3 Applied Changes Tracking

```typescript
interface AppliedChange {
  change_id: string;
  proposal_id: string;
  change_type: ProposedChange['type'];
  applied_at: string;
  applied_by: string;              // user_id
  rollback_available: boolean;
  previous_value?: string;         // For rollback
}
```

All changes are versioned. User can rollback any applied change from the UI.

---

## 9. Frontend Architecture

### 9.1 Pages

| Page | Path | Purpose |
|------|------|---------|
| **Board** | `/` | Kanban/list view of all tasks and their work items |
| **Task Detail** | `/task/:id` | Single task view: work items, comments, deliverables, file browser |
| **Sync Chat** | `/task/:id/discuss/:requestId` | Live discussion panel |
| **Trace Viewer** | `/task/:id/trace` | Step-by-step trace inspection |
| **Digest** | `/digest` | Daily digest view with reminders and attention items |
| **Improvements** | `/improvements` | Pending improvement proposals for review |
| **Settings** | `/settings` | Agent config, model selection, risk policies |

### 9.2 Real-Time Updates (WebSocket)

```typescript
type WebSocketEvent =
  | { type: 'board_updated'; task_id: string; items: WorkItem[] }
  | { type: 'comment_posted'; task_id: string; item_id: string; comment: Comment }
  | { type: 'task_status_changed'; task_id: string; status: TaskStatus }
  | { type: 'deliverable_published'; task_id: string; deliverable: Deliverable }
  | { type: 'discussion_requested'; task_id: string; request: DiscussionRequest }
  | { type: 'discussion_message'; session_id: string; message: DiscussionMessage }
  | { type: 'trace_event'; task_id: string; entry: TraceEntry }
  | { type: 'agent_iteration'; task_id: string; iteration: number; token_usage: number }
  | { type: 'file_changed'; task_id: string; path: string; action: 'created' | 'modified' | 'deleted' }
  | { type: 'digest_ready'; digest_id: string }
  | { type: 'improvement_proposed'; proposal: ImprovementProposal };
```

### 9.3 REST API

```typescript
// Tasks
POST   /api/tasks                          // Create new task
GET    /api/tasks                          // List tasks
GET    /api/tasks/:id                      // Get task detail
PATCH  /api/tasks/:id                      // Update (pause/resume/cancel)
DELETE /api/tasks/:id                      // Cancel and cleanup

// Work Items
GET    /api/tasks/:id/items                // List work items for task

// Comments
GET    /api/tasks/:id/items/:itemId/comments    // List comments
POST   /api/tasks/:id/items/:itemId/comments    // Post comment (user → agent)
POST   /api/tasks/:id/comments                  // Post task-level comment

// Deliverables
GET    /api/tasks/:id/deliverables         // List deliverables
PATCH  /api/tasks/:id/deliverables/:did    // Review (approve/request changes)
GET    /api/tasks/:id/deliverables/:did/content  // Get deliverable content

// Discussions
POST   /api/tasks/:id/discussions/:rid/schedule  // Set availability / schedule
POST   /api/tasks/:id/discussions/:rid/start     // Start discussion (returns WS URL)
POST   /api/tasks/:id/discussions/:rid/end       // End discussion
GET    /api/tasks/:id/discussions                // List discussions

// Files
GET    /api/tasks/:id/files                // Get file tree
GET    /api/tasks/:id/files/*path          // Get file content

// Traces
GET    /api/tasks/:id/trace                // Get trace entries
GET    /api/tasks/:id/trace/summary        // Get trace summary

// Digest
GET    /api/digest                         // Get latest daily digest
GET    /api/digest/:date                   // Get digest for specific date

// Improvements
GET    /api/improvements                   // List pending proposals
PATCH  /api/improvements/:id               // Review (approve/reject/modify)
POST   /api/improvements/:id/rollback      // Rollback applied change

// Settings
GET    /api/settings                       // Get current settings
PATCH  /api/settings                       // Update settings
```

### 9.4 Tech Stack (Recommendation)

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Frontend | Next.js (App Router) + React | SSR, API routes, good DX |
| UI Components | shadcn/ui + Tailwind | Fast to build, customizable |
| Real-time | WebSocket (native or Socket.io) | Board updates, trace streaming, sync chat |
| State | React Query (TanStack) | Server state, caching, optimistic updates |
| Board DnD | @dnd-kit | Drag-and-drop for kanban |
| Markdown | react-markdown + rehype | Render deliverables, comments |
| Backend | Node.js + Express or Fastify | Same language as execution service |
| Database | PostgreSQL | Tasks, comments, proposals, discussions |
| Queue | Redis Streams | Agent communication (unchanged) |
| File storage | Docker volumes + API | Workspace file access |

---

## 10. Updated Tool Inventory

Tools added or modified from v2:

| Tool | Change | Description |
|------|--------|-------------|
| `post_comment` | **NEW** | Post comments on board work items (replaces `ask_user` for async) |
| `request_discussion` | **NEW** | Request a live sync discussion with user |
| `update_plan` | **MODIFIED** | Now triggers Board Sync Engine to project plan onto board |
| `publish_deliverable` | **MODIFIED** | Now creates reviewable deliverable entry with review status |
| `ask_user` | **REMOVED** | Replaced by `post_comment(block=true)` for blocking questions |

Full tool list:

| Tool | Risk | Category |
|------|------|----------|
| `bash` | MEDIUM-CRITICAL | Environment |
| `read` | LOW | File System |
| `write` | MEDIUM-HIGH | File System |
| `edit` | LOW | File System |
| `glob` | LOW | File System |
| `grep` | LOW | File System |
| `browser` | MEDIUM-HIGH | Environment |
| `web_search` | MEDIUM | Information |
| `web_fetch` | MEDIUM | Information |
| `update_plan` | LOW | Context + Board |
| `save_memo` | LOW | Context |
| `search_memo` | LOW | Context |
| `post_comment` | LOW | Collaboration |
| `request_discussion` | LOW | Collaboration |
| `spawn_agent` | MEDIUM | Orchestration |
| `publish_deliverable` | LOW | Output |
| `list_skills` | LOW | Skills |
| `read_skill` | LOW | Skills |

---

## 11. Updated Agent Loop

### 11.1 Changes from v2

The agent loop from v2 (Section 4) is unchanged in its core structure. The additions:

1. **`update_plan` side effect**: After the tool executes, call `syncPlanToBoard()` to project plan onto the board UI.
2. **`post_comment` side effect**: After the tool executes, broadcast the comment via WebSocket.
3. **`publish_deliverable` side effect**: Create a reviewable deliverable entry in the database.
4. **`request_discussion` side effect**: Create a DiscussionRequest, notify user.
5. **Injection types expanded**: Now includes `user_comment` and `discussion_scheduled` in addition to v2 types.

```typescript
// Extended injection types
interface AgentInjection {
  injection_type:
    | 'user_message'
    | 'user_comment'             // NEW: user commented on a work item
    | 'hitl_response'
    | 'external_event'
    | 'system_control'
    | 'discussion_scheduled'     // NEW: user scheduled a discussion
    | 'review_feedback';         // NEW: user reviewed a deliverable
  content: string;
  metadata?: Record<string, unknown>;
}
```

### 11.2 Tool Side Effects Pipeline

```typescript
async function executeToolWithSideEffects(
  toolCall: ToolCall,
  container: Container,
  taskId: string,
): Promise<string> {
  // Execute the tool
  const result = await executeTool(toolCall, container);

  // Side effects based on tool name
  switch (toolCall.name) {
    case 'update_plan':
      const plan = JSON.parse(toolCall.arguments);
      await syncPlanToBoard(taskId, plan);
      await ws.broadcast(taskId, { type: 'board_updated', items: plan.steps });
      break;

    case 'post_comment':
      const comment = JSON.parse(toolCall.arguments);
      const saved = await db.createComment({ task_id: taskId, ...comment, author_type: 'agent' });
      await ws.broadcast(taskId, { type: 'comment_posted', comment: saved });
      break;

    case 'publish_deliverable':
      const deliv = JSON.parse(toolCall.arguments);
      const entry = await db.createDeliverable({ task_id: taskId, ...deliv, review_status: 'PENDING' });
      await ws.broadcast(taskId, { type: 'deliverable_published', deliverable: entry });
      break;

    case 'request_discussion':
      const req = JSON.parse(toolCall.arguments);
      const discussion = await db.createDiscussionRequest({ task_id: taskId, ...req });
      await ws.broadcast(taskId, { type: 'discussion_requested', request: discussion });
      await notifyUser(taskId, `Agent wants to discuss: ${req.topic}`);
      break;
  }

  return result;
}
```

---

## 12. Database Schema

### 12.1 Tables

```sql
-- Tasks
CREATE TABLE tasks (
  task_id        TEXT PRIMARY KEY,
  session_id     TEXT NOT NULL,
  user_id        TEXT NOT NULL,
  goal           TEXT NOT NULL,
  constraints    JSONB,
  size           TEXT CHECK (size IN ('story', 'epic')),
  status         TEXT NOT NULL DEFAULT 'RUNNING',
  plan_snapshot  JSONB,
  usage          JSONB,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at   TIMESTAMPTZ
);

-- Work Items (projections of plan steps)
CREATE TABLE work_items (
  item_id        TEXT NOT NULL,
  task_id        TEXT NOT NULL REFERENCES tasks(task_id),
  description    TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'TODO',
  notes          TEXT,
  sub_agent_label TEXT,
  sort_order     INT NOT NULL DEFAULT 0,
  started_at     TIMESTAMPTZ,
  completed_at   TIMESTAMPTZ,
  PRIMARY KEY (task_id, item_id)
);

-- Comments
CREATE TABLE comments (
  comment_id     TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  item_id        TEXT,         -- NULL for task-level comments
  task_id        TEXT NOT NULL REFERENCES tasks(task_id),
  author_type    TEXT NOT NULL CHECK (author_type IN ('agent', 'user', 'system')),
  author_id      TEXT NOT NULL,
  content        TEXT NOT NULL,
  comment_type   TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Deliverables
CREATE TABLE deliverables (
  deliverable_id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  task_id        TEXT NOT NULL REFERENCES tasks(task_id),
  item_id        TEXT,
  filepath       TEXT NOT NULL,
  description    TEXT NOT NULL,
  type           TEXT NOT NULL,
  review_status  TEXT NOT NULL DEFAULT 'PENDING',
  content        TEXT,
  size_bytes     BIGINT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at    TIMESTAMPTZ,
  reviewer_comment TEXT
);

-- Discussion Requests
CREATE TABLE discussion_requests (
  request_id     TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  task_id        TEXT NOT NULL REFERENCES tasks(task_id),
  item_id        TEXT NOT NULL,
  topic          TEXT NOT NULL,
  context        TEXT NOT NULL,
  preparation_notes TEXT,
  urgency        TEXT NOT NULL DEFAULT 'medium',
  estimated_duration_minutes INT NOT NULL DEFAULT 10,
  status         TEXT NOT NULL DEFAULT 'REQUESTED',
  requested_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  scheduled_at   TIMESTAMPTZ,
  started_at     TIMESTAMPTZ,
  ended_at       TIMESTAMPTZ
);

-- Discussion Sessions
CREATE TABLE discussion_sessions (
  session_id     TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  request_id     TEXT NOT NULL REFERENCES discussion_requests(request_id),
  task_id        TEXT NOT NULL,
  item_id        TEXT NOT NULL,
  messages       JSONB NOT NULL DEFAULT '[]',
  summary        TEXT,
  next_steps     JSONB,
  confirmed_by_user BOOLEAN DEFAULT FALSE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Improvement Proposals
CREATE TABLE improvement_proposals (
  proposal_id    TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  user_id        TEXT NOT NULL,
  detection_type TEXT NOT NULL,
  description    TEXT NOT NULL,
  evidence       JSONB NOT NULL DEFAULT '[]',
  proposed_change JSONB NOT NULL,
  confidence     FLOAT NOT NULL DEFAULT 0.5,
  status         TEXT NOT NULL DEFAULT 'pending_review',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at    TIMESTAMPTZ,
  reviewer_comment TEXT
);

-- Applied Changes (for rollback)
CREATE TABLE applied_changes (
  change_id      TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  proposal_id    TEXT NOT NULL REFERENCES improvement_proposals(proposal_id),
  change_type    TEXT NOT NULL,
  applied_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  applied_by     TEXT NOT NULL,
  previous_value TEXT,
  rollback_available BOOLEAN DEFAULT TRUE
);

-- Daily Digests
CREATE TABLE daily_digests (
  digest_id      TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  user_id        TEXT NOT NULL,
  date           DATE NOT NULL,
  content        JSONB NOT NULL,
  generated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- Trace index (traces stored as JSONL files, this is the index)
CREATE TABLE trace_index (
  task_id        TEXT NOT NULL REFERENCES tasks(task_id),
  trace_file     TEXT NOT NULL,
  total_entries  INT NOT NULL DEFAULT 0,
  total_tokens   BIGINT NOT NULL DEFAULT 0,
  started_at     TIMESTAMPTZ NOT NULL,
  ended_at       TIMESTAMPTZ,
  PRIMARY KEY (task_id)
);
```

---

## 13. Unchanged from v2

The following sections from v2 are unchanged and still apply:

| v2 Section | Topic |
|------------|-------|
| 4. Agent Loop | Core loop pseudocode, injection queue, initial context (with additions in Section 11 above) |
| 5. Planning Tool | update_plan definition and execution (now also triggers board sync) |
| 6. Compaction Engine | Full compaction flow, memory flush, summarization |
| 7. File System Context | Workspace layout, memo tools, tiered memory |
| 9. Sub-Agent Management | spawn_agent, sub-agent manager, result passing |
| 10. Skills System | SKILL.md, list_skills, read_skill |
| 11. Risk Control | Classification, rules, doom loop detection |
| 12. Docker Container Management | Container lifecycle, configuration, per-task isolation |
| 17. Configuration | Environment variables, per-task overrides |
| 18. Error Handling | Error categories, LLM retry, container errors |
| Appendix A | System prompt template (extend with collaboration instructions) |

---

## 14. System Prompt Additions (for v3)

Append to the system prompt template from v2:

```markdown
# Collaboration

You work with a human via a project board. Your plan steps appear as work items on the board.

## Comments
Use `post_comment` to communicate with the user on specific work items:
- Share findings and progress (comment_type: "note")
- Ask questions (comment_type: "question") — set block=true only if you cannot proceed without the answer
- Report blockers (comment_type: "blocker", block=true)
- Record important decisions (comment_type: "decision")
- Announce deliverables (comment_type: "deliverable")

The user will respond via comments when they are available. You will see their responses
as injected messages. React to feedback by adjusting your approach.

## Discussions
For complex topics that need interactive conversation, use `request_discussion`.
The user will schedule a time, and you will have a live chat to resolve the issue.
After the discussion:
1. Summarize the discussion
2. Post the summary as a comment (type: discussion_summary)
3. Update your plan with agreed next steps
4. Ask the user to confirm the plan

## Deliverables
When you complete a piece of work, use `publish_deliverable`.
The user may review and request changes. Check for review feedback in your injections.

## Async vs Sync
Default to async (comments). Only request sync discussions when:
- The topic has significant trade-offs requiring interactive exploration
- Multiple rounds of async back-and-forth would be slower
- You need to demonstrate or walk through something live
```

---

## Appendix A: Migration from v2 to v3

### What to Add

| Component | Purpose |
|-----------|---------|
| `src/board/` | Board Sync Engine, plan-to-board projection |
| `src/comments/` | Comment storage and injection |
| `src/discussion/` | Discussion scheduler, sync chat handler |
| `src/deliverable/` | Deliverable review management |
| `src/sleep-time/` | All sleep-time compute jobs |
| `src/trace/` | Trace store, query API, summarization |
| `src/improvement/` | Improvement proposal management |
| `src/api/` | REST API routes |
| `src/ws/` | WebSocket server for real-time updates |
| `src/frontend/` | Next.js web application |
| Database migrations | PostgreSQL schema |

### What to Modify

| Component | Change |
|-----------|--------|
| `update_plan` tool | Add board sync side effect |
| `ask_user` tool | Remove, replace with `post_comment(block=true)` |
| Agent loop | Add tool side effects pipeline |
| Injection types | Add `user_comment`, `discussion_scheduled`, `review_feedback` |

### What is Unchanged

| Component | Notes |
|-----------|-------|
| Agent loop core | Same LLM-in-a-loop |
| Compaction engine | Same |
| Sub-agent management | Same |
| Skills system | Same |
| Risk control | Same |
| Container management | Same |
| Session Coordinator | Same (extended with board events) |

---

*End of Execution Service Factsheet (v3)*
