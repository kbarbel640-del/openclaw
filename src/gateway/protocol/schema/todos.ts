import { Type } from "@sinclair/typebox";
import { NonEmptyString } from "./primitives.js";

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

export const TodoListParamsSchema = Type.Object({
  sessionKey: Type.Optional(NonEmptyString),
  status: Type.Optional(TodoStatusSchema),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
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

export const TodoDeleteParamsSchema = Type.Object({
  id: NonEmptyString,
});
