import type { Track, TaskDefinition, Worker, Message, ReviewQueueItem } from '../types';

export const mockTracks: Track[] = [
  {
    id: 'track-1',
    name: 'Dark Mode Toggle',
    description: 'Add dark mode support to the application',
    status: 'active',
    createdAt: Date.now() - 86400000,
    updatedAt: Date.now() - 3600000,
    taskCount: 3,
    completedTaskCount: 1,
  },
  {
    id: 'track-2',
    name: 'API Integration',
    description: 'Connect to the OpenClaw gateway API',
    status: 'pending',
    createdAt: Date.now() - 172800000,
    updatedAt: Date.now() - 86400000,
    taskCount: 2,
    completedTaskCount: 0,
  },
  {
    id: 'track-3',
    name: 'Dashboard Polish',
    description: 'UI improvements and bug fixes',
    status: 'idle',
    createdAt: Date.now() - 259200000,
    updatedAt: Date.now() - 172800000,
    taskCount: 0,
    completedTaskCount: 0,
  },
];

export const mockTasks: TaskDefinition[] = [
  {
    id: 'task-1',
    trackId: 'track-1',
    title: 'Create theme context',
    description: 'Set up React context for theme state management',
    workerType: 'worker-code',
    requiresReview: false,
    maxRetries: 2,
    timeoutMinutes: 30,
    status: 'complete',
    createdAt: Date.now() - 7200000,
    startedAt: Date.now() - 7000000,
    completedAt: Date.now() - 6000000,
  },
  {
    id: 'task-2',
    trackId: 'track-1',
    title: 'Build toggle component',
    description: 'Create the UI toggle for dark/light mode',
    workerType: 'worker-code',
    requiresReview: true,
    maxRetries: 2,
    timeoutMinutes: 30,
    status: 'running',
    createdAt: Date.now() - 6000000,
    startedAt: Date.now() - 3000000,
  },
  {
    id: 'task-3',
    trackId: 'track-1',
    title: 'Persist to localStorage',
    description: 'Save theme preference across sessions',
    workerType: 'worker-code',
    requiresReview: false,
    maxRetries: 2,
    timeoutMinutes: 20,
    status: 'pending',
    createdAt: Date.now() - 3000000,
  },
  {
    id: 'task-4',
    trackId: 'track-2',
    title: 'Set up WebSocket connection',
    description: 'Connect to OpenClaw gateway',
    workerType: 'worker-code',
    requiresReview: true,
    maxRetries: 3,
    timeoutMinutes: 45,
    status: 'queued',
    createdAt: Date.now() - 1800000,
    queuePosition: 1,
  },
];

export const mockWorkers: Worker[] = [
  {
    id: 'worker-1',
    name: 'Code Worker 1',
    type: 'worker-code',
    status: 'active',
    currentTask: 'task-2',
    taskDescription: 'Building toggle component...',
    worktreePath: '/workspace/.worktrees/task-2',
    startedAt: Date.now() - 3000000,
  },
  {
    id: 'worker-2',
    name: 'Code Worker 2',
    type: 'worker-code',
    status: 'idle',
  },
  {
    id: 'worker-3',
    name: 'Research Worker',
    type: 'worker-research',
    status: 'idle',
  },
];

export const mockMessages: Message[] = [
  {
    id: 'msg-1',
    sender: 'user',
    senderName: 'You',
    content: 'Can you add a dark mode toggle to the settings page?',
    timestamp: Date.now() - 7200000,
  },
  {
    id: 'msg-2',
    sender: 'lead',
    senderName: 'Lead Agent',
    content:
      "I'll break this down into subtasks and delegate to workers. Here's my plan:\n\n1. Create theme context and provider\n2. Add toggle component to settings\n3. Persist preference to localStorage",
    timestamp: Date.now() - 7100000,
    trackId: 'track-1',
  },
  {
    id: 'msg-3',
    sender: 'worker',
    senderName: 'Code Worker 1',
    content:
      'Created ThemeContext with useTheme hook. The provider wraps the app and exposes toggle function.',
    timestamp: Date.now() - 6000000,
    trackId: 'track-1',
    taskId: 'task-1',
  },
  {
    id: 'msg-4',
    sender: 'lead',
    senderName: 'Lead Agent',
    content:
      'Task 1 is complete. Starting task 2: Building the toggle component with accessibility support.',
    timestamp: Date.now() - 3000000,
    trackId: 'track-1',
  },
  {
    id: 'msg-5',
    sender: 'worker',
    senderName: 'Code Worker 1',
    content: 'Working on the toggle component. Adding keyboard navigation and ARIA labels.',
    timestamp: Date.now() - 60000,
    trackId: 'track-1',
    taskId: 'task-2',
  },
];

export const mockReviews: ReviewQueueItem[] = [
  {
    id: 'review-1',
    taskId: 'task-2',
    trackId: 'track-1',
    title: 'Toggle Component Implementation',
    description:
      'Added ThemeToggle component with full accessibility support including keyboard navigation, focus management, and ARIA labels.',
    status: 'pending',
    diffStats: {
      filesChanged: 3,
      additions: 145,
      deletions: 12,
    },
    createdAt: Date.now() - 60000,
    comments: [],
  },
  {
    id: 'review-2',
    taskId: 'task-1',
    trackId: 'track-1',
    title: 'Theme Context Setup',
    description:
      'Created ThemeContext with useTheme hook for managing dark/light mode state across the application.',
    status: 'approved',
    diffStats: {
      filesChanged: 2,
      additions: 89,
      deletions: 0,
    },
    createdAt: Date.now() - 6000000,
    reviewedAt: Date.now() - 3000000,
    reviewedBy: 'user',
    comments: [
      {
        id: 'comment-1',
        author: 'You',
        content: 'Looks good! Clean implementation.',
        createdAt: Date.now() - 3000000,
      },
    ],
  },
];

// Initialize store with mock data
export function initializeMockData() {
  // This will be called when the app loads
  return {
    tracks: mockTracks,
    tasks: mockTasks,
    workers: mockWorkers,
    messages: mockMessages,
    reviews: mockReviews,
    selectedTrackId: 'track-1',
  };
}
