/**
 * Twitter HTTP endpoint for dashboard data
 * GET /api/twitter/dashboard
 * GET /api/twitter/relationships
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import { getTwitterDashboardData, getTwitterRelationships } from "./twitter-api.js";

export async function handleTwitterHttpRequest(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<boolean> {
  const url = new URL(req.url || "", `http://${req.headers.host}`);

  // GET /api/twitter/dashboard
  if (req.method === "GET" && url.pathname === "/api/twitter/dashboard") {
    try {
      const data = await getTwitterDashboardData();

      res.writeHead(200, {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=900", // 15min cache
      });
      res.end(JSON.stringify(data, null, 2));
      return true;
    } catch (error) {
      const err = error as { message?: string };
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error: "Failed to fetch Twitter data",
          message: err.message ?? String(error),
        }),
      );
      return true;
    }
  }

  // GET /api/twitter/relationships
  if (req.method === "GET" && url.pathname === "/api/twitter/relationships") {
    try {
      const limit = Number.parseInt(url.searchParams.get("limit") || "50");
      const data = await getTwitterRelationships(limit);

      res.writeHead(200, {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=1800", // 30min cache
      });
      res.end(JSON.stringify(data, null, 2));
      return true;
    } catch (error) {
      const err = error as { message?: string };
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error: "Failed to fetch Twitter relationships",
          message: err.message ?? String(error),
        }),
      );
      return true;
    }
  }

  return false; // Not handled
}
