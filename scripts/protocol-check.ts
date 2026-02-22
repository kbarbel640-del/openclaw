import { spawnSync } from "node:child_process";

const generatedArtifacts = [
  "dist/protocol.schema.json",
  "apps/macos/Sources/OpenClawProtocol/GatewayModels.swift",
  "apps/shared/OpenClawKit/Sources/OpenClawProtocol/GatewayModels.swift",
];

function run(command: string, args: string[]) {
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run("pnpm", ["protocol:gen"]);
run("pnpm", ["protocol:gen:swift"]);

const diff = spawnSync("git", ["diff", "--exit-code", "--", ...generatedArtifacts], {
  stdio: "inherit",
});

if (diff.status !== 0) {
  console.error(
    "\nGenerated protocol artifacts are out of sync. Run `pnpm protocol:gen && pnpm protocol:gen:swift` and commit the results.",
  );
  process.exit(diff.status ?? 1);
}
