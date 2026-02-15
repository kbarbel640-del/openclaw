import type { Elysia } from "elysia";

export type BrowserRequest = {
  params: Record<string, string>;
  query: Record<string, unknown>;
  body?: unknown;
};

export type BrowserResponse = {
  status: (code: number) => BrowserResponse;
  json: (body: unknown) => void;
};

export type BrowserRouteHandler = (
  req: BrowserRequest,
  res: BrowserResponse,
) => void | Promise<void>;

export type BrowserRouteRegistrar = {
  get: (path: string, handler: BrowserRouteHandler) => void;
  post: (path: string, handler: BrowserRouteHandler) => void;
  delete: (path: string, handler: BrowserRouteHandler) => void;
};

/**
 * Creates a BrowserRouteRegistrar adapter on top of an Elysia instance.
 * This allows route files to remain unchanged while using Elysia as the underlying framework.
 */
export function createBrowserRouteAdapter(app: Elysia): BrowserRouteRegistrar {
  const createHandler =
    (method: "get" | "post" | "delete") => (path: string, handler: BrowserRouteHandler) => {
      const elysiaHandler = async (context: {
        params: Record<string, string>;
        query: Record<string, unknown>;
        body?: unknown;
        set: { status: number };
      }) => {
        let responseBody: unknown;
        let statusCode = 200;
        const res: BrowserResponse = {
          status(code) {
            statusCode = code;
            return res;
          },
          json(data) {
            responseBody = data;
          },
        };
        const req: BrowserRequest = {
          params: context.params,
          query: context.query,
          body: context.body,
        };
        await handler(req, res);
        context.set.status = statusCode;
        return responseBody;
      };

      if (method === "get") {
        app.get(path, elysiaHandler as Parameters<Elysia["get"]>[1]);
      } else if (method === "post") {
        app.post(path, elysiaHandler as Parameters<Elysia["post"]>[1]);
      } else if (method === "delete") {
        app.delete(path, elysiaHandler as Parameters<Elysia["delete"]>[1]);
      }
    };

  return {
    get: createHandler("get"),
    post: createHandler("post"),
    delete: createHandler("delete"),
  };
}
