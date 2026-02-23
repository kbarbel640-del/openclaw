/**
 * Docker abstraction layer — barrel export.
 *
 * Exposes all Docker management classes through a single import point.
 * Internal code may import directly from the source modules.
 */

export { DockerEngineClient } from "./engine-client.js";
export { EngineDetector } from "./engine-detector.js";
export { ContainerManager } from "./container-manager.js";
export { ImageManager } from "./image-manager.js";
export type { PullProgressEvent, PullProgressCallback, ImageSummary } from "./image-manager.js";
export { NetworkManager } from "./network-manager.js";
export type { NetworkSummary } from "./network-manager.js";
export { VolumeManager } from "./volume-manager.js";
export type { VolumeSummary } from "./volume-manager.js";
export { ComposeOrchestrator } from "./compose-orchestrator.js";
export type { StackConfig, StackStatus } from "./compose-orchestrator.js";
