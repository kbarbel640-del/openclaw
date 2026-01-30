import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { LocalReceiptStore } from "../src/stores/local.js";

const PORT = 18789;
const store = new LocalReceiptStore();

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(res: ServerResponse, status: number, data: unknown) {
  res.writeHead(status, { "Content-Type": "application/json", ...CORS_HEADERS });
  res.end(JSON.stringify(data));
}

function parseQuery(url: string): Record<string, string> {
  const idx = url.indexOf("?");
  if (idx === -1) return {};
  return Object.fromEntries(new URLSearchParams(url.slice(idx + 1)).entries());
}

function pathname(url: string): string {
  const idx = url.indexOf("?");
  return idx === -1 ? url : url.slice(0, idx);
}

const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return;
  }

  const path = pathname(req.url ?? "");
  const query = parseQuery(req.url ?? "");

  try {
    if (path === "/boltbot/receipts") {
      const limit = Math.min(Math.max(parseInt(query.limit ?? "50", 10) || 50, 1), 500);
      const offset = Math.max(parseInt(query.offset ?? "0", 10) || 0, 0);
      const receipts = await store.list({ limit, offset });
      json(res, 200, { receipts });
    } else if (path === "/boltbot/receipt") {
      const id = query.id;
      if (!id) return json(res, 400, { error: "missing_id" });
      const receipt = await store.get(id);
      if (!receipt) return json(res, 404, { error: "not_found" });
      json(res, 200, { receipt });
    } else if (path === "/boltbot/stats") {
      const stats = await store.stats();
      json(res, 200, stats);
    } else {
      json(res, 404, { error: "not_found" });
    }
  } catch (err) {
    console.error("Request error:", err);
    json(res, 500, { error: "internal_error" });
  }
});

server.listen(PORT, () => {
  console.log(`boltbot dev server: http://localhost:${PORT}`);
});
