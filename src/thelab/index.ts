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
export { LightroomTcpClient } from "./lightroom/tcp-client.js";
export type {
  TcpClientConfig,
  DevelopSettings as TcpDevelopSettings,
} from "./lightroom/tcp-client.js";
export {
  isPluginAvailable,
  forceProbe,
  resetPluginDetectorCache,
} from "./lightroom/plugin-detector.js";
export type { PluginDetectorConfig } from "./lightroom/plugin-detector.js";

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
export { assessQuality, assessQualityBatch, shouldReject } from "./culling/index.js";
export type { QualityAssessment } from "./culling/index.js";
export {
  detectFaces,
  isFaceDetectorAvailable,
  resetFaceDetectorCache,
  hasClosedEyes,
  faceQualityScore,
} from "./culling/index.js";
export type {
  DetectedFace,
  FaceDetectionResult,
  FaceDetectorConfig,
  FaceOrientation,
} from "./culling/index.js";
export { detectDuplicates, areDuplicates } from "./culling/index.js";
export type { DuplicateGroup, DuplicateGroupMember } from "./culling/index.js";
export { rankImages } from "./culling/index.js";
export type { RankedImage, ScoreBreakdown } from "./culling/index.js";

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

// --- Teach flow ---
export { TeachFlow } from "./teach/index.js";
export type { TeachState, TeachProgress, TeachCallbacks } from "./teach/index.js";

// --- Feedback ---
export { FeedbackHandler } from "./feedback/index.js";
export type { Correction, CorrectionPattern, FeedbackCallbacks } from "./feedback/index.js";

// --- Approval flow ---
export { ApprovalFlow } from "./notifications/approval-flow.js";
export type {
  ApprovalResponse,
  FlaggedImageInfo,
  ApprovalCallbacks,
} from "./notifications/approval-flow.js";

// --- IQA scoring ---
export {
  scoreImage,
  isIqaAvailable,
  resetIqaAvailabilityCache,
  iqaConfigFromLabConfig,
} from "./iqa/index.js";
export type { IqaResult, ClipIqaScores, IqaScorerConfig } from "./iqa/index.js";

// --- Image embeddings ---
export {
  computeEmbedding,
  isEmbedderAvailable,
  resetEmbedderAvailabilityCache,
  decodeEmbedding,
  encodeEmbedding,
  cosineSimilarity,
  embedderConfigFromLabConfig,
  EmbeddingStore,
} from "./embeddings/index.js";
export type {
  EmbeddingVector,
  EmbeddingResult,
  EmbedderConfig,
  SimilarImage,
  StoredEmbedding,
} from "./embeddings/index.js";

// --- Native inference (MLX-Swift, CoreML) ---
export {
  mlxSwiftClassifyImage,
  mlxSwiftClassifyScreenshot,
  isMlxSwiftAvailable,
  resetMlxSwiftAvailabilityCache,
  coremlComputeEmbedding,
  isCoremlClipAvailable,
  resetCoremlClipAvailabilityCache,
  coremlScoreImage,
  isCoremlIqaAvailable,
  resetCoremlIqaAvailabilityCache,
} from "./native/index.js";
export type { MlxSwiftConfig, CoreMlClipConfig, CoreMlIqaConfig } from "./native/index.js";

// --- Config ---
export type { TheLabConfig } from "./config/thelab-config.js";
export { resolveConfigPaths } from "./config/thelab-config.js";
export { DEFAULT_CONFIG } from "./config/defaults.js";
