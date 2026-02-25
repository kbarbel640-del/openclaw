export {
  computeEmbedding,
  isEmbedderAvailable,
  resetEmbedderAvailabilityCache,
  decodeEmbedding,
  encodeEmbedding,
  cosineSimilarity,
  embedderConfigFromLabConfig,
} from "./embedder.js";
export type { EmbeddingVector, EmbeddingResult, EmbedderConfig } from "./embedder.js";

export { EmbeddingStore } from "./embedding-store.js";
export type { SimilarImage, StoredEmbedding } from "./embedding-store.js";
