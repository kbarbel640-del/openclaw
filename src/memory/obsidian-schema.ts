/**
 * obsidian-schema.ts — SQLite schema for the Obsidian memory provider
 *
 * Rich FTS5 with per-field weighting (from local-rag), embedding cache (from OpenClaw native),
 * PARA-aware file metadata.
 */
import type { DatabaseSync } from "node:sqlite";

export interface ObsidianSchemaResult {
  ftsAvailable: boolean;
  ftsError?: string;
  vecAvailable: boolean;
  vecError?: string;
}

export function ensureObsidianSchema(params: {
  db: DatabaseSync;
  embeddingDims: number;
  vectorTable: string;
  ftsTable: string;
}): ObsidianSchemaResult {
  const { db, embeddingDims, vectorTable, ftsTable } = params;

  // Core metadata table
  db.exec(`
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // File tracking with PARA metadata
  db.exec(`
    CREATE TABLE IF NOT EXISTS files (
      path TEXT PRIMARY KEY,
      hash TEXT NOT NULL,
      mtime INTEGER NOT NULL,
      size INTEGER NOT NULL,
      title TEXT,
      filename TEXT,
      tags TEXT,
      aliases TEXT,
      headers TEXT,
      para_category TEXT,
      para_area TEXT,
      summary TEXT
    );
  `);

  // Chunks with embedding stored inline (for cache/skip logic)
  db.exec(`
    CREATE TABLE IF NOT EXISTS chunks (
      id TEXT PRIMARY KEY,
      path TEXT NOT NULL,
      start_line INTEGER NOT NULL,
      end_line INTEGER NOT NULL,
      hash TEXT NOT NULL,
      model TEXT NOT NULL,
      text TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_chunks_path ON chunks(path);
  `);

  // Embedding cache (reuse across re-indexes when content unchanged)
  db.exec(`
    CREATE TABLE IF NOT EXISTS embedding_cache (
      hash TEXT NOT NULL,
      model TEXT NOT NULL,
      embedding TEXT NOT NULL,
      dims INTEGER,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (hash, model)
    );
    CREATE INDEX IF NOT EXISTS idx_embedding_cache_updated_at ON embedding_cache(updated_at);
  `);

  // Vector table via sqlite-vec
  let vecAvailable = false;
  let vecError: string | undefined;
  try {
    db.exec(
      `CREATE VIRTUAL TABLE IF NOT EXISTS ${vectorTable} USING vec0(
        id TEXT PRIMARY KEY,
        embedding FLOAT[${embeddingDims}]
      );`,
    );
    vecAvailable = true;
  } catch (err) {
    vecError = err instanceof Error ? err.message : String(err);
  }

  // Rich FTS5 table with per-field weighting support
  // Fields ordered for bm25() weight parameters:
  // bm25(fts, 0, filename_w, title_w, tags_w, aliases_w, para_area_w, headers_w, summary_w, content_w)
  let ftsAvailable = false;
  let ftsError: string | undefined;
  try {
    db.exec(
      `CREATE VIRTUAL TABLE IF NOT EXISTS ${ftsTable} USING fts5(
        path UNINDEXED,
        filename,
        title,
        tags,
        aliases,
        para_area,
        headers,
        summary,
        text,
        tokenize='porter unicode61'
      );`,
    );
    ftsAvailable = true;
  } catch (err) {
    ftsError = err instanceof Error ? err.message : String(err);
  }

  return { ftsAvailable, ftsError, vecAvailable, vecError };
}

/**
 * BM25 field weights for FTS5 queries.
 * Higher weight = more important for ranking.
 */
export const DEFAULT_FTS_WEIGHTS = {
  filename: 10,
  title: 8,
  tags: 5,
  aliases: 8,
  para_area: 4,
  headers: 3,
  summary: 3,
  text: 1,
} as const;

export type FtsWeights = typeof DEFAULT_FTS_WEIGHTS;
