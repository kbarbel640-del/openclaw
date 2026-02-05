# clawd/lib - 可重用工具庫

萃取自各專案的可重用模組和工具函數。

## 模組列表

### memory_manager.py
**來源**: `thinker-monorepo/thinker-cli/core/memory.py`

Markdown 格式的記憶管理器，支援：
- 短期記憶 / 長期記憶的雙層結構
- 自動載入和解析 markdown 記憶檔
- 記憶條目的新增和儲存
- 記憶統計和封存功能

```python
from lib.memory_manager import MemoryManager

manager = MemoryManager("memory/user.md")
manager.add_memory_entry("- **14:30** - 完成任務")
stats = manager.get_memory_stats()
```

### persona_loader.py
**來源**: `thinker-monorepo/thinker-cli/core/persona.py`

YAML 格式的 AI 角色載入器，支援：
- 載入和驗證 persona 配置
- 自動生成 System Prompt
- 根據角色偏好過濾記憶
- 取得語調、專業領域、行為規則

```python
from lib.persona_loader import PersonaLoader

loader = PersonaLoader.from_file("prompts/personas/product_manager.yaml")
system_prompt = loader.generate_system_prompt()
tips = loader.get_interaction_tips()
```

### scene_router.py
**來源**: `thinker-monorepo/thinker-cli/scene_router.py`

模組化的場景路由系統，支援：
- YAML 註冊表管理
- 動態模組載入
- 場景搜尋和資訊查詢
- 基礎場景類別 (BaseScene)

```python
from lib.scene_router import SceneRouter, BaseScene

router = SceneRouter("scene_registry.yaml")
available = router.list_available_scenes()
result = router.route_to_scene("vigor_space", context={})
```

## 相關文檔

- [Tesla 發票系統設計](../docs/designs/tesla-invoice-system.md)
- [AI Office 架構設計](../docs/designs/ai-office-architecture.md)
- [Persona 模板](../prompts/personas/)

## 使用原則

1. **獨立性**: 每個模組應該可以獨立使用
2. **文檔化**: 保持完整的 docstring
3. **可測試**: 包含 `if __name__ == '__main__'` 的使用範例
4. **向後相容**: 修改時保持 API 穩定

## 萃取來源

| 模組 | 原始專案 | 原始路徑 |
|------|----------|----------|
| memory_manager.py | thinker-monorepo | thinker-cli/core/memory.py |
| persona_loader.py | thinker-monorepo | thinker-cli/core/persona.py |
| scene_router.py | thinker-monorepo | thinker-cli/scene_router.py |

## 待萃取

以下模組有潛在價值，但需要更多依賴或重構：

- [ ] `InvoiceImageGenerator` - PIL 圖片生成（需要 Pillow）
- [ ] `TeslaAuthManager` - OAuth Token 管理（需要 requests）
- [ ] `VigorMongoAccess` - MongoDB 存取層（需要 pymongo）
- [ ] `CaptchaSolver` - 驗證碼識別（需要 opencv, pytesseract）
