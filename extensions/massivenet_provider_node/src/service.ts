import crypto from "node:crypto";
import type { OpenClawPluginService, OpenClawPluginServiceContext } from "openclaw/plugin-sdk";

const DEFAULT_POLL_INTERVAL_MS = 500;
const DEFAULT_BACKOFF_MAX_MS = 5000;
const DEFAULT_HEARTBEAT_INTERVAL_MS = 15_000;
const DEFAULT_EXECUTOR = "stub";
const DEFAULT_LOG_JSON = true;
const STUB_CHAT_RESPONSE = "Stub response from OpenClaw MassiveNet node.";
const STUB_IMAGE_OUTPUT_URL = "https://example.com/stub-output.png";

export type MassiveNetExecutor = "stub" | "http";

export type MassiveNetProviderNodeConfig = {
  baseUrl: string;
  nodeToken: string;
  callbackHmacSecret: string;
  pollIntervalMs: number;
  backoffMaxMs: number;
  heartbeatIntervalMs: number;
  executor: MassiveNetExecutor;
  localExecutorUrl?: string;
  logJson: boolean;
};

type JobEnvelope = {
  id?: unknown;
  kind?: unknown;
  input?: unknown;
  payload_ref?: unknown;
};

type PollResponse = {
  job?: JobEnvelope | null;
};

type CompletePayload = {
  job_id: string;
  node_id: number;
  status: "succeeded" | "failed";
  metrics: Record<string, unknown>;
  result?: Record<string, unknown>;
};

type LogWriter = {
  info: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string) => void;
};

type WorkerDependencies = {
  fetchFn: typeof fetch;
  sleepMs: (ms: number) => Promise<void>;
  random: () => number;
};

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) {
    return fallback;
  }
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }
  return fallback;
}

export function resolveMassiveNetProviderNodeConfig(
  env: NodeJS.ProcessEnv = process.env,
): MassiveNetProviderNodeConfig {
  const baseUrl = (env.MASSIVENET_BASE_URL ?? "").trim().replace(/\/+$/, "");
  if (!baseUrl) {
    throw new Error("MASSIVENET_BASE_URL is required");
  }

  const nodeToken = (env.MASSIVENET_NODE_TOKEN ?? "").trim();
  if (!nodeToken) {
    throw new Error("MASSIVENET_NODE_TOKEN is required");
  }

  const callbackHmacSecret = (env.MASSIVENET_INTERNAL_JOB_HMAC_SECRET ?? "").trim();
  if (!callbackHmacSecret) {
    throw new Error(
      "MASSIVENET_INTERNAL_JOB_HMAC_SECRET is required for /internal/jobs/complete signature auth",
    );
  }

  const executorRaw = (env.MASSIVENET_EXECUTOR ?? DEFAULT_EXECUTOR).trim().toLowerCase();
  if (executorRaw !== "stub" && executorRaw !== "http") {
    throw new Error('MASSIVENET_EXECUTOR must be either "stub" or "http"');
  }

  const localExecutorUrl = (env.MASSIVENET_LOCAL_EXECUTOR_URL ?? "").trim();
  if (executorRaw === "http" && !localExecutorUrl) {
    throw new Error("MASSIVENET_LOCAL_EXECUTOR_URL is required when MASSIVENET_EXECUTOR=http");
  }

  return {
    baseUrl,
    nodeToken,
    callbackHmacSecret,
    pollIntervalMs: parsePositiveInt(env.MASSIVENET_POLL_INTERVAL_MS, DEFAULT_POLL_INTERVAL_MS),
    backoffMaxMs: parsePositiveInt(env.MASSIVENET_BACKOFF_MAX_MS, DEFAULT_BACKOFF_MAX_MS),
    heartbeatIntervalMs: DEFAULT_HEARTBEAT_INTERVAL_MS,
    executor: executorRaw,
    localExecutorUrl: localExecutorUrl || undefined,
    logJson: parseBoolean(env.MASSIVENET_LOG_JSON, DEFAULT_LOG_JSON),
  };
}

export function buildNodeAuthHeaders(nodeToken: string): Record<string, string> {
  return { Authorization: `Bearer ${nodeToken}` };
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function normalizeJobId(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("Invalid job id");
  }
  return value.trim();
}

function normalizeJobKind(value: unknown): "chat" | "image" {
  if (typeof value !== "string") {
    throw new Error("Job kind missing");
  }
  const kind = value.trim().toLowerCase();
  if (kind === "chat") {
    return "chat";
  }
  if (kind.includes("image")) {
    return "image";
  }
  throw new Error(`Unsupported job kind: ${kind}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

async function parseJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text.trim()) {
    return null;
  }
  return JSON.parse(text) as unknown;
}

function assertOk(response: Response, action: string): void {
  if (!response.ok) {
    throw new Error(`${action} failed (${response.status})`);
  }
}

export async function pollNodeJob(params: {
  fetchFn: typeof fetch;
  baseUrl: string;
  nodeToken: string;
}): Promise<JobEnvelope | null> {
  const response = await params.fetchFn(`${params.baseUrl}/v1/nodes/poll`, {
    method: "POST",
    headers: buildNodeAuthHeaders(params.nodeToken),
  });
  assertOk(response, "poll");
  const parsed = (await parseJson(response)) as PollResponse | null;
  if (!isRecord(parsed) || !("job" in parsed)) {
    return null;
  }
  const job = parsed.job;
  return isRecord(job) ? job : null;
}

export async function fetchNodeId(params: {
  fetchFn: typeof fetch;
  baseUrl: string;
  nodeToken: string;
}): Promise<number> {
  const response = await params.fetchFn(`${params.baseUrl}/v1/nodes/me`, {
    method: "GET",
    headers: buildNodeAuthHeaders(params.nodeToken),
  });
  assertOk(response, "node profile");
  const parsed = await parseJson(response);
  if (!isRecord(parsed) || typeof parsed.id !== "number") {
    throw new Error("Invalid /v1/nodes/me response");
  }
  return parsed.id;
}

export async function sendHeartbeat(params: {
  fetchFn: typeof fetch;
  baseUrl: string;
  nodeToken: string;
}): Promise<void> {
  const response = await params.fetchFn(`${params.baseUrl}/v1/nodes/heartbeat`, {
    method: "POST",
    headers: {
      ...buildNodeAuthHeaders(params.nodeToken),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ capabilities: { runtime: "openclaw" } }),
  });
  assertOk(response, "heartbeat");
}

export async function resolveJobInput(params: {
  fetchFn: typeof fetch;
  baseUrl: string;
  nodeToken: string;
  job: JobEnvelope;
}): Promise<Record<string, unknown>> {
  if (isRecord(params.job.input)) {
    return params.job.input;
  }

  if (typeof params.job.payload_ref !== "string" || !params.job.payload_ref.trim()) {
    throw new Error("Job payload missing");
  }

  const payloadRef = params.job.payload_ref.trim();
  const url =
    payloadRef.startsWith("http://") || payloadRef.startsWith("https://")
      ? payloadRef
      : `${params.baseUrl}/${payloadRef.replace(/^\/+/, "")}`;

  const response = await params.fetchFn(url, {
    method: "GET",
    headers: buildNodeAuthHeaders(params.nodeToken),
  });
  assertOk(response, "payload_ref fetch");
  const parsed = await parseJson(response);
  if (!isRecord(parsed) || !isRecord(parsed.payload_json)) {
    throw new Error("Invalid payload_ref response");
  }
  return parsed.payload_json;
}

export function executeStubJob(kind: "chat" | "image"): Record<string, unknown> {
  if (kind === "chat") {
    return { result_text: STUB_CHAT_RESPONSE };
  }
  return { output_urls: [STUB_IMAGE_OUTPUT_URL] };
}

export async function executeHttpJob(params: {
  fetchFn: typeof fetch;
  localExecutorUrl: string;
  kind: "chat" | "image";
  input: Record<string, unknown>;
}): Promise<Record<string, unknown>> {
  const response = await params.fetchFn(params.localExecutorUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params.input),
  });
  assertOk(response, "local executor");
  const parsed = await parseJson(response);
  if (!isRecord(parsed)) {
    throw new Error("Invalid local executor response");
  }
  if (params.kind === "chat") {
    if (typeof parsed.result_text !== "string") {
      throw new Error("local executor chat response missing result_text");
    }
    return { result_text: parsed.result_text };
  }
  if (
    !Array.isArray(parsed.output_urls) ||
    !parsed.output_urls.every((item) => typeof item === "string")
  ) {
    throw new Error("local executor image response missing output_urls");
  }
  return { output_urls: parsed.output_urls };
}

function signCompletionPayload(payload: string, hmacSecret: string): string {
  const digest = crypto.createHmac("sha256", hmacSecret).update(payload).digest("hex");
  return `sha256=${digest}`;
}

export async function completeNodeJob(params: {
  fetchFn: typeof fetch;
  baseUrl: string;
  hmacSecret: string;
  jobId: string;
  nodeId: number;
  success: boolean;
  result?: Record<string, unknown>;
  error?: string;
}): Promise<void> {
  const payload: CompletePayload = {
    job_id: params.jobId,
    node_id: params.nodeId,
    status: params.success ? "succeeded" : "failed",
    metrics: {
      success: params.success,
      ...(params.error ? { error: params.error } : {}),
    },
    ...(params.result ? { result: params.result } : {}),
  };

  const raw = JSON.stringify(payload);
  const signature = signCompletionPayload(raw, params.hmacSecret);
  const response = await params.fetchFn(`${params.baseUrl}/internal/jobs/complete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-MassiveNet-Signature": signature,
    },
    body: raw,
  });
  assertOk(response, "complete");
}

export class MassiveNetProviderNodeWorker {
  private readonly cfg: MassiveNetProviderNodeConfig;

  private readonly logger: LogWriter;

  private readonly deps: WorkerDependencies;

  private nodeId: number | null = null;

  private stopped = false;

  private backoffMs: number;

  private nextHeartbeatAtMs = 0;

  constructor(
    cfg: MassiveNetProviderNodeConfig,
    logger: LogWriter,
    deps?: Partial<WorkerDependencies>,
  ) {
    this.cfg = cfg;
    this.logger = logger;
    this.backoffMs = cfg.pollIntervalMs;
    this.deps = {
      fetchFn: deps?.fetchFn ?? fetch,
      sleepMs:
        deps?.sleepMs ?? (async (ms) => await new Promise((resolve) => setTimeout(resolve, ms))),
      random: deps?.random ?? Math.random,
    };
  }

  stop(): void {
    this.stopped = true;
  }

  private emit(event: string, fields: Record<string, unknown> = {}): void {
    const payload = {
      ts: new Date().toISOString(),
      event,
      ...fields,
    };

    if (this.cfg.logJson) {
      this.logger.info(JSON.stringify(payload));
      return;
    }

    const pairs = Object.entries(payload).map(([key, value]) => `${key}=${JSON.stringify(value)}`);
    this.logger.info(pairs.join(" "));
  }

  private async ensureNodeIdentity(): Promise<boolean> {
    if (this.nodeId !== null) {
      return true;
    }

    try {
      this.nodeId = await fetchNodeId({
        fetchFn: this.deps.fetchFn,
        baseUrl: this.cfg.baseUrl,
        nodeToken: this.cfg.nodeToken,
      });
      this.emit("register_success", { node_id: this.nodeId });
      return true;
    } catch (error) {
      this.emit("register_failure", { error: toErrorMessage(error) });
      return false;
    }
  }

  private async maybeHeartbeat(): Promise<void> {
    const nowMs = Date.now();
    if (nowMs < this.nextHeartbeatAtMs) {
      return;
    }
    this.nextHeartbeatAtMs = nowMs + this.cfg.heartbeatIntervalMs;
    try {
      await sendHeartbeat({
        fetchFn: this.deps.fetchFn,
        baseUrl: this.cfg.baseUrl,
        nodeToken: this.cfg.nodeToken,
      });
    } catch (error) {
      this.emit("heartbeat_failure", { error: toErrorMessage(error) });
    }
  }

  async pollAndProcessOnce(): Promise<"worked" | "idle" | "error"> {
    this.emit("poll");
    let job: JobEnvelope | null = null;
    try {
      job = await pollNodeJob({
        fetchFn: this.deps.fetchFn,
        baseUrl: this.cfg.baseUrl,
        nodeToken: this.cfg.nodeToken,
      });
    } catch (error) {
      this.emit("poll_failure", { error: toErrorMessage(error) });
      return "error";
    }

    if (!job) {
      return "idle";
    }

    let jobId = "";
    let jobKind: "chat" | "image" = "chat";
    try {
      jobId = normalizeJobId(job.id);
      jobKind = normalizeJobKind(job.kind);
    } catch (error) {
      this.emit("execute_failure", { error: toErrorMessage(error) });
      return "error";
    }

    this.emit("claim", { job_id: jobId, job_kind: jobKind });
    this.emit("execute_start", { job_id: jobId, job_kind: jobKind });

    try {
      const input = await resolveJobInput({
        fetchFn: this.deps.fetchFn,
        baseUrl: this.cfg.baseUrl,
        nodeToken: this.cfg.nodeToken,
        job,
      });

      const result =
        this.cfg.executor === "http"
          ? await executeHttpJob({
              fetchFn: this.deps.fetchFn,
              localExecutorUrl: this.cfg.localExecutorUrl ?? "",
              kind: jobKind,
              input,
            })
          : executeStubJob(jobKind);

      this.emit("execute_success", { job_id: jobId, job_kind: jobKind });
      try {
        await completeNodeJob({
          fetchFn: this.deps.fetchFn,
          baseUrl: this.cfg.baseUrl,
          hmacSecret: this.cfg.callbackHmacSecret,
          jobId,
          nodeId: this.nodeId ?? 0,
          success: true,
          result,
        });
        this.emit("complete_success", { job_id: jobId });
      } catch (error) {
        this.emit("complete_failure", { job_id: jobId, error: toErrorMessage(error) });
      }
      return "worked";
    } catch (error) {
      const errorMessage = toErrorMessage(error);
      this.emit("execute_failure", { job_id: jobId, error: errorMessage });
      try {
        await completeNodeJob({
          fetchFn: this.deps.fetchFn,
          baseUrl: this.cfg.baseUrl,
          hmacSecret: this.cfg.callbackHmacSecret,
          jobId,
          nodeId: this.nodeId ?? 0,
          success: false,
          result: { error: errorMessage },
          error: errorMessage,
        });
        this.emit("complete_success", { job_id: jobId, success: false });
      } catch (completionError) {
        this.emit("complete_failure", { job_id: jobId, error: toErrorMessage(completionError) });
      }
      return "worked";
    }
  }

  private async sleepWithBackoff(increase: boolean): Promise<void> {
    const jitter = Math.floor(
      this.deps.random() * Math.max(1, Math.floor(this.cfg.pollIntervalMs / 4)),
    );
    await this.deps.sleepMs(this.backoffMs + jitter);
    if (increase) {
      this.backoffMs = Math.min(this.cfg.backoffMaxMs, this.backoffMs * 2);
    } else {
      this.backoffMs = this.cfg.pollIntervalMs;
    }
  }

  async run(): Promise<void> {
    this.emit("worker_start", { executor: this.cfg.executor });

    while (!this.stopped) {
      const ready = await this.ensureNodeIdentity();
      if (!ready) {
        await this.sleepWithBackoff(true);
        continue;
      }

      await this.maybeHeartbeat();
      const outcome = await this.pollAndProcessOnce();

      if (outcome === "worked") {
        this.backoffMs = this.cfg.pollIntervalMs;
        continue;
      }

      await this.sleepWithBackoff(true);
    }

    this.emit("worker_stop");
  }
}

export function createMassiveNetProviderNodeService(): OpenClawPluginService {
  let worker: MassiveNetProviderNodeWorker | null = null;
  let workerPromise: Promise<void> | null = null;

  return {
    id: "massivenet_provider_node",
    async start(ctx: OpenClawPluginServiceContext) {
      try {
        const cfg = resolveMassiveNetProviderNodeConfig(process.env);
        worker = new MassiveNetProviderNodeWorker(cfg, ctx.logger);
        workerPromise = worker.run().catch((error) => {
          ctx.logger.error(`[massivenet_provider_node] worker crashed: ${toErrorMessage(error)}`);
        });
      } catch (error) {
        ctx.logger.error(`[massivenet_provider_node] not started: ${toErrorMessage(error)}`);
      }
    },
    async stop() {
      worker?.stop();
      if (workerPromise) {
        await workerPromise;
      }
      worker = null;
      workerPromise = null;
    },
  };
}
