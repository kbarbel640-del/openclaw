/**
 * Post-build fix: replace rolldown's `var __exportAll = (arrow fn)` with a
 * self-contained `function` declaration that is fully hoisted in ES modules.
 *
 * Background: rolldown may place `__exportAll` in one chunk and export it to
 * another.  When the two chunks form a circular import cycle, `var` bindings
 * are hoisted as `undefined` — causing a runtime TypeError.  A `function`
 * declaration is fully hoisted (name + body) and survives cyclic evaluation.
 *
 * The replacement also inlines `Object.defineProperty` instead of using the
 * `__defProp` alias (which is itself a `var` and suffers the same issue).
 */

import fs from "node:fs";
import path from "node:path";

const DIST = path.resolve(import.meta.dirname ?? ".", "../dist");

// The exact pattern emitted by rolldown's runtime helper.
const ORIGINAL = `var __exportAll = (all, no_symbols) => {
\tlet target = {};
\tfor (var name in all) {
\t\t__defProp(target, name, {
\t\t\tget: all[name],
\t\t\tenumerable: true
\t\t});
\t}
\tif (!no_symbols) {
\t\t__defProp(target, Symbol.toStringTag, { value: "Module" });
\t}
\treturn target;
};`;

// Self-contained function declaration: uses Object.defineProperty directly
// so it doesn't depend on any `var` aliases that may not be initialized yet.
const REPLACEMENT = `function __exportAll(all, no_symbols) {
\tlet target = {};
\tfor (var name in all) {
\t\tObject.defineProperty(target, name, {
\t\t\tget: all[name],
\t\t\tenumerable: true
\t\t});
\t}
\tif (!no_symbols) {
\t\tObject.defineProperty(target, Symbol.toStringTag, { value: "Module" });
\t}
\treturn target;
}`;

let patched = 0;

function walk(dir: string) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full);
      continue;
    }
    if (!entry.name.endsWith(".js")) {
      continue;
    }

    const src = fs.readFileSync(full, "utf8");
    if (!src.includes(ORIGINAL)) {
      continue;
    }

    const updated = src.replace(ORIGINAL, REPLACEMENT);
    if (updated !== src) {
      fs.writeFileSync(full, updated, "utf8");
      patched++;
    }
  }
}

walk(DIST);

if (patched > 0) {
  console.log(`[fix-export-all-hoisting] Patched ${patched} chunk(s)`);
}
