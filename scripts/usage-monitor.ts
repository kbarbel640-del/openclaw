#!/usr/bin/env tsx

import { collectUsageSummary } from "../src/infra/usage-monitor.js";

type Args = {
  sessionsDir?: string;
  tier?: string;
};

function parseArgs(argv: string[]): Args {
  const args: Args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--sessions-dir" && argv[i + 1]) {
      args.sessionsDir = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--tier" && argv[i + 1]) {
      args.tier = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--help") {
      const help = [
        "Usage: tsx scripts/usage-monitor.ts [options]",
        "",
        "Options:",
        "  --sessions-dir <dir>  Override session transcripts directory",
        "  --tier <tier>          Anthropic tier for daily limit estimates",
        "  --help                 Show this help",
      ];
      console.log(help.join("\n"));
      process.exit(0);
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const summary = await collectUsageSummary({
    sessionsDir: args.sessionsDir,
    tier: args.tier,
  });
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error(String(err));
  process.exit(1);
});
