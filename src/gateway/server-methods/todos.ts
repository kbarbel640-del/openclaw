import { ErrorCodes, errorShape } from "../protocol/index.js";
import type { GatewayRequestHandlers } from "./types.js";
import {
  handleTodosList,
  handleTodosCreate,
  handleTodosUpdate,
  handleTodosDelete,
} from "../todos/handlers.js";

export const todosHandlers: GatewayRequestHandlers = {
  "todos.list": async ({ params, respond }) => {
    try {
      const result = await handleTodosList({
        sessionKey: params.sessionKey as string | undefined,
        status: params.status as string | undefined,
        limit: params.limit as number | undefined,
      });
      respond(true, result);
    } catch (error) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(error)));
    }
  },

  "todos.create": async ({ params, respond }) => {
    try {
      if (!params.content || !params.sessionKey) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "content and sessionKey are required"),
        );
        return;
      }
      const result = await handleTodosCreate({
        content: params.content as string,
        sessionKey: params.sessionKey as string,
        priority: params.priority as "high" | "medium" | "low" | undefined,
        parentId: params.parentId as string | undefined,
      });
      respond(true, result);
    } catch (error) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(error)));
    }
  },

  "todos.update": async ({ params, respond }) => {
    try {
      if (!params.id) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "id is required"));
        return;
      }
      const result = await handleTodosUpdate({
        id: params.id as string,
        status: params.status as "pending" | "in_progress" | "completed" | "cancelled" | undefined,
        content: params.content as string | undefined,
        priority: params.priority as "high" | "medium" | "low" | undefined,
      });
      if (!result) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "todo not found"));
        return;
      }
      respond(true, result);
    } catch (error) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(error)));
    }
  },

  "todos.delete": async ({ params, respond }) => {
    try {
      if (!params.id) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "id is required"));
        return;
      }
      const result = await handleTodosDelete({
        id: params.id as string,
      });
      respond(true, { deleted: result });
    } catch (error) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(error)));
    }
  },
};
