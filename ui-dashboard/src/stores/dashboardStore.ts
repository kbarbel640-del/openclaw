import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { initializeMockData } from './mockData';
import type {
  DashboardState,
  Track,
  TaskDefinition,
  Worker,
  Message,
  ReviewQueueItem,
  WorktreeInfo,
  GatewayEvent,
  TaskCreatedEvent,
  TaskStartedEvent,
  TaskCompletedEvent,
  MessageEvent,
} from '../types';

interface DashboardActions {
  // Connection
  setConnected: (connected: boolean) => void;
  setConnecting: (connecting: boolean) => void;
  setError: (error: string | null) => void;

  // Data - Tracks
  setTracks: (tracks: Track[]) => void;
  addTrack: (track: Track) => void;
  updateTrack: (id: string, updates: Partial<Track>) => void;
  removeTrack: (id: string) => void;
  selectTrack: (id: string | null) => void;

  // Data - Tasks
  setTasks: (tasks: TaskDefinition[]) => void;
  addTask: (task: TaskDefinition) => void;
  updateTask: (id: string, updates: Partial<TaskDefinition>) => void;
  removeTask: (id: string) => void;
  selectTask: (id: string | null) => void;

  // Data - Workers
  setWorkers: (workers: Worker[]) => void;
  updateWorker: (id: string, updates: Partial<Worker>) => void;

  // Data - Messages
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;

  // Data - Reviews
  setReviews: (reviews: ReviewQueueItem[]) => void;
  addReview: (review: ReviewQueueItem) => void;
  updateReview: (id: string, updates: Partial<ReviewQueueItem>) => void;
  selectReview: (id: string | null) => void;

  // Data - Worktrees
  setWorktrees: (worktrees: WorktreeInfo[]) => void;
  addWorktree: (worktree: WorktreeInfo) => void;
  removeWorktree: (id: string) => void;

  // UI State
  toggleSidebar: () => void;
  toggleContextPanel: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setContextPanelOpen: (open: boolean) => void;

  // Gateway Events
  handleGatewayEvent: (event: GatewayEvent) => void;
}

const mockData = initializeMockData();

const initialState: Omit<DashboardState, keyof DashboardActions> = {
  connected: false,
  connecting: false,
  error: null,

  tracks: mockData.tracks,
  tasks: mockData.tasks,
  workers: mockData.workers,
  messages: mockData.messages,
  reviews: mockData.reviews,
  worktrees: [],

  selectedTrackId: mockData.selectedTrackId,
  selectedTaskId: null,
  selectedReviewId: null,

  sidebarCollapsed: false,
  contextPanelOpen: true,
};

export const useDashboardStore = create<DashboardState & DashboardActions>()(
  devtools(
    (set, get) => ({
      ...initialState,

      // Connection
      setConnected: (connected) => set({ connected }, false, 'setConnected'),
      setConnecting: (connecting) => set({ connecting }, false, 'setConnecting'),
      setError: (error) => set({ error }, false, 'setError'),

      // Tracks
      setTracks: (tracks) => set({ tracks }, false, 'setTracks'),
      addTrack: (track) =>
        set(
          (state) => ({ tracks: [...state.tracks, track] }),
          false,
          'addTrack'
        ),
      updateTrack: (id, updates) =>
        set(
          (state) => ({
            tracks: state.tracks.map((t) =>
              t.id === id ? { ...t, ...updates } : t
            ),
          }),
          false,
          'updateTrack'
        ),
      removeTrack: (id) =>
        set(
          (state) => ({
            tracks: state.tracks.filter((t) => t.id !== id),
            selectedTrackId:
              state.selectedTrackId === id ? null : state.selectedTrackId,
          }),
          false,
          'removeTrack'
        ),
      selectTrack: (id) => set({ selectedTrackId: id }, false, 'selectTrack'),

      // Tasks
      setTasks: (tasks) => set({ tasks }, false, 'setTasks'),
      addTask: (task) =>
        set(
          (state) => ({ tasks: [...state.tasks, task] }),
          false,
          'addTask'
        ),
      updateTask: (id, updates) =>
        set(
          (state) => ({
            tasks: state.tasks.map((t) =>
              t.id === id ? { ...t, ...updates } : t
            ),
          }),
          false,
          'updateTask'
        ),
      removeTask: (id) =>
        set(
          (state) => ({
            tasks: state.tasks.filter((t) => t.id !== id),
            selectedTaskId:
              state.selectedTaskId === id ? null : state.selectedTaskId,
          }),
          false,
          'removeTask'
        ),
      selectTask: (id) => set({ selectedTaskId: id }, false, 'selectTask'),

      // Workers
      setWorkers: (workers) => set({ workers }, false, 'setWorkers'),
      updateWorker: (id, updates) =>
        set(
          (state) => ({
            workers: state.workers.map((w) =>
              w.id === id ? { ...w, ...updates } : w
            ),
          }),
          false,
          'updateWorker'
        ),

      // Messages
      setMessages: (messages) => set({ messages }, false, 'setMessages'),
      addMessage: (message) =>
        set(
          (state) => ({ messages: [...state.messages, message] }),
          false,
          'addMessage'
        ),

      // Reviews
      setReviews: (reviews) => set({ reviews }, false, 'setReviews'),
      addReview: (review) =>
        set(
          (state) => ({ reviews: [...state.reviews, review] }),
          false,
          'addReview'
        ),
      updateReview: (id, updates) =>
        set(
          (state) => ({
            reviews: state.reviews.map((r) =>
              r.id === id ? { ...r, ...updates } : r
            ),
          }),
          false,
          'updateReview'
        ),
      selectReview: (id) => set({ selectedReviewId: id }, false, 'selectReview'),

      // Worktrees
      setWorktrees: (worktrees) => set({ worktrees }, false, 'setWorktrees'),
      addWorktree: (worktree) =>
        set(
          (state) => ({ worktrees: [...state.worktrees, worktree] }),
          false,
          'addWorktree'
        ),
      removeWorktree: (id) =>
        set(
          (state) => ({
            worktrees: state.worktrees.filter((w) => w.id !== id),
          }),
          false,
          'removeWorktree'
        ),

      // UI State
      toggleSidebar: () =>
        set(
          (state) => ({ sidebarCollapsed: !state.sidebarCollapsed }),
          false,
          'toggleSidebar'
        ),
      toggleContextPanel: () =>
        set(
          (state) => ({ contextPanelOpen: !state.contextPanelOpen }),
          false,
          'toggleContextPanel'
        ),
      setSidebarCollapsed: (collapsed) =>
        set({ sidebarCollapsed: collapsed }, false, 'setSidebarCollapsed'),
      setContextPanelOpen: (open) =>
        set({ contextPanelOpen: open }, false, 'setContextPanelOpen'),

      // Gateway Events Handler
      handleGatewayEvent: (event) => {
        const { type, payload } = event;

        switch (type) {
          case 'task.created': {
            const task = (event as TaskCreatedEvent).payload;
            get().addTask(task);
            break;
          }

          case 'task.queued': {
            const { taskId, position } = payload as { taskId: string; position: number };
            get().updateTask(taskId, { status: 'queued', queuePosition: position });
            break;
          }

          case 'task.started': {
            const { taskId } = (event as TaskStartedEvent).payload;
            get().updateTask(taskId, {
              status: 'running',
              startedAt: Date.now(),
              queuePosition: undefined,
            });
            break;
          }

          case 'task.completed': {
            const { taskId } = (event as TaskCompletedEvent).payload;
            get().updateTask(taskId, {
              status: 'complete',
              completedAt: Date.now(),
            });
            break;
          }

          case 'task.failed': {
            const { taskId } = payload as { taskId: string };
            get().updateTask(taskId, { status: 'failed' });
            break;
          }

          case 'task.review.ready': {
            const review = payload as ReviewQueueItem;
            get().addReview(review);
            get().updateTask(review.taskId, { status: 'review' });
            break;
          }

          case 'message': {
            const message = (event as MessageEvent).payload;
            get().addMessage(message);
            break;
          }

          case 'worker.status': {
            const { workerId, status, currentTask } = payload as {
              workerId: string;
              status: Worker['status'];
              currentTask?: string;
            };
            get().updateWorker(workerId, { status, currentTask });
            break;
          }

          default:
            break;
        }
      },
    }),
    { name: 'OpenClaw Dashboard' }
  )
);

// Selectors
export const selectCurrentTrack = (state: DashboardState) =>
  state.tracks.find((t) => t.id === state.selectedTrackId);

export const selectCurrentTask = (state: DashboardState) =>
  state.tasks.find((t) => t.id === state.selectedTaskId);

export const selectCurrentReview = (state: DashboardState) =>
  state.reviews.find((r) => r.id === state.selectedReviewId);

export const selectTasksByTrack = (state: DashboardState, trackId: string) =>
  state.tasks.filter((t) => t.trackId === trackId);

export const selectPendingReviews = (state: DashboardState) =>
  state.reviews.filter((r) => r.status === 'pending');

export const selectActiveWorkers = (state: DashboardState) =>
  state.workers.filter((w) => w.status === 'active');

export const selectMessagesForTrack = (state: DashboardState, trackId: string) =>
  state.messages.filter((m) => m.trackId === trackId);
