/**
 * Embedding Store — SQLite-backed vector storage
 *
 * Stores CLIP image embeddings and supports nearest-neighbor search
 * via brute-force cosine similarity. No FAISS dependency — pure SQLite.
 *
 * Uses node:sqlite DatabaseSync (same pattern as StyleDatabase).
 */

import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { cosineSimilarity, decodeEmbedding, encodeEmbedding } from "./embedder.js";
import type { EmbeddingVector } from "./embedder.js";

export interface SimilarImage {
  photoHash: string;
  scenarioKey: string;
  similarity: number;
}

export interface StoredEmbedding {
  photoHash: string;
  scenarioKey: string;
  embedding: EmbeddingVector;
}

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS image_embeddings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    photo_hash TEXT UNIQUE NOT NULL,
    embedding BLOB NOT NULL,
    scenario_key TEXT,
    dimensions INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_embeddings_hash
    ON image_embeddings(photo_hash);
  CREATE INDEX IF NOT EXISTS idx_embeddings_scenario
    ON image_embeddings(scenario_key);
`;

export class EmbeddingStore {
  private db: InstanceType<typeof DatabaseSync>;

  constructor(dbPath: string) {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    this.db = new DatabaseSync(dbPath);
    this.db.exec(SCHEMA_SQL);
  }

  /**
   * Store an embedding for a photo.
   * Overwrites if the photo_hash already exists.
   */
  store(photoHash: string, embedding: EmbeddingVector, scenarioKey?: string): void {
    const b64 = encodeEmbedding(embedding);

    this.db
      .prepare(
        `INSERT OR REPLACE INTO image_embeddings
         (photo_hash, embedding, scenario_key, dimensions)
         VALUES (?, ?, ?, ?)`,
      )
      .run(photoHash, b64, scenarioKey ?? null, embedding.length);
  }

  /**
   * Get the embedding for a specific photo.
   */
  get(photoHash: string): StoredEmbedding | null {
    const row = this.db
      .prepare(
        "SELECT photo_hash, embedding, scenario_key FROM image_embeddings WHERE photo_hash = ?",
      )
      .get(photoHash) as
      | { photo_hash: string; embedding: string; scenario_key: string | null }
      | undefined;

    if (!row) {
      return null;
    }

    return {
      photoHash: row.photo_hash,
      scenarioKey: row.scenario_key ?? "",
      embedding: decodeEmbedding(row.embedding),
    };
  }

  /**
   * Find the k most similar images to a query embedding.
   * Uses brute-force cosine similarity (fast enough for <100K images).
   */
  findSimilar(queryEmbedding: EmbeddingVector, k = 5): SimilarImage[] {
    const rows = this.db
      .prepare("SELECT photo_hash, embedding, scenario_key FROM image_embeddings")
      .all() as Array<{ photo_hash: string; embedding: string; scenario_key: string | null }>;

    const scored: SimilarImage[] = [];

    for (const row of rows) {
      try {
        const storedEmbedding = decodeEmbedding(row.embedding);
        const similarity = cosineSimilarity(queryEmbedding, storedEmbedding);

        scored.push({
          photoHash: row.photo_hash,
          scenarioKey: row.scenario_key ?? "",
          similarity,
        });
      } catch {
        // Skip malformed embeddings
        continue;
      }
    }

    // Sort by similarity descending, take top k
    scored.sort((a, b) => b.similarity - a.similarity);
    return scored.slice(0, k);
  }

  /**
   * Find similar images within a specific scenario.
   */
  findSimilarInScenario(
    queryEmbedding: EmbeddingVector,
    scenarioKey: string,
    k = 5,
  ): SimilarImage[] {
    const rows = this.db
      .prepare(
        "SELECT photo_hash, embedding, scenario_key FROM image_embeddings WHERE scenario_key = ?",
      )
      .all(scenarioKey) as Array<{
      photo_hash: string;
      embedding: string;
      scenario_key: string | null;
    }>;

    const scored: SimilarImage[] = [];

    for (const row of rows) {
      try {
        const storedEmbedding = decodeEmbedding(row.embedding);
        const similarity = cosineSimilarity(queryEmbedding, storedEmbedding);

        scored.push({
          photoHash: row.photo_hash,
          scenarioKey: row.scenario_key ?? "",
          similarity,
        });
      } catch {
        continue;
      }
    }

    scored.sort((a, b) => b.similarity - a.similarity);
    return scored.slice(0, k);
  }

  /**
   * Get the total number of stored embeddings.
   */
  getCount(): number {
    const row = this.db.prepare("SELECT COUNT(*) as cnt FROM image_embeddings").get() as {
      cnt: number;
    };
    return row.cnt;
  }

  /**
   * Check if an embedding exists for a given photo hash.
   */
  has(photoHash: string): boolean {
    const row = this.db
      .prepare("SELECT 1 FROM image_embeddings WHERE photo_hash = ? LIMIT 1")
      .get(photoHash) as Record<string, unknown> | undefined;
    return row !== undefined;
  }

  close(): void {
    this.db.close();
  }
}
