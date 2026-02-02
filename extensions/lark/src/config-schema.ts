import { Type } from "@sinclair/typebox";
import { DmConfigSchema, GroupPolicySchema } from "openclaw/plugin-sdk";

/**
 * 飞书账号配置 Schema
 */
export const LarkAccountConfigSchema = Type.Object({
  // 认证配置
  appId: Type.Optional(Type.String({ description: "飞书应用 ID" })),
  appSecret: Type.Optional(Type.String({ description: "飞书应用密钥" })),
  encryptKey: Type.Optional(Type.String({ description: "事件订阅加密密钥" })),
  verificationToken: Type.Optional(Type.String({ description: "验证 Token" })),

  // 基础配置
  enabled: Type.Optional(Type.Boolean({ description: "是否启用" })),
  name: Type.Optional(Type.String({ description: "账号名称" })),

  // 安全策略
  allowFrom: Type.Optional(
    Type.Array(Type.String(), { description: "允许的用户 OpenID 列表" }),
  ),
  groupAllowFrom: Type.Optional(
    Type.Array(Type.String(), { description: "允许的群组 ID 列表" }),
  ),
  dmPolicy: Type.Optional(
    Type.Union(
      [Type.Literal("pairing"), Type.Literal("open"), Type.Literal("allowlist")],
      { description: "私聊策略", default: "pairing" },
    ),
  ),
  groupPolicy: Type.Optional(GroupPolicySchema),

  // Webhook 配置
  webhookPath: Type.Optional(Type.String({ description: "Webhook 路径" })),

  // 群组配置
  groups: Type.Optional(
    Type.Record(
      Type.String(),
      Type.Object({
        requireMention: Type.Optional(
          Type.Boolean({ description: "是否需要在群聊中 @机器人" }),
        ),
      }),
      { description: "群组特定配置" },
    ),
  ),

  // DM 配置
  dm: Type.Optional(DmConfigSchema),
});

/**
 * 飞书频道配置 Schema
 */
export const LarkConfigSchema = Type.Object({
  // 默认账号配置（与 LarkAccountConfigSchema 相同字段）
  appId: Type.Optional(Type.String()),
  appSecret: Type.Optional(Type.String()),
  encryptKey: Type.Optional(Type.String()),
  verificationToken: Type.Optional(Type.String()),
  enabled: Type.Optional(Type.Boolean()),
  name: Type.Optional(Type.String()),
  allowFrom: Type.Optional(Type.Array(Type.String())),
  groupAllowFrom: Type.Optional(Type.Array(Type.String())),
  dmPolicy: Type.Optional(
    Type.Union([Type.Literal("pairing"), Type.Literal("open"), Type.Literal("allowlist")]),
  ),
  groupPolicy: Type.Optional(GroupPolicySchema),
  webhookPath: Type.Optional(Type.String()),
  groups: Type.Optional(
    Type.Record(
      Type.String(),
      Type.Object({
        requireMention: Type.Optional(Type.Boolean()),
      }),
    ),
  ),
  dm: Type.Optional(DmConfigSchema),

  // 多账号配置
  accounts: Type.Optional(Type.Record(Type.String(), LarkAccountConfigSchema)),
});
