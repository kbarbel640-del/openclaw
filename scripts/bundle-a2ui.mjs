import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");

const HASH_FILE = path.join(ROOT_DIR, "src/canvas-host/a2ui/.bundle.hash");
const OUTPUT_FILE = path.join(ROOT_DIR, "src/canvas-host/a2ui/a2ui.bundle.js");
const A2UI_RENDERER_DIR = path.join(ROOT_DIR, "vendor/a2ui/renderers/lit");
const A2UI_APP_DIR = path.join(ROOT_DIR, "apps/shared/OpenClawKit/Tools/CanvasA2UI");

async function fileExists(p) {
    try {
        await fs.access(p);
        return true;
    } catch {
        return false;
    }
}

async function dirExists(p) {
    try {
        const st = await fs.stat(p);
        return st.isDirectory();
    } catch {
        return false;
    }
}

async function main() {
    // Check if directories exist (similar to bash script check)
    const rendererExists = await dirExists(A2UI_RENDERER_DIR);
    const appExists = await dirExists(A2UI_APP_DIR);

    if (!rendererExists || !appExists) {
        console.log("A2UI sources missing; keeping prebuilt bundle.");
        process.exit(0);
    }

    const INPUT_PATHS = [
        path.join(ROOT_DIR, "package.json"),
        path.join(ROOT_DIR, "pnpm-lock.yaml"),
        A2UI_RENDERER_DIR,
        A2UI_APP_DIR,
    ];

    const currentHash = await computeHash(INPUT_PATHS);

    // Check cache
    let previousHash = "";
    if (await fileExists(HASH_FILE)) {
        previousHash = (await fs.readFile(HASH_FILE, "utf-8")).trim();
    }

    const outputExists = await fileExists(OUTPUT_FILE);

    if (previousHash === currentHash && outputExists) {
        console.log("A2UI bundle up to date; skipping.");
        process.exit(0);
    }

    console.log("Building A2UI bundle...");

    // Run TSC
    const tscResult = spawnSync("pnpm", ["-s", "exec", "tsc", "-p", path.join(A2UI_RENDERER_DIR, "tsconfig.json")], {
        stdio: "inherit",
        shell: true, // Needed for pnpm on Windows
        cwd: ROOT_DIR,
    });
    if (tscResult.status !== 0) {
        console.error("TSC compilation failed.");
        process.exit(1);
    }

    // Run Rolldown
    // Fix: Windows relies on `npx` or local `node_modules/.bin/rolldown` typically, 
    // but `pnpm exec rolldown` is safer if installed in dependencies.
    // The bash script used `rolldown` directly which implies it's in PATH or recognized.
    // We'll use `pnpm exec rolldown` to be safe.
    const rolldownResult = spawnSync(
        "pnpm",
        ["exec", "rolldown", "-c", path.join(A2UI_APP_DIR, "rolldown.config.mjs")],
        {
            stdio: "inherit",
            shell: true,
            cwd: ROOT_DIR,
        }
    );
    if (rolldownResult.status !== 0) {
        console.error("Rolldown bundling failed.");
        process.exit(1);
    }

    // Update hash
    await fs.writeFile(HASH_FILE, currentHash, "utf-8");
    console.log("A2UI bundle complete.");
}

async function computeHash(inputs) {
    const files = [];

    async function walk(entryPath) {
        try {
            const st = await fs.stat(entryPath);
            if (st.isDirectory()) {
                const entries = await fs.readdir(entryPath);
                for (const entry of entries) {
                    // Skip common ignored files if needed, but the bash script didn't explicitly ignore .git etc inside specific input dirs
                    // Assuming input dirs are clean source dirs.
                    await walk(path.join(entryPath, entry));
                }
                return;
            }
            files.push(entryPath);
        } catch (e) {
            // ignore missing files if any
        }
    }

    for (const input of inputs) {
        await walk(input);
    }

    // Sort for determinism
    files.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())); // Normalize sort

    const hash = createHash("sha256");
    for (const filePath of files) {
        const rel = path.relative(ROOT_DIR, filePath).split(path.sep).join("/");
        hash.update(rel);
        hash.update("\0");
        const content = await fs.readFile(filePath);
        hash.update(content);
        hash.update("\0");
    }

    return hash.digest("hex");
}

main().catch((err) => {
    console.error("Unexpected error:", err);
    process.exit(1);
});
