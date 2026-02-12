import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadGlobalRules, loadStrictRules, resetStrictRulesCache } from "./global-rules.js";

describe("loadStrictRules", () => {
  afterEach(() => {
    resetStrictRulesCache();
  });

  it("returns content when STRICT_RULES.md exists", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "strict-rules-"));
    try {
      await fs.writeFile(path.join(tmpDir, "STRICT_RULES.md"), "Do not share secrets.");
      const result = await loadStrictRules(tmpDir);
      expect(result).toBe("Do not share secrets.");
    } finally {
      await fs.rm(tmpDir, { recursive: true });
    }
  });

  it("strips front matter before returning content", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "strict-rules-"));
    try {
      await fs.writeFile(
        path.join(tmpDir, "STRICT_RULES.md"),
        "---\ntitle: Rules\n---\nDo not share secrets.",
      );
      const result = await loadStrictRules(tmpDir);
      expect(result).toBe("Do not share secrets.");
    } finally {
      await fs.rm(tmpDir, { recursive: true });
    }
  });

  it("returns undefined when file does not exist", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "strict-rules-"));
    try {
      const result = await loadStrictRules(tmpDir);
      expect(result).toBeUndefined();
    } finally {
      await fs.rm(tmpDir, { recursive: true });
    }
  });

  it("returns undefined when file is empty", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "strict-rules-"));
    try {
      await fs.writeFile(path.join(tmpDir, "STRICT_RULES.md"), "   \n  ");
      const result = await loadStrictRules(tmpDir);
      expect(result).toBeUndefined();
    } finally {
      await fs.rm(tmpDir, { recursive: true });
    }
  });

  it("caches result after first load", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "strict-rules-"));
    try {
      await fs.writeFile(path.join(tmpDir, "STRICT_RULES.md"), "Rule one.");
      const first = await loadStrictRules(tmpDir);
      expect(first).toBe("Rule one.");

      // Modify the file — cached value should persist
      await fs.writeFile(path.join(tmpDir, "STRICT_RULES.md"), "Rule two.");
      const second = await loadStrictRules(tmpDir);
      expect(second).toBe("Rule one.");
    } finally {
      await fs.rm(tmpDir, { recursive: true });
    }
  });
});

describe("loadGlobalRules", () => {
  it("returns content when RULES.md exists", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "global-rules-"));
    try {
      await fs.writeFile(path.join(tmpDir, "RULES.md"), "Always respond in Spanish.");
      const result = await loadGlobalRules(tmpDir);
      expect(result).toBe("Always respond in Spanish.");
    } finally {
      await fs.rm(tmpDir, { recursive: true });
    }
  });

  it("returns undefined when file does not exist", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "global-rules-"));
    try {
      const result = await loadGlobalRules(tmpDir);
      expect(result).toBeUndefined();
    } finally {
      await fs.rm(tmpDir, { recursive: true });
    }
  });

  it("returns undefined when file is empty", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "global-rules-"));
    try {
      await fs.writeFile(path.join(tmpDir, "RULES.md"), "  \n  ");
      const result = await loadGlobalRules(tmpDir);
      expect(result).toBeUndefined();
    } finally {
      await fs.rm(tmpDir, { recursive: true });
    }
  });

  it("trims whitespace from content", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "global-rules-"));
    try {
      await fs.writeFile(path.join(tmpDir, "RULES.md"), "\n  Some rule.\n\n");
      const result = await loadGlobalRules(tmpDir);
      expect(result).toBe("Some rule.");
    } finally {
      await fs.rm(tmpDir, { recursive: true });
    }
  });
});
