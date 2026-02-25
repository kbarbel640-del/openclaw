export {
  classifyImage as mlxSwiftClassifyImage,
  classifyScreenshot as mlxSwiftClassifyScreenshot,
  isMlxSwiftAvailable,
  resetMlxSwiftAvailabilityCache,
} from "./mlx-inference.js";
export type { MlxSwiftConfig } from "./mlx-inference.js";

export {
  computeEmbedding as coremlComputeEmbedding,
  isCoremlClipAvailable,
  resetCoremlClipAvailabilityCache,
} from "./coreml-clip.js";
export type { CoreMlClipConfig } from "./coreml-clip.js";

export {
  scoreImage as coremlScoreImage,
  isCoremlIqaAvailable,
  resetCoremlIqaAvailabilityCache,
} from "./coreml-iqa.js";
export type { CoreMlIqaConfig } from "./coreml-iqa.js";
