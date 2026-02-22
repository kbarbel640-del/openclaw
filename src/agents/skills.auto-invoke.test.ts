import { describe, expect, it } from "vitest";
import {
  resolveAutoInvokedSkillNames,
  resolveAutoInvokeSkillFilter,
  type SkillEntry,
} from "./skills.js";

function makeEntry(params: {
  name: string;
  triggers?: string;
  keywords?: string;
  connectsTo?: string;
}): SkillEntry {
  return {
    skill: {
      name: params.name,
      description: params.name,
      source: "test",
      filePath: `/tmp/${params.name}/SKILL.md`,
      baseDir: `/tmp/${params.name}`,
      disableModelInvocation: false,
    },
    frontmatter: {
      ...(params.triggers ? { triggers: params.triggers } : {}),
      ...(params.keywords ? { keywords: params.keywords } : {}),
      ...(params.connectsTo ? { connects_to: params.connectsTo } : {}),
    },
  };
}

describe("resolveAutoInvokedSkillNames", () => {
  it("scores trigger phrases higher than keywords", () => {
    const entries = [
      makeEntry({ name: "market-watch", triggers: "check market", keywords: "prices,crypto" }),
      makeEntry({ name: "crypto-news", keywords: "market,crypto" }),
    ];

    const matches = resolveAutoInvokedSkillNames({
      message: "please check market status",
      entries,
    });

    expect(matches).toEqual(["market-watch"]);
  });

  it("supports keyword and connects_to matching", () => {
    const entries = [
      makeEntry({ name: "x-post", keywords: "post,x", connectsTo: "twitter" }),
      makeEntry({ name: "cron-manager", keywords: "cron" }),
    ];

    const matches = resolveAutoInvokedSkillNames({
      message: "post this to x and twitter",
      entries,
    });

    expect(matches).toEqual(["x-post"]);
  });

  it("can be disabled by config", () => {
    const entries = [makeEntry({ name: "x-post", keywords: "post,x" })];
    const matches = resolveAutoInvokedSkillNames({
      message: "post to x",
      entries,
      config: { skills: { autoInvoke: { enabled: false } } },
    });
    expect(matches).toEqual([]);
  });
});

describe("resolveAutoInvokeSkillFilter", () => {
  it("preserves explicit filters", () => {
    const entries = [makeEntry({ name: "x-post", keywords: "post" })];
    const filter = resolveAutoInvokeSkillFilter({
      message: "post to x",
      entries,
      baseSkillFilter: ["manual-only"],
    });
    expect(filter).toEqual(["manual-only"]);
  });
});
