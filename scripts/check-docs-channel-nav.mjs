#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function collectDocPages(value, out = new Set()) {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectDocPages(item, out);
    }
    return out;
  }
  if (!value || typeof value !== "object") {
    return out;
  }
  if (Array.isArray(value.pages)) {
    for (const page of value.pages) {
      if (typeof page === "string") {
        out.add(page);
      }
    }
  }
  for (const nested of Object.values(value)) {
    collectDocPages(nested, out);
  }
  return out;
}

function listChannelDocPages(channelsDir) {
  const entries = fs.readdirSync(channelsDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => `channels/${entry.name.replace(/\.md$/u, "")}`)
    .toSorted();
}

export function findMissingChannelNavEntries(config, channelDocPages) {
  const configuredPages = collectDocPages(config);
  return channelDocPages.filter((page) => !configuredPages.has(page));
}

export async function main() {
  const docsJsonPath = path.join(repoRoot, "docs", "docs.json");
  const channelsDir = path.join(repoRoot, "docs", "channels");

  if (!fs.existsSync(docsJsonPath) || !fs.existsSync(channelsDir)) {
    console.error("docs:check-channel-nav: run from repository root with docs/ present.");
    process.exit(1);
  }

  const config = readJson(docsJsonPath);
  const channelDocPages = listChannelDocPages(channelsDir);
  const missing = findMissingChannelNavEntries(config, channelDocPages);

  if (missing.length === 0) {
    console.log(`docs:check-channel-nav: ok (${channelDocPages.length} channel docs mapped)`);
    return;
  }

  console.error("docs:check-channel-nav: missing docs/docs.json navigation entries:");
  for (const page of missing) {
    console.error(`- ${page}`);
  }
  process.exit(1);
}

const isDirectExecution = (() => {
  const entry = process.argv[1];
  if (!entry) {
    return false;
  }
  return path.resolve(entry) === fileURLToPath(import.meta.url);
})();

if (isDirectExecution) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
