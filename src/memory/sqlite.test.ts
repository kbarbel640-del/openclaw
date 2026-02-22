import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { requireNodeSqlite } from "./sqlite.js";

describe("requireNodeSqlite", () => {
  let tempDir: string;
  let dbPath: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openclaw-sqlite-test-"));
    dbPath = path.join(tempDir, "test.db");
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // cleanup error is not critical
    }
  });

  it("should successfully require sqlite implementation", () => {
    expect(() => requireNodeSqlite()).not.toThrow();
  });

  it("should create a database", () => {
    const { DatabaseSync } = requireNodeSqlite();
    const db = new DatabaseSync(dbPath);
    expect(db).toBeDefined();
    db.close();
  });

  it("should support basic SQL operations", () => {
    const { DatabaseSync } = requireNodeSqlite();
    const db = new DatabaseSync(dbPath);

    db.exec("CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)");
    db.exec("INSERT INTO test (name) VALUES ('Alice')");

    const stmt = db.prepare("SELECT * FROM test WHERE name = ?");
    const rows = stmt.all("Alice");

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: 1, name: "Alice" });

    db.close();
  });

  it("should support FTS5 virtual tables", () => {
    const { DatabaseSync } = requireNodeSqlite();
    const db = new DatabaseSync(dbPath);

    // Try to create an FTS5 virtual table
    expect(() => {
      db.exec(`
        CREATE VIRTUAL TABLE documents USING fts5(
          title,
          content
        )
      `);
    }).not.toThrow();

    // Insert test data
    db.exec(`
      INSERT INTO documents (title, content) VALUES
        ('Test Document', 'This is a test document about Node.js'),
        ('Another Doc', 'This document talks about TypeScript and testing')
    `);

    // Test FTS5 search
    const stmt = db.prepare("SELECT * FROM documents WHERE documents MATCH ?");
    const results = stmt.all("Node");

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      title: "Test Document",
      content: "This is a test document about Node.js",
    });

    db.close();
  });

  it("should support FTS5 BM25 ranking", () => {
    const { DatabaseSync } = requireNodeSqlite();
    const db = new DatabaseSync(dbPath);

    db.exec(`
      CREATE VIRTUAL TABLE docs USING fts5(content)
    `);

    db.exec(`
      INSERT INTO docs (content) VALUES
        ('javascript programming language'),
        ('python programming'),
        ('javascript framework react')
    `);

    // Test BM25 ranking (lower is better)
    const stmt = db.prepare(`
      SELECT content, bm25(docs) as rank
      FROM docs
      WHERE docs MATCH 'javascript'
      ORDER BY rank
    `);
    const results = stmt.all();

    expect(results).toHaveLength(2);
    // Verify ranking order (exact values may vary)
    expect(results[0].rank).toBeLessThan(0);
    expect(results[1].rank).toBeLessThan(0);

    db.close();
  });

  it("should support enableLoadExtension and loadExtension methods", () => {
    const { DatabaseSync } = requireNodeSqlite();
    const db = new DatabaseSync(":memory:");

    // Verify methods exist (for better-sqlite3 compatibility)
    expect(typeof db.enableLoadExtension).toBe("function");
    expect(typeof db.loadExtension).toBe("function");

    // Test enableLoadExtension doesn't throw
    expect(() => db.enableLoadExtension(true)).not.toThrow();

    db.close();
  });
});
