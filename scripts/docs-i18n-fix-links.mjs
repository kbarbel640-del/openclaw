#!/usr/bin/env node

/**
 * Post-processing script for i18n docs: rewrites internal links in locale
 * directories to include the locale prefix.
 *
 * Example: in docs/zh-CN/install/index.md, a link like [Docker](/install/docker)
 * becomes [Docker](/zh-CN/install/docker) when docs/zh-CN/install/docker.md exists.
 *
 * Usage:
 *   node scripts/docs-i18n-fix-links.mjs            # fix all locales (zh-CN, ja-JP)
 *   node scripts/docs-i18n-fix-links.mjs --lang zh-CN
 *   node scripts/docs-i18n-fix-links.mjs --dry-run   # preview changes only
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const DOCS_DIR = path.join(ROOT, "docs");

// Locale directories that need link rewriting.
const LOCALE_DIRS = ["zh-CN", "ja-JP"];

// Paths that should NOT be prefixed (static assets, API routes, etc.).
const SKIP_PREFIXES = ["/assets/", "/images/", "/favicons/", "/api/", "/_"];

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { dryRun: false, lang: null, verbose: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--dry-run") {
      opts.dryRun = true;
    } else if (args[i] === "--verbose" || args[i] === "-v") {
      opts.verbose = true;
    } else if (args[i] === "--lang" && args[i + 1]) {
      opts.lang = args[++i];
    }
  }
  return opts;
}

/** Recursively collect markdown files. */
function walk(dir) {
  const out = [];
  if (!fs.existsSync(dir)) {
    return out;
  }
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) {
      continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(full));
    } else if (/\.(md|mdx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

/** Build a set of known page routes for a locale (e.g. /zh-CN/install/docker). */
function buildLocaleRoutes(locale) {
  const localeDir = path.join(DOCS_DIR, locale);
  const files = walk(localeDir);
  const routes = new Set();
  for (const file of files) {
    // Convert file path to route: docs/zh-CN/install/docker.md -> /zh-CN/install/docker
    let route = "/" + path.relative(DOCS_DIR, file).replace(/\\/g, "/");
    // Strip .md/.mdx extension
    route = route.replace(/\.(md|mdx)$/, "");
    // Strip /index suffix (index.md -> parent route)
    route = route.replace(/\/index$/, "");
    if (!route) {
      route = `/${locale}`;
    }
    routes.add(route);
  }
  return routes;
}

/** Check if a path should be skipped (assets, already prefixed, etc.). */
function shouldSkip(linkPath, locale) {
  // Already has locale prefix
  if (linkPath.startsWith(`/${locale}/`) || linkPath === `/${locale}`) {
    return true;
  }
  // Skip other locale prefixes
  for (const loc of LOCALE_DIRS) {
    if (linkPath.startsWith(`/${loc}/`) || linkPath === `/${loc}`) {
      return true;
    }
  }
  // Skip assets and special paths
  for (const prefix of SKIP_PREFIXES) {
    if (linkPath.startsWith(prefix)) {
      return true;
    }
  }
  // Skip external (shouldn't happen with our regex, but guard)
  if (linkPath.startsWith("//") || linkPath.startsWith("http")) {
    return true;
  }
  return false;
}

/**
 * Rewrite links in a markdown file.
 * Returns { content, count } where count is the number of rewrites.
 */
function rewriteLinks(content, locale, routes) {
  let count = 0;

  // Pattern 1: Markdown links [text](/path) and [text](/path#anchor)
  const mdLinkRe = /\]\(\/([^)]*)\)/g;
  content = content.replace(mdLinkRe, (match, pathAndAnchor) => {
    const linkPath = "/" + pathAndAnchor.split("#")[0].split("?")[0];

    if (shouldSkip(linkPath, locale)) {
      return match;
    }

    const candidate = `/${locale}${linkPath}`;
    // Also check without trailing slash
    const clean = candidate.replace(/\/$/, "") || `/${locale}`;
    if (routes.has(clean) || routes.has(candidate)) {
      count++;
      return `](/${locale}/${pathAndAnchor})`.replace(`/${locale}//`, `/${locale}/`);
    }
    return match;
  });

  // Pattern 2: href="/path" (JSX-style in MDX)
  const hrefRe = /href="(\/[^"]*)"/g;
  content = content.replace(hrefRe, (match, hrefPath) => {
    const linkPath = hrefPath.split("#")[0].split("?")[0];
    if (shouldSkip(linkPath, locale)) {
      return match;
    }

    const candidate = `/${locale}${linkPath}`;
    const clean = candidate.replace(/\/$/, "") || `/${locale}`;
    if (routes.has(clean) || routes.has(candidate)) {
      count++;
      return `href="/${locale}${hrefPath}"`;
    }
    return match;
  });

  return { content, count };
}

function main() {
  const opts = parseArgs();
  const locales = opts.lang ? [opts.lang] : LOCALE_DIRS;

  let totalFiles = 0;
  let totalRewrites = 0;
  let modifiedFiles = 0;

  for (const locale of locales) {
    const localeDir = path.join(DOCS_DIR, locale);
    if (!fs.existsSync(localeDir)) {
      console.log(`skip ${locale}: directory not found`);
      continue;
    }

    const routes = buildLocaleRoutes(locale);
    const files = walk(localeDir);

    if (opts.verbose) {
      console.log(`${locale}: ${files.length} files, ${routes.size} known routes`);
    }

    for (const file of files) {
      totalFiles++;
      const original = fs.readFileSync(file, "utf8");
      const { content, count } = rewriteLinks(original, locale, routes);

      if (count === 0) {
        continue;
      }

      modifiedFiles++;
      totalRewrites += count;
      const rel = path.relative(ROOT, file);

      if (opts.dryRun || opts.verbose) {
        console.log(`  ${rel}: ${count} link(s) rewritten`);
      }

      if (!opts.dryRun) {
        fs.writeFileSync(file, content, "utf8");
      }
    }
  }

  const mode = opts.dryRun ? "(dry-run) " : "";
  console.log(
    `${mode}docs-i18n-fix-links: files=${totalFiles} modified=${modifiedFiles} rewrites=${totalRewrites}`,
  );
}

main();
