import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveBundledSkillsDir } from "./bundled-dir.js";
import { parseFrontmatter, resolveOpenClawMetadata } from "./frontmatter.js";

describe("pr-review skill", () => {
  it("has valid frontmatter with required fields", async () => {
    const bundledDir = resolveBundledSkillsDir();
    const skillPath = path.join(bundledDir, "pr-review", "SKILL.md");

    const content = await fs.readFile(skillPath, "utf-8");
    const frontmatter = parseFrontmatter(content);

    expect(frontmatter.name).toBe("pr-review");
    expect(frontmatter.description).toBeDefined();
    expect(typeof frontmatter.description).toBe("string");
    expect(frontmatter.description.length).toBeGreaterThan(0);
  });

  it("has required gh CLI dependency in metadata", async () => {
    const bundledDir = resolveBundledSkillsDir();
    const skillPath = path.join(bundledDir, "pr-review", "SKILL.md");

    const content = await fs.readFile(skillPath, "utf-8");
    const frontmatter = parseFrontmatter(content);
    const metadata = resolveOpenClawMetadata(frontmatter);

    expect(metadata).toBeDefined();
    expect(metadata?.requires?.bins).toContain("gh");
  });

  it("includes install instructions for gh CLI", async () => {
    const bundledDir = resolveBundledSkillsDir();
    const skillPath = path.join(bundledDir, "pr-review", "SKILL.md");

    const content = await fs.readFile(skillPath, "utf-8");
    const frontmatter = parseFrontmatter(content);
    const metadata = resolveOpenClawMetadata(frontmatter);

    expect(metadata?.install).toBeDefined();
    expect(Array.isArray(metadata?.install)).toBe(true);

    const brewInstall = metadata?.install?.find((i) => i.id === "brew");
    expect(brewInstall).toBeDefined();
    expect(brewInstall?.formula).toBe("gh");
  });

  it("contains review workflow content", async () => {
    const bundledDir = resolveBundledSkillsDir();
    const skillPath = path.join(bundledDir, "pr-review", "SKILL.md");

    const content = await fs.readFile(skillPath, "utf-8");

    // Check for key sections
    expect(content).toContain("# PR Review Skill");
    expect(content).toContain("## Review Workflow");
    expect(content).toContain("gh pr view");
    expect(content).toContain("gh pr diff");
    expect(content).toContain("gh pr review");
  });

  it("includes review checklist", async () => {
    const bundledDir = resolveBundledSkillsDir();
    const skillPath = path.join(bundledDir, "pr-review", "SKILL.md");

    const content = await fs.readFile(skillPath, "utf-8");

    expect(content).toContain("## Review Checklist");
    expect(content).toContain("Code Quality");
    expect(content).toContain("Testing");
    expect(content).toContain("Security");
  });

  it("has proper emoji in metadata", async () => {
    const bundledDir = resolveBundledSkillsDir();
    const skillPath = path.join(bundledDir, "pr-review", "SKILL.md");

    const content = await fs.readFile(skillPath, "utf-8");
    const frontmatter = parseFrontmatter(content);
    const metadata = resolveOpenClawMetadata(frontmatter);

    expect(metadata?.emoji).toBe("🔍");
  });
});
