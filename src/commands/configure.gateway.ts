import type { OpenClawConfig } from "../config/config.js";
import { resolveGatewayPort } from "../config/config.js";
import { findTailscaleBinary } from "../infra/tailscale.js";
import type { RuntimeEnv } from "../runtime.js";
import { note } from "../terminal/note.js";
import { buildGatewayAuthConfig } from "./configure.gateway-auth.js";
import { t } from "../wizard/i18n.js";
import { confirm, select, text } from "./configure.shared.js";
import { guardCancel, randomToken } from "./onboard-helpers.js";

type GatewayAuthChoice = "token" | "password";

export async function promptGatewayConfig(
  cfg: OpenClawConfig,
  runtime: RuntimeEnv,
): Promise<{
  config: OpenClawConfig;
  port: number;
  token?: string;
}> {
  const portRaw = guardCancel(
    await text({
      message: t("onboarding.gatewayConfig.port"),
      initialValue: String(resolveGatewayPort(cfg)),
      validate: (value) => (Number.isFinite(Number(value)) ? undefined : t("onboarding.gatewayConfig.invalidPort")),
    }),
    runtime,
  );
  const port = Number.parseInt(String(portRaw), 10);

  let bind = guardCancel(
    await select({
      message: t("onboarding.gatewayConfig.bind"),
      options: [
        {
          value: "loopback",
          label: t("onboarding.gateway.bindLoopback"),
          hint: t("onboarding.gatewayConfig.bindLoopbackHint") || "Bind to 127.0.0.1 - secure, local-only access",
        },
        {
          value: "tailnet",
          label: t("onboarding.gateway.bindTailnet"),
          hint: t("onboarding.gatewayConfig.bindTailnetHint") || "Bind to your Tailscale IP only (100.x.x.x)",
        },
        {
          value: "auto",
          label: t("onboarding.gateway.bindAuto"),
          hint: "Prefer loopback; fall back to all interfaces if unavailable",
        },
        {
          value: "lan",
          label: t("onboarding.gateway.bindLan"),
          hint: t("onboarding.gatewayConfig.bindLanHint") || "Bind to 0.0.0.0 - accessible from anywhere on your network",
        },
        {
          value: "custom",
          label: t("onboarding.gateway.bindCustom"),
          hint: "Specify a specific IP address, with 0.0.0.0 fallback if unavailable",
        },
      ],
    }),
    runtime,
  ) as "auto" | "lan" | "loopback" | "custom" | "tailnet";

  let customBindHost: string | undefined;
  if (bind === "custom") {
    const input = guardCancel(
      await text({
        message: t("onboarding.gatewayConfig.customIp"),
        placeholder: "192.168.1.100",
        validate: (value) => {
          if (!value) return t("onboarding.gatewayConfig.customIpRequired");
          const trimmed = value.trim();
          const parts = trimmed.split(".");
          if (parts.length !== 4) return t("onboarding.gatewayConfig.invalidIp") + " (e.g., 192.168.1.100)";
          if (
            parts.every((part) => {
              const n = parseInt(part, 10);
              return !Number.isNaN(n) && n >= 0 && n <= 255 && part === String(n);
            })
          )
            return undefined;
          return t("onboarding.gatewayConfig.invalidIpOctet");
        },
      }),
      runtime,
    );
    customBindHost = typeof input === "string" ? input : undefined;
  }

  let authMode = guardCancel(
    await select({
      message: t("onboarding.gatewayConfig.auth"),
      options: [
        { value: "token", label: t("onboarding.gatewayConfig.authToken"), hint: t("onboarding.gatewayConfig.authTokenHint") },
        { value: "password", label: t("onboarding.gatewayConfig.authPassword") },
      ],
      initialValue: "token",
    }),
    runtime,
  ) as GatewayAuthChoice;

  const tailscaleMode = guardCancel(
    await select({
      message: t("onboarding.gatewayConfig.tsExposure"),
      options: [
        { value: "off", label: t("onboarding.gatewayConfig.tsOff"), hint: t("onboarding.gatewayConfig.tsOffHint") },
        {
          value: "serve",
          label: t("onboarding.gatewayConfig.tsServe"),
          hint: t("onboarding.gatewayConfig.tsServeHint"),
        },
        {
          value: "funnel",
          label: t("onboarding.gatewayConfig.tsFunnel"),
          hint: t("onboarding.gatewayConfig.tsFunnelHint"),
        },
      ],
    }),
    runtime,
  ) as "off" | "serve" | "funnel";

  // Detect Tailscale binary before proceeding with serve/funnel setup.
  if (tailscaleMode !== "off") {
    const tailscaleBin = await findTailscaleBinary();
    if (!tailscaleBin) {
      note(
        t("onboarding.gatewayConfig.tsNotFound"),
        t("onboarding.gatewayConfig.tsWarningTitle"),
      );
    }
  }

  let tailscaleResetOnExit = false;
  if (tailscaleMode !== "off") {
    note(
      ["Docs:", "https://docs.openclaw.ai/gateway/tailscale", "https://docs.openclaw.ai/web"].join(
        "\n",
      ),
      "Tailscale",
    );
    tailscaleResetOnExit = Boolean(
      guardCancel(
        await confirm({
          message: t("onboarding.gatewayConfig.tsResetConfirm"),
          initialValue: false,
        }),
        runtime,
      ),
    );
  }

  if (tailscaleMode !== "off" && bind !== "loopback") {
    note(t("onboarding.gatewayConfig.tsAdjustBind"), "Note");
    bind = "loopback";
  }

  if (tailscaleMode === "funnel" && authMode !== "password") {
    note(t("onboarding.gatewayConfig.tsFunnelAuth"), "Note");
    authMode = "password";
  }

  let gatewayToken: string | undefined;
  let gatewayPassword: string | undefined;
  let next = cfg;

  if (authMode === "token") {
    const tokenInput = guardCancel(
      await text({
        message: t("onboarding.gatewayConfig.tokenPlaceholder"),
        initialValue: randomToken(),
      }),
      runtime,
    );
    gatewayToken = String(tokenInput).trim() || randomToken();
  }

  if (authMode === "password") {
    const password = guardCancel(
      await text({
        message: t("onboarding.gatewayConfig.passwordLabel"),
        validate: (value) => (value?.trim() ? undefined : t("onboarding.gatewayConfig.passwordRequired")),
      }),
      runtime,
    );
    gatewayPassword = String(password).trim();
  }

  const authConfig = buildGatewayAuthConfig({
    existing: next.gateway?.auth,
    mode: authMode,
    token: gatewayToken,
    password: gatewayPassword,
  });

  next = {
    ...next,
    gateway: {
      ...next.gateway,
      mode: "local",
      port,
      bind,
      auth: authConfig,
      ...(customBindHost && { customBindHost }),
      tailscale: {
        ...next.gateway?.tailscale,
        mode: tailscaleMode,
        resetOnExit: tailscaleResetOnExit,
      },
    },
  };

  return { config: next, port, token: gatewayToken };
}
