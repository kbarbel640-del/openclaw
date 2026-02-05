const fs = require("fs");
const path = require("path");

const REPO_ROOT = path.resolve(__dirname, "..");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function rmDir(dir) {
  if (!fs.existsSync(dir)) return;
  fs.rmSync(dir, { recursive: true, force: true });
}

function normalizePosix(p) {
  return p.split(path.sep).join("/");
}

function isUnder(child, parent) {
  const rel = path.relative(parent, child);
  return !!rel && !rel.startsWith("..") && !path.isAbsolute(rel);
}

function listFilesRec(dir) {
  const out = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...listFilesRec(p));
    else if (ent.isFile()) out.push(p);
  }
  return out;
}

function globToRegex(glob) {
  // Supports "*" within a single segment and "**" for any depth.
  const norm = normalizePosix(glob);
  const parts = norm.split("/").filter((p) => p.length > 0);
  const out = [];

  for (const part of parts) {
    if (part === "**") {
      // any number of path segments
      out.push("(?:.*)");
      continue;
    }
    // Escape regex special chars, then expand "*" wildcards within segment.
    const esc = part.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*");
    out.push(esc);
  }

  const re = out.join("\\/");
  return new RegExp(`^${re}$`);
}

function matchesAnyGlobs(relPath, globs) {
  const p = normalizePosix(relPath);
  for (const g of globs || []) {
    const re = globToRegex(g);
    if (re.test(p)) return true;
  }
  return false;
}

function copyFile(srcAbs, destAbs) {
  ensureDir(path.dirname(destAbs));
  fs.copyFileSync(srcAbs, destAbs);
}

function copyEntry(spec, outDirAbs) {
  const copied = [];

  // Directory glob
  if (spec.includes("*")) {
    const all = listFilesRec(REPO_ROOT);
    const includeRe = globToRegex(spec);
    for (const abs of all) {
      const rel = normalizePosix(path.relative(REPO_ROOT, abs));
      if (!includeRe.test(rel)) continue;
      const destAbs = path.join(outDirAbs, rel);
      copyFile(abs, destAbs);
      copied.push(rel);
    }
    return copied;
  }

  const srcAbs = path.join(REPO_ROOT, spec);
  if (!fs.existsSync(srcAbs)) return [];

  const st = fs.statSync(srcAbs);
  if (st.isFile()) {
    const rel = normalizePosix(spec);
    copyFile(srcAbs, path.join(outDirAbs, rel));
    copied.push(rel);
    return copied;
  }
  if (st.isDirectory()) {
    const files = listFilesRec(srcAbs);
    for (const abs of files) {
      const rel = normalizePosix(path.relative(REPO_ROOT, abs));
      copyFile(abs, path.join(outDirAbs, rel));
      copied.push(rel);
    }
  }
  return copied;
}

function applyRewrite(outDirAbs, rewrite) {
  const rules = rewrite || {};
  for (const [relFile, cfg] of Object.entries(rules)) {
    const target = path.join(outDirAbs, relFile);
    if (!fs.existsSync(target)) continue;
    let content = fs.readFileSync(target, "utf8");
    const reps = (cfg && cfg.replace) || [];
    for (const r of reps) {
      const from = String(r.from || "");
      const to = String(r.to || "");
      if (!from) continue;
      content = content.split(from).join(to);
    }
    fs.writeFileSync(target, content, "utf8");
  }
}

function rewritePackageJson(outDirAbs) {
  const p = path.join(outDirAbs, "package.json");
  if (!fs.existsSync(p)) return;
  try {
    const pkg = JSON.parse(fs.readFileSync(p, "utf8"));
    pkg.scripts = {
      start: "node index.js",
      run: "node index.js run",
    };
    fs.writeFileSync(p, JSON.stringify(pkg, null, 2) + "\n", "utf8");
  } catch (e) {
    // ignore
  }
}

function pruneExcluded(outDirAbs, excludeGlobs) {
  const all = listFilesRec(outDirAbs);
  for (const abs of all) {
    const rel = normalizePosix(path.relative(outDirAbs, abs));
    if (matchesAnyGlobs(rel, excludeGlobs)) {
      fs.rmSync(abs, { force: true });
    }
  }
}

function validateNoPrivatePaths(outDirAbs) {
  // Basic safeguard: forbid docs/ and memory/ in output.
  const forbiddenPrefixes = ["docs/", "memory/"];
  const all = listFilesRec(outDirAbs);
  for (const abs of all) {
    const rel = normalizePosix(path.relative(outDirAbs, abs));
    for (const pref of forbiddenPrefixes) {
      if (rel.startsWith(pref)) {
        throw new Error(`Build validation failed: forbidden path in output: ${rel}`);
      }
    }
  }
}

function main() {
  const manifestPath = path.join(REPO_ROOT, "public.manifest.json");
  const manifest = readJson(manifestPath);
  const outDir = String(manifest.outDir || "dist-public");
  const outDirAbs = path.join(REPO_ROOT, outDir);

  rmDir(outDirAbs);
  ensureDir(outDirAbs);

  const include = manifest.include || [];
  const exclude = manifest.exclude || [];

  const copied = [];
  for (const spec of include) {
    copied.push(...copyEntry(spec, outDirAbs));
  }

  pruneExcluded(outDirAbs, exclude);
  applyRewrite(outDirAbs, manifest.rewrite);
  rewritePackageJson(outDirAbs);
  validateNoPrivatePaths(outDirAbs);

  // Write build manifest for private verification (do not include in dist-public/).
  const buildInfo = {
    built_at: new Date().toISOString(),
    outDir,
    files: copied.sort(),
  };
  const privateDir = path.join(REPO_ROOT, "memory");
  ensureDir(privateDir);
  fs.writeFileSync(
    path.join(privateDir, "public_build_info.json"),
    JSON.stringify(buildInfo, null, 2) + "\n",
    "utf8",
  );

  process.stdout.write(`Built public output at ${outDir}\n`);
}

try {
  main();
} catch (e) {
  process.stderr.write(`${e.message}\n`);
  process.exit(1);
}
