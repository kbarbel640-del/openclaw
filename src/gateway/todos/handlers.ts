import { randomUUID } from "node:crypto";
import { todoStore } from "./store.js";
import type { Todo } from "./types.js";

export async function handleTodosList(params: {
  sessionKey?: string;
  status?: string;
  limit?: number;
}): Promise<Todo[]> {
  let todos: Todo[];

  if (params.sessionKey) {
    todos = await todoStore.findBySession(params.sessionKey);
  } else if (params.status) {
    todos = await todoStore.findByStatus(params.status);
  } else {
    todos = await todoStore.load();
  }

  if (params.status) {
    todos = todos.filter((t) => t.status === params.status);
  }

  const priorityOrder = { high: 0, medium: 1, low: 2 };
  todos = todos.toSorted((a, b) => {
    const priDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (priDiff !== 0) {
      return priDiff;
    }
    return b.createdAt - a.createdAt;
  });

  if (params.limit) {
    todos = todos.slice(0, params.limit);
  }

  return todos;
}

export async function handleTodosCreate(params: {
  content: string;
  priority?: "high" | "medium" | "low";
  sessionKey: string;
  parentId?: string;
}): Promise<Todo> {
  const now = Date.now();
  const todo: Todo = {
    id: randomUUID(),
    content: params.content,
    status: "pending",
    priority: params.priority || "medium",
    createdAt: now,
    updatedAt: now,
    sessionKey: params.sessionKey,
    parentId: params.parentId,
  };

  return await todoStore.create(todo);
}

export async function handleTodosUpdate(params: {
  id: string;
  status?: "pending" | "in_progress" | "completed" | "cancelled";
  content?: string;
  priority?: "high" | "medium" | "low";
}): Promise<Todo | null> {
  const updates: Partial<Todo> = {};

  if (params.status) {
    updates.status = params.status;
    if (params.status === "completed") {
      updates.completedAt = Date.now();
    }
  }
  if (params.content) {
    updates.content = params.content;
  }
  if (params.priority) {
    updates.priority = params.priority;
  }

  return await todoStore.update(params.id, updates);
}

export async function handleTodosDelete(params: { id: string }): Promise<boolean> {
  return await todoStore.delete(params.id);
}

export function parseTodosFromPrompt(prompt: string): string[] {
  const patterns = [
    /^(?:\d+[.)]\s+)(.+)$/m,
    /^todo:\s*(.+)$/im,
    /^- \[ \]\s*(.+)$/m,
    /^[-*]\s+(.+)$/m,
  ];

  const todos: string[] = [];
  const lines = prompt.split("\n");

  for (const line of lines) {
    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match) {
        todos.push(match[1].trim());
        break;
      }
    }
  }

  return todos;
}
