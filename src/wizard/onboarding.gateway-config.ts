import type { GatewayAuthChoice } from "../commands/onboard-types.js";
import type { GatewayBindMode, GatewayTailscaleMode, OpenClawConfig } from "../config/config.js";
import type { RuntimeEnv } from "../runtime.js";
import type {
  GatewayWizardSettings,
  QuickstartGatewayDefaults,
  WizardFlow,
} from "./onboarding.types.js";
import type { WizardPrompter } from "./prompts.js";
import { normalizeGatewayTokenInput, randomToken } from "../commands/onboard-helpers.js";
import { findTailscaleBinary } from "../infra/tailscale.js";
import { t } from "../i18n/index.js";

type ConfigureGatewayOptions = {
  flow: WizardFlow;
  baseConfig: OpenClawConfig;
  nextConfig: OpenClawConfig;
  localPort: number;
  quickstartGateway: QuickstartGatewayDefaults;
  prompter: WizardPrompter;
  runtime: RuntimeEnv;
};

type ConfigureGatewayResult = {
  nextConfig: OpenClawConfig;
  settings: GatewayWizardSettings;
};

export async function configureGatewayForOnboarding(
  opts: ConfigureGatewayOptions,
): Promise<ConfigureGatewayResult> {
  const { flow, localPort, quickstartGateway, prompter } = opts;
  let { nextConfig } = opts;

  const port =
    flow === "quickstart"
      ? quickstartGateway.port
      : Number.parseInt(
        String(
          await prompter.text({
            message: t().wizard.gatewayPort,
            initialValue: String(localPort),
            validate: (value) => (Number.isFinite(Number(value)) ? undefined : t().wizard.invalidPort),
          }),
        ),
        10,
      );

  let bind: GatewayWizardSettings["bind"] =
    flow === "quickstart"
      ? quickstartGateway.bind
      : await prompter.select<GatewayWizardSettings["bind"]>({
        message: t().wizard.gatewayBind,
        options: [
          { value: "loopback", label: t().wizard.bindLoopback },
          { value: "lan", label: t().wizard.bindLan },
          { value: "tailnet", label: t().wizard.bindTailnet },
          { value: "auto", label: t().wizard.bindAuto },
          { value: "custom", label: t().wizard.bindCustom },
        ],
      });

  let customBindHost = quickstartGateway.customBindHost;
  if (bind === "custom") {
    const needsPrompt = flow !== "quickstart" || !customBindHost;
    if (needsPrompt) {
      const input = await prompter.text({
        message: t().wizard.customIpAddress,
        placeholder: "192.168.1.100",
        initialValue: customBindHost ?? "",
        validate: (value) => {
          if (!value) {
            return t().wizard.ipRequired;
          }
          const trimmed = value.trim();
          const parts = trimmed.split(".");
          if (parts.length !== 4) {
            return t().wizard.invalidIpv4;
          }
          if (
            parts.every((part) => {
              const n = parseInt(part, 10);
              return !Number.isNaN(n) && n >= 0 && n <= 255 && part === String(n);
            })
          ) {
            return undefined;
          }
          return t().wizard.invalidIpv4Octet;
        },
      });
      customBindHost = typeof input === "string" ? input.trim() : undefined;
    }
  }

  let authMode =
    flow === "quickstart"
      ? quickstartGateway.authMode
      : ((await prompter.select({
        message: t().wizard.gatewayAuth,
        options: [
          {
            value: "token",
            label: "Token",
            hint: t().wizard.authHintToken,
          },
          { value: "password", label: "Password" },
        ],
        initialValue: "token",
      })) as GatewayAuthChoice);

  const tailscaleMode: GatewayWizardSettings["tailscaleMode"] =
    flow === "quickstart"
      ? quickstartGateway.tailscaleMode
      : await prompter.select<GatewayWizardSettings["tailscaleMode"]>({
        message: t().wizard.tailscaleExposure,
        options: [
          { value: "off", label: t().wizard.tailscaleOff, hint: t().wizard.tailscaleHintOff },
          {
            value: "serve",
            label: t().wizard.tailscaleServe,
            hint: t().wizard.tailscaleHintServe,
          },
          {
            value: "funnel",
            label: t().wizard.tailscaleFunnel,
            hint: t().wizard.tailscaleHintFunnel,
          },
        ],
      });

  // Detect Tailscale binary before proceeding with serve/funnel setup.
  if (tailscaleMode !== "off") {
    const tailscaleBin = await findTailscaleBinary();
    if (!tailscaleBin) {
      await prompter.note(t().wizard.tailscaleNotFound, "Tailscale Warning");
    }
  }

  let tailscaleResetOnExit = flow === "quickstart" ? quickstartGateway.tailscaleResetOnExit : false;
  if (tailscaleMode !== "off" && flow !== "quickstart") {
    await prompter.note(
      ["Docs:", "https://docs.openclaw.ai/gateway/tailscale", "https://docs.openclaw.ai/web"].join(
        "\n",
      ),
      "Tailscale",
    );
    tailscaleResetOnExit = Boolean(
      await prompter.confirm({
        message: t().wizard.tailscaleResetOnExit,
        initialValue: false,
      }),
    );
  }

  // Safety + constraints:
  // - Tailscale wants bind=loopback so we never expose a non-loopback server + tailscale serve/funnel at once.
  // - Funnel requires password auth.
  if (tailscaleMode !== "off" && bind !== "loopback") {
    await prompter.note(t().wizard.tailscaleRequiresLoopback, "Note");
    bind = "loopback";
    customBindHost = undefined;
  }

  if (tailscaleMode === "funnel" && authMode !== "password") {
    await prompter.note(t().wizard.tailscaleFunnelRequiresPassword, "Note");
    authMode = "password";
  }

  let gatewayToken: string | undefined;
  if (authMode === "token") {
    if (flow === "quickstart") {
      gatewayToken = quickstartGateway.token ?? randomToken();
    } else {
      const tokenInput = await prompter.text({
        message: t().wizard.gatewayTokenLabel,
        placeholder: t().wizard.gatewayTokenPlaceholder,
        initialValue: quickstartGateway.token ?? "",
      });
      gatewayToken = normalizeGatewayTokenInput(tokenInput) || randomToken();
    }
  }

  if (authMode === "password") {
    const password =
      flow === "quickstart" && quickstartGateway.password
        ? quickstartGateway.password
        : await prompter.text({
          message: t().wizard.gatewayPasswordLabel,
          validate: (value) => (value?.trim() ? undefined : t().wizard.passwordRequired),
        });
    nextConfig = {
      ...nextConfig,
      gateway: {
        ...nextConfig.gateway,
        auth: {
          ...nextConfig.gateway?.auth,
          mode: "password",
          password: String(password).trim(),
        },
      },
    };
  } else if (authMode === "token") {
    nextConfig = {
      ...nextConfig,
      gateway: {
        ...nextConfig.gateway,
        auth: {
          ...nextConfig.gateway?.auth,
          mode: "token",
          token: gatewayToken,
        },
      },
    };
  }

  nextConfig = {
    ...nextConfig,
    gateway: {
      ...nextConfig.gateway,
      port,
      bind: bind as GatewayBindMode,
      ...(bind === "custom" && customBindHost ? { customBindHost } : {}),
      tailscale: {
        ...nextConfig.gateway?.tailscale,
        mode: tailscaleMode as GatewayTailscaleMode,
        resetOnExit: tailscaleResetOnExit,
      },
    },
  };

  return {
    nextConfig,
    settings: {
      port,
      bind: bind as GatewayBindMode,
      customBindHost: bind === "custom" ? customBindHost : undefined,
      authMode,
      gatewayToken,
      tailscaleMode: tailscaleMode as GatewayTailscaleMode,
      tailscaleResetOnExit,
    },
  };
}
