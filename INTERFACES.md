# OpenClaw Python 接口契约

> 每个批次完成后由 /done 命令自动更新。
> 新批次开始时由 /start 命令自动读取。
> 最后更新：批次 2（2026-02-13）

---

## openclaw_py.types.base
路径: openclaw_py/types/base.py

```python
from openclaw_py.types import (
    ChatType,
    DmPolicy,
    DmScope,
    GroupPolicy,
    LogLevel,
    MarkdownTableMode,
    ReplyMode,
    ReplyToMode,
    SessionMaintenanceMode,
    SessionResetMode,
    SessionScope,
    SessionSendPolicyAction,
    TypingMode,
    normalize_chat_type,
)
```

### 类型定义

**ChatType**: Literal["direct", "group", "channel"]
- 聊天类型：直接消息、群组、频道

**ReplyMode**: Literal["text", "command"]
- 回复模式

**TypingMode**: Literal["never", "instant", "thinking", "message"]
- 打字状态显示模式

**SessionScope**: Literal["per-sender", "global"]
- 会话作用域

**DmScope**: Literal["main", "per-peer", "per-channel-peer", "per-account-channel-peer"]
- 直接消息作用域

**ReplyToMode**: Literal["off", "first", "all"]
- 回复引用模式

**GroupPolicy**: Literal["open", "disabled", "allowlist"]
- 群组消息策略

**DmPolicy**: Literal["pairing", "allowlist", "open", "disabled"]
- 直接消息策略

**MarkdownTableMode**: Literal["off", "bullets", "code"]
- Markdown 表格渲染模式

**SessionResetMode**: Literal["daily", "idle"]
- 会话重置模式

**SessionSendPolicyAction**: Literal["allow", "deny"]
- 会话发送策略动作

**SessionMaintenanceMode**: Literal["enforce", "warn"]
- 会话维护模式

**LogLevel**: Literal["silent", "fatal", "error", "warn", "info", "debug", "trace"]
- 日志级别

### 函数

```python
def normalize_chat_type(raw: str | None) -> ChatType | None:
    """将字符串规范化为 ChatType。

    - "dm" 会转换为 "direct"
    - 大小写不敏感
    - 自动去除前后空白
    - 无效值返回 None
    """
```

---

## openclaw_py.config

### openclaw_py.config.types
路径: openclaw_py/config/types.py

```python
from openclaw_py.config import (
    OpenClawConfig,
    LoggingConfig,
    SessionConfig,
    TelegramConfig,
    ModelsConfig,
    GatewayConfig,
    IdentityConfig,
    # 以及其他 40+ 配置模型
)
```

**主要配置模型**：

- `OpenClawConfig` - 根配置（包含 logging, session, models, telegram, gateway 等）
- `LoggingConfig` - 日志配置（level, file, console_style 等）
- `SessionConfig` - 会话配置（scope, dm_scope, idle_minutes, maintenance 等）
- `TelegramConfig` - Telegram 配置（bot_token, dm_policy, group_policy, stream_mode 等）
- `ModelsConfig` - AI 模型配置（providers, mode 等）
- `ModelProviderConfig` - 模型提供商配置（base_url, api_key, models 等）
- `ModelDefinitionConfig` - 模型定义（id, name, api, cost 等）
- `GatewayConfig` - Gateway 服务器配置（enabled, host, port, password 等）

所有配置使用 Pydantic v2 BaseModel，支持自动验证和类型检查。

### openclaw_py.config.env_substitution
路径: openclaw_py/config/env_substitution.py

```python
from openclaw_py.config import substitute_env_vars, MissingEnvVarError

def substitute_env_vars(
    obj: Any,
    env: dict[str, str] | None = None,
    config_path: str = "",
) -> Any:
    """递归替换配置中的环境变量。
    
    - 支持 ${VAR_NAME} 语法
    - 支持 $${VAR} 转义为 ${VAR}
    - 只匹配大写字母开头的变量名
    """

class MissingEnvVarError(Exception):
    """环境变量缺失异常"""
    var_name: str
    config_path: str
```

### openclaw_py.config.paths
路径: openclaw_py/config/paths.py

```python
from openclaw_py.config import (
    resolve_config_path,
    resolve_state_dir,
    resolve_home_dir,
    expand_home_prefix,
    ensure_state_dir,
)

def resolve_config_path(env: dict[str, str] | None = None) -> Path:
    """解析配置文件路径（默认: ~/.openclaw/openclaw.yaml）"""

def resolve_state_dir(env: dict[str, str] | None = None) -> Path:
    """解析状态目录（默认: ~/.openclaw）"""

def resolve_home_dir(env: dict[str, str] | None = None) -> Path:
    """解析用户主目录（支持 OPENCLAW_HOME 覆盖）"""

def expand_home_prefix(path: str, env: dict[str, str] | None = None) -> Path:
    """展开 ~ 前缀为用户主目录"""

def ensure_state_dir(env: dict[str, str] | None = None) -> Path:
    """确保状态目录存在（创建如果不存在）"""
```

### openclaw_py.config.loader
路径: openclaw_py/config/loader.py

```python
from openclaw_py.config import (
    load_config_file,
    load_config_sync,
    read_config_file_snapshot,
    parse_config_file,
    ConfigLoadError,
    ConfigParseError,
    ConfigValidationError,
)

async def load_config_file(
    path: str | Path | None = None,
    env: dict[str, str] | None = None,
) -> OpenClawConfig:
    """加载配置文件（支持 YAML/JSON）。
    
    - 自动环境变量替换
    - 应用默认值
    - Pydantic 验证
    """

def load_config_sync(
    path: str | Path | None = None,
    env: dict[str, str] | None = None,
) -> OpenClawConfig:
    """同步版本的 load_config_file"""

async def read_config_file_snapshot(
    path: str | Path | None = None,
    env: dict[str, str] | None = None,
) -> ConfigFileSnapshot:
    """读取配置文件快照（包含原始内容、解析结果、验证结果）"""

def parse_config_file(content: str, format: Literal["yaml", "json"]) -> dict[str, Any]:
    """解析配置文件内容"""

class ConfigLoadError(Exception):
    """配置加载错误基类"""

class ConfigParseError(ConfigLoadError):
    """配置解析错误"""

class ConfigValidationError(ConfigLoadError):
    """配置验证错误"""
    issues: list[ConfigValidationIssue]
```

### openclaw_py.config.defaults
路径: openclaw_py/config/defaults.py

```python
from openclaw_py.config import apply_defaults

def apply_defaults(config: OpenClawConfig) -> OpenClawConfig:
    """应用默认配置值"""
```

---
