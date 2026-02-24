/**
 * OpenClaw Command Center — Shared types for IPC bridge.
 *
 * These types define the contract between the main process and the renderer.
 * The preload script exposes a typed subset of these via `window.occc`.
 */

// ─── Environment Status ─────────────────────────────────────────────────────

export type EnvironmentHealth = "healthy" | "degraded" | "unhealthy" | "stopped" | "unknown";

export interface EnvironmentStatus {
  health: EnvironmentHealth;
  gateway: ContainerStatus;
  cli: ContainerStatus;
  sandboxes: ContainerStatus[];
  uptime: number | null;
}

export interface ContainerStatus {
  id: string;
  name: string;
  state: "running" | "paused" | "stopped" | "restarting" | "removing" | "dead" | "created";
  health: EnvironmentHealth;
  cpu: number;
  memoryMB: number;
  networkRx: number;
  networkTx: number;
}

// ─── System Validation ──────────────────────────────────────────────────────

export type CheckResult = "pass" | "warn" | "fail";

export interface SystemCheck {
  name: string;
  description: string;
  result: CheckResult;
  message: string;
  autoFixAvailable: boolean;
}

export interface SystemValidation {
  checks: SystemCheck[];
  allPassed: boolean;
  canProceed: boolean;
}

// ─── Docker Engine ──────────────────────────────────────────────────────────

export type DockerVariant = "docker-desktop" | "docker-ce" | "podman" | "none";

export interface DockerInfo {
  variant: DockerVariant;
  version: string;
  apiVersion: string;
  running: boolean;
}

// ─── Configuration ──────────────────────────────────────────────────────────

export interface ConfigSection {
  key: string;
  label: string;
  description: string;
  fields: ConfigField[];
}

export interface ConfigField {
  key: string;
  label: string;
  type: "text" | "password" | "number" | "boolean" | "select" | "json";
  value: unknown;
  defaultValue: unknown;
  options?: { label: string; value: string }[];
  required: boolean;
  sensitive: boolean;
  description: string;
}

// ─── Skills ─────────────────────────────────────────────────────────────────

export type SkillRiskLevel = "low" | "medium" | "high" | "blocked";
export type SkillApprovalStatus = "approved" | "pending" | "rejected" | "blocked";

export interface SkillInfo {
  name: string;
  description: string;
  riskLevel: SkillRiskLevel;
  approvalStatus: SkillApprovalStatus;
  installed: boolean;
  scanFindings: number;
}

// ─── Auth & RBAC ────────────────────────────────────────────────────────────

export type UserRole = "super-admin" | "admin" | "operator" | "viewer";

export interface UserProfile {
  id: string;
  username: string;
  role: UserRole;
  biometricEnrolled: boolean;
  totpEnabled: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface AuthSession {
  userId: string;
  role: UserRole;
  authenticatedAt: number;
  expiresAt: number;
  elevated: boolean;
}

export interface TotpSetupInfo {
  secret: string;
  otpAuthUrl: string;
  qrDataUrl: string;
}

export interface CreateUserParams {
  username: string;
  role: UserRole;
  password: string;
}

export interface MutationResult {
  ok: boolean;
  reason?: string;
}

export interface AuditLogEntry {
  id: string;
  userId: string | null;
  username: string | null;
  event: string;
  method: string | null;
  success: boolean;
  timestamp: string;
}

// ─── IPC Channel Definitions ────────────────────────────────────────────────

/**
 * IPC channels used between main process and renderer.
 * All channels follow the pattern: "occc:<domain>:<action>"
 */
export const IPC_CHANNELS = {
  // Auth
  AUTH_LOGIN: "occc:auth:login",
  AUTH_BIOMETRIC: "occc:auth:biometric",
  AUTH_VERIFY_TOTP: "occc:auth:verify-totp",
  AUTH_LOGOUT: "occc:auth:logout",
  AUTH_SESSION: "occc:auth:session",
  AUTH_ELEVATE: "occc:auth:elevate",

  // Auth — First Run
  AUTH_IS_FIRST_RUN: "occc:auth:is-first-run",
  AUTH_CREATE_INITIAL_USER: "occc:auth:create-initial-user",
  AUTH_CONFIRM_TOTP: "occc:auth:confirm-totp",
  AUTH_BIOMETRIC_AVAILABLE: "occc:auth:biometric-available",
  AUTH_ENROLL_BIOMETRIC: "occc:auth:enroll-biometric",

  // Auth — User Management
  AUTH_LIST_USERS: "occc:auth:list-users",
  AUTH_CREATE_USER: "occc:auth:create-user",
  AUTH_UPDATE_ROLE: "occc:auth:update-role",
  AUTH_RESET_PASSWORD: "occc:auth:reset-password",
  AUTH_DELETE_USER: "occc:auth:delete-user",
  AUTH_AUDIT_LOG: "occc:auth:audit-log",

  // Auth — Self-service
  AUTH_CHANGE_PASSWORD: "occc:auth:change-password",

  // Environment
  ENV_STATUS: "occc:env:status",
  ENV_CREATE: "occc:env:create",
  ENV_START: "occc:env:start",
  ENV_STOP: "occc:env:stop",
  ENV_DESTROY: "occc:env:destroy",
  ENV_LOGS: "occc:env:logs",

  // Docker
  DOCKER_INFO: "occc:docker:info",
  DOCKER_INSTALL_CHECK: "occc:docker:install-check",

  // Config
  CONFIG_GET: "occc:config:get",
  CONFIG_SET: "occc:config:set",
  CONFIG_VALIDATE: "occc:config:validate",
  CONFIG_SECTIONS: "occc:config:sections",

  // Skills
  SKILLS_LIST: "occc:skills:list",
  SKILLS_INSTALL: "occc:skills:install",
  SKILLS_SCAN: "occc:skills:scan",

  // System
  SYSTEM_VALIDATE: "occc:system:validate",
  SYSTEM_PLATFORM: "occc:system:platform",

  // Backup
  BACKUP_CREATE: "occc:backup:create",
  BACKUP_RESTORE: "occc:backup:restore",
  BACKUP_HISTORY: "occc:backup:history",
} as const;

// ─── API Bridge Type ────────────────────────────────────────────────────────

/**
 * The typed API surface exposed to the renderer via `window.occc`.
 */
export interface OcccBridge {
  // Auth
  login(username: string, password: string): Promise<{ session: AuthSession; token: string } | { requiresTotp: true; nonce: string } | null>;
  biometricAuth(username: string): Promise<{ session: AuthSession; token: string } | null>;
  verifyTotp(code: string): Promise<boolean>;
  logout(token?: string): Promise<void>;
  getSession(token?: string): Promise<AuthSession | null>;
  elevate(token?: string, totpCode?: string): Promise<{ ok: boolean; reason?: string } | null>;

  // Auth — First Run
  isFirstRun(): Promise<boolean>;
  createInitialUser(username: string, password: string): Promise<{ profile: UserProfile; totpSetup: TotpSetupInfo; recoveryCodes: string[] }>;
  confirmTotp(token: string, secret: string, code: string): Promise<boolean>;
  isBiometricAvailable(): Promise<boolean>;
  enrollBiometric(token: string): Promise<boolean>;

  // Auth — User Management (admin+, elevation required for mutations)
  listUsers(token: string): Promise<UserProfile[]>;
  createUser(token: string, params: CreateUserParams): Promise<UserProfile>;
  updateUserRole(token: string, userId: string, role: UserRole): Promise<MutationResult>;
  resetUserPassword(token: string, userId: string, newPassword: string): Promise<MutationResult>;
  deleteUser(token: string, userId: string): Promise<MutationResult>;
  getAuditLog(token: string, limit?: number): Promise<AuditLogEntry[]>;

  // Auth — Self-service
  changePassword(token: string, currentPassword: string, newPassword: string): Promise<MutationResult>;

  // Environment (session required; create/destroy require elevated session)
  getEnvironmentStatus(token: string): Promise<EnvironmentStatus>;
  createEnvironment(token: string, config: Record<string, unknown>): Promise<void>;
  startEnvironment(token: string): Promise<void>;
  stopEnvironment(token: string): Promise<void>;
  destroyEnvironment(token: string): Promise<void>;
  getEnvironmentLogs(token: string, containerId: string): Promise<string>;

  // Docker
  getDockerInfo(): Promise<DockerInfo>;

  // Config (session required)
  getConfigSections(token: string): Promise<ConfigSection[]>;
  getConfig(token: string, section: string): Promise<Record<string, unknown>>;
  setConfig(token: string, section: string, values: Record<string, unknown>): Promise<void>;

  // Skills (session required)
  listSkills(token: string): Promise<SkillInfo[]>;
  installSkill(name: string): Promise<void>;
  scanSkill(path: string): Promise<{ approved: boolean; findings: string[] }>;

  // System
  validateSystem(): Promise<SystemValidation>;
  getPlatform(): Promise<{ os: string; arch: string; version: string }>;

  // Backup
  createBackup(): Promise<void>;
  getBackupHistory(): Promise<{ timestamp: string; commit: string }[]>;

  // Events
  on(channel: string, callback: (...args: unknown[]) => void): void;
  off(channel: string, callback: (...args: unknown[]) => void): void;

  /**
   * @deprecated Dev-only scaffold for auth/install channels not yet added to the
   * typed bridge. Rejected in production builds by the preload. Do NOT add new
   * usages — add a typed OcccBridge method instead.
   */
  invoke(channel: string, ...args: unknown[]): Promise<unknown>;
}
