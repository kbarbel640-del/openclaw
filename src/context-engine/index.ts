export type {
  ContextEngine,
  ContextEngineInfo,
  AssembleResult,
  CompactResult,
  IngestResult,
} from "./types.js";

export {
  registerContextEngine,
  getContextEngineFactory,
  listContextEngineIds,
  resolveContextEngine,
} from "./registry.js";
export type { ContextEngineFactory } from "./registry.js";

export { LegacyContextEngine, registerLegacyContextEngine } from "./legacy.js";
export { DoltContextEngine, registerDoltContextEngine } from "./dolt/engine.js";

export { ensureContextEnginesInitialized } from "./init.js";

export * from "./dolt/index.js";
