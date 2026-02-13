# 迁移日志

> 每批次完成后由 /done 命令自动追加。

---

## 批次 1：项目骨架 + 核心类型（2026-02-13）

**新增文件**：
- openclaw_py/types/base.py - 核心基础类型定义
- openclaw_py/types/__init__.py - 类型模块导出
- openclaw_py/__init__.py - 包根模块
- tests/types/test_base.py - 核心类型单元测试

**核心变更**：
- 创建了 openclaw_py/ 项目目录结构（types, config, logging, utils, sessions, gateway, agents, channels, routing, users, cli）
- 定义了 14 个核心基础类型（ChatType, ReplyMode, TypingMode, SessionScope, DmScope, ReplyToMode, GroupPolicy, DmPolicy, MarkdownTableMode, SessionResetMode, SessionSendPolicyAction, SessionMaintenanceMode, LogLevel）
- 实现了 normalize_chat_type() 辅助函数（支持 "dm" -> "direct" 别名转换）
- 使用 typing.Literal 替代 TypeScript 的联合类型，保持类型安全
- 配置 Poetry 依赖管理（Python 3.13, Pydantic v2, aiogram 3.x, FastAPI, anthropic SDK, openai SDK, litellm）

**依赖的已有模块**：
- 无（批次 1 是基础，无依赖）

**已知问题**：
- 无

**测试结果**：22 passed

---
## 批次 2：配置系统（2026-02-13）

**新增文件**：
- openclaw_py/config/types.py - 配置 Pydantic 模型（OpenClawConfig, LoggingConfig, SessionConfig, TelegramConfig, ModelsConfig 等 40+ 模型）
- openclaw_py/config/env_substitution.py - 环境变量替换（支持 ${VAR} 语法和 $${} 转义）
- openclaw_py/config/paths.py - 配置文件和状态目录路径解析
- openclaw_py/config/defaults.py - 默认配置值应用
- openclaw_py/config/loader.py - 配置加载器（支持 YAML/JSON，自动环境变量替换和验证）
- openclaw_py/config/__init__.py - 配置模块导出
- tests/config/test_types.py - 配置类型验证测试（28 个测试）
- tests/config/test_env_substitution.py - 环境变量替换测试（16 个测试）
- tests/config/test_paths.py - 路径解析测试（16 个测试）
- tests/config/test_loader.py - 配置加载测试（20 个测试）

**核心变更**：
- 使用 Pydantic v2 定义完整的配置系统（40+ 配置模型）
- 实现环境变量替换功能（${VAR_NAME} 语法，支持转义和递归处理）
- 实现配置文件加载器（支持 YAML/JSON 格式）
- 支持配置路径自定义（OPENCLAW_CONFIG, OPENCLAW_STATE_DIR, OPENCLAW_HOME 环境变量）
- 实现配置快照功能（ConfigFileSnapshot，包含原始内容、解析结果、验证结果）
- 配置验证失败时提供详细错误信息（ConfigValidationError, MissingEnvVarError）
- 简化配置结构（仅保留 Telegram 频道，移除 Discord/Slack/Signal 等其他频道配置）
- 所有配置支持默认值自动应用

**依赖的已有模块**：
- openclaw_py.types.base - 核心枚举类型（ChatType, LogLevel, SessionScope, DmPolicy, GroupPolicy 等）

**已知问题**：
- 无

**测试结果**：80 passed（批次 2）+ 22 passed（批次 1）= 102 passed

---

## 批次 3：日志 + 工具函数（2026-02-13）

**新增文件**：
- openclaw_py/logging/logger.py - 基于 loguru 的日志系统（支持文件/控制台输出，自动轮转和压缩）
- openclaw_py/logging/__init__.py - 日志模块导出
- openclaw_py/utils/common.py - 通用工具函数（文件系统、数字、字符串、JSON、类型守卫）
- openclaw_py/utils/__init__.py - 工具模块导出
- tests/logging/test_logger.py - 日志系统测试（17 个测试）
- tests/utils/test_common.py - 工具函数测试（34 个测试）

**核心变更**：
- 使用 loguru 替代 TypeScript 的 tslog，实现日志系统
- 支持 7 种日志级别：silent, fatal, error, warn, info, debug, trace
- 支持 3 种控制台样式：pretty（彩色输出）, compact（紧凑格式）, json（JSON 格式）
- 自动日志轮转（10 MB）和压缩（保留 7 天，zip 格式）
- 默认日志路径：~/.openclaw/logs/openclaw.log
- 实现了 10 个通用工具函数：
  - 文件系统：ensure_dir, path_exists
  - 数字：clamp, clamp_int, clamp_number
  - 字符串：escape_regexp, normalize_path
  - JSON：safe_parse_json
  - 类型守卫：is_plain_object, is_record
- 简化了 TypeScript 版本的复杂功能（移除子系统日志、控制台捕获等）

**依赖的已有模块**：
- openclaw_py.config.types - LoggingConfig 配置模型

**已知问题**：
- 无

**测试结果**：153 passed（51 new + 102 from previous batches）

---
