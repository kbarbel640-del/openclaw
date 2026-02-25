import fs from "node:fs";
import path from "node:path";

/**
 * Common locations where Lightroom Classic stores catalogs on macOS.
 */
const CATALOG_SEARCH_PATHS = [
  "~/Pictures/Lightroom",
  "~/Pictures/Lightroom Catalog",
  "~/Pictures",
  "~/Documents/Lightroom",
  "~/Documents",
  "~/Desktop",
];

const LRCAT_EXTENSION = ".lrcat";

export interface DiscoveredCatalog {
  path: string;
  name: string;
  sizeBytes: number;
  lastModified: Date;
}

/**
 * Auto-discover Lightroom Classic catalog files on this Mac.
 *
 * Searches common locations and returns all found catalogs
 * sorted by most recently modified (the active catalog is usually the newest).
 */
export function discoverCatalogs(maxDepth = 3): DiscoveredCatalog[] {
  const home = process.env.HOME ?? "";
  const catalogs: DiscoveredCatalog[] = [];

  for (const searchPath of CATALOG_SEARCH_PATHS) {
    const resolved = searchPath.replace(/^~/, home);
    if (!fs.existsSync(resolved)) {
      continue;
    }

    findLrcatFiles(resolved, maxDepth, catalogs);
  }

  // Also check Lightroom's preferences for the last-used catalog
  const prefsCatalog = findFromLightroomPrefs();
  if (prefsCatalog && !catalogs.some((c) => c.path === prefsCatalog.path)) {
    catalogs.push(prefsCatalog);
  }

  catalogs.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());
  return catalogs;
}

/**
 * Get the most likely active catalog (most recently modified).
 */
export function discoverActiveCatalog(): DiscoveredCatalog | null {
  const catalogs = discoverCatalogs();
  return catalogs.length > 0 ? catalogs[0] : null;
}

function findLrcatFiles(dir: string, depth: number, results: DiscoveredCatalog[]): void {
  if (depth <= 0) {
    return;
  }

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isFile() && entry.name.endsWith(LRCAT_EXTENSION)) {
      // Skip lock files and previews
      if (entry.name.includes("-wal") || entry.name.includes("-shm")) {
        continue;
      }
      if (entry.name.includes("Previews")) {
        continue;
      }
      if (entry.name.includes("Helper")) {
        continue;
      }

      try {
        const stat = fs.statSync(fullPath);
        results.push({
          path: fullPath,
          name: entry.name.replace(LRCAT_EXTENSION, ""),
          sizeBytes: stat.size,
          lastModified: stat.mtime,
        });
      } catch {
        continue;
      }
    }

    if (entry.isDirectory()) {
      // Skip known non-catalog directories
      if (entry.name.startsWith(".")) {
        continue;
      }
      if (entry.name === "node_modules") {
        continue;
      }
      if (entry.name.endsWith("Previews.lrdata")) {
        continue;
      }
      if (entry.name.endsWith("Smart Previews.lrdata")) {
        continue;
      }

      findLrcatFiles(fullPath, depth - 1, results);
    }
  }
}

/**
 * Try to find the last-used catalog from Lightroom's preferences plist.
 */
function findFromLightroomPrefs(): DiscoveredCatalog | null {
  const home = process.env.HOME ?? "";
  const prefsPath = path.join(home, "Library/Preferences/com.adobe.LightroomClassicCC7.plist");

  if (!fs.existsSync(prefsPath)) {
    return null;
  }

  try {
    // Read the plist as XML (macOS defaults can convert)
    const { execSync } = require("node:child_process") as typeof import("node:child_process");
    const xml = execSync(`defaults read com.adobe.LightroomClassicCC7 recentCatalogs 2>/dev/null`, {
      encoding: "utf-8",
      timeout: 5000,
    });

    // Extract paths from the plist output
    const pathMatch = /"([^"]+\.lrcat)"/i.exec(xml);
    if (pathMatch) {
      const catalogPath = pathMatch[1];
      if (fs.existsSync(catalogPath)) {
        const stat = fs.statSync(catalogPath);
        return {
          path: catalogPath,
          name: path.basename(catalogPath, LRCAT_EXTENSION),
          sizeBytes: stat.size,
          lastModified: stat.mtime,
        };
      }
    }
  } catch {
    // Prefs not readable or Lightroom not installed
  }

  return null;
}
