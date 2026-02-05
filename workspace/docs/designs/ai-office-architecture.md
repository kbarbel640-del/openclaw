# AI Office 架構設計

萃取自 `thinker-monorepo/thinker-cafe-workspace/` 和 `thinker-cli/`

## 概述

AI Office 是一個模組化的 AI 工作空間系統，核心概念是「語場」(Scene) - 每個語場代表一個特定的工作情境，包含專屬的記憶、角色和任務。

## 核心架構

```
┌──────────────────────────────────────────────────────┐
│                    Scene Router                       │
│  (根據命令或上下文路由到對應語場)                      │
└──────────────────┬───────────────────────────────────┘
                   │
     ┌─────────────┼─────────────┐
     ▼             ▼             ▼
┌─────────┐  ┌─────────┐  ┌─────────┐
│ Vigor   │  │ HR      │  │ Mingli  │
│ Space   │  │ Space   │  │ Space   │
└────┬────┘  └────┬────┘  └────┬────┘
     │            │            │
     ▼            ▼            ▼
┌─────────────────────────────────────┐
│           Core Modules              │
│  ┌──────────┐  ┌──────────────┐    │
│  │ Memory   │  │   Persona    │    │
│  │ Manager  │  │   Loader     │    │
│  └──────────┘  └──────────────┘    │
└─────────────────────────────────────┘
```

## 場景註冊表 (scene_registry.yaml)

場景註冊表是系統的核心配置，定義了所有可用的場景及其屬性。

### 結構

```yaml
version: "1.0"
registry_name: "thinker-cafe-workspace"

global_settings:
  default_memory_format: "markdown"
  context_injection: true
  persona_binding: true
  memory_persistence: true

scenes:
  vigor_space:
    name: "Vigor Space"
    description: "AI自動化服務平台開發場景"
    path: "thinker-cafe-workspace/scenes/vigor_space"
    module_path: "scenes.vigor_space.__main__"
    scene_class: "run"
    memory_file: "thinker-cafe-workspace/memory/vigor.md"
    context_config: "thinker-cafe-workspace/context/vigor_context.yaml"
    keywords: ["automation", "data_scraping", "scheduling"]
    modules: ["data_collection", "routing_planner", "billing_automation"]
    platforms: ["udrive", "tesla", "etag", "google_sheets"]
    personas: ["product_manager", "developer", "data_engineer"]
    active: true
    priority: 1

personas:
  product_manager:
    name: "產品經理"
    personality_file: "persona/product_manager.yaml"
    skills: ["product_planning", "user_research", "feature_design"]

routing:
  default_scene: "cli-init"
  fallback_scene: "cli-init"
  commands:
    vigor: "vigor_space"
    hr: "hr_space"
```

### 關鍵配置

| 欄位 | 說明 |
|------|------|
| `module_path` | Python 模組路徑，用於動態載入 |
| `scene_class` | 場景類別或函數名稱 |
| `memory_file` | 專屬記憶檔案位置 |
| `context_config` | 場景上下文配置 |
| `keywords` | 搜尋關鍵字 |
| `personas` | 可用的角色列表 |
| `active` | 是否啟用 |
| `priority` | 優先級（數字越小越高） |

## 記憶系統 (Memory System)

### 設計原則

1. **Markdown 格式**：人類可讀，易於編輯
2. **雙層結構**：短期記憶 + 長期記憶
3. **自動封存**：超過閾值自動歸檔

### 記憶檔案結構

```markdown
# User Memory Log

## 短期記憶 (Short-term Memory)
### 2025-07-03
- **14:10** - 完成功能開發
- **14:15** - 執行測試

## 長期記憶 (Long-term Memory)
### 技術偏好
- Python 開發
- TDD 實踐

### 專案資訊
- 負責 Vigor 專案
```

### 記憶管理器 API

```python
manager = MemoryManager("memory/user.md")

# 讀取記憶
short_term = manager.get_short_term_memory()
long_term = manager.get_long_term_memory()

# 新增記憶
manager.add_memory_entry("- **15:00** - 完成重構", "short_term")

# 檢查是否需要封存
if manager.should_archive():
    manager.archive_old_memories(days_threshold=7)
```

## Persona 系統

### 設計理念

Persona 是 AI 的「角色設定」，決定了回應風格、專業領域和行為規則。

### Persona 定義格式

```yaml
name: "木 - 產品經理"
symbol: "🌱"
description: |
  一位具備使用者洞察與結構思維的產品經理，
  專精於規劃自然語言意圖與對話流程。

archetype: "語場設計者 / Intent 規劃師"

roles:
  - product_manager
  - user_experience_designer
  - conversational_planner

tone:
  style: "條理清晰、使用者導向、帶有成長感"
  response_form: "以使用者語言思考，將需求轉換成模組與任務定義"
  decision_mindset: "關注意圖覆蓋率、語意清晰度與使用頻率排序"

default_tasks:
  - name: "定義使用者意圖"
    trigger: ["我想新增一個新功能", "使用者會怎麼問這個？"]
    action: "從語句中萃取出使用者背後的意圖與關鍵實體"

memory_focus:
  - /thinker-cli/core/semantic_parser.py

interaction_tips:
  - "請用使用者的語氣幫我拆解這句話的意圖。"
  - "你認為這句話應該屬於哪一個 intent？"
```

### System Prompt 生成

PersonaLoader 可以自動將 YAML 配置轉換為 System Prompt：

```python
loader = PersonaLoader.from_file("persona/product_manager.yaml")
system_prompt = loader.generate_system_prompt()
```

輸出範例：
```
你是 木 - 產品經理

一位具備使用者洞察與結構思維的產品經理...

定位：語場設計者 / Intent 規劃師

角色職責：
- product_manager
- user_experience_designer

溝通風格：
- style: 條理清晰、使用者導向
- response_form: 以使用者語言思考
```

## 場景路由 (Scene Routing)

### 路由邏輯

```python
router = SceneRouter("scene_registry.yaml")

# 根據命令路由
scene_name = routing_config['commands'].get(user_command)

# 執行場景
result = router.route_to_scene(scene_name, context={
    'user_input': user_message,
    'memory': memory_manager,
    'persona': persona_loader
})
```

### 場景執行

每個場景實作 `execute()` 方法：

```python
class VigorScene(BaseScene):
    def execute(self):
        # 1. 載入場景專屬記憶
        memory = self.context.get('memory')
        
        # 2. 應用 Persona
        persona = self.context.get('persona')
        
        # 3. 執行場景邏輯
        result = self.run_automation_tasks()
        
        # 4. 更新記憶
        memory.add_memory_entry(f"- 執行了 {self.__class__.__name__}")
        
        return result
```

## 目錄結構

```
thinker-cafe-workspace/
├── scenes/                 # 場景模組
│   ├── vigor_space/       # Vigor 自動化場景
│   │   ├── tesla/         # Tesla 相關功能
│   │   └── utils/         # 工具模組
│   ├── hr_space/          # HR 人資場景
│   └── mingli_space/      # 命理專案場景
├── memory/                 # 記憶檔案
│   ├── vigor.md
│   └── hr.md
├── persona/               # 角色定義
│   └── product_manager.yaml
├── context/               # 場景上下文
└── ai-office/             # AI 辦公室成員
    ├── cruz/
    ├── avery/
    └── vivian/
```

## 擴展指南

### 新增場景

1. 在 `scenes/` 建立場景目錄
2. 實作場景類別或函數
3. 在 `scene_registry.yaml` 註冊場景
4. 建立對應的記憶檔案和 context 配置

### 新增角色

1. 在 `persona/` 建立 YAML 檔案
2. 定義 name、roles、tone、default_tasks
3. 在 scene_registry.yaml 的 personas 區塊註冊
4. 在場景配置中指定可用角色
