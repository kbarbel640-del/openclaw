// OpenClaw Dashboard Types
// Based on docs/dashboard/2026-02-05-openclaw-unified-design.md

// ============================================================================
// Task & Job Types
// ============================================================================

export type TaskStatus =
  | 'pending'
  | 'queued'
  | 'running'
  | 'complete'
  | 'failed'
  | 'blocked'
  | 'review'
  | 'cancelled';

export type WorkerType = 'worker-code' | 'worker-research' | 'worker-test' | 'worker-docs';

export interface TaskDefinition {
  id: string;
  trackId: string;
  title: string;
  description?: string;
  dependsOn?: string[];
  workerType: WorkerType;
  requiresReview: boolean;
  maxRetries: number;
  timeoutMinutes: number;
  status: TaskStatus;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  queuePosition?: number;
}

export interface TaskCreateInput {
  trackId: string;
  title: string;
  description?: string;
  dependsOn?: string[];
  workerType: WorkerType;
  requiresReview?: boolean;
  maxRetries?: number;
  timeoutMinutes?: number;
}

export interface TaskListResult {
  tasks: TaskDefinition[];
  total: number;
  pending: number;
  running: number;
  completed: number;
  failed: number;
}

// ============================================================================
// Job & Execution Types
// ============================================================================

export interface Artifact {
  id: string;
  name: string;
  path: string;
  size: number;
  type: string;
  createdAt: number;
}

export interface ContextUpdate {
  key: string;
  value: unknown;
}

export interface DiffStats {
  filesChanged: number;
  additions: number;
  deletions: number;
}

export interface WorkerResult {
  taskId: string;
  status: 'complete' | 'blocked' | 'failed';
  summary: string;
  artifacts: Artifact[];
  contextUpdates: ContextUpdate[];
  requiresReview: boolean;
  diffStats?: DiffStats;
  blockedReason?: string;
  error?: string;
}

export interface JobRecord {
  id: string;
  taskId: string;
  workerId: string;
  status: TaskStatus;
  result?: WorkerResult;
  logs: LogEntry[];
  startedAt: number;
  completedAt?: number;
}

export interface LogEntry {
  timestamp: number;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  source?: string;
}

// ============================================================================
// Track & Project Types
// ============================================================================

export type TrackStatus = 'active' | 'pending' | 'idle' | 'completed' | 'archived';

export interface Track {
  id: string;
  name: string;
  description?: string;
  status: TrackStatus;
  createdAt: number;
  updatedAt: number;
  taskCount: number;
  completedTaskCount: number;
  specPath?: string;
  planPath?: string;
  contextPath?: string;
}

export interface TrackCreateInput {
  name: string;
  description?: string;
}

// ============================================================================
// Worker Types
// ============================================================================

export type WorkerStatus = 'idle' | 'active' | 'paused' | 'error';

export interface Worker {
  id: string;
  name: string;
  type: WorkerType;
  status: WorkerStatus;
  currentTask?: string;
  taskDescription?: string;
  worktreePath?: string;
  startedAt?: number;
}

// ============================================================================
// Review Queue Types
// ============================================================================

export type ReviewStatus = 'pending' | 'approved' | 'rejected' | 'merged';

export interface ReviewQueueItem {
  id: string;
  taskId: string;
  trackId: string;
  title: string;
  description: string;
  status: ReviewStatus;
  diffStats: DiffStats;
  createdAt: number;
  reviewedAt?: number;
  reviewedBy?: string;
  comments: ReviewComment[];
}

export interface ReviewComment {
  id: string;
  author: string;
  content: string;
  filePath?: string;
  lineNumber?: number;
  createdAt: number;
}

// ============================================================================
// Git Worktree Types
// ============================================================================

export interface WorktreeInfo {
  id: string;
  taskId: string;
  path: string;
  branch: string;
  baseBranch: string;
  createdAt: number;
  lastUsedAt: number;
}

export interface DiffResult {
  files: DiffFile[];
  stats: DiffStats;
}

export interface DiffFile {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  additions: number;
  deletions: number;
  diff: string;
}

// ============================================================================
// Chat & Message Types
// ============================================================================

export type MessageSender = 'user' | 'lead' | 'worker' | 'system';

export interface Message {
  id: string;
  sender: MessageSender;
  senderName: string;
  senderId?: string;
  content: string;
  timestamp: number;
  trackId?: string;
  taskId?: string;
  attachments?: MessageAttachment[];
  metadata?: Record<string, unknown>;
}

export interface MessageAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  url?: string;
}

// ============================================================================
// Context Store Types
// ============================================================================

export interface ContextFile {
  path: string;
  name: string;
  content: string;
  lastModified: number;
}

export interface ProjectContext {
  product: ContextFile;
  workflow: ContextFile;
  guidelines: ContextFile;
  tracks: Track[];
}

// ============================================================================
// Gateway WebSocket Types
// ============================================================================

export type GatewayEventType =
  | 'task.created'
  | 'task.queued'
  | 'task.started'
  | 'task.progress'
  | 'task.completed'
  | 'task.failed'
  | 'task.review.ready'
  | 'task.review.approved'
  | 'task.review.rejected'
  | 'worker.status'
  | 'message'
  | 'connected'
  | 'disconnected';

export interface GatewayEvent {
  type: GatewayEventType;
  timestamp: number;
  payload: unknown;
}

export interface TaskCreatedEvent extends GatewayEvent {
  type: 'task.created';
  payload: TaskDefinition;
}

export interface TaskStartedEvent extends GatewayEvent {
  type: 'task.started';
  payload: {
    taskId: string;
    jobId: string;
    workerId: string;
  };
}

export interface TaskCompletedEvent extends GatewayEvent {
  type: 'task.completed';
  payload: {
    taskId: string;
    result: WorkerResult;
  };
}

export interface MessageEvent extends GatewayEvent {
  type: 'message';
  payload: Message;
}

// ============================================================================
// UI State Types
// ============================================================================

export interface DashboardState {
  // Connection
  connected: boolean;
  connecting: boolean;
  error: string | null;

  // Data
  tracks: Track[];
  tasks: TaskDefinition[];
  workers: Worker[];
  messages: Message[];
  reviews: ReviewQueueItem[];
  worktrees: WorktreeInfo[];

  // Selection
  selectedTrackId: string | null;
  selectedTaskId: string | null;
  selectedReviewId: string | null;

  // UI State
  sidebarCollapsed: boolean;
  contextPanelOpen: boolean;
}

export type ViewRoute = '/' | '/board' | '/git' | '/files' | '/timeline' | '/reviews' | '/settings';
