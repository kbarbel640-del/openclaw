import { Type } from "@sinclair/typebox";
import { NonEmptyString } from "../protocol/schema/primitives.js";

export const TodoPrioritySchema = Type.Union([
  Type.Literal("high"),
  Type.Literal("medium"),
  Type.Literal("low"),
]);

export const TodoStatusSchema = Type.Union([
  Type.Literal("pending"),
  Type.Literal("in_progress"),
  Type.Literal("completed"),
  Type.Literal("cancelled"),
]);

export const TodoSchema = Type.Object({
  id: NonEmptyString,
  content: Type.String(),
  status: TodoStatusSchema,
  priority: TodoPrioritySchema,
  createdAt: Type.Integer({ minimum: 0 }),
  updatedAt: Type.Integer({ minimum: 0 }),
  completedAt: Type.Optional(Type.Integer({ minimum: 0 })),
  sessionKey: NonEmptyString,
  subtasks: Type.Optional(Type.Array(NonEmptyString)),
  parentId: Type.Optional(NonEmptyString),
});

export const TodoCreateParamsSchema = Type.Object({
  content: Type.String({ minLength: 1 }),
  priority: Type.Optional(TodoPrioritySchema),
  sessionKey: NonEmptyString,
  parentId: Type.Optional(NonEmptyString),
});

export const TodoUpdateParamsSchema = Type.Object({
  id: NonEmptyString,
  status: Type.Optional(TodoStatusSchema),
  content: Type.Optional(Type.String({ minLength: 1 })),
  priority: Type.Optional(TodoPrioritySchema),
});

export const TodoListParamsSchema = Type.Object({
  sessionKey: Type.Optional(NonEmptyString),
  status: Type.Optional(TodoStatusSchema),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
});

export type Todo = Type.TypeOf<typeof TodoSchema>;
export type TodoPriority = Type.TypeOf<typeof TodoPrioritySchema>;
export type TodoStatus = Type.TypeOf<typeof TodoStatusSchema>;
