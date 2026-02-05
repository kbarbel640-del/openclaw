"""
Scene Router - 場景路由器
萃取自 thinker-monorepo/thinker-cli/scene_router.py

將 scene 指令路由至對應的語場模組
適用於模組化的 AI 工作流程系統
"""

import importlib
import yaml
from pathlib import Path
from typing import Dict, Any, Optional


class SceneRouter:
    """
    場景路由器
    
    透過 YAML 註冊表管理場景模組，支援動態載入和路由。
    
    使用範例:
        router = SceneRouter("scene_registry.yaml")
        available = router.list_available_scenes()
        result = router.route_to_scene("vigor_space", context={})
    """
    
    def __init__(self, registry_file: str = "scene_registry.yaml"):
        """
        初始化場景路由器
        
        Args:
            registry_file: 場景註冊表 YAML 檔案路徑
        """
        self.registry_file = Path(registry_file)
        self.scene_registry = self._load_scene_registry()
        
    def _load_scene_registry(self) -> Dict[str, Any]:
        """載入場景註冊表"""
        if not self.registry_file.exists():
            # 嘗試從腳本目錄尋找
            script_dir_path = Path(__file__).parent
            alt_registry_path = script_dir_path / self.registry_file.name
            if not alt_registry_path.exists():
                return {}
            self.registry_file = alt_registry_path

        with open(self.registry_file, 'r', encoding='utf-8') as f:
            data = yaml.safe_load(f) or {}
            return data.get('scenes', {})
    
    def route_to_scene(self, scene_name: str, context: Dict[str, Any]) -> Any:
        """
        路由到指定場景
        
        Args:
            scene_name: 場景名稱
            context: 傳遞給場景的上下文
            
        Returns:
            場景執行結果
        """
        scene_config = self.scene_registry.get(scene_name)
        
        if not scene_config:
            raise ValueError(f"Scene '{scene_name}' not found in registry")
        
        module_path = scene_config.get('module_path')
        scene_class = scene_config.get('scene_class')
        
        if not module_path or not scene_class:
            raise ValueError(f"Invalid scene configuration for '{scene_name}'")
        
        try:
            # 動態載入場景模組
            module = importlib.import_module(module_path)
            target_to_run = getattr(module, scene_class)
            
            # 判斷目標是類別還是函式
            if isinstance(target_to_run, type):
                scene_instance = target_to_run(context)
                return scene_instance.execute()
            else:
                return target_to_run(context)
            
        except ImportError as e:
            raise ImportError(f"Failed to import scene module '{module_path}': {e}")
        except AttributeError as e:
            raise AttributeError(f"Scene class or function '{scene_class}' not found in module '{module_path}': {e}")
    
    def list_available_scenes(self) -> Dict[str, str]:
        """
        列出所有可用場景
        
        Returns:
            場景名稱到描述的映射
        """
        return {
            scene_name: config.get('description', 'No description available')
            for scene_name, config in self.scene_registry.items()
        }
    
    def get_scene_info(self, scene_name: str) -> Optional[Dict[str, Any]]:
        """
        取得特定場景資訊
        
        Args:
            scene_name: 場景名稱
            
        Returns:
            場景配置字典，或 None
        """
        return self.scene_registry.get(scene_name)
    
    def get_scenes_by_keyword(self, keyword: str) -> Dict[str, Any]:
        """
        根據關鍵字搜尋場景
        
        Args:
            keyword: 搜尋關鍵字
            
        Returns:
            符合的場景配置
        """
        results = {}
        for scene_name, config in self.scene_registry.items():
            keywords = config.get('keywords', [])
            if keyword in keywords or keyword.lower() in scene_name.lower():
                results[scene_name] = config
        return results
    
    def get_active_scenes(self) -> Dict[str, Any]:
        """
        取得所有啟用的場景
        
        Returns:
            啟用的場景配置
        """
        return {
            name: config 
            for name, config in self.scene_registry.items() 
            if config.get('active', True)
        }


# 場景基礎類別
class BaseScene:
    """
    場景基礎類別
    
    所有場景應繼承此類別並實作 execute 方法
    """
    
    def __init__(self, context: Dict[str, Any] = None):
        """
        初始化場景
        
        Args:
            context: 場景上下文
        """
        self.context = context or {}
    
    def execute(self) -> Dict[str, Any]:
        """
        執行場景邏輯
        
        Returns:
            執行結果
        """
        raise NotImplementedError("Subclasses must implement execute()")
    
    def validate_context(self, required_keys: list) -> bool:
        """
        驗證上下文包含必要的鍵
        
        Args:
            required_keys: 必要的鍵列表
            
        Returns:
            是否驗證通過
        """
        missing = [key for key in required_keys if key not in self.context]
        if missing:
            raise ValueError(f"Missing required context keys: {missing}")
        return True


if __name__ == '__main__':
    # 使用範例
    print("SceneRouter 使用範例")
    print("=" * 40)
    
    # 建立範例註冊表
    sample_registry = {
        'scenes': {
            'example_scene': {
                'name': 'Example Scene',
                'description': '範例場景',
                'module_path': 'scenes.example',
                'scene_class': 'ExampleScene',
                'keywords': ['example', 'demo'],
                'active': True
            }
        }
    }
    
    # 寫入臨時檔案
    import tempfile
    import os
    
    with tempfile.NamedTemporaryFile(mode='w', suffix='.yaml', delete=False) as f:
        yaml.dump(sample_registry, f)
        temp_file = f.name
    
    try:
        router = SceneRouter(temp_file)
        print(f"Available scenes: {router.list_available_scenes()}")
    finally:
        os.unlink(temp_file)
