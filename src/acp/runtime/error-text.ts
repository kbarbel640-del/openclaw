import { type AcpRuntimeErrorCode, AcpRuntimeError, toAcpRuntimeError } from "./errors.js";

export function formatAcpRuntimeErrorText(error: AcpRuntimeError): string {
  return `ACP error (${error.code}): ${error.message}`;
}

export function toAcpRuntimeErrorText(params: {
  error: unknown;
  fallbackCode: AcpRuntimeErrorCode;
  fallbackMessage: string;
}): string {
  return formatAcpRuntimeErrorText(
    toAcpRuntimeError({
      error: params.error,
      fallbackCode: params.fallbackCode,
      fallbackMessage: params.fallbackMessage,
    }),
  );
}
