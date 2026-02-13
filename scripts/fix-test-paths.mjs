import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const SRC_DIR = path.join(ROOT_DIR, "src");

async function walk(dir) {
    let files = [];
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            files = files.concat(await walk(fullPath));
        } else if (entry.isFile() && entry.name.endsWith(".test.ts")) {
            files.push(fullPath);
        }
    }
    return files;
}

async function processFile(filePath) {
    let content = await fs.readFile(filePath, "utf-8");
    const originalContent = content;

    // Regex for "/tmp/..."
    // specific matching to avoid replacing things that aren't paths if possible, but /tmp/ is pretty specific.
    // We match "/tmp/something" and replace with tmp("something")

    let hasReplacements = false;

    // Pattern 1: Double quotes
    // Capture group 1 is the rest of the path
    const doubleQuoteRegex = /"\/tmp\/([^"]*)"/g;
    if (doubleQuoteRegex.test(content)) {
        content = content.replace(doubleQuoteRegex, 'tmp("$1")');
        hasReplacements = true;
    }

    // Pattern 2: Backticks (Template literals)
    // ` /tmp/${id} `
    const backtickRegex = /`\/tmp\/([^`]*)`/g;
    if (backtickRegex.test(content)) {
        content = content.replace(backtickRegex, 'tmp(`$1`)');
        hasReplacements = true;
    }

    if (!hasReplacements) {
        return;
    }

    // Inject imports and helper
    const importsToAdd = [];
    if (!content.includes('from "node:path"')) {
        importsToAdd.push('import path from "node:path";');
    }
    if (!content.includes('from "node:os"')) {
        importsToAdd.push('import os from "node:os";');
    }

    const helperCode = '\n// Helper for temp paths\nconst tmp = (p: string) => path.join(os.tmpdir(), p);\n';

    // Find the last import statement to insert after
    // If no imports, insert at top.
    // We prefer inserting after the last "import ... from ..." line.

    const lines = content.split("\n");
    let lastImportIdx = -1;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim().startsWith("import ")) {
            lastImportIdx = i;
        }
    }

    if (lastImportIdx !== -1) {
        // Insert imports if needed
        if (importsToAdd.length > 0) {
            lines.splice(lastImportIdx + 1, 0, ...importsToAdd);
            lastImportIdx += importsToAdd.length;
        }
        // Insert helper
        // Check if helper already exists logic is tricky, but we assume we are running once.
        // To be safe, we check if `const tmp = ` is already there.
        if (!content.includes("const tmp = ")) {
            lines.splice(lastImportIdx + 1, 0, helperCode);
        }
    } else {
        // No imports? prepend everything
        const preamble = importsToAdd.join("\n") + helperCode;
        lines.unshift(preamble);
    }

    content = lines.join("\n");

    if (content !== originalContent) {
        await fs.writeFile(filePath, content, "utf-8");
        console.log(`Fixed: ${path.relative(ROOT_DIR, filePath)}`);
    }
}

async function main() {
    console.log("Scanning for test files...");
    const files = await walk(SRC_DIR);
    console.log(`Found ${files.length} test files. Processing...`);

    for (const file of files) {
        await processFile(file);
    }
    console.log("Done.");
}

main().catch(console.error);
