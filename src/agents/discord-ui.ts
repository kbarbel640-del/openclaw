/**
 * Discord 富 UI 组件库 - 选择菜单、模态框、媒体画廊
 */

import type { OpenClawConfig } from "../config/config.js";
import { callGateway } from "../gateway/call.js";
import { generateUUID } from "../utils/uuid.js";

// ============================================================================
// 选择菜单 (Select Menus)
// ============================================================================

export type SelectOption = {
  label: string;
  value: string;
  description?: string;
  emoji?: string;
  default?: boolean;
};

export type SelectMenuType =
  | "string" // 字符串选择 (type: 3)
  | "user" // 用户选择 (type: 5)
  | "role" // 角色选择 (type: 6)
  | "mentionable" // 可提及选择 (type: 7)
  | "channel"; // 频道选择 (type: 8)

export type SelectMenuConfig = {
  type: SelectMenuType;
  placeholder?: string;
  options?: SelectOption[]; // string 类型需要
  minValues?: number;
  maxValues?: number;
  disabled?: boolean;
};

const SELECT_MENU_TYPES: Record<SelectMenuType, number> = {
  string: 3,
  user: 5,
  role: 6,
  mentionable: 7,
  channel: 8,
};

/**
 * 发送选择菜单消息
 */
export async function sendSelectMenu(params: {
  cfg: OpenClawConfig;
  channel: string;
  content: string;
  selectMenu: SelectMenuConfig;
  customId?: string;
}): Promise<{ messageId: string; customId: string } | null> {
  const customId = params.customId ?? `select:${generateUUID()}`;

  const menuComponent: Record<string, unknown> = {
    type: 1, // ActionRow
    components: [
      {
        type: SELECT_MENU_TYPES[params.selectMenu.type],
        custom_id: customId,
        placeholder: params.selectMenu.placeholder ?? "请选择...",
        min_values: params.selectMenu.minValues ?? 1,
        max_values: params.selectMenu.maxValues ?? 1,
        disabled: params.selectMenu.disabled ?? false,
      },
    ],
  };

  // String select 需要 options
  if (params.selectMenu.type === "string" && params.selectMenu.options) {
    (menuComponent.components[0] as Record<string, unknown>).options =
      params.selectMenu.options.map((opt) => ({
        label: opt.label,
        value: opt.value,
        description: opt.description,
        emoji: opt.emoji ? { name: opt.emoji } : undefined,
        default: opt.default ?? false,
      }));
  }

  try {
    const result = await callGateway({
      config: params.cfg,
      method: "message.send",
      params: {
        channel: params.channel,
        content: params.content,
        components: [menuComponent],
      },
    });

    if (!result.success) {
      console.error("[SELECT_MENU] Failed:", result.error);
      return null;
    }

    return {
      messageId: result.data?.messageId ?? "",
      customId,
    };
  } catch (err) {
    console.error("[SELECT_MENU] Error:", err);
    return null;
  }
}

/**
 * 发送模型选择菜单
 */
export async function sendModelPicker(params: {
  cfg: OpenClawConfig;
  channel: string;
  placeholder?: string;
}): Promise<{ messageId: string; customId: string } | null> {
  return sendSelectMenu({
    cfg: params.cfg,
    channel: params.channel,
    content: "🤖 **选择 AI 模型**",
    selectMenu: {
      type: "string",
      placeholder: params.placeholder ?? "选择要使用的模型...",
      options: [
        {
          label: "Kimi K2.5",
          value: "kimi-coding/k2p5",
          emoji: "🌙",
          description: "擅长代码和中文",
        },
        {
          label: "GPT-5.3 Codex",
          value: "openai-codex/gpt-5.3-codex",
          emoji: "🤖",
          description: "最强代码能力",
        },
        { label: "GPT-5.2", value: "openai/gpt-5.2", emoji: "🧠", description: "通用能力强" },
        {
          label: "Claude 4",
          value: "anthropic/claude-4",
          emoji: "🎭",
          description: "长上下文专家",
        },
      ],
    },
  });
}

/**
 * 发送 Agent 选择菜单
 */
export async function sendAgentPicker(params: {
  cfg: OpenClawConfig;
  channel: string;
  agents: Array<{ id: string; name: string; description?: string; emoji?: string }>;
}): Promise<{ messageId: string; customId: string } | null> {
  return sendSelectMenu({
    cfg: params.cfg,
    channel: params.channel,
    content: "🎯 **选择 Agent**",
    selectMenu: {
      type: "string",
      placeholder: "选择要使用的 Agent...",
      options: params.agents.map((a) => ({
        label: a.name,
        value: a.id,
        description: a.description,
        emoji: a.emoji,
      })),
    },
  });
}

// ============================================================================
// 模态框 (Modals)
// ============================================================================

export type ModalTextInput = {
  label: string;
  style: "short" | "paragraph";
  placeholder?: string;
  value?: string;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
};

export type ModalConfig = {
  title: string;
  inputs: Array<{
    id: string;
    config: ModalTextInput;
  }>;
};

/**
 * 显示模态框（通过响应 interaction）
 *
 * NOTE: 模态框只能在响应 interaction 时显示，不能主动发送
 * 需要先收到按钮点击或选择菜单的 interaction 才能打开模态框
 */
export function buildModalResponse(config: ModalConfig): Record<string, unknown> {
  return {
    type: 9, // MODAL
    data: {
      title: config.title,
      custom_id: `modal:${generateUUID()}`,
      components: config.inputs.map((input) => ({
        type: 1, // ActionRow
        components: [
          {
            type: 4, // TEXT_INPUT
            custom_id: input.id,
            label: input.config.label,
            style: input.config.style === "paragraph" ? 2 : 1,
            placeholder: input.config.placeholder,
            value: input.config.value,
            required: input.config.required ?? true,
            min_length: input.config.minLength,
            max_length: input.config.maxLength,
          },
        ],
      })),
    },
  };
}

/**
 * 创建子区模态框预设
 */
export function buildCreateThreadModal(): Record<string, unknown> {
  return buildModalResponse({
    title: "📝 创建子区",
    inputs: [
      {
        id: "thread_title",
        config: {
          label: "子区标题",
          style: "short",
          placeholder: "输入子区标题...",
          maxLength: 100,
          required: true,
        },
      },
      {
        id: "thread_goal",
        config: {
          label: "目标描述",
          style: "paragraph",
          placeholder: "描述这个子区的目标和任务...",
          maxLength: 1000,
          required: true,
        },
      },
      {
        id: "thread_repo",
        config: {
          label: "关联仓库 (可选)",
          style: "short",
          placeholder: "例如: repo-vibeusage, repo-openclaw",
          required: false,
        },
      },
    ],
  });
}

/**
 * 代码审查反馈模态框
 */
export function buildCodeReviewModal(): Record<string, unknown> {
  return buildModalResponse({
    title: "🔍 代码审查反馈",
    inputs: [
      {
        id: "review_type",
        config: {
          label: "审查结果",
          style: "short",
          placeholder: "PASS / BLOCKING / MAJOR / MINOR",
          required: true,
          maxLength: 20,
        },
      },
      {
        id: "review_comment",
        config: {
          label: "审查意见",
          style: "paragraph",
          placeholder: "详细描述你的审查意见...",
          required: true,
          maxLength: 2000,
        },
      },
    ],
  });
}

// ============================================================================
// 媒体画廊 (Media Gallery)
// ============================================================================

export type GalleryImage = {
  url: string;
  description?: string;
  spoiler?: boolean;
};

/**
 * 发送媒体画廊消息
 */
export async function sendMediaGallery(params: {
  cfg: OpenClawConfig;
  channel: string;
  title?: string;
  images: GalleryImage[];
  description?: string;
}): Promise<string | null> {
  let content = params.title ? `## ${params.title}\n` : "";
  if (params.description) {
    content += `${params.description}\n`;
  }

  // Discord 原生不支持真正的媒体画廊，用多个 embed 模拟
  const embeds = params.images.slice(0, 10).map((img, index) => ({
    image: { url: img.url },
    description: img.description ? `${index + 1}. ${img.description}` : undefined,
  }));

  try {
    const result = await callGateway({
      config: params.cfg,
      method: "message.send",
      params: {
        channel: params.channel,
        content: content || undefined,
        embeds,
      },
    });

    if (!result.success) {
      console.error("[GALLERY] Failed:", result.error);
      return null;
    }

    return result.data?.messageId ?? null;
  } catch (err) {
    console.error("[GALLERY] Error:", err);
    return null;
  }
}

// ============================================================================
// 组合组件
// ============================================================================

/**
 * 代码审查界面：按钮 + 选择菜单组合
 */
export async function sendCodeReviewUI(params: {
  cfg: OpenClawConfig;
  channel: string;
  prTitle: string;
  prUrl: string;
}): Promise<string | null> {
  const content = `🔍 **代码审查请求**\n\n**PR:** [${params.prTitle}](${params.prUrl})\n\n请选择审查结果：`;

  const components = [
    {
      type: 1, // ActionRow
      components: [
        {
          type: 2, // Button
          label: "✅ 通过",
          style: 3, // Success
          custom_id: `review:pass:${generateUUID()}`,
        },
        {
          type: 2,
          label: "❌ 拒绝",
          style: 4, // Danger
          custom_id: `review:reject:${generateUUID()}`,
        },
        {
          type: 2,
          label: "📝 详细反馈",
          style: 1, // Primary
          custom_id: `review:modal:${generateUUID()}`,
        },
      ],
    },
    {
      type: 1, // ActionRow
      components: [
        {
          type: 3, // String Select
          custom_id: `review:severity:${generateUUID()}`,
          placeholder: "选择问题严重程度（如拒绝）",
          options: [
            {
              label: "🔴 Blocking - 阻塞性问题",
              value: "blocking",
              description: "必须修复才能合并",
            },
            { label: "🟠 Major - 重要问题", value: "major", description: "建议修复" },
            { label: "🟡 Minor - 次要问题", value: "minor", description: "可选修复" },
            { label: "🟢 Nitpick - 风格问题", value: "nitpick", description: "仅供参考" },
          ],
        },
      ],
    },
  ];

  try {
    const result = await callGateway({
      config: params.cfg,
      method: "message.send",
      params: {
        channel: params.channel,
        content,
        components,
      },
    });

    if (!result.success) {
      console.error("[REVIEW_UI] Failed:", result.error);
      return null;
    }

    return result.data?.messageId ?? null;
  } catch (err) {
    console.error("[REVIEW_UI] Error:", err);
    return null;
  }
}

// Re-export confirmation functions
export { requestConfirmation, confirmDestructive, confirmAccessRequest } from "./confirmation.js";
