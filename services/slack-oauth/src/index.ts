import "dotenv/config";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { loadEnv } from "./env.js";
import { health } from "./routes/health.js";
import { createInstallRoute } from "./routes/install.js";
import { createCallbackRoute } from "./routes/callback.js";

const env = await loadEnv();

const app = new Hono();

app.route("/", health);
app.route("/", createInstallRoute(env));
app.route("/", createCallbackRoute(env));

console.log(`slack-oauth service listening on port ${env.PORT}`);

serve({ fetch: app.fetch, port: env.PORT });
