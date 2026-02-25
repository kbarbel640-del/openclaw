/**
 * Duplicate Detector — Embedding-based visual similarity
 *
 * Finds duplicate/near-duplicate images using CLIP embedding cosine similarity.
 * Images with similarity > 0.95 are considered duplicates.
 *
 * Within each duplicate group, ranks images by IQA quality score
 * to pick the best version.
 */

import { computeEmbedding, cosineSimilarity } from "../embeddings/embedder.js";
import type { EmbedderConfig, EmbeddingVector } from "../embeddings/embedder.js";

export interface DuplicateGroup {
  groupId: string;
  images: DuplicateGroupMember[];
}

export interface DuplicateGroupMember {
  imagePath: string;
  /** Similarity to the group's reference image (first detected) */
  similarity: number;
  /** Quality score for ranking within the group */
  qualityScore: number;
  /** Whether this is the best in the group */
  isBest: boolean;
}

/** Threshold above which two images are considered duplicates */
const DUPLICATE_THRESHOLD = 0.95;

/**
 * Detect duplicate groups from a set of image paths.
 *
 * Uses CLIP embeddings to compute pairwise similarity.
 * Groups images that exceed the similarity threshold.
 */
export async function detectDuplicates(
  imagePaths: string[],
  embedderConfig: EmbedderConfig,
  qualityScores?: Map<string, number>,
  onProgress?: (completed: number, total: number) => void,
): Promise<DuplicateGroup[]> {
  if (!embedderConfig.enabled || imagePaths.length < 2) {
    return [];
  }

  // Step 1: Compute embeddings for all images
  const embeddings = new Map<string, EmbeddingVector>();

  for (let i = 0; i < imagePaths.length; i++) {
    try {
      const result = await computeEmbedding(imagePaths[i], embedderConfig);
      if (result.embedding) {
        embeddings.set(imagePaths[i], result.embedding);
      }
    } catch {
      // Skip images that can't be embedded
    }
    onProgress?.(i + 1, imagePaths.length);
  }

  // Step 2: Find duplicate groups via pairwise similarity
  const paths = [...embeddings.keys()];
  const assigned = new Set<string>();
  const groups: DuplicateGroup[] = [];
  let groupCounter = 0;

  for (let i = 0; i < paths.length; i++) {
    if (assigned.has(paths[i])) {
      continue;
    }

    const embA = embeddings.get(paths[i]);
    if (!embA) {
      continue;
    }

    const members: DuplicateGroupMember[] = [
      {
        imagePath: paths[i],
        similarity: 1.0,
        qualityScore: qualityScores?.get(paths[i]) ?? 0.5,
        isBest: false,
      },
    ];

    for (let j = i + 1; j < paths.length; j++) {
      if (assigned.has(paths[j])) {
        continue;
      }

      const embB = embeddings.get(paths[j]);
      if (!embB) {
        continue;
      }

      const similarity = cosineSimilarity(embA, embB);

      if (similarity >= DUPLICATE_THRESHOLD) {
        members.push({
          imagePath: paths[j],
          similarity,
          qualityScore: qualityScores?.get(paths[j]) ?? 0.5,
          isBest: false,
        });
        assigned.add(paths[j]);
      }
    }

    // Only create a group if there are actual duplicates
    if (members.length > 1) {
      assigned.add(paths[i]);
      groupCounter++;

      // Rank by quality score — best image first
      members.sort((a, b) => b.qualityScore - a.qualityScore);
      members[0].isBest = true;

      groups.push({
        groupId: `dup_${groupCounter}`,
        images: members,
      });
    }
  }

  return groups;
}

/**
 * Quick duplicate check between two images.
 */
export async function areDuplicates(
  imagePath1: string,
  imagePath2: string,
  embedderConfig: EmbedderConfig,
): Promise<{ isDuplicate: boolean; similarity: number }> {
  if (!embedderConfig.enabled) {
    return { isDuplicate: false, similarity: 0 };
  }

  try {
    const [emb1, emb2] = await Promise.all([
      computeEmbedding(imagePath1, embedderConfig),
      computeEmbedding(imagePath2, embedderConfig),
    ]);

    if (!emb1.embedding || !emb2.embedding) {
      return { isDuplicate: false, similarity: 0 };
    }

    const similarity = cosineSimilarity(emb1.embedding, emb2.embedding);

    return {
      isDuplicate: similarity >= DUPLICATE_THRESHOLD,
      similarity,
    };
  } catch {
    return { isDuplicate: false, similarity: 0 };
  }
}
