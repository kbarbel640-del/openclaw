# CLI Loading Bottlenecks

## Build-time penalties
- `scripts/run-node.mjs` always runs a TypeScript build whenever `dist/.buildstamp` is stale or missing, which is the case on a clean checkout. That build shell-spawns `pnpm exec tsgo --project tsconfig.json`, requiring `pnpm` to be installed and adding significant delay before any CLI logic runs. Without pnpm the command even fails (`ENOENT`).
- The runner scans every file under `src/` (minus tests) to determine the newest modification time, so even “no-change” runs still pay a filesystem traversal cost before invoking `pnpm`.

## Subcommand registration overhead
- `registerSubCliCommands` creates placeholders for every subcommand but recomputes their registration lazily by dynamically importing each CLI module (e.g., `nodes-cli`, `gateway-cli`, `plugins-cli`) when invoked. Heavy modules like the plugin registry still run disk/config I/O during registration (e.g., `loadConfig()`) even before the user’s command executes, which can block the CLI.
- There is no shared caching of `loadConfig()` or plugin registry initialization, so running multiple subcommands within one session repeats this work.

## Global command registry loading
- `registerProgramCommands` iterates over `commandRegistry` and imports/registers every command file (`agents.js`, `status.js`, `memory-cli`, etc.) before Commander can pick a route. Even short commands (like `--help`) must load all these modules, so startup time always includes the cost of importing the entire CLI tree.

## Recommendations
1. Ship a fresh `dist/` bundle (or skip the build step) to avoid the repeated pnpm/tsgo invocation and filesystem scan. Alternatively, allow using `bunx tsgo` or a bundled compiler so the runner succeeds without relying on a globally-installed pnpm.
2. Cache `loadConfig()` and the plugin registry where possible so lazy subcommand registration no longer re-reads disk state for each invocation.
3. Defer heavy command registrar imports further (similar to subcommand lazy-loading) so the “core” CLI (help/status) only loads a minimal set of modules.

These changes should drastically reduce CLI startup latency and avoid the `pnpm ENOENT` failure when pnpm isn’t available.

## Action Plan
1. **Benchmark baseline load time (first step)** – capture the current CLI startup latency across representative commands (`openclaw help`, `openclaw status`, a plugin-heavy command). Use `/usr/bin/time -l` (macOS) or `time` to record wall-clock and maximum RSS while running `pnpm openclaw <command>` from a clean state (`rm -rf dist && pnpm tsc && pnpm build` if needed). Store timestamps and system info (node version, pnpm version, disk, CPU) in `docs/analysis/cli-bottlenecks/benchmarks.md` so future comparisons have context.
2. **Optimize build-time penalties** – keep the `dist/` bundle current in CI releases so local runs never rebuild unless source files change; explore bundling tsgo with Bun or shipping a ready-to-run compiler binary so `scripts/run-node.mjs` skips the `pnpm exec tsgo` invocation. Introduce caching of the `src/` scan (store last-known mtime in `dist/.buildstamp`) to avoid repeated filesystem traversal.
3. **Streamline subcommand registration** – add shared caching for `loadConfig()` and plugin discovery results, and ensure lazy registration only triggers once per session. Move disk-heavy initialization behind explicit `--warmup` or `--config-cache` flags as needed so incidental commands (e.g., `--help`) do not read plugins.
4. **Reduce global registry imports** – split the command registry into a “core” entrypoint and optional modules that only load when their namespace is requested. Start by deferring imports for the heaviest modules (`providers`, `agents`, `media`) and use a lightweight dispatcher to load them asynchronously after first paint.
5. **Test and validate improvements** – after each change, rerun the baseline benchmark (step 1) to ensure measurable wall-clock reductions. Add automated regression coverage using a simple shell script (`scripts/benchmark-cli-load.sh`) that runs the three representative commands and records timing; run it in CI after `pnpm test` and compare against stored golden values. Document results in the benchmark file and note any deviations.
6. **Iterate on instrumentation** – if the benchmark reveals other hotspots, add tracing/logging around the slow phases (build, config loads, module imports) so the next iteration has precise targets.
