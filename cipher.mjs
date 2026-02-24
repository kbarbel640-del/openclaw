#!/usr/bin/env node
/**
 * Shim so that `cipher "message"` runs openclaw cipher <message>.
 * Install adds both `openclaw` and `cipher` to PATH.
 */
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const openclawEntry = path.join(__dirname, "openclaw.mjs");

// Rewrite argv to: node openclaw.mjs cipher <...rest>
process.argv = [process.argv[0], openclawEntry, "cipher", ...process.argv.slice(2)];

await import(pathToFileURL(openclawEntry).href);
