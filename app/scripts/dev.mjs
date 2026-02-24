import { execSync, spawn } from "node:child_process";
import electron from "electron";
import { createServer } from "vite";

console.log("\n  THE LAB ® / DEPARTMENT OF VIBE");
console.log("  SOPHIE / DEV SERVER / STARTING\n");

execSync(
  "npx esbuild src/main/index.ts --bundle --platform=node --outfile=out/main/index.cjs --external:electron --format=cjs --sourcemap",
  { stdio: "inherit" },
);
execSync(
  "npx esbuild src/preload/index.ts --bundle --platform=node --outfile=out/preload/index.cjs --external:electron --format=cjs --sourcemap",
  { stdio: "inherit" },
);

console.log("  MAIN PROCESS / BUILT");

const server = await createServer({ configFile: "vite.config.ts" });
await server.listen();

const address = server.resolvedUrls?.local?.[0] ?? "http://localhost:5173";
console.log(`  RENDERER / ${address}`);
console.log("  STATUS: LAUNCHING ELECTRON\n");

const proc = spawn(/** @type {string} */ (electron), ["."], {
  stdio: "inherit",
  env: { ...process.env, VITE_DEV_SERVER_URL: address },
});

proc.on("close", (code) => {
  console.log(`\n  SOPHIE / SHUTDOWN / EXIT ${code}\n`);
  void server.close();
  process.exit(code ?? 0);
});

process.on("SIGINT", () => {
  proc.kill();
  void server.close();
  process.exit(0);
});
