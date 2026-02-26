import type { Command } from "commander";
import { readSecretFromFile } from "../../acp/secret-file.js";
import { callGateway } from "../../gateway/call.js";
import { GATEWAY_CLIENT_MODES, GATEWAY_CLIENT_NAMES } from "../../utils/message-channel.js";
import { withProgress } from "../progress.js";

export type GatewayRpcOpts = {
  url?: string;
  token?: string;
  tokenFile?: string;
  password?: string;
  passwordFile?: string;
  timeout?: string;
  expectFinal?: boolean;
  json?: boolean;
};

export const gatewayCallOpts = (cmd: Command) =>
  cmd
    .option("--url <url>", "Gateway WebSocket URL (defaults to gateway.remote.url when configured)")
    .option("--token <token>", "Gateway token (if required)")
    .option("--token-file <path>", "Read gateway token from file (avoids ps exposure)")
    .option("--password <password>", "Gateway password (password auth)")
    .option("--password-file <path>", "Read gateway password from file (avoids ps exposure)")
    .option("--timeout <ms>", "Timeout in ms", "10000")
    .option("--expect-final", "Wait for final response (agent)", false)
    .option("--json", "Output JSON", false);

function resolveCallSecret(
  direct: string | undefined,
  filePath: string | undefined,
  directFlag: string,
  fileFlag: string,
  label: string,
): string | undefined {
  const d = direct?.trim();
  const f = filePath?.trim();
  if (d && f) {
    throw new Error(`Use either ${directFlag} or ${fileFlag} for ${label}.`);
  }
  if (f) {
    return readSecretFromFile(f, label);
  }
  return d || undefined;
}

export const callGatewayCli = async (method: string, opts: GatewayRpcOpts, params?: unknown) => {
  const token = resolveCallSecret(opts.token, opts.tokenFile, "--token", "--token-file", "Gateway token");
  const password = resolveCallSecret(opts.password, opts.passwordFile, "--password", "--password-file", "Gateway password");
  return withProgress(
    {
      label: `Gateway ${method}`,
      indeterminate: true,
      enabled: opts.json !== true,
    },
    async () =>
      await callGateway({
        url: opts.url,
        token,
        password,
        method,
        params,
        expectFinal: Boolean(opts.expectFinal),
        timeoutMs: Number(opts.timeout ?? 10_000),
        clientName: GATEWAY_CLIENT_NAMES.CLI,
        mode: GATEWAY_CLIENT_MODES.CLI,
      }),
  );
};
