import {
  confirm as clackConfirm,
  intro as clackIntro,
  outro as clackOutro,
  select as clackSelect,
  text as clackText,
} from "@clack/prompts";

import { stylePromptHint, stylePromptMessage, stylePromptTitle } from "../terminal/prompt-style.js";
import { t } from "../wizard/i18n.js";

export const CONFIGURE_WIZARD_SECTIONS = [
  "workspace",
  "model",
  "web",
  "gateway",
  "daemon",
  "channels",
  "skills",
  "health",
] as const;

export type WizardSection = (typeof CONFIGURE_WIZARD_SECTIONS)[number];

export type ChannelsWizardMode = "configure" | "remove";

export type ConfigureWizardParams = {
  command: "configure" | "update";
  sections?: WizardSection[];
};

export const CONFIGURE_SECTION_OPTIONS: Array<{
  value: WizardSection;
  label: string;
  hint: string;
}> = [
    { value: "workspace", label: t("configure.sections.workspace"), hint: t("configure.sections.workspaceHint") },
    { value: "model", label: t("configure.sections.model"), hint: t("configure.sections.modelHint") },
    { value: "web", label: t("configure.sections.web"), hint: t("configure.sections.webHint") },
    { value: "gateway", label: t("configure.sections.gateway"), hint: t("configure.sections.gatewayHint") },
    {
      value: "daemon",
      label: t("configure.sections.daemon"),
      hint: t("configure.sections.daemonHint"),
    },
    {
      value: "channels",
      label: t("configure.sections.channels"),
      hint: t("configure.sections.channelsHint"),
    },
    { value: "skills", label: t("configure.sections.skills"), hint: t("configure.sections.skillsHint") },
    {
      value: "health",
      label: t("configure.sections.health"),
      hint: t("configure.sections.healthHint"),
    },
  ];

export const intro = (message: string) => clackIntro(stylePromptTitle(message) ?? message);
export const outro = (message: string) => clackOutro(stylePromptTitle(message) ?? message);
export const text = (params: Parameters<typeof clackText>[0]) =>
  clackText({
    ...params,
    message: stylePromptMessage(params.message),
  });
export const confirm = (params: Parameters<typeof clackConfirm>[0]) =>
  clackConfirm({
    ...params,
    message: stylePromptMessage(params.message),
  });
export const select = <T>(params: Parameters<typeof clackSelect<T>>[0]) =>
  clackSelect({
    ...params,
    message: stylePromptMessage(params.message),
    options: params.options.map((opt) =>
      opt.hint === undefined ? opt : { ...opt, hint: stylePromptHint(opt.hint) },
    ),
  });
