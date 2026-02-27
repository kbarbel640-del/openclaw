import { StatusCodes } from "http-status-codes";
import type { RetryInfo, RetryOptions } from "./retry.js";
import { retryAsync } from "./retry.js";

export type RetryLogger = (msg: string) => void;

type ResponseValidator = (res: Response) => Promise<Response>;

type ResponseTransformer<T> = (res: Response) => Promise<T>;

type ErrorFactory<T> = (res: Response, options: RetryHttpOptions<T>) => Promise<Error>;

export type RetryHttpOptions<T> = RetryOptions & {
  label: string;
  initialUrl?: string;
  logger?: RetryLogger;
  onResponse?: ResponseValidator;
  transformResponse?: ResponseTransformer<T>;
  createError?: ErrorFactory<T>;
};

// HTTP status codes that are safe to retry
const RETRYABLE_STATUS_CODES = new Set([
  StatusCodes.TOO_MANY_REQUESTS, // 429
  StatusCodes.INTERNAL_SERVER_ERROR, // 500
  StatusCodes.BAD_GATEWAY, // 502
  StatusCodes.SERVICE_UNAVAILABLE, // 503
  StatusCodes.GATEWAY_TIMEOUT, // 504
  522, // Connection timed out (Cloudflare)
  524, // A timeout occurred (Cloudflare)
]);

// Network error codes that indicate transient failures
const RETRYABLE_NETWORK_ERROR_CODES = new Set([
  "ECONNRESET",
  "ETIMEDOUT",
  "ECONNREFUSED",
  "EADDRINUSE",
  "EADDRNOTAVAIL",
  "ENETUNREACH",
  "ENOTCONN",
]);

function hasRetryableErrorCode(err: unknown, codeProp: string, codes: Set<unknown>): boolean {
  if (typeof err === "object" && err !== null && codeProp in err) {
    const code = (err as Record<string, unknown>)[codeProp];
    return codes.has(code);
  }
  return false;
}

function isRetryableNetworkError(err: unknown): boolean {
  return hasRetryableErrorCode(err, "code", RETRYABLE_NETWORK_ERROR_CODES);
}

function isRetryableHttpStatusError(err: unknown): boolean {
  return hasRetryableErrorCode(err, "status", RETRYABLE_STATUS_CODES);
}

export function isHttpRetryable(err: unknown): boolean {
  if (err instanceof TypeError) {
    return true;
  }
  if (isRetryableNetworkError(err)) {
    return true;
  }
  if (isRetryableHttpStatusError(err)) {
    return true;
  }
  return false;
}

export async function retryHttpAsync<T>(
  fn: () => Promise<Response>,
  options: RetryHttpOptions<T>,
): Promise<T> {
  const {
    logger = console.warn,
    onResponse: validate = onResponse(options),
    transformResponse: transform = promisedResponse,
    ...retryOptions
  } = options;
  return retryAsync(() => fn().then(validate), {
    ...retryOptions,
    shouldRetry: (err) => isHttpRetryable(err),
    onRetry: (info) => onRetry(logger, info),
  }).then(transform);
}

export function promisedResponse(res: Response): Promise<Response> {
  return Promise.resolve(res);
}

function onRetry(logger: RetryLogger, info: RetryInfo) {
  const errMsg = info.err instanceof Error ? info.err.message : String(info.err);
  const labelPart = info.label ? `[${info.label}] ` : "";
  logger(`${labelPart}Retry ${info.attempt}/${info.maxAttempts} failed: ${errMsg}`);
}

function onResponse(options: RetryHttpOptions<unknown>): ResponseValidator {
  const { createError = defaultCreateError } = options;
  return async (res: Response) => {
    if (!res.ok) {
      throw await createError(res, options);
    }
    return res;
  };
}

async function defaultCreateError(
  res: Response,
  options: RetryHttpOptions<unknown>,
): Promise<Error> {
  const { initialUrl, label } = options;
  const initialUrlPart = initialUrl ? `${initialUrl} ` : "";
  const textPart = await res
    .text()
    .then((text) => `: ${text}`)
    .catch(() => "");
  const err = new Error(
    `${label}: HTTP ${initialUrlPart}${res.status} ${res.statusText}${textPart}`,
  );
  (err as Error & { status?: number }).status = res.status;
  return err;
}
