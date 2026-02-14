/**
 * obsidian-search.ts — Hybrid search with RRF for the Obsidian memory provider
 *
 * Ports the search pipeline from local-rag:
 * - sqlite-vec KNN for vector search
 * - FTS5 BM25 with per-field weighting
 * - Reciprocal Rank Fusion (RRF)
 * - Entity shortcut (exact filename/alias match)
 */
import type { DatabaseSync } from "node:sqlite";
import type { FtsWeights } from "./obsidian-schema.js";
import { DEFAULT_FTS_WEIGHTS } from "./obsidian-schema.js";

export interface ObsidianVectorResult {
  id: string;
  path: string;
  distance: number;
  text: string;
  startLine: number;
  endLine: number;
}

export interface ObsidianKeywordResult {
  path: string;
  bm25Score: number;
}

export interface ObsidianRRFResult {
  path: string;
  rrfScore: number;
  vecRank: number;
  ftsRank: number;
  bestChunk: ObsidianVectorResult | null;
}

export interface ObsidianSearchOptions {
  maxResults?: number;
  minScore?: number;
  vectorLimit?: number;
  ftsLimit?: number;
  rrfK?: number;
  ftsWeights?: Partial<FtsWeights>;
}

const MISSING_RANK = 999;
const DEFAULT_RRF_K = 60;
const DEFAULT_VECTOR_LIMIT = 50;
const DEFAULT_FTS_LIMIT = 50;
const DEFAULT_MAX_RESULTS = 8;
const DEFAULT_MIN_SCORE = 0;

/**
 * Entity shortcut: exact filename or alias match returns file path instantly.
 * Skips embedding entirely for navigational queries.
 */
export function entityShortcut(db: DatabaseSync, query: string): string | null {
  const queryLower = query.toLowerCase().trim();
  if (!queryLower) {
    return null;
  }

  // Check exact filename match
  const byFilename = db
    .prepare("SELECT path FROM files WHERE LOWER(filename) = ?")
    .get(queryLower) as { path: string } | undefined;
  if (byFilename) {
    return byFilename.path;
  }

  // Check alias match (aliases stored as JSON array)
  const allFiles = db
    .prepare("SELECT path, aliases FROM files WHERE aliases IS NOT NULL AND aliases != '[]'")
    .all() as Array<{ path: string; aliases: string }>;

  for (const row of allFiles) {
    try {
      const aliases: string[] = JSON.parse(row.aliases);
      if (aliases.some((a) => a.toLowerCase() === queryLower)) {
        return row.path;
      }
    } catch {
      // skip malformed JSON
    }
  }

  return null;
}

/**
 * Vector search via sqlite-vec KNN.
 */
export function vectorSearch(
  db: DatabaseSync,
  queryEmbedding: Float32Array,
  vectorTable: string,
  limit: number = DEFAULT_VECTOR_LIMIT,
): ObsidianVectorResult[] {
  const results: ObsidianVectorResult[] = [];

  try {
    const rows = db
      .prepare(
        `SELECT id, distance FROM ${vectorTable} WHERE embedding MATCH ? ORDER BY distance LIMIT ?`,
      )
      .all(Buffer.from(queryEmbedding.buffer), limit) as Array<{
      id: string;
      distance: number;
    }>;

    for (const row of rows) {
      const chunk = db
        .prepare("SELECT path, text, start_line, end_line FROM chunks WHERE id = ?")
        .get(row.id) as
        | { path: string; text: string; start_line: number; end_line: number }
        | undefined;

      if (chunk) {
        results.push({
          id: row.id,
          path: chunk.path,
          distance: row.distance,
          text: chunk.text,
          startLine: chunk.start_line,
          endLine: chunk.end_line,
        });
      }
    }
  } catch {
    // sqlite-vec not available — return empty, fall back to FTS5 only
  }

  return results;
}

/**
 * Keyword search via FTS5 with per-field BM25 weighting.
 */
export function keywordSearch(
  db: DatabaseSync,
  query: string,
  ftsTable: string,
  limit: number = DEFAULT_FTS_LIMIT,
  weights: Partial<FtsWeights> = {},
): ObsidianKeywordResult[] {
  const w = { ...DEFAULT_FTS_WEIGHTS, ...weights };

  // Build FTS5 query from terms
  const terms = query
    .replace(/['"]/g, "")
    .split(/\s+/)
    .filter((t) => t.length > 1);
  if (terms.length === 0) {
    return [];
  }

  const ftsQuery = terms.map((t) => `"${t}"`).join(" OR ");

  try {
    return db
      .prepare(
        `SELECT path,
                bm25(${ftsTable}, 0, ${w.filename}, ${w.title}, ${w.tags}, ${w.aliases}, ${w.para_area}, ${w.headers}, ${w.summary}, ${w.text}) AS bm25_score
         FROM ${ftsTable}
         WHERE ${ftsTable} MATCH ?
         ORDER BY bm25_score
         LIMIT ?`,
      )
      .all(ftsQuery, limit) as ObsidianKeywordResult[];
  } catch {
    return [];
  }
}

/**
 * Reciprocal Rank Fusion — merges vector and keyword results by rank.
 * Immune to score-scale mismatches between different ranking methods.
 *
 * RRF_score = 1/(k + rank_vec) + 1/(k + rank_fts)
 */
export function reciprocalRankFusion(
  vecResults: ObsidianVectorResult[],
  ftsResults: ObsidianKeywordResult[],
  k: number = DEFAULT_RRF_K,
): ObsidianRRFResult[] {
  // Deduplicate vec results: keep best (lowest distance) per file
  const vecByFile = new Map<string, ObsidianVectorResult>();
  for (const r of vecResults) {
    const existing = vecByFile.get(r.path);
    if (!existing || r.distance < existing.distance) {
      vecByFile.set(r.path, r);
    }
  }

  // Assign ranks (1-based)
  const vecRanked = [...vecByFile.entries()]
    .toSorted((a, b) => a[1].distance - b[1].distance)
    .map(([fp], i) => ({ path: fp, rank: i + 1 }));

  const ftsRanked = ftsResults.map((r, i) => ({ path: r.path, rank: i + 1 }));

  const vecRankMap = new Map(vecRanked.map((r) => [r.path, r.rank]));
  const ftsRankMap = new Map(ftsRanked.map((r) => [r.path, r.rank]));

  const allPaths = new Set([...vecRankMap.keys(), ...ftsRankMap.keys()]);
  const results: ObsidianRRFResult[] = [];

  for (const fp of allPaths) {
    const vr = vecRankMap.get(fp) || MISSING_RANK;
    const fr = ftsRankMap.get(fp) || MISSING_RANK;
    const rrfScore = 1 / (k + vr) + 1 / (k + fr);

    results.push({
      path: fp,
      rrfScore,
      vecRank: vr,
      ftsRank: fr,
      bestChunk: vecByFile.get(fp) || null,
    });
  }

  return results.toSorted((a, b) => b.rrfScore - a.rrfScore);
}

/**
 * Full hybrid search pipeline.
 */
export function hybridSearch(params: {
  db: DatabaseSync;
  queryEmbedding: Float32Array;
  queryText: string;
  vectorTable: string;
  ftsTable: string;
  options?: ObsidianSearchOptions;
}): ObsidianRRFResult[] {
  const opts = params.options || {};
  const maxResults = opts.maxResults || DEFAULT_MAX_RESULTS;
  const minScore = opts.minScore || DEFAULT_MIN_SCORE;
  const k = opts.rrfK || DEFAULT_RRF_K;

  // Parallel: KNN + FTS5
  const vecResults = vectorSearch(
    params.db,
    params.queryEmbedding,
    params.vectorTable,
    opts.vectorLimit || DEFAULT_VECTOR_LIMIT,
  );
  const ftsResults = keywordSearch(
    params.db,
    params.queryText,
    params.ftsTable,
    opts.ftsLimit || DEFAULT_FTS_LIMIT,
    opts.ftsWeights,
  );

  // Fuse with RRF
  const fused = reciprocalRankFusion(vecResults, ftsResults, k);

  // Filter and limit
  return fused.filter((r) => r.rrfScore >= minScore).slice(0, maxResults);
}
