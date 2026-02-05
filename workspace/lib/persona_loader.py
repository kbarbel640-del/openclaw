"""
Persona Loader - 角色載入模組
萃取自 thinker-monorepo/thinker-cli/core/persona.py

負責載入、解析 YAML 格式的角色定義檔案
用於 AI Agent 的角色配置和 System Prompt 生成
"""

import yaml
from typing import Dict, List, Any, Optional
from pathlib import Path


class PersonaLoader:
    """角色載入器 - 處理 YAML 格式的角色定義檔案"""
    
    def __init__(self, persona_data: Dict[str, Any]):
        """
        初始化角色載入器
        
        Args:
            persona_data: 角色資料字典
        """
        self.data = persona_data
        self._validate_persona_data()
    
    @classmethod
    def load(cls, persona_file: str) -> Dict[str, Any]:
        """
        從檔案載入角色定義
        
        Args:
            persona_file: 角色定義檔案路徑 (YAML格式)
            
        Returns:
            角色資料字典
        """
        try:
            with open(persona_file, 'r', encoding='utf-8') as f:
                data = yaml.safe_load(f)
                return data
        except FileNotFoundError:
            raise FileNotFoundError(f"Persona file not found: {persona_file}")
        except yaml.YAMLError as e:
            raise ValueError(f"Invalid YAML format: {e}")
    
    @classmethod
    def from_file(cls, persona_file: str) -> 'PersonaLoader':
        """
        從檔案創建 PersonaLoader 實例
        
        Args:
            persona_file: 角色定義檔案路徑
            
        Returns:
            PersonaLoader 實例
        """
        data = cls.load(persona_file)
        return cls(data)
    
    def _validate_persona_data(self):
        """驗證角色資料完整性"""
        required_fields = ['name']
        
        for field in required_fields:
            if field not in self.data:
                raise ValueError(f"Missing required field: {field}")
    
    def get_tone_settings(self) -> Dict[str, str]:
        """取得語調設定"""
        tone_data = self.data.get('tone', {})
        if isinstance(tone_data, dict):
            return {
                'style': tone_data.get('style', 'neutral'),
                'response_form': tone_data.get('response_form', ''),
                'decision_mindset': tone_data.get('decision_mindset', '')
            }
        return {
            'tone': tone_data if isinstance(tone_data, str) else 'neutral',
            'language': self.data.get('language', 'zh-TW')
        }
    
    def get_personality_traits(self) -> List[str]:
        """取得性格特質"""
        return self.data.get('personality', [])
    
    def get_behavior_rules(self) -> List[str]:
        """取得行為規則"""
        return self.data.get('behavior_rules', [])
    
    def get_expertise_areas(self) -> List[str]:
        """取得專業領域"""
        return self.data.get('expertise', [])
    
    def get_roles(self) -> List[str]:
        """取得角色列表"""
        return self.data.get('roles', [])
    
    def get_default_tasks(self) -> List[Dict[str, Any]]:
        """取得預設任務"""
        return self.data.get('default_tasks', [])
    
    def generate_system_prompt(self) -> str:
        """生成系統提示詞"""
        name = self.data.get('name', 'Assistant')
        description = self.data.get('description', '')
        archetype = self.data.get('archetype', '')
        personality = self.get_personality_traits()
        behavior_rules = self.get_behavior_rules()
        expertise = self.get_expertise_areas()
        roles = self.get_roles()
        tone = self.get_tone_settings()
        
        prompt_parts = [f"你是 {name}"]
        
        if description:
            prompt_parts.append(f"\n{description}")
        
        if archetype:
            prompt_parts.append(f"\n定位：{archetype}")
        
        if roles:
            prompt_parts.append("\n\n角色職責：")
            for role in roles:
                prompt_parts.append(f"- {role}")
        
        if personality:
            prompt_parts.append("\n\n個性特質：")
            for trait in personality:
                prompt_parts.append(f"- {trait}")
        
        if tone:
            prompt_parts.append("\n\n溝通風格：")
            for key, value in tone.items():
                if value:
                    prompt_parts.append(f"- {key}: {value}")
        
        if behavior_rules:
            prompt_parts.append("\n\n行為規則：")
            for rule in behavior_rules:
                prompt_parts.append(f"- {rule}")
        
        if expertise:
            prompt_parts.append("\n\n專業領域：")
            for area in expertise:
                prompt_parts.append(f"- {area}")
        
        return "\n".join(prompt_parts)
    
    def filter_memory_by_preferences(self, memory_items: List[str]) -> List[str]:
        """
        根據記憶偏好過濾記憶項目
        
        Args:
            memory_items: 記憶項目列表
            
        Returns:
            過濾後的記憶項目
        """
        memory_prefs = self.data.get('memory_preferences', {})
        short_term_focus = memory_prefs.get('short_term_focus', [])
        long_term_focus = memory_prefs.get('long_term_focus', [])
        memory_focus = self.data.get('memory_focus', [])
        
        focus_keywords = short_term_focus + long_term_focus + memory_focus
        
        if not focus_keywords:
            return memory_items
        
        filtered_items = []
        for item in memory_items:
            if any(keyword in item for keyword in focus_keywords):
                filtered_items.append(item)
        
        return filtered_items
    
    def get_interaction_tips(self) -> List[str]:
        """取得互動提示"""
        return self.data.get('interaction_tips', [])
    
    def get_user_id(self) -> str:
        """取得使用者ID"""
        return self.data.get('user_id', 'unknown')
    
    def get_name(self) -> str:
        """取得角色名稱"""
        return self.data.get('name', 'Assistant')
    
    def get_symbol(self) -> str:
        """取得角色符號/emoji"""
        return self.data.get('symbol', '🤖')
    
    def to_dict(self) -> Dict[str, Any]:
        """轉換為字典格式"""
        return self.data.copy()


if __name__ == '__main__':
    # 使用範例
    sample_persona = {
        'name': '木 - 產品經理',
        'symbol': '🌱',
        'description': '一位具備使用者洞察與結構思維的產品經理',
        'archetype': '語場設計者 / Intent 規劃師',
        'roles': ['product_manager', 'user_experience_designer'],
        'tone': {
            'style': '條理清晰、使用者導向',
            'response_form': '以使用者語言思考'
        }
    }
    
    loader = PersonaLoader(sample_persona)
    print(loader.generate_system_prompt())
