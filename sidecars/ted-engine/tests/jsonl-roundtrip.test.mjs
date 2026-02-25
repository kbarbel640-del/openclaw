/**
 * QA-005 — JSONL Round-Trip Tests
 *
 * Verifies write/read integrity for JSONL ledger operations using
 * temp directories. Tests the fundamental serialization contract that
 * all Ted ledgers depend on.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import fc from "fast-check";
import { describe, test, expect, beforeEach, afterEach } from "vitest";

let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ted-test-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ─── Helper: mimics appendJsonlLine behavior ───
function appendJsonlLine(filePath, obj) {
  const record = { ...obj };
  if (typeof record._schema_version !== "number") {
    record._schema_version = 1;
  }
  fs.appendFileSync(filePath, JSON.stringify(record) + "\n", "utf8");
  return record;
}

// ─── Helper: mimics readJsonlLines behavior ───
function readJsonlLines(filePath) {
  if (!fs.existsSync(filePath)) {
    return [];
  }
  const content = fs.readFileSync(filePath, "utf8").trim();
  if (!content) {
    return [];
  }
  const lines = content.split("\n");
  const results = [];
  for (const line of lines) {
    try {
      results.push(JSON.parse(line));
    } catch {
      // skip corrupt lines
    }
  }
  return results;
}

// ─── Basic round-trip ───

describe("JSONL round-trip: basic write/read", () => {
  test("write a single object and read it back", () => {
    const filePath = path.join(tmpDir, "test.jsonl");
    const obj = { type: "deal", name: "Acme Corp", amount: 1500000 };
    appendJsonlLine(filePath, obj);

    const records = readJsonlLines(filePath);
    expect(records).toHaveLength(1);
    expect(records[0].type).toBe("deal");
    expect(records[0].name).toBe("Acme Corp");
    expect(records[0].amount).toBe(1500000);
  });

  test("write multiple records and read all back in order", () => {
    const filePath = path.join(tmpDir, "multi.jsonl");
    const objects = [
      { id: 1, event: "created" },
      { id: 2, event: "updated" },
      { id: 3, event: "deleted" },
    ];

    for (const obj of objects) {
      appendJsonlLine(filePath, obj);
    }

    const records = readJsonlLines(filePath);
    expect(records).toHaveLength(3);
    expect(records[0].id).toBe(1);
    expect(records[1].id).toBe(2);
    expect(records[2].id).toBe(3);
    expect(records[0].event).toBe("created");
    expect(records[1].event).toBe("updated");
    expect(records[2].event).toBe("deleted");
  });

  test("raw JSON.stringify + newline + JSON.parse round-trips", () => {
    const filePath = path.join(tmpDir, "raw.jsonl");
    const obj = { key: "value", nested: { a: 1, b: [2, 3] } };
    fs.appendFileSync(filePath, JSON.stringify(obj) + "\n", "utf8");

    const content = fs.readFileSync(filePath, "utf8").trim();
    const parsed = JSON.parse(content);
    expect(parsed).toEqual(obj);
  });
});

// ─── _schema_version injection ───

describe("JSONL round-trip: _schema_version injection", () => {
  test("object without _schema_version gets 1 injected", () => {
    const filePath = path.join(tmpDir, "version.jsonl");
    const obj = { name: "test" };
    appendJsonlLine(filePath, obj);

    const records = readJsonlLines(filePath);
    expect(records[0]._schema_version).toBe(1);
    expect(records[0].name).toBe("test");
  });

  test("object with existing _schema_version is preserved", () => {
    const filePath = path.join(tmpDir, "version2.jsonl");
    const obj = { name: "test", _schema_version: 2 };
    appendJsonlLine(filePath, obj);

    const records = readJsonlLines(filePath);
    expect(records[0]._schema_version).toBe(2);
  });

  test("_schema_version injection does not mutate original object", () => {
    const filePath = path.join(tmpDir, "nomutate.jsonl");
    const original = { name: "immutable" };
    appendJsonlLine(filePath, original);
    expect(original._schema_version).toBeUndefined();
  });
});

// ─── Edge cases ───

describe("JSONL round-trip: edge cases", () => {
  test("empty file returns empty array", () => {
    const filePath = path.join(tmpDir, "empty.jsonl");
    fs.writeFileSync(filePath, "", "utf8");

    const records = readJsonlLines(filePath);
    expect(records).toEqual([]);
  });

  test("non-existent file returns empty array", () => {
    const filePath = path.join(tmpDir, "does_not_exist.jsonl");
    const records = readJsonlLines(filePath);
    expect(records).toEqual([]);
  });

  test("file with one corrupt line — valid lines still parse", () => {
    const filePath = path.join(tmpDir, "corrupt.jsonl");
    fs.writeFileSync(
      filePath,
      [
        JSON.stringify({ id: 1, status: "ok" }),
        "THIS IS NOT VALID JSON {{{",
        JSON.stringify({ id: 2, status: "ok" }),
      ].join("\n") + "\n",
      "utf8",
    );

    const records = readJsonlLines(filePath);
    expect(records).toHaveLength(2);
    expect(records[0].id).toBe(1);
    expect(records[1].id).toBe(2);
  });

  test("file with all corrupt lines returns empty array", () => {
    const filePath = path.join(tmpDir, "allcorrupt.jsonl");
    fs.writeFileSync(filePath, "garbage\nnot json\n{broken\n", "utf8");

    const records = readJsonlLines(filePath);
    expect(records).toEqual([]);
  });

  test("handles records with special characters", () => {
    const filePath = path.join(tmpDir, "special.jsonl");
    const obj = {
      name: 'O\'Brien & "Partners"',
      note: "Line1\nLine2\tTabbed",
      emoji: "test",
      unicode: "\u00e9\u00e0\u00fc\u00f1",
    };
    appendJsonlLine(filePath, obj);

    const records = readJsonlLines(filePath);
    expect(records[0].name).toBe('O\'Brien & "Partners"');
    expect(records[0].note).toBe("Line1\nLine2\tTabbed");
  });
});

// ─── Concurrent appends ───

describe("JSONL round-trip: concurrent appends", () => {
  test("10 rapid sequential appends are all readable", () => {
    const filePath = path.join(tmpDir, "concurrent.jsonl");
    const records = [];

    for (let i = 0; i < 10; i++) {
      const obj = { index: i, timestamp: Date.now() };
      appendJsonlLine(filePath, obj);
      records.push(obj);
    }

    const readBack = readJsonlLines(filePath);
    expect(readBack).toHaveLength(10);

    for (let i = 0; i < 10; i++) {
      expect(readBack[i].index).toBe(i);
      expect(readBack[i]._schema_version).toBe(1);
    }
  });

  test("100 appends produce a file with 100 lines", () => {
    const filePath = path.join(tmpDir, "hundred.jsonl");

    for (let i = 0; i < 100; i++) {
      appendJsonlLine(filePath, { seq: i });
    }

    const readBack = readJsonlLines(filePath);
    expect(readBack).toHaveLength(100);
    expect(readBack[0].seq).toBe(0);
    expect(readBack[99].seq).toBe(99);
  });
});

// ─── Property-based: JSON round-trip ───

describe("JSONL round-trip: property-based", () => {
  test("any JSON-serializable object round-trips correctly via stringify+parse", () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.record({
            str: fc.string(),
            num: fc.integer(),
            bool: fc.boolean(),
          }),
          fc.record({
            arr: fc.array(fc.integer(), { maxLength: 5 }),
            nested: fc.record({ key: fc.string() }),
          }),
          fc.record({
            value: fc.oneof(fc.string(), fc.integer(), fc.constant(null), fc.boolean()),
          }),
        ),
        (obj) => {
          const line = JSON.stringify(obj);
          const parsed = JSON.parse(line);
          expect(parsed).toEqual(obj);
        },
      ),
    );
  });

  test("appendJsonlLine + readJsonlLines round-trips for arbitrary records", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.string({ minLength: 1, maxLength: 20 }),
            value: fc.integer(),
          }),
          { minLength: 1, maxLength: 10 },
        ),
        (records) => {
          const filePath = path.join(
            tmpDir,
            `prop-${Date.now()}-${Math.random().toString(36).slice(2)}.jsonl`,
          );

          for (const rec of records) {
            appendJsonlLine(filePath, rec);
          }

          const readBack = readJsonlLines(filePath);
          expect(readBack).toHaveLength(records.length);

          for (let i = 0; i < records.length; i++) {
            expect(readBack[i].id).toBe(records[i].id);
            expect(readBack[i].value).toBe(records[i].value);
            expect(readBack[i]._schema_version).toBe(1);
          }
        },
      ),
      { numRuns: 20 },
    );
  });

  test("_schema_version is always present after appendJsonlLine", () => {
    fc.assert(
      fc.property(fc.record({ name: fc.string(), count: fc.integer() }), (obj) => {
        const filePath = path.join(
          tmpDir,
          `sv-${Date.now()}-${Math.random().toString(36).slice(2)}.jsonl`,
        );
        appendJsonlLine(filePath, obj);
        const records = readJsonlLines(filePath);
        expect(records[0]._schema_version).toBe(1);
      }),
      { numRuns: 30 },
    );
  });
});
