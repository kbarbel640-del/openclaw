import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { applyMergePatch } from "./merge-patch.js";

describe("applyMergePatch", () => {
  it("merges plain objects", () => {
    const base = { a: 1, b: 2 };
    const patch = { b: 3, c: 4 };
    const result = applyMergePatch(base, patch);
    assert.deepEqual(result, { a: 1, b: 3, c: 4 });
  });

  it("removes fields when patch value is null", () => {
    const base = { a: 1, b: 2, c: 3 };
    const patch = { b: null };
    const result = applyMergePatch(base, patch);
    assert.deepEqual(result, { a: 1, c: 3 });
  });

  it("recursively merges nested objects", () => {
    const base = { a: { x: 1, y: 2 }, b: 3 };
    const patch = { a: { y: 20, z: 30 } };
    const result = applyMergePatch(base, patch);
    assert.deepEqual(result, { a: { x: 1, y: 20, z: 30 }, b: 3 });
  });

  it("replaces non-object base with patch object", () => {
    const base = { a: "string" };
    const patch = { a: { x: 1 } };
    const result = applyMergePatch(base, patch);
    assert.deepEqual(result, { a: { x: 1 } });
  });

  describe("array merge by key for agents.list", () => {
    it("merges agent entries by id, preserving unpatched fields", () => {
      const base = {
        agents: {
          list: [
            {
              id: "atlas",
              name: "Atlas",
              workspace: "~/atlas",
              identity: "leader.md",
              model: { provider: "anthropic", model: "claude-3-5-sonnet" },
            },
            {
              id: "blake",
              name: "Blake",
              workspace: "~/blake",
              identity: "backend.md",
              model: { provider: "anthropic", model: "claude-3-5-sonnet" },
            },
          ],
        },
      };

      const patch = {
        agents: {
          list: [
            {
              id: "atlas",
              model: { provider: "anthropic", model: "claude-4-opus" },
            },
          ],
        },
      };

      const result = applyMergePatch(base, patch);

      assert.deepEqual(result, {
        agents: {
          list: [
            {
              id: "atlas",
              name: "Atlas",
              workspace: "~/atlas",
              identity: "leader.md",
              model: { provider: "anthropic", model: "claude-4-opus" },
            },
            {
              id: "blake",
              name: "Blake",
              workspace: "~/blake",
              identity: "backend.md",
              model: { provider: "anthropic", model: "claude-3-5-sonnet" },
            },
          ],
        },
      });
    });

    it("adds new agent entries when id does not exist", () => {
      const base = {
        agents: {
          list: [{ id: "atlas", name: "Atlas" }],
        },
      };

      const patch = {
        agents: {
          list: [{ id: "morgan", name: "Morgan", workspace: "~/morgan" }],
        },
      };

      const result = applyMergePatch(base, patch);

      assert.equal((result as any).agents.list.length, 2);
      assert.deepEqual((result as any).agents.list[0], { id: "atlas", name: "Atlas" });
      assert.deepEqual((result as any).agents.list[1], {
        id: "morgan",
        name: "Morgan",
        workspace: "~/morgan",
      });
    });

    it("merges multiple agents in one patch", () => {
      const base = {
        agents: {
          list: [
            { id: "atlas", name: "Atlas", role: "leader" },
            { id: "blake", name: "Blake", role: "backend" },
          ],
        },
      };

      const patch = {
        agents: {
          list: [
            { id: "atlas", role: "coordinator" },
            { id: "morgan", name: "Morgan", role: "architect" },
          ],
        },
      };

      const result = applyMergePatch(base, patch);

      const list = (result as any).agents.list;
      assert.equal(list.length, 3);
      assert.deepEqual(list[0], { id: "atlas", name: "Atlas", role: "coordinator" });
      assert.deepEqual(list[1], { id: "blake", name: "Blake", role: "backend" });
      assert.deepEqual(list[2], { id: "morgan", name: "Morgan", role: "architect" });
    });

    it("deep merges nested objects in agent entries", () => {
      const base = {
        agents: {
          list: [
            {
              id: "atlas",
              permissions: {
                tools: { allow: ["read", "write"] },
                channels: ["discord"],
              },
            },
          ],
        },
      };

      const patch = {
        agents: {
          list: [
            {
              id: "atlas",
              permissions: {
                tools: { allow: ["read", "write", "exec"] },
              },
            },
          ],
        },
      };

      const result = applyMergePatch(base, patch);

      const agent = (result as any).agents.list[0];
      assert.deepEqual(agent.permissions, {
        tools: { allow: ["read", "write", "exec"] },
        channels: ["discord"],
      });
    });

    it("handles empty base array", () => {
      const base = {
        agents: {
          list: [],
        },
      };

      const patch = {
        agents: {
          list: [{ id: "atlas", name: "Atlas" }],
        },
      };

      const result = applyMergePatch(base, patch);

      assert.equal((result as any).agents.list.length, 1);
      assert.deepEqual((result as any).agents.list[0], { id: "atlas", name: "Atlas" });
    });

    it("handles missing base array (non-array value)", () => {
      const base = {
        agents: {},
      };

      const patch = {
        agents: {
          list: [{ id: "atlas", name: "Atlas" }],
        },
      };

      const result = applyMergePatch(base, patch);

      // When base is not an array, replace with patch
      assert.equal((result as any).agents.list.length, 1);
      assert.deepEqual((result as any).agents.list[0], { id: "atlas", name: "Atlas" });
    });
  });

  describe("regular arrays (non-agents.list) are still replaced", () => {
    it("replaces regular arrays completely", () => {
      const base = {
        someArray: [1, 2, 3],
        nested: {
          items: ["a", "b", "c"],
        },
      };

      const patch = {
        someArray: [4, 5],
        nested: {
          items: ["x"],
        },
      };

      const result = applyMergePatch(base, patch);

      assert.deepEqual(result, {
        someArray: [4, 5],
        nested: {
          items: ["x"],
        },
      });
    });
  });
});
