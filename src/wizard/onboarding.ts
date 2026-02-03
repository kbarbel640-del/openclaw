import type {
  GatewayAuthChoice,
  OnboardMode,
  OnboardOptions,
  ResetScope,
} from "../commands/onboard-types.js";
import type { OpenClawConfig } from "../config/config.js";
import type { RuntimeEnv } from "../runtime.js";
import type { QuickstartGatewayDefaults, WizardFlow } from "./onboarding.types.js";
import { ensureAuthProfileStore } from "../agents/auth-profiles.js";
import { listChannelPlugins } from "../channels/plugins/index.js";
import { formatCliCommand } from "../cli/command-format.js";
import { installCompletion } from "../cli/completion-cli.js";
import { promptAuthChoiceGrouped } from "../commands/auth-choice-prompt.js";
import {
  applyAuthChoice,
  resolvePreferredProviderForAuthChoice,
  warnIfModelConfigLooksOff,
} from "../commands/auth-choice.js";
import { applyPrimaryModel, promptDefaultModel } from "../commands/model-picker.js";
import { setupChannels } from "../commands/onboard-channels.js";
import {
  applyWizardMetadata,
  DEFAULT_WORKSPACE,
  ensureWorkspaceAndSessions,
  handleReset,
  printWizardHeader,
  probeGatewayReachable,
  summarizeExistingConfig,
} from "../commands/onboard-helpers.js";
import { setupInternalHooks } from "../commands/onboard-hooks.js";
import { promptRemoteGatewayConfig } from "../commands/onboard-remote.js";
import { setupSkills } from "../commands/onboard-skills.js";
import {
  DEFAULT_GATEWAY_PORT,
  readConfigFileSnapshot,
  resolveGatewayPort,
  writeConfigFile,
} from "../config/config.js";
import { logConfigUpdated } from "../config/logging.js";
import { defaultRuntime } from "../runtime.js";
import { resolveUserPath } from "../utils.js";
import { finalizeOnboardingWizard } from "./onboarding.finalize.js";
import { configureGatewayForOnboarding } from "./onboarding.gateway-config.js";
import { WizardCancelledError, type WizardPrompter } from "./prompts.js";
import { getLocale, type Locale, setLocale, t } from "../i18n/index.js";

async function requireRiskAcknowledgement(params: {
  opts: OnboardOptions;
  prompter: WizardPrompter;
}) {
  if (params.opts.acceptRisk === true) {
    return;
  }

  await params.prompter.note(t().wizard.securityWarning, t().wizard.securityTitle);
  const ok = await params.prompter.confirm({
    message: t().wizard.riskConfirm,
    initialValue: false,
  });
  if (!ok) {
    throw new WizardCancelledError("risk not accepted");
  }
}

export async function runOnboardingWizard(
  opts: OnboardOptions,
  runtime: RuntimeEnv = defaultRuntime,
  prompter: WizardPrompter,
) {
  printWizardHeader(runtime);

  const snapshot = await readConfigFileSnapshot();
  const initialConfig: OpenClawConfig = snapshot.valid ? snapshot.config : {};

  // Language selection
  const selectedLocale = await prompter.select<Locale>({
    message: "Select Language / 选择语言",
    options: [
      { value: "en", label: "English" },
      { value: "zh-CN", label: "简体中文" },
    ],
    initialValue: initialConfig.language ?? getLocale(),
  });
  setLocale(selectedLocale);

  await prompter.intro(t().wizard.intro);
  await requireRiskAcknowledgement({ opts, prompter });

  let baseConfig: OpenClawConfig = {
    ...initialConfig,
    language: selectedLocale,
  };

  if (snapshot.exists && !snapshot.valid) {
    await prompter.note(summarizeExistingConfig(baseConfig), t().wizard.invalidConfig);
    if (snapshot.issues.length > 0) {
      await prompter.note(
        [
          ...snapshot.issues.map((iss) => `- ${iss.path}: ${iss.message}`),
          "",
          "Docs: https://docs.openclaw.ai/gateway/configuration",
        ].join("\n"),
        t().wizard.configIssues,
      );
    }
    await prompter.outro(t().wizard.configInvalidOutro(formatCliCommand("openclaw doctor")));
    runtime.exit(1);
    return;
  }

  const quickstartHint = `Configure details later via ${formatCliCommand("openclaw configure")}.`;
  const manualHint = "Configure port, network, Tailscale, and auth options.";
  const explicitFlowRaw = opts.flow?.trim();
  const normalizedExplicitFlow = explicitFlowRaw === "manual" ? "advanced" : explicitFlowRaw;
  if (
    normalizedExplicitFlow &&
    normalizedExplicitFlow !== "quickstart" &&
    normalizedExplicitFlow !== "advanced"
  ) {
    runtime.error(t().wizard.onboardingModeSelectError);
    runtime.exit(1);
    return;
  }
  const explicitFlow: WizardFlow | undefined =
    normalizedExplicitFlow === "quickstart" || normalizedExplicitFlow === "advanced"
      ? normalizedExplicitFlow
      : undefined;
  let flow: WizardFlow =
    explicitFlow ??
    (await prompter.select({
      message: t().wizard.onboardingMode,
      options: [
        {
          value: "quickstart",
          label: t().wizard.quickstartLabel,
          hint: t().wizard.quickstartHint(formatCliCommand("openclaw configure")),
        },
        { value: "advanced", label: t().wizard.manualLabel, hint: t().wizard.manualHint },
      ],
      initialValue: "quickstart",
    }));

  if (opts.mode === "remote" && flow === "quickstart") {
    await prompter.note(t().wizard.quickstartSwitchToManual, t().wizard.quickstartLabel);
    flow = "advanced";
  }

  if (snapshot.exists) {
    await prompter.note(summarizeExistingConfig(baseConfig), t().wizard.existingConfigDetected);

    const action = await prompter.select({
      message: t().wizard.configHandling,
      options: [
        { value: "keep", label: t().wizard.configHandlingUseExisting },
        { value: "modify", label: t().wizard.configHandlingUpdate },
        { value: "reset", label: t().wizard.configHandlingReset },
      ],
    });

    if (action === "reset") {
      const workspaceDefault = baseConfig.agents?.defaults?.workspace ?? DEFAULT_WORKSPACE;
      const resetScope = (await prompter.select({
        message: t().wizard.resetScope,
        options: [
          { value: "config", label: t().wizard.resetScopeConfig },
          {
            value: "config+creds+sessions",
            label: t().wizard.resetScopeConfigCredsSessions,
          },
          {
            value: "full",
            label: t().wizard.resetScopeFull,
          },
        ],
      })) as ResetScope;
      await handleReset(resetScope, resolveUserPath(workspaceDefault), runtime);
      baseConfig = {};
    }
  }

  const quickstartGateway: QuickstartGatewayDefaults = (() => {
    const hasExisting =
      typeof baseConfig.gateway?.port === "number" ||
      baseConfig.gateway?.bind !== undefined ||
      baseConfig.gateway?.auth?.mode !== undefined ||
      baseConfig.gateway?.auth?.token !== undefined ||
      baseConfig.gateway?.auth?.password !== undefined ||
      baseConfig.gateway?.customBindHost !== undefined ||
      baseConfig.gateway?.tailscale?.mode !== undefined;

    const bindRaw = baseConfig.gateway?.bind;
    const bind =
      bindRaw === "loopback" ||
        bindRaw === "lan" ||
        bindRaw === "auto" ||
        bindRaw === "custom" ||
        bindRaw === "tailnet"
        ? bindRaw
        : "loopback";

    let authMode: GatewayAuthChoice = "token";
    if (
      baseConfig.gateway?.auth?.mode === "token" ||
      baseConfig.gateway?.auth?.mode === "password"
    ) {
      authMode = baseConfig.gateway.auth.mode;
    } else if (baseConfig.gateway?.auth?.token) {
      authMode = "token";
    } else if (baseConfig.gateway?.auth?.password) {
      authMode = "password";
    }

    const tailscaleRaw = baseConfig.gateway?.tailscale?.mode;
    const tailscaleMode =
      tailscaleRaw === "off" || tailscaleRaw === "serve" || tailscaleRaw === "funnel"
        ? tailscaleRaw
        : "off";

    return {
      hasExisting,
      port: resolveGatewayPort(baseConfig),
      bind,
      authMode,
      tailscaleMode,
      token: baseConfig.gateway?.auth?.token,
      password: baseConfig.gateway?.auth?.password,
      customBindHost: baseConfig.gateway?.customBindHost,
      tailscaleResetOnExit: baseConfig.gateway?.tailscale?.resetOnExit ?? false,
    };
  })();

  if (flow === "quickstart") {
    const formatBind = (value: "loopback" | "lan" | "auto" | "custom" | "tailnet") => {
      if (value === "loopback") {
        return t().wizard.bindLoopback;
      }
      if (value === "lan") {
        return t().wizard.bindLan;
      }
      if (value === "custom") {
        return t().wizard.bindCustom;
      }
      if (value === "tailnet") {
        return t().wizard.bindTailnet;
      }
      return t().wizard.bindAuto;
    };
    const formatAuth = (value: GatewayAuthChoice) => {
      if (value === "token") {
        return t().wizard.authTokenDefault;
      }
      return t().wizard.authPassword;
    };
    const formatTailscale = (value: "off" | "serve" | "funnel") => {
      if (value === "off") {
        return t().wizard.tailscaleOff;
      }
      if (value === "serve") {
        return t().wizard.tailscaleServe;
      }
      return t().wizard.tailscaleFunnel;
    };
    const quickstartLines = quickstartGateway.hasExisting
      ? [
        t().wizard.keepExistingSettings,
        `${t().wizard.gatewayPort}: ${quickstartGateway.port}`,
        `${t().wizard.gatewayBind}: ${formatBind(quickstartGateway.bind)}`,
        ...(quickstartGateway.bind === "custom" && quickstartGateway.customBindHost
          ? [`${t().wizard.gatewayCustomIp}: ${quickstartGateway.customBindHost}`]
          : []),
        `${t().wizard.gatewayAuth}: ${formatAuth(quickstartGateway.authMode)}`,
        `${t().wizard.tailscaleExposure}: ${formatTailscale(quickstartGateway.tailscaleMode)}`,
        t().wizard.directToChannels,
      ]
      : [
        `${t().wizard.gatewayPort}: ${DEFAULT_GATEWAY_PORT}`,
        `${t().wizard.gatewayBind}: ${t().wizard.bindLoopback}`,
        `${t().wizard.gatewayAuth}: ${t().wizard.authTokenDefault}`,
        `${t().wizard.tailscaleExposure}: ${t().wizard.tailscaleOff}`,
        t().wizard.directToChannels,
      ];
    await prompter.note(quickstartLines.join("\n"), t().wizard.quickstartNote);
  }

  const localPort = resolveGatewayPort(baseConfig);
  const localUrl = `ws://127.0.0.1:${localPort}`;
  const localProbe = await probeGatewayReachable({
    url: localUrl,
    token: baseConfig.gateway?.auth?.token ?? process.env.OPENCLAW_GATEWAY_TOKEN,
    password: baseConfig.gateway?.auth?.password ?? process.env.OPENCLAW_GATEWAY_PASSWORD,
  });
  const remoteUrl = baseConfig.gateway?.remote?.url?.trim() ?? "";
  const remoteProbe = remoteUrl
    ? await probeGatewayReachable({
      url: remoteUrl,
      token: baseConfig.gateway?.remote?.token,
    })
    : null;

  const mode =
    opts.mode ??
    (flow === "quickstart"
      ? "local"
      : ((await prompter.select({
        message: t().wizard.setupChoiceTitle,
        options: [
          {
            value: "local",
            label: t().wizard.localGatewayLabel,
            hint: localProbe.ok
              ? t().wizard.gatewayReachable(localUrl)
              : t().wizard.noGatewayDetected(localUrl),
          },
          {
            value: "remote",
            label: t().wizard.remoteGatewayLabel,
            hint: !remoteUrl
              ? t().wizard.noRemoteUrl
              : remoteProbe?.ok
                ? t().wizard.gatewayReachable(remoteUrl)
                : t().wizard.remoteGatewayUnreachable(remoteUrl),
          },
        ],
      })) as OnboardMode));

  if (mode === "remote") {
    let nextConfig = await promptRemoteGatewayConfig(baseConfig, prompter);
    nextConfig = applyWizardMetadata(nextConfig, { command: "onboard", mode });
    await writeConfigFile(nextConfig);
    logConfigUpdated(runtime);
    await prompter.outro(t().wizard.remoteGatewayConfigured);
    return;
  }

  const workspaceInput =
    opts.workspace ??
    (flow === "quickstart"
      ? (baseConfig.agents?.defaults?.workspace ?? DEFAULT_WORKSPACE)
      : await prompter.text({
        message: t().wizard.workspaceDirLabel,
        initialValue: baseConfig.agents?.defaults?.workspace ?? DEFAULT_WORKSPACE,
      }));

  const workspaceDir = resolveUserPath(workspaceInput.trim() || DEFAULT_WORKSPACE);

  let nextConfig: OpenClawConfig = {
    ...baseConfig,
    agents: {
      ...baseConfig.agents,
      defaults: {
        ...baseConfig.agents?.defaults,
        workspace: workspaceDir,
      },
    },
    gateway: {
      ...baseConfig.gateway,
      mode: "local",
    },
  };

  const authStore = ensureAuthProfileStore(undefined, {
    allowKeychainPrompt: false,
  });
  const authChoiceFromPrompt = opts.authChoice === undefined;
  const authChoice =
    opts.authChoice ??
    (await promptAuthChoiceGrouped({
      prompter,
      store: authStore,
      includeSkip: true,
    }));

  const authResult = await applyAuthChoice({
    authChoice,
    config: nextConfig,
    prompter,
    runtime,
    setDefaultModel: true,
    opts: {
      tokenProvider: opts.tokenProvider,
      token: opts.authChoice === "apiKey" && opts.token ? opts.token : undefined,
    },
  });
  nextConfig = authResult.config;

  if (authChoiceFromPrompt) {
    const modelSelection = await promptDefaultModel({
      config: nextConfig,
      prompter,
      allowKeep: true,
      ignoreAllowlist: true,
      preferredProvider: resolvePreferredProviderForAuthChoice(authChoice),
    });
    if (modelSelection.model) {
      nextConfig = applyPrimaryModel(nextConfig, modelSelection.model);
    }
  }

  await warnIfModelConfigLooksOff(nextConfig, prompter);

  const gateway = await configureGatewayForOnboarding({
    flow,
    baseConfig,
    nextConfig,
    localPort,
    quickstartGateway,
    prompter,
    runtime,
  });
  nextConfig = gateway.nextConfig;
  const settings = gateway.settings;

  if (opts.skipChannels ?? opts.skipProviders) {
    await prompter.note(t().wizard.skippingChannels, t().wizard.channelsNote);
  } else {
    const quickstartAllowFromChannels =
      flow === "quickstart"
        ? listChannelPlugins()
          .filter((plugin) => plugin.meta.quickstartAllowFrom)
          .map((plugin) => plugin.id)
        : [];
    nextConfig = await setupChannels(nextConfig, runtime, prompter, {
      allowSignalInstall: true,
      forceAllowFromChannels: quickstartAllowFromChannels,
      skipDmPolicyPrompt: flow === "quickstart",
      skipConfirm: flow === "quickstart",
      quickstartDefaults: flow === "quickstart",
    });
  }

  await writeConfigFile(nextConfig);
  logConfigUpdated(runtime);
  await ensureWorkspaceAndSessions(workspaceDir, runtime, {
    skipBootstrap: Boolean(nextConfig.agents?.defaults?.skipBootstrap),
  });

  if (opts.skipSkills) {
    await prompter.note(t().wizard.skippingSkills, t().wizard.skillsNote);
  } else {
    nextConfig = await setupSkills(nextConfig, workspaceDir, runtime, prompter);
  }

  // Setup hooks (session memory on /new)
  nextConfig = await setupInternalHooks(nextConfig, runtime, prompter);

  nextConfig = applyWizardMetadata(nextConfig, { command: "onboard", mode });
  await writeConfigFile(nextConfig);

  await finalizeOnboardingWizard({
    flow,
    opts,
    baseConfig,
    nextConfig,
    workspaceDir,
    settings,
    prompter,
    runtime,
  });

  const installShell = await prompter.confirm({
    message: t().wizard.installShellCompletion,
    initialValue: true,
  });

  if (installShell) {
    const shell = process.env.SHELL?.split("/").pop() || "zsh";
    // We pass 'yes=true' to skip any double-confirmation inside the helper,
    // as the wizard prompt above serves as confirmation.
    await installCompletion(shell, true);
  }
}
