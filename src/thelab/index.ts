/**
 * Sophie — Your AI Photo Editor
 * The Lab by Department of Vibe
 *
 * Sophie learns your specific editing style by watching you edit and
 * analyzing your Lightroom catalog, then autonomously edits photos
 * the way you would. She flags what she's unsure about and communicates
 * like a real editor.
 */

// --- Core editing loop ---
export { EditingLoop } from "./loop/editing-loop.js";
export type { EditingLoopCallbacks, SessionStats } from "./loop/editing-loop.js";
export { ImageQueue } from "./loop/queue.js";
export { evaluateGate, filterConfidentAdjustments } from "./loop/gate.js";

// --- Lightroom control ---
export { LightroomController } from "./lightroom/controller.js";
export { LightroomWindow } from "./lightroom/window.js";
export { SliderController } from "./lightroom/sliders.js";

// --- Vision ---
export { VisionTool } from "./vision/vision-tool.js";
export {
  classifyImage as vlmClassifyImage,
  classifyScreenshot as vlmClassifyScreenshot,
  vlmConfigFromLabConfig,
  isMlxVlmAvailable,
  resetAvailabilityCache,
} from "./vision/vlm-adapter.js";
export type { VlmAdapterConfig } from "./vision/vlm-adapter.js";
export {
  buildClassifyPrompt,
  parseClassifyOutput,
  VALID_TIME_OF_DAY,
  VALID_LOCATIONS,
  VALID_LIGHTING,
  VALID_SUBJECTS,
  VALID_SPECIALS,
} from "./vision/classify-prompt.js";
export type { VisionClassification } from "./vision/classify-prompt.js";

// --- Session ---
export { SessionStore } from "./session/session-store.js";

// --- Learning system ---
export { CatalogIngester, LR_DEFAULTS } from "./learning/catalog-ingester.js";
export type {
  CatalogPhotoRecord,
  CatalogExifData,
  DevelopSettings,
} from "./learning/catalog-ingester.js";
export { SceneClassifier, scenarioKey, scenarioLabel } from "./learning/scene-classifier.js";
export type {
  SceneClassification,
  TimeOfDay,
  Location,
  Lighting,
  Subject,
  Special,
} from "./learning/scene-classifier.js";
export { StyleDatabase } from "./learning/style-db.js";
export type {
  ScenarioProfile,
  AdjustmentStats,
  PhotoEditRecord,
  SliderCorrelation,
} from "./learning/style-db.js";
export { IngestPipeline } from "./learning/ingest-pipeline.js";
export type { IngestProgress, IngestCallbacks } from "./learning/ingest-pipeline.js";
export { LiveObserver } from "./learning/live-observer.js";
export type { ObserverCallbacks, ObserverStatus } from "./learning/live-observer.js";
export { discoverCatalogs, discoverActiveCatalog } from "./learning/catalog-discovery.js";
export type { DiscoveredCatalog } from "./learning/catalog-discovery.js";
export { generateStyleReport, generateSessionReport } from "./learning/style-report.js";
export { SessionNotifier, sendIMessage } from "./notifications/imessage.js";

// --- Sophie (conversation engine) ---
export { SophieBrain, parseIntent } from "./sophie/index.js";
export type {
  SophieBrainDeps,
  SophieMessage,
  SophieState,
  UserIntent,
  ActiveSessionState,
  MessageRole,
  MessageType,
  ImageFlagMessage,
  SessionCardMessage,
  ProgressUpdateMessage,
  QuestionCardMessage,
} from "./sophie/index.js";

// --- Culling ---
export { Culler } from "./culling/index.js";
export type {
  CullResult,
  CullVerdict,
  CullSessionStats,
  CullCallbacks,
  RejectReason,
} from "./culling/index.js";

// --- Schemas ---
export {
  ImageAnalysisResult,
  VerificationResult,
  LightroomControl,
  ImageState,
  SessionLog,
  FilmStockTarget,
} from "./vision/schema.js";
export type {
  ImageAnalysisResultType,
  VerificationResultType,
  LightroomControlType,
  ImageStateType,
  SessionLogType,
  FilmStockTargetType,
  AdjustmentEntryType,
  SessionImageEntryType,
} from "./vision/schema.js";

// --- Soul system ---
export { generateSoulData, renderSoulMarkdown } from "./soul/index.js";
export { SoulStore } from "./soul/index.js";
export type {
  SoulData,
  SoulGeneratorConfig,
  SoulPhilosophy,
  SoulNonNegotiable,
  SoulTendency,
  SoulScenarioShift,
  SoulConfidenceGap,
  SoulSignaturePair,
  SoulStoreConfig,
} from "./soul/index.js";

// --- EXIF extraction ---
export {
  extractFullExif,
  extractQuickExif,
  extractBatchExif,
  isExiftoolAvailable,
} from "./exif/index.js";
export type { ExifQuickData } from "./exif/index.js";

// --- Config ---
export type { TheLabConfig } from "./config/thelab-config.js";
export { resolveConfigPaths } from "./config/thelab-config.js";
export { DEFAULT_CONFIG } from "./config/defaults.js";
