/**
 * Plugin Command Picker — Generic Discord component framework for plugin commands.
 *
 * Allows plugins to return structured Discord component specs (buttons, selects)
 * that are rendered as Carbon Container components, following the model-picker pattern.
 */

import {
  Button,
  Container,
  Row,
  Separator,
  StringSelectMenu,
  TextDisplay,
  type ComponentData,
  type MessagePayloadObject,
  type TopLevelComponents,
} from "@buape/carbon";
import type { APISelectMenuOption } from "discord-api-types/v10";
import { ButtonStyle } from "discord-api-types/v10";

// ---------------------------------------------------------------------------
// Types — Spec returned by plugin command handlers via channelData.discord
// ---------------------------------------------------------------------------

export type PluginCommandDiscordButton = {
  label: string;
  callbackArgs: string;
  style?: "primary" | "secondary" | "success" | "danger";
  disabled?: boolean;
};

export type PluginCommandDiscordSelectOption = {
  label: string;
  value: string;
  callbackArgs: string;
  description?: string;
  isDefault?: boolean;
};

export type PluginCommandDiscordRow =
  | { type: "buttons"; items: PluginCommandDiscordButton[] }
  | {
      type: "select";
      placeholder?: string;
      options: PluginCommandDiscordSelectOption[];
    };

export type PluginCommandDiscordSpec = {
  title?: string;
  details?: string[];
  rows: PluginCommandDiscordRow[];
  footer?: string;
};

// ---------------------------------------------------------------------------
// Custom ID encoding
// ---------------------------------------------------------------------------

export const PLUGIN_CMD_CUSTOM_ID_KEY = "plgcmd";
const CUSTOM_ID_MAX_CHARS = 100;

function encodeValue(value: string): string {
  return encodeURIComponent(value);
}

function decodeValue(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function buildPluginCommandCustomId(params: {
  plugin: string;
  callbackArgs: string;
  userId: string;
}): string {
  const parts = [
    `${PLUGIN_CMD_CUSTOM_ID_KEY}:p=${encodeValue(params.plugin)}`,
    `a=${encodeValue(params.callbackArgs)}`,
    `u=${encodeValue(params.userId)}`,
  ];
  const customId = parts.join(";");
  if (customId.length > CUSTOM_ID_MAX_CHARS) {
    throw new Error(
      `Plugin command custom_id exceeds ${CUSTOM_ID_MAX_CHARS} chars (${customId.length})`,
    );
  }
  return customId;
}

export type PluginCommandCustomIdParsed = {
  plugin: string;
  callbackArgs: string;
  userId: string;
};

export function parsePluginCommandCustomId(customId: string): PluginCommandCustomIdParsed | null {
  const trimmed = customId.trim();
  if (!trimmed.startsWith(`${PLUGIN_CMD_CUSTOM_ID_KEY}:`)) {
    return null;
  }
  const rawParts = trimmed.split(";");
  const data: Record<string, string> = {};
  for (const part of rawParts) {
    const eqIndex = part.indexOf("=");
    if (eqIndex <= 0) {
      continue;
    }
    const rawKey = part.slice(0, eqIndex);
    const rawValue = part.slice(eqIndex + 1);
    const key = rawKey.includes(":") ? rawKey.split(":").slice(1).join(":") : rawKey;
    if (!key) {
      continue;
    }
    data[key] = rawValue;
  }
  return parsePluginCommandPickerData(data);
}

export function parsePluginCommandPickerData(
  data: ComponentData,
): PluginCommandCustomIdParsed | null {
  if (!data || typeof data !== "object") {
    return null;
  }
  const coerce = (value: unknown) =>
    typeof value === "string" || typeof value === "number" ? String(value) : "";
  const plugin = decodeValue(coerce(data.p));
  const callbackArgs = decodeValue(coerce(data.a));
  const userId = decodeValue(coerce(data.u));
  if (!plugin || !userId) {
    return null;
  }
  return { plugin, callbackArgs: callbackArgs ?? "", userId };
}

// ---------------------------------------------------------------------------
// Button style mapping
// ---------------------------------------------------------------------------

function mapButtonStyle(style?: string): ButtonStyle {
  switch (style) {
    case "primary":
      return ButtonStyle.Primary;
    case "success":
      return ButtonStyle.Success;
    case "danger":
      return ButtonStyle.Danger;
    case "secondary":
    default:
      return ButtonStyle.Secondary;
  }
}

// ---------------------------------------------------------------------------
// Component factories (mirrors createModelPickerButton / createModelSelect)
// ---------------------------------------------------------------------------

export function createPluginCommandButton(params: {
  label: string;
  customId: string;
  style?: ButtonStyle;
  disabled?: boolean;
}): Button {
  class PluginCmdButton extends Button {
    label = params.label;
    customId = params.customId;
    style = params.style ?? ButtonStyle.Secondary;
    disabled = params.disabled ?? false;
  }
  return new PluginCmdButton();
}

export function createPluginCommandSelect(params: {
  customId: string;
  options: APISelectMenuOption[];
  placeholder?: string;
  disabled?: boolean;
}): StringSelectMenu {
  class PluginCmdSelect extends StringSelectMenu {
    customId = params.customId;
    options = params.options;
    minValues = 1;
    maxValues = 1;
    placeholder = params.placeholder;
    disabled = params.disabled ?? false;
  }
  return new PluginCmdSelect();
}

// ---------------------------------------------------------------------------
// Render spec → Carbon components
// ---------------------------------------------------------------------------

type PluginCommandRow = Row<Button> | Row<StringSelectMenu>;

export type PluginCommandRenderedView = {
  components: TopLevelComponents[];
};

export function renderPluginCommandView(
  spec: PluginCommandDiscordSpec,
  pluginName: string,
  userId: string,
): PluginCommandRenderedView {
  const containerComponents: Array<TextDisplay | Separator | PluginCommandRow> = [];

  // Title
  const title = spec.title ?? pluginName;
  containerComponents.push(new TextDisplay(`## ${title}`));

  // Detail lines
  if (spec.details && spec.details.length > 0) {
    containerComponents.push(new TextDisplay(spec.details.join("\n")));
  }

  containerComponents.push(new Separator({ divider: true, spacing: "small" }));

  // Rows
  for (const row of spec.rows) {
    if (row.type === "buttons") {
      const buttons = row.items.map((item) =>
        createPluginCommandButton({
          label: item.label,
          customId: buildPluginCommandCustomId({
            plugin: pluginName,
            callbackArgs: item.callbackArgs,
            userId,
          }),
          style: mapButtonStyle(item.style),
          disabled: item.disabled,
        }),
      );
      if (buttons.length > 0) {
        containerComponents.push(new Row(buttons));
      }
    } else if (row.type === "select") {
      const options: APISelectMenuOption[] = row.options.map((opt) => ({
        label: opt.label,
        value: opt.callbackArgs,
        description: opt.description,
        default: opt.isDefault,
      }));
      // The customId for a select uses the first option's callbackArgs as a seed.
      // When the user picks a value, the selected value IS the callbackArgs.
      const selectCustomId = buildPluginCommandCustomId({
        plugin: pluginName,
        callbackArgs: "__select__",
        userId,
      });
      const select = createPluginCommandSelect({
        customId: selectCustomId,
        options,
        placeholder: row.placeholder,
      });
      containerComponents.push(new Row([select]));
    }
  }

  // Footer
  if (spec.footer) {
    containerComponents.push(new Separator({ divider: false, spacing: "small" }));
    containerComponents.push(new TextDisplay(`-# ${spec.footer}`));
  }

  const container = new Container(containerComponents);
  return { components: [container] };
}

// ---------------------------------------------------------------------------
// Payload converters
// ---------------------------------------------------------------------------

export function toPluginCommandPickerPayload(
  view: PluginCommandRenderedView,
): MessagePayloadObject {
  return { components: view.components };
}

export function buildPluginCommandNoticePayload(text: string): { components: Container[] } {
  return {
    components: [new Container([new TextDisplay(text)])],
  };
}
